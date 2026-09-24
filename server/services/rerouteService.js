/**
 * Stage 12 — Smart Rerouting & Rescue Delivery.
 *
 *   RescueSale (selectedCustomer set, Stage 11)
 *         -> Vendor previews a route: current vehicle location (Stage 10/11
 *            resolveVehicleLocation, reused unchanged) -> selected buyer's
 *            location (resolved server-side, never trusted from a client)
 *         -> server-side OpenRouteService route (server/services/
 *            routingService.js)
 *         -> Vendor confirms -> RerouteRequest created, Shipment gets an
 *            ADDITIVE approvedRescueDestination (endLocation is never
 *            touched) -> Driver notified
 *         -> Driver acknowledges (no business-level reject — see
 *            reportIssue) -> reroute becomes ACTIVE
 *         -> existing vehicle tracking (Vehicle/Device/location) continues
 *            unchanged
 *         -> existing Driver "complete" endpoint finishes the shipment;
 *            this module's completeActiveReroute() is called from there to
 *            record that this specific completion was a rescue delivery.
 *
 * Vendor decides; Driver executes. This module never lets a Driver reject
 * the business decision to reroute — only report an operational issue,
 * which notifies the Vendor without automatically touching the route.
 */
const Shipment = require('../models/shipmentModel');
const RescueSale = require('../models/rescueSaleModel');
const Customer = require('../models/customerModel');
const Vendor = require('../models/vendorModel');
const Driver = require('../models/driverModel');
const RerouteRequest = require('../models/rerouteRequestModel');
const logShipmentEvent = require('../utils/logShipmentEvent');
const { createNotification } = require('./notificationService');
const { resolveVehicleLocation } = require('./rescueService');
const { calculateRoute, resolveDestinationLabel, RoutingError } = require('./routingService');
const { RESCUE_ALLOWED_SHIPMENT_STATUSES } = require('../config/rescueConfig');

// A reroute is "in play" for any of these statuses — used to block a
// second conflicting reroute on the same shipment (Phase 18/19).
const ACTIVE_REROUTE_STATUSES = ['VENDOR_CONFIRMED', 'DRIVER_NOTIFIED', 'DRIVER_ACKNOWLEDGED', 'ACTIVE', 'ISSUE_REPORTED'];

class RerouteError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function toClientRoute(reroute) {
  return {
    _id: reroute._id,
    shipment: reroute.shipment,
    rescueSale: reroute.rescueSale,
    status: reroute.status,
    originalDestination: reroute.originalDestination,
    // Route geometry only — the polyline's own endpoint is the destination,
    // which is the "safe route geometry" a map needs to render (Phase 2).
    // No separately-labeled raw customer lat/lng field is ever returned.
    route: reroute.route,
    destinationLabel: reroute.destinationLabel,
    requestedBy: reroute.requestedBy,
    acknowledgedAt: reroute.acknowledgedAt,
    issueReportedAt: reroute.issueReportedAt,
    issueReason: reroute.issueReason,
    completedAt: reroute.completedAt,
    cancelledAt: reroute.cancelledAt,
    createdAt: reroute.createdAt,
    updatedAt: reroute.updatedAt,
  };
}

/**
 * Shared validation for both preview and confirm (Phase 18). Everything
 * here throws a typed RerouteError with a clear code — never a generic
 * 500 for an expected business-rule failure.
 */
