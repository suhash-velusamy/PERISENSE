const mongoose = require('mongoose');

/**
 * Product catalog entry. Deliberately minimal in Stage 4 — perishability
 * thresholds are an optional, unpopulated foundation for a future
 * Perishability Engine, not a working feature. No scientific defaults are
 * invented here; every threshold field is null unless a vendor sets it.
 */
const perishabilityConfigSchema = new mongoose.Schema({
  isPerishable: { type: Boolean, default: true },
  shelfLifeHours: { type: Number, default: null, min: 0 },
  optimalTempRangeC: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  optimalHumidityRangePct: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
  },
  notes: { type: String, default: null, maxlength: 1000 },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'ton', 'liter', 'ml', 'piece', 'box', 'crate', 'dozen'],
  },
  description: { type: String, default: null, maxlength: 1000 },

  // Optional — only the vendor who catalogued this product may see/edit it.
  // Left nullable so a future "global" product taxonomy is not precluded.
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },

  perishabilityConfig: { type: perishabilityConfigSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'Product',
});

productSchema.index({ vendor: 1 });
productSchema.index({ category: 1 });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
