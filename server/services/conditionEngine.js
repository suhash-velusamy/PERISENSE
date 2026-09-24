/**
 * Stage 10 — IoT Condition Monitoring & Perishability Risk Engine.
 *
 *   Sensor readings (Device.deviceData, existing Stage-2 collection)
 *         -> Validation (VALID / INVALID / MISSING / STALE)
 *         -> Condition analysis (per-sensor classification against
 *            server/config/conditionRules.js, or a Product's own
 *            perishabilityConfig when the shipment has one)
 *         -> Condition status (NORMAL / WARNING / CRITICAL / UNKNOWN)
 *         -> Stored on ShipmentCondition (the "cached result" Phase 17 asks
 *            for, so the mobile app never triggers historical analysis)
 *         -> Vendor alert on a real transition only (Phase 9 dedup)
 *
 * This module does NOT touch driver routing, rescue sale, or customer
 * discovery — it stops at "tell the Vendor something needs attention."
 *
 * This is a condition/risk indicator, not a scientific or medical shelf-life
 * guarantee (Phase 7). See conditionRules.js for the disclosed demo
 * thresholds and how a Product's own perishabilityConfig overrides them.
 */
const Shipment = require('../models/shipmentModel');
const Vehicle = require('../models/VehicleModel');
const Device = require('../models/deviceModel');
const Vendor = require('../models/vendorModel');
const ShipmentCondition = require('../models/shipmentConditionModel');
// Nothing else in the require graph loads this — Shipment.product's `ref:
// 'Product'` is never resolvable by .populate('product') below unless the
// schema has actually been registered with Mongoose somewhere first.
require('../models/productModel');
const logShipmentEvent = require('../utils/logShipmentEvent');
const { createNotification } = require('./notificationService');
const {
  DEFAULT_RULES,
  RANGE_WARNING_BUFFER,
  SANITY_BOUNDS,
  STALE_READING_MAX_AGE_MINUTES,
} = require('../config/conditionRules');

const RISK_MAP = { NORMAL: 'LOW', WARNING: 'MEDIUM', CRITICAL: 'HIGH', UNKNOWN: 'UNKNOWN' };
const SEVERITY_ORDER = { NORMAL: 0, WARNING: 1, CRITICAL: 2 };
const SENSOR_LABELS = { temperature: 'Temperature', humidity: 'Humidity', ethyleneLevel: 'Ethylene' };

// Alerts are only useful while the shipment is actually moving. A shipment
// that hasn't started transit yet or has already finished can still be
// *viewed* (evaluation always runs), it just never pages the vendor.
const ALERTABLE_STATUSES = ['IN_TRANSIT'];

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * VALID / INVALID / MISSING / STALE classification for one raw reading.
 * Never silently repairs bad data into something that looks healthy.
 */
function classifyDataQuality(reading, now = new Date()) {
  if (!reading) {
    return { quality: 'MISSING', issues: [] };
  }

  const { temperature, humidity, ethyleneLevel, timestamp } = reading;
  const missing = [];
  if (!isFiniteNumber(temperature)) missing.push('temperature');
  if (!isFiniteNumber(humidity)) missing.push('humidity');
  if (!isFiniteNumber(ethyleneLevel)) missing.push('ethyleneLevel');
  if (missing.length > 0) {
    return { quality: 'MISSING', issues: missing };
  }

  const impossible = [];
  if (temperature < SANITY_BOUNDS.temperature.min || temperature > SANITY_BOUNDS.temperature.max) impossible.push('temperature');
  if (humidity < SANITY_BOUNDS.humidity.min || humidity > SANITY_BOUNDS.humidity.max) impossible.push('humidity');
  if (ethyleneLevel < SANITY_BOUNDS.ethyleneLevel.min || ethyleneLevel > SANITY_BOUNDS.ethyleneLevel.max) impossible.push('ethyleneLevel');
  if (impossible.length > 0) {
    return { quality: 'INVALID', issues: impossible };
  }

  const ts = timestamp ? new Date(timestamp).getTime() : NaN;
  if (Number.isNaN(ts)) {
    return { quality: 'INVALID', issues: ['timestamp'] };
  }

  const ageMinutes = (now.getTime() - ts) / 60000;
  if (ageMinutes > STALE_READING_MAX_AGE_MINUTES) {
    return { quality: 'STALE', issues: [], ageMinutes };
  }

  return { quality: 'VALID', issues: [], ageMinutes };
}

function classifySensorValue(value, rule) {
  if (rule.type === 'range') {
    const { min, max, buffer } = rule;
    if (value >= min && value <= max) return 'NORMAL';
    if (value >= min - buffer && value <= max + buffer) return 'WARNING';
    return 'CRITICAL';
  }
  const { normalMax, warningMax } = rule;
  if (value <= normalMax) return 'NORMAL';
  if (value <= warningMax) return 'WARNING';
  return 'CRITICAL';
}

