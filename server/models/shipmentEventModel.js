const mongoose = require('mongoose');

/**
 * Append-only timeline for a Shipment. Stage 4 only wires up events for
 * transitions the current routes actually perform (create/assign, accept,
 * reject, start, complete). Event types for not-yet-built features
 * (IoT warnings, rescue sale, route suggestions) are declared here so the
 * schema doesn't need to change again when those stages land, but nothing
 * emits them yet.
 */
const shipmentEventSchema = new mongoose.Schema({
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },

  eventType: {
    type: String,
    required: true,
    enum: [
      'SHIPMENT_CREATED',
      'DRIVER_ASSIGNED',
      'DRIVER_ACCEPTED',
      'DRIVER_REJECTED',
      'DELIVERY_STARTED',
      'DELIVERY_COMPLETED',
      'SHIPMENT_CANCELLED',
      // Stage 10 — emitted by the Condition Engine (server/services/conditionEngine.js):
      'IOT_WARNING',
      'HIGH_RISK_DETECTED',
      'CONDITION_RECOVERED',
      // Stage 11 — emitted by server/services/rescueService.js:
      'RESCUE_SALE_CREATED',
      // Stage 12 — emitted by server/services/rerouteService.js:
      'REROUTE_REQUESTED',
      'REROUTE_CONFIRMED',
      'DRIVER_NOTIFIED',
      'DRIVER_ACKNOWLEDGED',
      'DRIVER_ISSUE_REPORTED',
      'RESCUE_DESTINATION_APPROVED',
      'RESCUE_DELIVERY_COMPLETED',
      'REROUTE_CANCELLED',
      // Reserved for a future stage — not emitted yet:
      'ROUTE_SUGGESTED',
      'ROUTE_ACCEPTED',
      'ROUTE_DECLINED',
    ],
  },

  // Who caused the event. actorModel enables a polymorphic populate via
  // refPath; actor is null for system-generated events (none yet in Stage 4).
  actor: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorModel: { type: String, enum: ['Vendor', 'Driver', 'Customer', null], default: null },

  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  timestamp: { type: Date, default: Date.now },
}, {
  collection: 'ShipmentEvent',
});

shipmentEventSchema.index({ shipment: 1, timestamp: -1 });
shipmentEventSchema.index({ eventType: 1 });

const ShipmentEvent = mongoose.model('ShipmentEvent', shipmentEventSchema);
module.exports = ShipmentEvent;
