const mongoose = require('mongoose');

/**
 * Stage 11 — Rescue Marketplace listing. First created as a Stage 4 data
 * foundation (unused by any route until now), extended here with the
 * condition-traceability snapshot and lifecycle this stage requires. No
 * route referenced the old ACTIVE/EXPIRED/SOLD/CANCELLED status values
 * anywhere in the codebase, so replacing them with the stage's
 * DRAFT/PUBLISHED/EXPIRED/CLOSED/CANCELLED lifecycle is a safe, non-breaking
 * change (verified by repo-wide search before editing).
 *
 * A Rescue Sale always traces back to exactly one source Shipment — it is
 * never a standalone marketplace listing (see server/services/
 * rescueService.js for the creation-time validation that enforces this).
 */
const rescueSaleSchema = new mongoose.Schema({
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  itemName: { type: String, required: true },

  availableQuantity: { type: Number, required: true, min: 0 },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'ton', 'liter', 'ml', 'piece', 'box', 'crate', 'dozen'],
  },
  price: { type: Number, required: true, min: 0 },
  description: { type: String, default: null, maxlength: 500 },

  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  // When the vehicle location backing pickupLocation was captured — lets
  // the vendor/customer UI show "as of" instead of implying a live feed.
  pickupLocationTimestamp: { type: Date, default: null },

  // Phase 4: configurable per-sale radius, defaults from
  // server/config/rescueConfig.js (DEFAULT_RESCUE_RADIUS_KM).
  searchRadiusKm: { type: Number, default: 30, min: 0 },

  validUntil: { type: Date, required: true },

  // Phase 23 — a snapshot of the Condition Engine result at creation time,
  // NOT a live link. Deliberately does not duplicate sensor history; just
  // enough for the Vendor/Customer to understand *why* this sale exists.
  conditionStatus: { type: String, enum: ['WARNING', 'CRITICAL'], required: true },
  riskStatus: { type: String, enum: ['MEDIUM', 'HIGH'], required: true },
  conditionReason: { type: String, default: null },
  conditionEvaluatedAt: { type: Date, default: null },

  // Snapshot of how many customers were eligible at publish time (Phase 2
  // "eligibleCustomerCount where appropriate") — not a live count.
  eligibleCustomerCount: { type: Number, default: null, min: 0 },

  // Phase 14 duplicate-notification control: every customer who has been
  // sent a RESCUE_SALE_AVAILABLE push for this sale, so a later re-fetch
  // (e.g. an edit that doesn't materially change eligibility) never
  // re-notifies the same customer.
  notifiedCustomers: [{
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    notifiedAt: { type: Date, default: Date.now },
  }],

  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'EXPIRED', 'CLOSED', 'CANCELLED'],
    default: 'DRAFT',
  },

  // Set once a Vendor selects a buyer (Phase 20). Null while no selection
  // has been made yet, or if quantity/business rules never require one.
  selectedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  selectedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'RescueSale',
});

rescueSaleSchema.index({ pickupLocation: '2dsphere' });
rescueSaleSchema.index({ vendor: 1, status: 1 });
rescueSaleSchema.index({ shipment: 1, status: 1 });

const RescueSale = mongoose.model('RescueSale', rescueSaleSchema);
module.exports = RescueSale;
