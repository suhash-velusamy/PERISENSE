const mongoose = require('mongoose');

/**
 * Stage 12 — a rescue-delivery reroute: the Vendor's decision to send the
 * vehicle to a Rescue Sale's selected buyer instead of (in addition to,
 * chronologically) the shipment's original destination.
 *
 * Deliberately NOT a second Shipment — it references the existing Shipment
 * and RescueSale, and never duplicates their fields beyond the immutable
 * snapshots needed for audit (originalDestination, rescueDestination,
 * route) — see Phase 5/7. Vendor decides; Driver acknowledges and executes
 * (no business-level reject — see reportIssue below, server/services/
 * rerouteService.js).
 */
const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
}, { _id: false });

const routeSchema = new mongoose.Schema({
  polyline: { type: [[Number]], default: [] }, // [[lat, lng], ...]
  distanceKm: { type: Number, required: true, min: 0 },
  durationMinutes: { type: Number, required: true, min: 0 },
  provider: { type: String, default: 'openrouteservice' },
}, { _id: false });

const rerouteRequestSchema = new mongoose.Schema({
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
  rescueSale: { type: mongoose.Schema.Types.ObjectId, ref: 'RescueSale', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
  vehicle: { type: Number, ref: 'Vehicle', required: true },

  // Immutable snapshots taken at confirmation time — never recomputed in
  // place, so this document remains an honest audit record even if the
  // shipment's own fields change later.
  originalDestination: { type: locationSchema, required: true },
  rescueDestination: { type: locationSchema, required: true },
  // Human-readable label only (e.g. "Salem, Tamil Nadu") — never the raw
  // customer coordinates are exposed to a client from this field's name;
  // rescueDestination above is stored for backend use (route recompute,
  // driver map rendering) but API responses expose it only as part of the
  // route geometry / this label, per Phase 4/8/22 — see rerouteService.js.
  destinationLabel: { type: String, default: null },
  route: { type: routeSchema, required: true },

  status: {
    type: String,
    enum: [
      'VENDOR_CONFIRMED',
      'DRIVER_NOTIFIED',
      'DRIVER_ACKNOWLEDGED', // transient in practice — acknowledge() moves straight to ACTIVE, but the value is kept in the enum for clarity/history queries
      'ACTIVE',
      'ISSUE_REPORTED',
      'COMPLETED',
      'CANCELLED',
    ],
    default: 'VENDOR_CONFIRMED',
  },

  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },

  issueReportedAt: { type: Date, default: null },
  issueReason: { type: String, default: null, maxlength: 500 },

  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'RerouteRequest',
});

rerouteRequestSchema.index({ shipment: 1, status: 1 });
rerouteRequestSchema.index({ vendor: 1, status: 1 });
rerouteRequestSchema.index({ driver: 1, status: 1 });
rerouteRequestSchema.index({ rescueSale: 1 });

const RerouteRequest = mongoose.model('RerouteRequest', rerouteRequestSchema);
module.exports = RerouteRequest;
