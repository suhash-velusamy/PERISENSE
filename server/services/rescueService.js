/**
 * Stage 11 — Rescue Marketplace business logic.
 *
 *   Vendor reviews a WARNING/CRITICAL shipment (Stage 10 Condition Engine)
 *         -> creates + publishes a Rescue Sale, location pulled from the
 *            shipment's own vehicle (never vendor-entered)
 *         -> backend finds eligible nearby, opted-in Customers
 *            (geospatial pre-filter + authoritative Haversine distance)
 *         -> eligible Customers are notified (existing Notification system,
 *            de-duplicated)
 *         -> a Customer may express interest (not a purchase)
 *         -> the Vendor sees an interested-buyer list (approximate distance
 *            only, contact info gated behind expressed interest)
 *         -> the Vendor may select one buyer
 *
 * Explicitly out of scope here (later stages): rerouting, delivery
 * completion, payment. See server/config/rescueConfig.js for every
 * configurable threshold used below.
 */
const mongoose = require('mongoose');
const Shipment = require('../models/shipmentModel');
const Vehicle = require('../models/VehicleModel');
const Device = require('../models/deviceModel');
const Vendor = require('../models/vendorModel');
const Customer = require('../models/customerModel');
const RescueSale = require('../models/rescueSaleModel');
const RescueInterest = require('../models/rescueInterestModel');
const logShipmentEvent = require('../utils/logShipmentEvent');
const { createNotification } = require('./notificationService');
const { evaluateShipmentCondition } = require('./conditionEngine');
const {
  DEFAULT_RESCUE_RADIUS_KM,
  RESCUE_ALLOWED_CONDITION_STATUSES,
  RESCUE_ALLOWED_SHIPMENT_STATUSES,
  VEHICLE_LOCATION_STALE_MINUTES,
  CUSTOMER_LOCATION_STALE_DAYS,
  EARTH_RADIUS_KM,
  DISTANCE_EPSILON_KM,
} = require('../config/rescueConfig');

// See DISTANCE_EPSILON_KM in server/config/rescueConfig.js for why this
// isn't a plain `<=`.
const withinRadius = (distanceKm, radiusKm) => distanceKm <= radiusKm + DISTANCE_EPSILON_KM;

class RescueError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ── Distance ────────────────────────────────────────────────────────────

/**
 * Proper great-circle distance (Phase 11) — never a flat lat/lng
 * subtraction. Same EARTH_RADIUS_KM constant the MongoDB $centerSphere
 * pre-filter uses, so this function is always the authoritative answer for
 * the eligibility boundary, not just a display estimate.
 */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// ── Vehicle location (Phase 5) ─────────────────────────────────────────

/**
 * Resolves the shipment's current vehicle location from the same IoT
 * read-side Stage 2/10 already established (Vehicle.deviceId ->
 * Device.deviceLocation). Never fabricates a location and never silently
 * reuses a stale one — the caller must branch on `status`.
 */
async function resolveVehicleLocation(shipment) {
  if (!shipment.vehicle) {
    return { status: 'LOCATION_UNAVAILABLE', latitude: null, longitude: null, timestamp: null };
  }
  const vehicle = await Vehicle.findById(shipment.vehicle);
  if (!vehicle || !vehicle.deviceId) {
    return { status: 'LOCATION_UNAVAILABLE', latitude: null, longitude: null, timestamp: null };
  }
  const device = await Device.findOne({ deviceName: vehicle.deviceId });
  const locations = device?.deviceLocation || [];
  const latest = locations.length > 0 ? locations[locations.length - 1] : null;
  if (!latest || typeof latest.latitude !== 'number' || typeof latest.longitude !== 'number') {
    return { status: 'LOCATION_UNAVAILABLE', latitude: null, longitude: null, timestamp: null };
  }

  const ts = latest.timestamp ? new Date(latest.timestamp) : null;
  const ageMinutes = ts ? (Date.now() - ts.getTime()) / 60000 : Infinity;
  if (!ts || Number.isNaN(ts.getTime()) || ageMinutes > VEHICLE_LOCATION_STALE_MINUTES) {
    return { status: 'LOCATION_STALE', latitude: latest.latitude, longitude: latest.longitude, timestamp: ts };
  }

  return { status: 'LOCATION_AVAILABLE', latitude: latest.latitude, longitude: latest.longitude, timestamp: ts };
}