async function resolveRerouteContext(vendorId, rescueSaleId) {
  const rescueSale = await RescueSale.findById(rescueSaleId);
  if (!rescueSale) throw new RerouteError('RESCUE_SALE_NOT_FOUND', 'Rescue sale not found.', 404);
  if (rescueSale.vendor.toString() !== vendorId) {
    throw new RerouteError('FORBIDDEN', "Access denied. Not your rescue sale.", 403);
  }
  if (rescueSale.status !== 'PUBLISHED') {
    throw new RerouteError('RESCUE_SALE_NOT_ACTIVE', 'This rescue sale is not currently active.', 409);
  }
  if (!rescueSale.selectedCustomer) {
    throw new RerouteError('NO_BUYER_SELECTED', 'No buyer has been selected for this rescue sale yet.', 400);
  }

  const shipment = await Shipment.findById(rescueSale.shipment);
  if (!shipment) throw new RerouteError('SHIPMENT_NOT_FOUND', 'Shipment not found.', 404);
  if (shipment.vendorId.toString() !== vendorId) {
    // Defense in depth — should already be guaranteed by RescueSale.vendor above.
    throw new RerouteError('FORBIDDEN', 'Access denied. Not your shipment.', 403);
  }
  if (!RESCUE_ALLOWED_SHIPMENT_STATUSES.includes(shipment.status)) {
    throw new RerouteError(
      'INVALID_SHIPMENT_STATUS',
      `A rescue reroute requires the shipment to be ${RESCUE_ALLOWED_SHIPMENT_STATUSES.join('/')}.`,
    );
  }
  if (!shipment.driver) {
    throw new RerouteError('NO_DRIVER_ASSIGNED', 'This shipment has no assigned driver.', 400);
  }
  if (!shipment.vehicle) {
    throw new RerouteError('NO_VEHICLE_ASSIGNED', 'This shipment has no assigned vehicle.', 400);
  }

  const vehicleLoc = await resolveVehicleLocation(shipment);
  if (vehicleLoc.status !== 'LOCATION_AVAILABLE') {
    throw new RerouteError(
      'LOCATION_UNRELIABLE',
      vehicleLoc.status === 'LOCATION_STALE'
        ? "The vehicle's last known location is stale (older than 15 minutes). A reroute cannot be planned without a reliable current location."
        : "The vehicle's current location is unavailable. A reroute cannot be planned without a reliable current location.",
    );
  }

  const buyer = await Customer.findById(rescueSale.selectedCustomer).select('location');
  const buyerCoords = buyer?.location?.coordinates;
  if (!buyer || !Array.isArray(buyerCoords) || buyerCoords.length !== 2) {
    throw new RerouteError('BUYER_LOCATION_UNAVAILABLE', "The selected buyer's location is unavailable.", 400);
  }
  const [buyerLng, buyerLat] = buyerCoords;
  if (!Number.isFinite(buyerLat) || !Number.isFinite(buyerLng)) {
    throw new RerouteError('INVALID_COORDINATES', "The selected buyer's location is invalid.", 400);
  }

  const existingActive = await RerouteRequest.findOne({
    shipment: shipment._id,
    status: { $in: ACTIVE_REROUTE_STATUSES },
  });

  return { rescueSale, shipment, vehicleLoc, buyerLat, buyerLng, existingActive };
}

/**
 * Stateless — no database write. Lets the Vendor see the route, distance,
 * and ETA before committing to anything (Phase 8).
 */
async function previewReroute(vendorId, rescueSaleId) {
  const ctx = await resolveRerouteContext(vendorId, rescueSaleId);

  let route;
  try {
    route = await calculateRoute(
      { latitude: ctx.vehicleLoc.latitude, longitude: ctx.vehicleLoc.longitude },
      { latitude: ctx.buyerLat, longitude: ctx.buyerLng },
    );
  } catch (err) {
    if (err instanceof RoutingError) {
      throw new RerouteError(err.code, err.message, err.code === 'ROUTING_NOT_CONFIGURED' ? 500 : 502);
    }
    throw err;
  }

  const destinationLabel = await resolveDestinationLabel(ctx.buyerLat, ctx.buyerLng).catch(() => null);

  return {
    shipmentId: ctx.shipment._id,
    rescueSaleId: ctx.rescueSale._id,
    itemName: ctx.shipment.itemName,
    originalDestination: ctx.shipment.endLocation,
    route,
    destinationLabel,
    reason: {
      conditionStatus: ctx.rescueSale.conditionStatus,
      riskStatus: ctx.rescueSale.riskStatus,
      conditionReason: ctx.rescueSale.conditionReason,
    },
    conflictingReroute: ctx.existingActive ? { id: ctx.existingActive._id, status: ctx.existingActive.status } : null,
  };
}

/**
 * The Vendor's one-click decision (Phase 9) — no Driver approval gate.
 * Recomputes the route fresh rather than trusting a client-cached preview,
 * so the confirmed route always reflects the vehicle's current location at
 * the moment of confirmation, not whenever the Vendor happened to first
 * open the preview screen.
 */
