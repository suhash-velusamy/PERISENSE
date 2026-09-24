const mongoose = require('mongoose');

/**
 * Stage 10 — one document per Shipment holding the latest Condition Engine
 * result. This is the "stored/cached result" step of:
 *   Latest reading -> Condition evaluation -> Stored result -> Mobile API
 * so repeated vendor/driver polling never re-runs historical analysis, and
 * so alert de-duplication (Phase 9) has somewhere to remember what the last
 * *alerted* status was without re-deriving it from notification history.
 */
const sensorSnapshotSchema = new mongoose.Schema({
  temperature: { type: Number, default: null },
  humidity: { type: Number, default: null },
  ethyleneLevel: { type: Number, default: null },
}, { _id: false });

const shipmentConditionSchema = new mongoose.Schema({
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true, unique: true },

  status: {
    type: String,
    enum: ['NORMAL', 'WARNING', 'CRITICAL', 'UNKNOWN'],
    default: 'UNKNOWN',
  },
  riskStatus: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'],
    default: 'UNKNOWN',
  },

  dataQuality: {
    type: String,
    enum: ['VALID', 'INVALID', 'MISSING', 'STALE'],
    default: 'MISSING',
  },

  reason: { type: String, default: null },
  triggeredSensors: { type: [String], default: [] },
  sensorSnapshot: { type: sensorSnapshotSchema, default: null },

  evaluatedAt: { type: Date, default: null },
  latestReadingTimestamp: { type: Date, default: null },

  // What we last actually alerted the vendor about, so repeated evaluations
  // of an unchanged status never re-fire (Phase 9 duplicate-alert control).
  lastAlertedStatus: {
    type: String,
    enum: ['NORMAL', 'WARNING', 'CRITICAL', 'UNKNOWN', null],
    default: null,
  },
  lastAlertedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'ShipmentCondition',
});

const ShipmentCondition = mongoose.model('ShipmentCondition', shipmentConditionSchema);
module.exports = ShipmentCondition;