// ── Lazy expiry ─────────────────────────────────────────────────────────

/**
 * No cron/scheduler exists in this codebase (Stage 10 established the same
 * pattern) and Phase 32 forbids adding new infrastructure for this stage,
 * so expiry is evaluated lazily on every read/mutation that touches a
 * specific sale, mirroring how Stage 10 evaluates condition on read rather
 * than on a timer.
 */
async function expireIfNeeded(rescueSale) {
  if (rescueSale.status === 'PUBLISHED' && rescueSale.validUntil.getTime() <= Date.now()) {
    rescueSale.status = 'EXPIRED';
    await rescueSale.save();
  }
  return rescueSale;
}

// ── Creation (Phase 3, 4, 5, 6) ────────────────────────────────────────

async function createRescueSale(vendorId, shipmentId, payload) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) throw new RescueError('SHIPMENT_NOT_FOUND', 'Shipment not found', 404);
  if (shipment.vendorId.toString() !== vendorId) {
    throw new RescueError('FORBIDDEN', "Access denied. Not your shipment.", 403);
  }
  if (!RESCUE_ALLOWED_SHIPMENT_STATUSES.includes(shipment.status)) {
    throw new RescueError(
      'INVALID_SHIPMENT_STATUS',
      `A Rescue Sale can only be created for a shipment that is ${RESCUE_ALLOWED_SHIPMENT_STATUSES.join('/')}.`,
    );
  }

  const existing = await RescueSale.findOne({ shipment: shipment._id, status: { $in: ['DRAFT', 'PUBLISHED'] } });
  if (existing) {
    throw new RescueError('DUPLICATE_RESCUE_SALE', 'An active Rescue Sale already exists for this shipment.', 409);
  }

  const condition = await evaluateShipmentCondition(shipment._id);
  if (!RESCUE_ALLOWED_CONDITION_STATUSES.includes(condition.conditionStatus)) {
    throw new RescueError(
      'INVALID_CONDITION',
      `A Rescue Sale requires the shipment's condition to be ${RESCUE_ALLOWED_CONDITION_STATUSES.join(' or ')} (currently ${condition.conditionStatus}).`,
    );
  }

  const location = await resolveVehicleLocation(shipment);
  if (location.status !== 'LOCATION_AVAILABLE') {
    throw new RescueError(
      'LOCATION_UNRELIABLE',
      location.status === 'LOCATION_STALE'
        ? 'The vehicle\'s last known location is stale. A Rescue Sale cannot be published without a reliable current location.'
        : "The vehicle's current location is unavailable. A Rescue Sale cannot be published without a reliable current location.",
    );
  }

  const { availableQuantity, unit, price, description, validUntil } = payload;
  if (!(availableQuantity > 0)) throw new RescueError('INVALID_QUANTITY', 'availableQuantity must be greater than 0.');
  if (!(price >= 0)) throw new RescueError('INVALID_PRICE', 'price must be 0 or greater.');
  if (!validUntil || Number.isNaN(new Date(validUntil).getTime()) || new Date(validUntil).getTime() <= Date.now()) {
    throw new RescueError('INVALID_EXPIRY', 'validUntil must be a valid future date/time.');
  }
  const radiusKm = payload.rescueRadiusKm > 0 ? payload.rescueRadiusKm : DEFAULT_RESCUE_RADIUS_KM;

  const riskStatus = condition.conditionStatus === 'CRITICAL' ? 'HIGH' : 'MEDIUM';

  const rescueSale = await RescueSale.create({
    shipment: shipment._id,
    vendor: shipment.vendorId,
    product: shipment.product || null,
    itemName: shipment.itemName,
    availableQuantity,
    unit: unit || shipment.unit || 'kg',
    price,
    description: description || null,
    pickupLocation: { type: 'Point', coordinates: [location.longitude, location.latitude] },
    pickupLocationTimestamp: location.timestamp,
    searchRadiusKm: radiusKm,
    validUntil: new Date(validUntil),
    conditionStatus: condition.conditionStatus,
    riskStatus,
    conditionReason: condition.reason,
    conditionEvaluatedAt: condition.evaluatedAt,
    status: 'PUBLISHED',
  });

  await logShipmentEvent(shipment._id, 'RESCUE_SALE_CREATED', shipment.vendorId, 'Vendor', {
    rescueSaleId: rescueSale._id,
    conditionStatus: condition.conditionStatus,
  });

  const eligible = await findEligibleCustomers(rescueSale);
  rescueSale.eligibleCustomerCount = eligible.length;
  await rescueSale.save();
  await notifyEligibleCustomers(rescueSale, eligible);

  return rescueSale;
}

