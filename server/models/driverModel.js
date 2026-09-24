const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const durationSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
}, { _id: false });

const workSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  // Ties this embedded record back to the Shipment that created it, so it
  // can be removed precisely when that shipment is deleted. Optional/null
  // on records created before this field existed (Stage 4 and earlier).
  exportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
  workDuration: { type: [durationSchema], required: true },
  salary: { type: Number, required: true },
  isPaid: { type: Boolean, default: false }
}, { _id: false });

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  mobileNo: { type: String, required: true },
  password: { type: String, required: true },
  licenseNo: { type: String, required: true },
  state: { type: String, required: true },
  district: { type: String, required: true },

  // The single Vendor who created/owns this driver (POST /api/vendor/drivers
  // — see vendorRoutes.js). Not `required` at the schema level: a small
  // number of pre-existing accounts were created before this field existed
  // (self-registered, then optionally claimed into a Vendor's `drivers[]`
  // array under the old many-to-many model) and are left untouched rather
  // than migrated; enforcing "always has a vendor" here would break a plain
  // `.save()` on one of those legacy documents (e.g. updating expoPushToken).
  // Every driver created going forward always has this set.
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },

  // ✅ All past work assignments
  work: {
    type: [workSchema],
    default: []
  },

  // ✅ Flat list of all individual dates the driver worked
  workDates: {
    type: [Date],
    default: []
  },

  // Whether the driver can currently be assigned new shipments. Informational
  // only in Stage 4 — no route enforces it yet (availableResources already
  // computes busy-ness from overlapping shipment dates).
  isAvailable: { type: Boolean, default: true },

  // Standing Driver -> Vehicle assignment (independent of per-shipment
  // driver/vehicle selection in Shipment.driver/Shipment.vehicle). Type is
  // Number, not ObjectId, to match Vehicle._id (see VehicleModel.js).
  vehicle: { type: Number, ref: 'Vehicle', default: null },

  // Push notification token
  expoPushToken: { type: String, default: null }

}, {
  timestamps: true,
  collection: 'Driver'
});

// Database indexes for faster queries
// No separate .index({username:1}) / .index({email:1}) — `unique: true`
// on those fields above already creates that index.
driverSchema.index({ vendor: 1 });
driverSchema.index({ vehicle: 1 });

// Hash password before saving
driverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Hide password when sending JSON
driverSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;