/**
 * Resolves which rule set applies to this shipment: a populated Product's
 * own perishabilityConfig (Phase 5 grounding) where present, otherwise the
 * global demo defaults from conditionRules.js. Ethylene always uses the
 * default — no product-level ethylene field exists yet.
 */
function resolveRules(product) {
  const rules = { ...DEFAULT_RULES };
  const source = { temperature: 'default', humidity: 'default', ethyleneLevel: 'default' };
  const cfg = product?.perishabilityConfig;

  const tempRange = cfg?.optimalTempRangeC;
  if (tempRange && tempRange.min != null && tempRange.max != null) {
    rules.temperature = { type: 'range', min: tempRange.min, max: tempRange.max, buffer: RANGE_WARNING_BUFFER.temperature };
    source.temperature = 'product';
  }

  const humidityRange = cfg?.optimalHumidityRangePct;
  if (humidityRange && humidityRange.min != null && humidityRange.max != null) {
    rules.humidity = { type: 'range', min: humidityRange.min, max: humidityRange.max, buffer: RANGE_WARNING_BUFFER.humidity };
    source.humidity = 'product';
  }

  return { rules, source };
}

function evaluateReading(reading, rules) {
  const perSensor = {
    temperature: classifySensorValue(reading.temperature, rules.temperature),
    humidity: classifySensorValue(reading.humidity, rules.humidity),
    ethyleneLevel: classifySensorValue(reading.ethyleneLevel, rules.ethyleneLevel),
  };

  let status = 'NORMAL';
  const triggeredSensors = [];
  for (const [sensor, level] of Object.entries(perSensor)) {
    if (SEVERITY_ORDER[level] > SEVERITY_ORDER[status]) status = level;
    if (level !== 'NORMAL') triggeredSensors.push(sensor);
  }

  return { status, perSensor, triggeredSensors };
}

function buildReason(evalResult) {
  if (evalResult.status === 'NORMAL') return 'Sensor readings are within the expected range.';
  const labels = evalResult.triggeredSensors.map((s) => SENSOR_LABELS[s] || s);
  const list = labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
    : labels[0];
  return evalResult.status === 'CRITICAL'
    ? `${list} readings indicate a serious deterioration risk.`
    : `${list} conditions require attention.`;
}

function reasonForDataQuality(dq) {
  switch (dq.quality) {
    case 'MISSING':
      return 'No valid sensor reading is available for this shipment.';
    case 'INVALID':
      return `Sensor reading contains invalid value(s): ${dq.issues.join(', ')}.`;
    case 'STALE':
      return `Sensor data is stale (last reading ${Math.max(0, Math.round(dq.ageMinutes))} minute(s) ago).`;
    default:
      return 'Condition could not be reliably determined.';
  }
}

function snapshotOf(reading) {
  if (!reading) return null;
  return {
    temperature: isFiniteNumber(reading.temperature) ? reading.temperature : null,
    humidity: isFiniteNumber(reading.humidity) ? reading.humidity : null,
    ethyleneLevel: isFiniteNumber(reading.ethyleneLevel) ? reading.ethyleneLevel : null,
  };
}

function buildUnknownResult({ reason, dataQuality, latestReadingTimestamp = null, sensorSnapshot = null }) {
  return {
    conditionStatus: 'UNKNOWN',
    riskStatus: 'UNKNOWN',
    reason,
    triggeredSensors: [],
    dataQuality,
    latestReadingTimestamp,
    sensorSnapshot,
    ruleSource: null,
  };
}

/**
 * Runs the full pipeline for one shipment: locate its device, validate the
 * latest reading, classify condition, persist the result, and fire a
 * de-duplicated vendor alert on real transitions. Cheap by design — one
 * Shipment lookup, one Device lookup, and a read of the *last* element of
 * its embedded reading array. No historical scan (Phase 17).
 */