// ── Eligibility (Phase 7, 8, 9, 10, 11, 32) ────────────────────────────

/**
 * Two-stage lookup: MongoDB's 2dsphere index narrows the candidate set
 * (Phase 32 — no full customer-table scan), then every candidate is
 * re-checked with the authoritative Haversine distance so the eligibility
 * boundary (Phase 11: <=30km eligible, >30km not) is decided by exactly one
 * formula, not by the geospatial index's own internal approximation.
 */
async function findEligibleCustomers(rescueSale) {
  const [lng, lat] = rescueSale.pickupLocation.coordinates;
  const radiusKm = rescueSale.searchRadiusKm || DEFAULT_RESCUE_RADIUS_KM;
  const radiusRadians = radiusKm / EARTH_RADIUS_KM;
  const staleCutoff = new Date(Date.now() - CUSTOMER_LOCATION_STALE_DAYS * 86400000);

  const candidates = await Customer.find({
    rescueOptIn: true,
    location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRadians] } },
    locationUpdatedAt: { $ne: null, $gte: staleCutoff },
  }).select('_id name mobileNo location');

  const eligible = [];
  for (const customer of candidates) {
    const [cLng, cLat] = customer.location.coordinates;
    const distanceKm = haversineDistanceKm(lat, lng, cLat, cLng);
    if (withinRadius(distanceKm, radiusKm)) {
      eligible.push({ customer, distanceKm });
    }
  }
  return eligible;
}

async function notifyEligibleCustomers(rescueSale, eligible) {
  const alreadyNotified = new Set(rescueSale.notifiedCustomers.map((n) => n.customer.toString()));
  const toNotify = eligible.filter((e) => !alreadyNotified.has(e.customer._id.toString()));
  if (toNotify.length === 0) return;

  await Promise.all(toNotify.map(({ customer, distanceKm }) => createNotification({
    recipientId: customer._id,
    recipientModel: 'Customer',
    type: 'RESCUE_SALE_AVAILABLE',
    title: 'Fresh Goods Rescue Opportunity',
    message: `${rescueSale.itemName} is available nearby through a rescue sale, approximately ${distanceKm.toFixed(1)} km away.`,
    relatedEntityType: 'Shipment',
    relatedEntityId: rescueSale.shipment,
    recipientPushToken: customer.expoPushToken,
  })));

  rescueSale.notifiedCustomers.push(...toNotify.map(({ customer }) => ({ customer: customer._id, notifiedAt: new Date() })));
  await rescueSale.save();
}

// ── Active-listing lookup (Browse Goods filtering) ─────────────────────

/**
 * Shipment IDs currently backed by an active (PUBLISHED, not-yet-expired)
 * Rescue Sale — the "does this shipment have a live rescue opportunity"
 * check, with no customer-specific opt-in/location/radius filtering (unlike
 * listPublishedRescueSalesForCustomer above, which is scoped to what one
 * particular customer is eligible to see). Used by the general-purpose
 * Browse Goods listing, which must not require rescueOptIn/location to see
 * that a rescue sale exists at all. Reuses the same lazy-expiry check
 * (expireIfNeeded) as every other rescue-sale read path.
 */
async function listActiveRescueShipmentIds() {
  const candidates = await RescueSale.find({ status: 'PUBLISHED' }).select('shipment status validUntil');
  const activeShipmentIds = [];
  for (const sale of candidates) {
    await expireIfNeeded(sale);
    if (sale.status === 'PUBLISHED') activeShipmentIds.push(sale.shipment);
  }
  return activeShipmentIds;
}

// ── Customer discovery (Phase 12, 22) ──────────────────────────────────

