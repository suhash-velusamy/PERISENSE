const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const sensorDataSchema = new mongoose.Schema({
  humidity: { type: Number, required: true },
  temperature: { type: Number, required: true },
  ethyleneLevel: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  deviceName: { type: String, required: true, unique: true },

  // Ownership: the Vendor who registered this device. deviceName remains
  // the sole join key the external IoT hardware writer and the telemetry
  // read routes use — this field is ownership metadata only, never part of
  // that lookup.
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  deviceLocation: {
    type: [locationSchema],
    default: []
  },

  deviceData: {
    type: [sensorDataSchema],
    default: []
  },

  // ✅ New field: isAssigned (boolean)
  isAssigned: {
    type: Boolean,
    default: false
  },

  // Back-reference to the Vehicle it's mounted on, resolved at assignment
  // time. deviceName remains the authoritative join key for the external
  // IoT writer (Stage 2 audit) — this field is a convenience for backend
  // queries only. Type is Number, not ObjectId — Vehicle._id is a plain
  // Number (see VehicleModel.js), a pre-existing design choice this field
  // must match.
  vehicle: { type: Number, ref: 'Vehicle', default: null },

}, {
  timestamps: true,
  collection: 'Device'
});

deviceSchema.index({ vehicle: 1 });
deviceSchema.index({ vendor: 1, isAssigned: 1 });

const Device = mongoose.model('Device', deviceSchema);
module.exports = Device;
