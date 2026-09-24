const mongoose = require('mongoose');
const { STATUS_VALUES } = require('../utils/shipmentStateMachine');

// latitude/longitude are the fields every existing screen reads directly.
// `geo` is a derived GeoJSON mirror kept in sync by the pre-validate hook
// below, so future geospatial queries ($near, $geoWithin) have something
// to index without changing the shape the app already consumes.
const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  geo: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
}, { _id: false });

const intermediateLocationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
}, { _id: false });

// Vendor-controlled visibility: a customer may see live tracking only if
// they are the shipment's primary customer, or they appear here with
// allowed: true. See shipmentModel.canCustomerTrack below for the policy
// (including the legacy/no-entries-yet default) applied by routes.
const trackingViewerSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  allowed: { type: Boolean, default: true },
  addedAt: { type: Date, default: Date.now },
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  // Catalog reference is optional so a vendor can still free-text an item
  // name without first creating a Product; itemName is kept as the
  // display value either way (existing screens read it directly).
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  itemName: { type: String, required: true },

  quantity: { type: Number, required: true, min: 0 },
  unit: {
    type: String,
    default: null,
    enum: ['kg', 'g', 'ton', 'liter', 'ml', 'piece', 'box', 'crate', 'dozen', null],
  },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  expectedDropTime: { type: Date, default: null },

  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  vehicle: { type: Number, ref: 'Vehicle', required: true },
  // Convenience direct ref, resolved from vehicle.deviceId at creation time.
  // The IoT read-side still matches on Device.deviceName === Vehicle.deviceId;
  // this field does not change that resolution, it only avoids a second hop
  // for callers that just want "which device is on this shipment".
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },

  // Optional — a shipment is not always tied to one named customer (e.g. a
  // bulk vendor-to-market run). When set, this customer always has tracking
  // access regardless of trackingViewers.
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  trackingViewers: { type: [trackingViewerSchema], default: [] },

  driverSalary: { type: Number, default: null, min: 0 },
  instructions: { type: String, default: null, maxlength: 1000 },

  startLocation: { type: locationSchema, required: true },
  endLocation: { type: locationSchema, required: true },
  intermediateLocations: { type: [intermediateLocationSchema], default: [] },
  routes: { type: [String], default: [] },

  // Stage 12 — additive only. `endLocation` above is NEVER overwritten by a
  // rescue reroute; it remains the shipment's original, historical
  // destination. This field is null until a Vendor confirms a rescue
  // reroute (server/services/rerouteService.js), after which it holds the
  // currently-approved rescue delivery point. Both can be read side by
  // side — original vs. approved-rescue — for tracking/history/UI.
  approvedRescueDestination: { type: locationSchema, default: null },
  // Convenience pointer to the most recent RerouteRequest for this
  // shipment (same "convenience ref, not a replacement" pattern already
  // used by `device` above and by Vehicle.device / Device.vehicle) — the
  // RerouteRequest document itself remains the authoritative record.
  activeRerouteRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'RerouteRequest', default: null },

  status: {
    type: String,
    enum: STATUS_VALUES,
    default: 'ASSIGNED',
  },
  rejectionReason: { type: String, default: null },

  costPrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
}, {
  timestamps: true,
  // Physical collection name intentionally stays 'Export' — this document
  // is the authoritative Shipment/Work entity, but the collection holds
  // real pre-existing data and every route path is /export/... on the
  // wire. See migrateStage4.js for the one-time field migration; renaming
  // the collection itself was judged unnecessary churn for Stage 4.
  collection: 'Export',
});

shipmentSchema.pre('validate', function populateGeoMirror(next) {
  for (const field of ['startLocation', 'endLocation', 'approvedRescueDestination']) {
    const loc = this[field];
    if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      loc.geo = { type: 'Point', coordinates: [loc.longitude, loc.latitude] };
    }
  }
  next();
});

/**
 * Tracking-permission policy used by GET /api/customer/track/:id.
 *
 * Stage 5 product decision (overrides Stage 4's temporary default-open
 * behavior): tracking must be EXPLICITLY granted. Being the shipment's
 * primary `customer` does NOT by itself grant tracking — selecting a
 * customer and granting them tracking are two separate vendor actions.
 * A shipment with no trackingViewers entries is tracked by nobody.
 */
shipmentSchema.methods.canCustomerTrack = function canCustomerTrack(customerId) {
  const id = customerId?.toString();
  if (!id) return false;
  return this.trackingViewers.some(
    (v) => v.customer.toString() === id && v.allowed === true
  );
};

/**
 * Customers who should receive shipment-progress notifications: everyone
 * currently granted tracking access. (Not the primary `customer` alone —
 * same explicit-grant rule as canCustomerTrack.)
 */
shipmentSchema.methods.getNotifiableCustomerIds = function getNotifiableCustomerIds() {
  return this.trackingViewers.filter((v) => v.allowed === true).map((v) => v.customer);
};

/**
 * Strips vendor-operational fields (pricing, driver salary, internal
 * instructions, the tracking permission list itself, internal device ref)
 * before a shipment is sent to a customer. Used by every customer-facing
 * shipment route so "what the customer sees" has one definition instead of
 * being re-decided ad hoc per endpoint.
 *
 * Stage 12: also strips `approvedRescueDestination`/`activeRerouteRequest`.
 * A rescue reroute's destination is the RESCUE BUYER's location — a
 * different person from whoever is tracking this shipment as its original
 * customer (if anyone). Passing it through here would leak one customer's
 * delivery coordinates to another. Original `startLocation`/`endLocation`
 * remain visible as before — those are this shipment's own route.
 */
shipmentSchema.methods.toCustomerView = function toCustomerView() {
  const obj = this.toObject();
  const {
    costPrice, salePrice, driverSalary, instructions,
    trackingViewers, device, rejectionReason,
    approvedRescueDestination, activeRerouteRequest,
    ...customerFacing
  } = obj;
  return customerFacing;
};

shipmentSchema.index({ vendorId: 1, status: 1 });
shipmentSchema.index({ startDate: 1, endDate: 1 });
shipmentSchema.index({ driver: 1 });
shipmentSchema.index({ vehicle: 1 });
shipmentSchema.index({ customer: 1 });
shipmentSchema.index({ createdAt: -1 });
shipmentSchema.index({ 'startLocation.geo': '2dsphere' });
shipmentSchema.index({ 'endLocation.geo': '2dsphere' });

const Shipment = mongoose.model('Shipment', shipmentSchema);
module.exports = Shipment;