async function listPublishedRescueSalesForCustomer(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer || !customer.rescueOptIn || !customer.location?.coordinates) {
    return [];
  }
  const staleCutoff = new Date(Date.now() - CUSTOMER_LOCATION_STALE_DAYS * 86400000);
  if (!customer.locationUpdatedAt || customer.locationUpdatedAt < staleCutoff) {
    return [];
  }
  const [cLng, cLat] = customer.location.coordinates;

  // RescueSale is a small, actively-curated collection (bounded by active
  // vendor listings, not customer-table scale) — unlike
  // findEligibleCustomers() above, a geospatial pre-filter here isn't
  // needed to satisfy Phase 32; a plain status/expiry filter plus an
  // authoritative per-sale-radius Haversine check is simpler and exact,
  // with no arbitrary outer-bound guess required.
  const candidates = await RescueSale.find({ status: 'PUBLISHED' });

  const visible = [];
  for (const sale of candidates) {
    await expireIfNeeded(sale);
    if (sale.status !== 'PUBLISHED') continue;
    const [sLng, sLat] = sale.pickupLocation.coordinates;
    const distanceKm = haversineDistanceKm(cLat, cLng, sLat, sLng);
    if (withinRadius(distanceKm, sale.searchRadiusKm || DEFAULT_RESCUE_RADIUS_KM)) {
      visible.push(toCustomerListView(sale, distanceKm));
    }
  }
  visible.sort((a, b) => a.approxDistanceKm - b.approxDistanceKm);
  return visible;
}

function toCustomerListView(sale, distanceKm) {
  return {
    _id: sale._id,
    itemName: sale.itemName,
    availableQuantity: sale.availableQuantity,
    unit: sale.unit,
    price: sale.price,
    description: sale.description,
    conditionStatus: sale.conditionStatus,
    riskStatus: sale.riskStatus,
    approxDistanceKm: Math.round(distanceKm * 10) / 10,
    validUntil: sale.validUntil,
    status: sale.status,
  };
}

/**
 * Single-sale customer view. Visible if the sale is currently within the
 * customer's eligibility (published, in range, opted-in, fresh location) OR
 * the customer already has an interest record on it — so expressing
 * interest once doesn't later 404 if the customer's saved location drifts.
 */
async function getRescueSaleForCustomer(customerId, rescueSaleId) {
  const sale = await RescueSale.findById(rescueSaleId);
  if (!sale) throw new RescueError('NOT_FOUND', 'Rescue sale not found', 404);
  await expireIfNeeded(sale);

  const interest = await RescueInterest.findOne({ rescueSale: sale._id, customer: customerId });

  if (sale.status !== 'PUBLISHED' && !interest) {
    throw new RescueError('NOT_FOUND', 'Rescue sale not found', 404);
  }

  if (sale.status === 'PUBLISHED' && !interest) {
    const customer = await Customer.findById(customerId);
    if (!customer?.rescueOptIn || !customer.location?.coordinates) {
      throw new RescueError('FORBIDDEN', 'Not eligible for this rescue sale.', 403);
    }
    const [cLng, cLat] = customer.location.coordinates;
    const [sLng, sLat] = sale.pickupLocation.coordinates;
    const distanceKm = haversineDistanceKm(cLat, cLng, sLat, sLng);
    if (!withinRadius(distanceKm, sale.searchRadiusKm || DEFAULT_RESCUE_RADIUS_KM)) {
      throw new RescueError('FORBIDDEN', 'Not eligible for this rescue sale.', 403);
    }
  }

  const customer = await Customer.findById(customerId).select('location');
  let approxDistanceKm = null;
  if (customer?.location?.coordinates) {
    const [cLng, cLat] = customer.location.coordinates;
    const [sLng, sLat] = sale.pickupLocation.coordinates;
    approxDistanceKm = Math.round(haversineDistanceKm(cLat, cLng, sLat, sLng) * 10) / 10;
  }

  return {
    ...toCustomerListView(sale, approxDistanceKm ?? 0),
    approxDistanceKm,
    myInterestStatus: interest?.status || null,
  };
}

// ── Customer interest (Phase 15, 16, 17) ───────────────────────────────

