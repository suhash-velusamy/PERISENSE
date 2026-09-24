const mongoose = require('mongoose');

/**
 * Extensible notification record. Stage 4 persists notifications for the
 * events that already trigger an Expo push today (job assignment/accept/
 * reject/complete, chat message) so there is a durable in-app history
 * alongside the push. It does not add new triggers (rescue sale, route
 * suggestion) — those enum values exist so later stages don't need a
 * schema migration, but nothing emits them yet.
 *
 * Stage 10 starts emitting IOT_RISK_ALERT from the Condition Engine
 * (server/services/conditionEngine.js) — see shouldFireAlert() there for
 * the escalation/recovery/dedup rules governing when it fires.
 */
const notificationSchema = new mongoose.Schema({
  // Polymorphic recipient — one of Vendor/Driver/Customer.
  recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientModel: { type: String, required: true, enum: ['Vendor', 'Driver', 'Customer'] },

  type: {
    type: String,
    required: true,
    enum: [
      'JOB_ASSIGNED',
      'JOB_ACCEPTED',
      'JOB_REJECTED',
      'SHIPMENT_STATUS_CHANGED',
      'CHAT_MESSAGE',
      // Stage 10:
      'IOT_RISK_ALERT',
      // Stage 11 — emitted by server/services/rescueService.js:
      'RESCUE_SALE_AVAILABLE',
      'CUSTOMER_INTEREST',
      'RESCUE_BUYER_SELECTED',
      // Stage 12 — emitted by server/services/rerouteService.js:
      'REROUTE_ASSIGNED',
      'REROUTE_ACKNOWLEDGED',
      'REROUTE_ISSUE_REPORTED',
      'RESCUE_DELIVERY_COMPLETED',
      // Reserved for a future stage — not emitted yet:
      'ROUTE_SUGGESTION',
    ],
  },

  title: { type: String, required: true },
  message: { type: String, required: true },

  // Polymorphic related-entity link (e.g. a Shipment or Message).
  relatedEntityType: { type: String, enum: ['Shipment', 'Message', 'ServiceRequest', null], default: null },
  relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },

  read: { type: Boolean, default: false },
}, {
  timestamps: true,
  collection: 'Notification',
});

notificationSchema.index({ recipient: 1, recipientModel: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