async function confirmReroute(vendorId, rescueSaleId) {
  const ctx = await resolveRerouteContext(vendorId, rescueSaleId);

  if (ctx.existingActive) {
    throw new RerouteError('REROUTE_ALREADY_EXISTS', 'An active reroute already exists for this shipment.', 409);
  }

  let route;
  try {
    route = await calculateRoute(
      { latitude: ctx.vehicleLoc.latitude, longitude: ctx.vehicleLoc.longitude },
      { latitude: ctx.buyerLat, longitude: ctx.buyerLng },
    );
  } catch (err) {
    if (err instanceof RoutingError) {
      throw new RerouteError(err.code, err.message, err.code === 'ROUTING_NOT_CONFIGURED' ? 500 : 502);
    }
    throw err;
  }
  const destinationLabel = await resolveDestinationLabel(ctx.buyerLat, ctx.buyerLng).catch(() => null);

  // Primary write: the reroute record itself. Must succeed for the
  // confirmation to be considered successful at all.
  const reroute = await RerouteRequest.create({
    shipment: ctx.shipment._id,
    rescueSale: ctx.rescueSale._id,
    vendor: vendorId,
    driver: ctx.shipment.driver,
    vehicle: ctx.shipment.vehicle,
    originalDestination: { latitude: ctx.shipment.endLocation.latitude, longitude: ctx.shipment.endLocation.longitude },
    rescueDestination: { latitude: ctx.buyerLat, longitude: ctx.buyerLng },
    destinationLabel,
    route,
    status: 'VENDOR_CONFIRMED',
    requestedBy: vendorId,
  });

  // Primary write: additive shipment fields. endLocation is never touched.
  ctx.shipment.approvedRescueDestination = { latitude: ctx.buyerLat, longitude: ctx.buyerLng };
  ctx.shipment.activeRerouteRequest = reroute._id;
  await ctx.shipment.save();

  // Secondary writes below (timeline, notification) follow the same
  // best-effort convention already used everywhere else in this codebase
  // (logShipmentEvent/createNotification both already swallow their own
  // errors internally — see server/utils/logShipmentEvent.js and
  // server/services/notificationService.js) rather than a DB transaction,
  // matching the project's existing consistency strategy (documented in
  // the Stage 12 report's Database Changes section — no prior stage uses
  // Mongo transactions, so this doesn't introduce a new pattern).
  await logShipmentEvent(ctx.shipment._id, 'REROUTE_REQUESTED', vendorId, 'Vendor', { rerouteRequestId: reroute._id });
  await logShipmentEvent(ctx.shipment._id, 'REROUTE_CONFIRMED', vendorId, 'Vendor', {
    rerouteRequestId: reroute._id, distanceKm: route.distanceKm, durationMinutes: route.durationMinutes,
  });
  await logShipmentEvent(ctx.shipment._id, 'RESCUE_DESTINATION_APPROVED', vendorId, 'Vendor', { rerouteRequestId: reroute._id });

  const driver = await Driver.findById(ctx.shipment.driver).select('expoPushToken');
  await createNotification({
    recipientId: ctx.shipment.driver,
    recipientModel: 'Driver',
    type: 'REROUTE_ASSIGNED',
    title: 'New Rescue Route Assigned',
    message: `A rescue delivery route has been assigned for ${ctx.shipment.itemName}. Please review and acknowledge.`,
    relatedEntityType: 'Shipment',
    relatedEntityId: ctx.shipment._id,
    recipientPushToken: driver?.expoPushToken,
  });

  reroute.status = 'DRIVER_NOTIFIED';
  await reroute.save();
  await logShipmentEvent(ctx.shipment._id, 'DRIVER_NOTIFIED', null, null, { rerouteRequestId: reroute._id });

  return reroute;
}

async function getRerouteForVendor(vendorId, rescueSaleId) {
  const rescueSale = await RescueSale.findById(rescueSaleId);
  if (!rescueSale) throw new RerouteError('RESCUE_SALE_NOT_FOUND', 'Rescue sale not found.', 404);
  if (rescueSale.vendor.toString() !== vendorId) {
    throw new RerouteError('FORBIDDEN', "Access denied. Not your rescue sale.", 403);
  }
  const reroute = await RerouteRequest.findOne({ rescueSale: rescueSale._id }).sort({ createdAt: -1 });
  return reroute ? toClientRoute(reroute) : null;
}

