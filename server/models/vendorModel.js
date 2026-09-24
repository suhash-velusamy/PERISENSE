const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  mobileNo: { type: String, required: true },
  password: { type: String, required: true },
  businessName: { type: String, required: true },
  state: { type: String, required: true },
  district: { type: String, required: true },

  // Existing field: array of Driver ObjectIds
  drivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: [] }],

  // 🔹 New field: array of Vehicle ObjectIds
  vehicles: [{ type: Number, ref: 'Vehicle', default: [] }],

  // Push notification token
  expoPushToken: { type: String, default: null }

}, {
  timestamps: true,
  collection: 'Vendor'
});

// No separate .index({username:1}) / .index({email:1}) — `unique: true`
// on those fields above already creates that index; declaring both
// produced a duplicate-index warning at startup.

// Hash password before saving
vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Hide password when sending JSON (mirrors Driver's existing toJSON — this
// was previously missing here, so login/profile responses leaked the
// bcrypt hash to the client).
vendorSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;
