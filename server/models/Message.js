const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  vendorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  // Either customerId or driverId must be present
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: false },
  driverId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Driver',   required: false },

  senderId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  content:    { type: String, required: true },

  timestamp:  { type: Date, default: Date.now }
});

// Add validation to enforce one of customerId or driverId is present
messageSchema.pre('validate', function (next) {
  if (!this.customerId && !this.driverId) {
    return next(new Error('Either customerId or driverId must be provided.'));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
