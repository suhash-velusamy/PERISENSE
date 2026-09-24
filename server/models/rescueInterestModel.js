const mongoose = require('mongoose');

/**
 * Stage 11 — a Customer's expressed willingness to buy from a Rescue Sale.
 * NOT a purchase, reservation, or payment (Phase 15/42). Originally a
 * Stage 4 data foundation (unused by any route); redesigned here around the
 * Phase 16 lifecycle since nothing else in the codebase depended on the old
 * shape (verified by repo-wide search before editing).
 *
 * "Not interested" is intentionally NOT a stored state — Phase 16's status
 * enum has no such value. Dismissing a rescue opportunity in the UI is a
 * local/no-op action; only genuine interest is persisted.
 */
const rescueInterestSchema = new mongoose.Schema({
  rescueSale: { type: mongoose.Schema.Types.ObjectId, ref: 'RescueSale', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  status: {
    type: String,
    enum: ['INTERESTED', 'WITHDRAWN', 'SELECTED', 'NOT_SELECTED', 'EXPIRED'],
    default: 'INTERESTED',
  },

  withdrawnAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'RescueInterest',
});

// Phase 16: one Customer + one Rescue Sale = one interest record, ever.
// Re-expressing interest after withdrawing updates this same document
// (status back to INTERESTED) rather than inserting a duplicate — the
// record itself is the audit trail (Phase 17), not a rolling history.
rescueInterestSchema.index({ rescueSale: 1, customer: 1 }, { unique: true });

const RescueInterest = mongoose.model('RescueInterest', rescueInterestSchema);
module.exports = RescueInterest;
