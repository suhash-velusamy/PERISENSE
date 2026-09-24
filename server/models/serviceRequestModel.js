/**
 * Service Request Model
 * Schema for customer service requests to vendors
 */
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['product_inquiry', 'delivery_issue', 'support', 'feedback', 'other'],
        default: 'other',
    },
    message: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed'],
        default: 'pending',
    },
    response: {
        type: String,
        maxlength: 1000,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update timestamp on save
serviceRequestSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
