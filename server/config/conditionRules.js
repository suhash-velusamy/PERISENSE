/**
 * Centralized, configurable condition-monitoring rules for the Stage 10
 * IoT Condition Engine (server/services/conditionEngine.js).
 *
 * DEMO THRESHOLDS — NOT SCIENTIFICALLY VALIDATED.
 * The warn/critical values below are carried over from the only sensor
 * thresholds that existed anywhere in the codebase before Stage 10: the
 * gauge-coloring cutoffs already shipped in the vendor's
 * MonitorHealthView.js (FreshGoods/screens/Vendor Management/components/
 * vendorHomeComponents/monitorHealthView.js). No product-specific,
 * scientifically validated thresholds exist in this project's data. These
 * are a disclosed, configurable placeholder baseline — replace them with
 * validated, product-specific thresholds before any real-world deployment.
 * They must never be presented to a user as a scientific or medical
 * guarantee about shelf life.
 *
 * Per-shipment override: when a shipment's Product document has
 * perishabilityConfig.optimalTempRangeC / optimalHumidityRangePct populated
 * (server/models/productModel.js — a field that already existed before
 * Stage 10 but was unpopulated/unused), those values take precedence over
 * the defaults below for temperature/humidity. Ethylene has no
 * product-level field yet, so it always uses the default rule.
 */

// Single-sided rules: value <= normalMax -> NORMAL, <= warningMax -> WARNING, above -> CRITICAL.
const DEFAULT_RULES = Object.freeze({
  temperature: Object.freeze({ type: 'upperBound', normalMax: 24, warningMax: 26, unit: '°C' }),
  humidity: Object.freeze({ type: 'upperBound', normalMax: 50, warningMax: 60, unit: '%' }),
  ethyleneLevel: Object.freeze({ type: 'upperBound', normalMax: 2, warningMax: 9, unit: 'ppm' }),
});

// How far outside a product's declared optimal [min, max] range a reading
// may fall before escalating from WARNING to CRITICAL, when product-specific
// ranges are used instead of the defaults above. Configurable demo buffer.
const RANGE_WARNING_BUFFER = Object.freeze({
  temperature: 2, // °C
  humidity: 10,   // percentage points
});

// Physically-impossible value guards (Phase 2 "impossible values"). These
// are sanity bounds, not warning/critical thresholds — a reading outside
// these bounds is treated as INVALID data, never as a healthy reading.
const SANITY_BOUNDS = Object.freeze({
  temperature: Object.freeze({ min: -30, max: 60 }),   // cold-chain to open-air extremes
  humidity: Object.freeze({ min: 0, max: 100 }),        // physical percentage bounds
  ethyleneLevel: Object.freeze({ min: 0, max: 1000 }),  // generous ceiling for a ppm sensor
});

// A reading older than this is STALE and must never be treated as current.
// Matches the existing frontend "recent vs stale" cutoff already shipped in
// FreshGoods/screens/utils/freshness.js, kept in sync deliberately so the
// backend's STALE classification agrees with what the UI already labels
// "Stale" — not a new/independent guess.
const STALE_READING_MAX_AGE_MINUTES = 15;

module.exports = {
  DEFAULT_RULES,
  RANGE_WARNING_BUFFER,
  SANITY_BOUNDS,
  STALE_READING_MAX_AGE_MINUTES,
};