async function evaluateShipmentCondition(shipmentId) {
  const shipment = await Shipment.findById(shipmentId).populate('product');
  if (!shipment) {
    const err = new Error('Shipment not found');
    err.code = 'SHIPMENT_NOT_FOUND';
    throw err;
  }

  const now = new Date();
  let result;

  if (!shipment.vehicle) {
    result = buildUnknownResult({
      reason: 'No vehicle is associated with this shipment.',
      dataQuality: 'MISSING',
    });
  } else {
    const vehicle = await Vehicle.findById(shipment.vehicle);
    if (!vehicle || !vehicle.deviceId) {
      result = buildUnknownResult({
        reason: "No IoT device is associated with this shipment's vehicle.",
        dataQuality: 'MISSING',
      });
    } else {
      const device = await Device.findOne({ deviceName: vehicle.deviceId });
      if (!device) {
        result = buildUnknownResult({
          reason: 'The associated IoT device could not be found. Sensor data is unavailable.',
          dataQuality: 'MISSING',
        });
      } else {
        const readings = device.deviceData || [];
        const latest = readings.length > 0 ? readings[readings.length - 1] : null;
        const dq = classifyDataQuality(latest, now);

        if (dq.quality !== 'VALID') {
          result = buildUnknownResult({
            reason: reasonForDataQuality(dq),
            dataQuality: dq.quality,
            latestReadingTimestamp: latest?.timestamp || null,
            sensorSnapshot: snapshotOf(latest),
          });
        } else {
          const { rules, source } = resolveRules(shipment.product);
          const evalResult = evaluateReading(latest, rules);
          result = {
            conditionStatus: evalResult.status,
            riskStatus: RISK_MAP[evalResult.status],
            reason: buildReason(evalResult),
            triggeredSensors: evalResult.triggeredSensors,
            dataQuality: 'VALID',
            latestReadingTimestamp: latest.timestamp,
            sensorSnapshot: snapshotOf(latest),
            ruleSource: source,
          };
        }
      }
    }
  }

  result.evaluatedAt = now;
  await persistAndAlert(shipment, result);

  return result;
}

/**
 * Phase 9 duplicate-alert control:
 *   NORMAL -> WARNING     alert (new risk)
 *   WARNING -> WARNING    no alert
 *   WARNING -> CRITICAL   alert (escalation)
 *   CRITICAL -> CRITICAL  no alert
 *   CRITICAL -> NORMAL    alert (recovery)
 *   * -> UNKNOWN           no alert (avoid paging on transient device gaps;
 *                           the status is still visible in the UI response)
 */
function shouldFireAlert(prevStatus, nextStatus) {
  if (prevStatus === nextStatus) return false;
  if (nextStatus === 'WARNING' || nextStatus === 'CRITICAL') return true;
  if (nextStatus === 'NORMAL' && (prevStatus === 'WARNING' || prevStatus === 'CRITICAL')) return true;
  return false;
}

async function fireVendorAlert(shipment, result, prevStatus) {
  const vendor = await Vendor.findById(shipment.vendorId).select('expoPushToken');
  const isRecovery = result.conditionStatus === 'NORMAL';
  const isCritical = result.conditionStatus === 'CRITICAL';

  const title = isRecovery
    ? 'Shipment condition recovered'
    : isCritical
      ? 'Critical shipment condition detected'
      : 'Shipment condition requires attention';

  const message = isRecovery
    ? `${shipment.itemName} sensor readings have returned to normal.`
    : isCritical
      ? `Critical shipment condition detected for ${shipment.itemName}. Immediate review recommended.`
      : `Shipment condition requires attention for ${shipment.itemName}.`;

  await createNotification({
    recipientId: shipment.vendorId,
    recipientModel: 'Vendor',
    type: 'IOT_RISK_ALERT',
    title,
    message,
    relatedEntityType: 'Shipment',
    relatedEntityId: shipment._id,
    recipientPushToken: vendor?.expoPushToken,
  });

  const eventType = isRecovery ? 'CONDITION_RECOVERED' : isCritical ? 'HIGH_RISK_DETECTED' : 'IOT_WARNING';
  await logShipmentEvent(shipment._id, eventType, null, null, {
    conditionStatus: result.conditionStatus,
    previousStatus: prevStatus,
    reason: result.reason,
    triggeredSensors: result.triggeredSensors,
  });
}

async function persistAndAlert(shipment, result) {
  let record = await ShipmentCondition.findOne({ shipment: shipment._id });
  const prevStatus = record?.status || 'UNKNOWN';
  if (!record) {
    record = new ShipmentCondition({ shipment: shipment._id });
  }

  record.status = result.conditionStatus;
  record.riskStatus = result.riskStatus;
  record.reason = result.reason;
  record.triggeredSensors = result.triggeredSensors || [];
  record.dataQuality = result.dataQuality;
  record.evaluatedAt = result.evaluatedAt;
  record.latestReadingTimestamp = result.latestReadingTimestamp || null;
  record.sensorSnapshot = result.sensorSnapshot || null;

  const alertable = ALERTABLE_STATUSES.includes(shipment.status);
  if (alertable && shouldFireAlert(prevStatus, result.conditionStatus)) {
    await fireVendorAlert(shipment, result, prevStatus);
    record.lastAlertedStatus = result.conditionStatus;
    record.lastAlertedAt = result.evaluatedAt;
  }

  await record.save();
}

module.exports = {
  evaluateShipmentCondition,
  // exported for tests / reuse, not part of the route-facing surface
  classifyDataQuality,
  classifySensorValue,
  resolveRules,
  evaluateReading,
  shouldFireAlert,
};