async function getRerouteForDriver(driverId, shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new RerouteError('SHIPMENT_NOT_FOUND', 'Shipment not found.', 404);
  if (!shipment.driver || shipment.driver.toString() !== driverId) {
    throw new RerouteError('FORBIDDEN', 'Access denied. Not your assigned export.', 403);
  }
  if (!shipment.activeRerouteRequest) return null;
  const reroute = await RerouteRequest.findById(shipment.activeRerouteRequest);
  if (!reroute || reroute.driver.toString() !== driverId) return null;
  return toClientRoute(reroute);
}

/**
 * Phase 11 — no business-level accept/reject; acknowledging is the only
 * Driver action here, and it moves straight to ACTIVE (no lingering
 * "acknowledged but not yet active" limbo — there is nothing else the
 * Driver needs to do to make it active).
 */
async function acknowledgeReroute(driverId, shipmentId) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new RerouteError('SHIPMENT_NOT_FOUND', 'Shipment not found.', 404);
  if (!shipment.driver || shipment.driver.toString() !== driverId) {
    throw new RerouteError('FORBIDDEN', 'Access denied. Not your assigned export.', 403);
  }
  if (!shipment.activeRerouteRequest) {
    throw new RerouteError('NO_ACTIVE_REROUTE', 'There is no reroute to acknowledge for this shipment.', 404);
  }

  const reroute = await RerouteRequest.findById(shipment.activeRerouteRequest);
  if (!reroute || reroute.driver.toString() !== driverId) {
    throw new RerouteError('NO_ACTIVE_REROUTE', 'There is no reroute to acknowledge for this shipment.', 404);
  }

  // Phase 19: already acknowledged (or beyond) -> idempotent no-op, no new
  // transition/event/notification. A retried request should never fail or
  // double-fire side effects.
  if (['ACTIVE', 'ISSUE_REPORTED', 'COMPLETED'].includes(reroute.status)) {
    return toClientRoute(reroute);
  }
  if (reroute.status !== 'DRIVER_NOTIFIED') {
    throw new RerouteError('INVALID_REROUTE_STATE', `Cannot acknowledge a reroute in status ${reroute.status}.`, 409);
  }

  reroute.status = 'ACTIVE';
  reroute.acknowledgedAt = new Date();
  reroute.acknowledgedBy = driverId;
  await reroute.save();

  await logShipmentEvent(shipment._id, 'DRIVER_ACKNOWLEDGED', driverId, 'Driver', { rerouteRequestId: reroute._id });

  const vendor = await Vendor.findById(reroute.vendor).select('expoPushToken');
  await createNotification({
    recipientId: reroute.vendor,
    recipientModel: 'Vendor',
    type: 'REROUTE_ACKNOWLEDGED',
    title: 'Driver acknowledged rescue route',
    message: `Your driver has acknowledged the rescue route for ${shipment.itemName}.`,
    relatedEntityType: 'Shipment',
    relatedEntityId: shipment._id,
    recipientPushToken: vendor?.expoPushToken,
  });

  return toClientRoute(reroute);
}

/**
 * Phase 12 — the ONLY way a Driver can push back on a confirmed reroute.
 * Never changes status back toward the original destination and never
 * cancels anything automatically; the Vendor decides what happens next
 * (outside this stage's scope — see Stage 12 report Remaining Issues).
 */