async function expressInterest(customerId, rescueSaleId) {
  const sale = await RescueSale.findById(rescueSaleId);
  if (!sale) throw new RescueError('NOT_FOUND', 'Rescue sale not found', 404);
  await expireIfNeeded(sale);
  if (sale.status !== 'PUBLISHED') {
    throw new RescueError('SALE_NOT_ACTIVE', 'This rescue sale is no longer active.', 409);
  }

  let interest = await RescueInterest.findOne({ rescueSale: sale._id, customer: customerId });
  const wasAlreadyInterested = interest?.status === 'INTERESTED';

  if (interest) {
    interest.status = 'INTERESTED';
    interest.withdrawnAt = null;
    await interest.save();
  } else {
    interest = await RescueInterest.create({ rescueSale: sale._id, customer: customerId, status: 'INTERESTED' });
  }

  // Phase 14-style dedup applied to the vendor side too: only notify on a
  // genuine new expression of interest, not a repeated identical call.
  if (!wasAlreadyInterested) {
    const [vendor, customer] = await Promise.all([
      Vendor.findById(sale.vendor).select('expoPushToken'),
      Customer.findById(customerId).select('name'),
    ]);
    await createNotification({
      recipientId: sale.vendor,
      recipientModel: 'Vendor',
      type: 'CUSTOMER_INTEREST',
      title: 'Interested buyer',
      message: `${customer?.name || 'A customer'} is interested in your rescue sale for ${sale.itemName}.`,
      relatedEntityType: 'Shipment',
      relatedEntityId: sale.shipment,
      recipientPushToken: vendor?.expoPushToken,
    });
  }

  return interest;
}

async function withdrawInterest(customerId, rescueSaleId) {
  const interest = await RescueInterest.findOne({ rescueSale: rescueSaleId, customer: customerId });
  if (!interest || interest.status === 'WITHDRAWN') {
    throw new RescueError('NOT_FOUND', 'No active interest record found.', 404);
  }
  interest.status = 'WITHDRAWN';
  interest.withdrawnAt = new Date();
  await interest.save();
  return interest;
}

// ── Vendor management (Phase 4, 18, 19, 20, 21, 28) ────────────────────

async function assertVendorOwnsRescueSale(vendorId, rescueSaleId) {
  const sale = await RescueSale.findById(rescueSaleId);
  if (!sale) throw new RescueError('NOT_FOUND', 'Rescue sale not found', 404);
  if (sale.vendor.toString() !== vendorId) {
    throw new RescueError('FORBIDDEN', "Access denied. Not your rescue sale.", 403);
  }
  return sale;
}

async function listVendorRescueSales(vendorId) {
  const sales = await RescueSale.find({ vendor: vendorId }).sort({ createdAt: -1 });
  await Promise.all(sales.map(expireIfNeeded));
  return sales;
}

async function getVendorRescueSale(vendorId, rescueSaleId) {
  const sale = await assertVendorOwnsRescueSale(vendorId, rescueSaleId);
  await expireIfNeeded(sale);
  return sale;
}

async function updateRescueSale(vendorId, rescueSaleId, payload) {
  const sale = await assertVendorOwnsRescueSale(vendorId, rescueSaleId);
  await expireIfNeeded(sale);
  if (!['DRAFT', 'PUBLISHED'].includes(sale.status)) {
    throw new RescueError('SALE_NOT_EDITABLE', 'Only an active rescue sale can be edited.', 409);
  }

  // Deliberately limited to commercial terms — location/shipment/radius are
  // not editable after publish (Phase 5: location must trace to the
  // vehicle, not be arbitrarily re-entered; changing radius after
  // notifications have already gone out would misrepresent who was
  // actually notified — Phase 14).
  if (payload.availableQuantity !== undefined) {
    if (!(payload.availableQuantity > 0)) throw new RescueError('INVALID_QUANTITY', 'availableQuantity must be greater than 0.');
    sale.availableQuantity = payload.availableQuantity;
  }
  if (payload.price !== undefined) {
    if (!(payload.price >= 0)) throw new RescueError('INVALID_PRICE', 'price must be 0 or greater.');
    sale.price = payload.price;
  }
  if (payload.description !== undefined) sale.description = payload.description;
  if (payload.validUntil !== undefined) {
    if (Number.isNaN(new Date(payload.validUntil).getTime()) || new Date(payload.validUntil).getTime() <= Date.now()) {
      throw new RescueError('INVALID_EXPIRY', 'validUntil must be a valid future date/time.');
    }
    sale.validUntil = new Date(payload.validUntil);
  }

  await sale.save();
  return sale;
}

