const ShipmentEvent = require('../models/shipmentEventModel');

/**
 * Best-effort timeline write. A failure here must never fail the request
 * that triggered it (the shipment mutation itself already succeeded by the
 * time this is called) — log and move on.
 */
async function logShipmentEvent(shipmentId, eventType, actor = null, actorModel = null, metadata = {}) {
  try {
    await ShipmentEvent.create({
      shipment: shipmentId,
      eventType,
      actor,
      actorModel,
      metadata,
    });
  } catch (err) {
    console.error('Failed to log shipment event:', err.message);
  }
}

module.exports = logShipmentEvent;