async function reportIssue(driverId, shipmentId, reason) {
  if (!reason || !reason.trim()) {
    throw new RerouteError('REASON_REQUIRED', 'A reason is required to report an issue.', 400);
  }

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new RerouteError('SHIPMENT_NOT_FOUND', 'Shipment not found.', 404);
  if (!shipment.driver || shipment.driver.toString() !== driverId) {
    throw new RerouteError('FORBIDDEN', 'Access denied. Not your assigned export.', 403);
  }
  if (!shipment.activeRerouteRequest) {
    throw new RerouteError('NO_ACTIVE_REROUTE', 'There is no active reroute for this shipment.', 404);
  }

  const reroute = await RerouteRequest.findById(shipment.activeRerouteRequest);
  if (!reroute || reroute.driver.toString() !== driverId) {
    throw new RerouteError('NO_ACTIVE_REROUTE', 'There is no active reroute for this shipment.', 404);
  }

  if (reroute.status === 'ISSUE_REPORTED') {
    throw new RerouteError('ISSUE_ALREADY_REPORTED', 'An issue has already been reported for this reroute; the vendor has been notified.', 409);
  }
  if (!['DRIVER_NOTIFIED', 'ACTIVE'].includes(reroute.status)) {
    throw new RerouteError('INVALID_REROUTE_STATE', `Cannot report an issue for a reroute in status ${reroute.status}.`, 409);
  }

  reroute.status = 'ISSUE_REPORTED';
  reroute.issueReportedAt = new Date();
  reroute.issueReason = reason.trim();
  await reroute.save();

  // Original destination is untouched — reporting an issue does not
  // reject or auto-cancel the reroute (Phase 12).
  await logShipmentEvent(shipment._id, 'DRIVER_ISSUE_REPORTED', driverId, 'Driver', {
    rerouteRequestId: reroute._id, reason: reroute.issueReason,
  });

  const vendor = await Vendor.findById(reroute.vendor).select('expoPushToken');
  await createNotification({
    recipientId: reroute.vendor,
    recipientModel: 'Vendor',
    type: 'REROUTE_ISSUE_REPORTED',
    title: 'Driver reported an issue',
    message: `Your driver reported an issue with the rescue route for ${shipment.itemName}: ${reroute.issueReason}`,
    relatedEntityType: 'Shipment',
    relatedEntityId: shipment._id,
    recipientPushToken: vendor?.expoPushToken,
  });

  return toClientRoute(reroute);
}

/**
 * Called from the EXISTING driver "complete export" endpoint (Phase 14 —
 * no new completion system). No-op if this shipment has no reroute at all,
 * so every normal (non-rescue) completion is completely unaffected.
 */
async function completeActiveReroute(shipment, driverId) {
  if (!shipment.activeRerouteRequest) return null;
  const reroute = await RerouteRequest.findById(shipment.activeRerouteRequest);
  if (!reroute || ['COMPLETED', 'CANCELLED'].includes(reroute.status)) return null;

  reroute.status = 'COMPLETED';
  reroute.completedAt = new Date();
  await reroute.save();

  await logShipmentEvent(shipment._id, 'RESCUE_DELIVERY_COMPLETED', driverId, 'Driver', { rerouteRequestId: reroute._id });

  const [vendor, buyer] = await Promise.all([
    Vendor.findById(reroute.vendor).select('expoPushToken'),
    RescueSale.findById(reroute.rescueSale).select('selectedCustomer itemName'),
  ]);
  await createNotification({
    recipientId: reroute.vendor,
    recipientModel: 'Vendor',
    type: 'RESCUE_DELIVERY_COMPLETED',
    title: 'Rescue delivery completed',
    message: `The rescue delivery for ${shipment.itemName} has been completed.`,
    relatedEntityType: 'Shipment',
    relatedEntityId: shipment._id,
    recipientPushToken: vendor?.expoPushToken,
  });

  if (buyer?.selectedCustomer) {
    const customer = await Customer.findById(buyer.selectedCustomer).select('expoPushToken');
    await createNotification({
      recipientId: buyer.selectedCustomer,
      recipientModel: 'Customer',
      type: 'RESCUE_DELIVERY_COMPLETED',
      title: 'Rescue delivery completed',
      message: `Your rescue purchase (${shipment.itemName}) has been delivered.`,
      relatedEntityType: 'Shipment',
      relatedEntityId: shipment._id,
      recipientPushToken: customer?.expoPushToken,
    });
  }

  return reroute;
}

/**
 * Called from rescueService.cancelRescueSale (Phase 6 "safe cancellation")
 * so an active reroute never points at a cancelled sale. No-op if there is
 * no non-terminal reroute for this shipment.
 */
async function cancelActiveRerouteForShipment(shipmentId) {
  const reroute = await RerouteRequest.findOne({
    shipment: shipmentId,
    status: { $in: ACTIVE_REROUTE_STATUSES },
  });
  if (!reroute) return null;

  reroute.status = 'CANCELLED';
  reroute.cancelledAt = new Date();
  await reroute.save();

  await logShipmentEvent(shipmentId, 'REROUTE_CANCELLED', null, null, { rerouteRequestId: reroute._id });
  return reroute;
}

module.exports = {
  RerouteError,
  previewReroute,
  confirmReroute,
  getRerouteForVendor,
  getRerouteForDriver,
  acknowledgeReroute,
  reportIssue,
  completeActiveReroute,
  cancelActiveRerouteForShipment,
};
