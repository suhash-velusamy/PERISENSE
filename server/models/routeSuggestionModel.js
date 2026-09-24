const mongoose = require('mongoose');

/**
 * Data foundation only — Stage 4 does not calculate or suggest routes.
 * No route currently reads or writes this model.
 */
const routeSuggestionSchema = new mongoose.Schema({
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },

  // Freeform until a real routing representation is designed in a later stage.
  originalRoute: { type: mongoose.Schema.Types.Mixed, default: null },
  suggestedRoute: { type: mongoose.Schema.Types.Mixed, default: null },

  distanceKm: { type: Number, default: null, min: 0 },
  estimatedDurationMinutes: { type: Number, default: null, min: 0 },
  reason: { type: String, default: null, maxlength: 500 },

  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
    default: 'PENDING',
  },

  respondedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'RouteSuggestion',
});

routeSuggestionSchema.index({ shipment: 1 });
routeSuggestionSchema.index({ driver: 1, status: 1 });

const RouteSuggestion = mongoose.model('RouteSuggestion', routeSuggestionSchema);
module.exports = RouteSuggestion;