async function cancelRescueSale(vendorId, rescueSaleId) {
  const sale = await assertVendorOwnsRescueSale(vendorId, rescueSaleId);
  await expireIfNeeded(sale);
  if (!['DRAFT', 'PUBLISHED'].includes(sale.status)) {
    throw new RescueError('SALE_NOT_CANCELLABLE', 'Only an active rescue sale can be cancelled.', 409);
  }
  sale.status = 'CANCELLED';
  await sale.save();
  return sale;
}

/**
 * Phase 18/19: approximate distance only, contact info only for customers
 * who have actually expressed interest — never the full eligible list,
 * never exact coordinates.
 */
async function getInterestedBuyers(vendorId, rescueSaleId) {
  const sale = await assertVendorOwnsRescueSale(vendorId, rescueSaleId);
  const interests = await RescueInterest.find({
    rescueSale: sale._id,
    status: { $in: ['INTERESTED', 'SELECTED', 'NOT_SELECTED'] },
  }).populate('customer', 'name mobileNo location');

  const [sLng, sLat] = sale.pickupLocation.coordinates;
  return interests.map((interest) => {
    const c = interest.customer;
    let approxDistanceKm = null;
    if (c?.location?.coordinates) {
      const [cLng, cLat] = c.location.coordinates;
      approxDistanceKm = Math.round(haversineDistanceKm(sLat, sLng, cLat, cLng) * 10) / 10;
    }
    return {
      customerId: c?._id,
      name: c?.name || 'Customer',
      // Contact info only ever included once the customer has expressed
      // interest — never for the wider eligible-but-silent population.
      mobileNo: c?.mobileNo || null,
      approxDistanceKm,
      status: interest.status,
      interestedAt: interest.createdAt,
    };
  });
}

async function selectBuyer(vendorId, rescueSaleId, customerId) {
  const sale = await assertVendorOwnsRescueSale(vendorId, rescueSaleId);
  await expireIfNeeded(sale);
  if (sale.status !== 'PUBLISHED') {
    throw new RescueError('SALE_NOT_ACTIVE', 'Only an active rescue sale can have a buyer selected.', 409);
  }

  const target = await RescueInterest.findOne({ rescueSale: sale._id, customer: customerId, status: 'INTERESTED' });
  if (!target) {
    throw new RescueError('NOT_FOUND', 'No active interest record for this customer on this rescue sale.', 404);
  }

  target.status = 'SELECTED';
  await target.save();

  await RescueInterest.updateMany(
    { rescueSale: sale._id, customer: { $ne: customerId }, status: 'INTERESTED' },
    { $set: { status: 'NOT_SELECTED' } },
  );

  sale.selectedCustomer = customerId;
  sale.selectedAt = new Date();
  await sale.save();

  const customer = await Customer.findById(customerId).select('expoPushToken');
  await createNotification({
    recipientId: customerId,
    recipientModel: 'Customer',
    type: 'RESCUE_BUYER_SELECTED',
    title: 'You were selected!',
    message: `You've been selected as the buyer for ${sale.itemName}. The vendor will be in touch.`,
    relatedEntityType: 'Shipment',
    relatedEntityId: sale.shipment,
    recipientPushToken: customer?.expoPushToken,
  });

  return sale;
}

// ── Customer rescue preferences (Phase 9) ──────────────────────────────

async function setRescuePreferences(customerId, { optIn, latitude, longitude }) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new RescueError('NOT_FOUND', 'Customer not found', 404);

  customer.rescueOptIn = !!optIn;
  if (optIn) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new RescueError('LOCATION_REQUIRED', 'latitude and longitude are required to opt in.');
    }
    customer.location = { type: 'Point', coordinates: [longitude, latitude] };
    customer.locationUpdatedAt = new Date();
  }
  await customer.save();
  return customer;
}

module.exports = {
  RescueError,
  haversineDistanceKm,
  resolveVehicleLocation,
  createRescueSale,
  findEligibleCustomers,
  listActiveRescueShipmentIds,
  listPublishedRescueSalesForCustomer,
  getRescueSaleForCustomer,
  expressInterest,
  withdrawInterest,
  listVendorRescueSales,
  getVendorRescueSale,
  updateRescueSale,
  cancelRescueSale,
  getInterestedBuyers,
  selectBuyer,
  setRescuePreferences,
};
