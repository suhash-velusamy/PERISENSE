// models/Vehicle.js
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true,
    unique: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  capacity: {
    type: String,
    required: true,
    trim: true
  },
  // Optional as of the Fleet Device Architecture stage — a vehicle can now
  // exist without a device (added at creation, or later via Assign
  // Device). `sparse: true` is required alongside `unique: true` so that
  // multiple vehicles with no device don't collide on a shared `null` in
  // the unique index — only documents that actually have this field set
  // participate in the uniqueness check.
  deviceId: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true
  },

  // Back-reference to the standing driver assignment. Driver.vehicle is
  // the forward direction (set by POST /assign-driver-vehicle); this is
  // the convenience back-ref, same pattern as `device` below.
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },

  // Back-reference to the owning vendor. Vendor.vehicles already tracks the
  // forward direction; this lets a Vehicle be looked up without going
  // through its vendor first, and lets validation confirm the two agree.
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },

  // Direct ObjectId link to the Device, resolved at creation time from
  // deviceId (which stays authoritative for the external IoT writer that
  // matches on Device.deviceName — this field is a convenience, not a
  // replacement).
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },

  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, {timestamps: true,
   collection: 'Vehicle' });

vehicleSchema.index({ vendor: 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;
