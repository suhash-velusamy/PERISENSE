/**
 * Centralized, configurable rules for the Stage 11 Rescue Marketplace.
 * Mirrors the pattern established in server/config/conditionRules.js —
 * no magic numbers scattered through routes/services.
 */

// Phase 4: default configurable rescue radius. Vendors do not currently
// have a UI control to change this per-sale value beyond what they submit
// at creation time (the field is accepted from the request body and falls
// back to this default) — kept simple per the stage instructions rather
// than adding a separate vendor-level radius-preference setting.
const DEFAULT_RESCUE_RADIUS_KM = 30;

// Phase 3: only these Condition Engine statuses (server/services/
// conditionEngine.js) justify creating a Rescue Sale. NORMAL means there is
// no deterioration concern; UNKNOWN means the system cannot reliably
// determine condition at all — neither is a defensible basis for pulling a
// shipment into the rescue workflow.
const RESCUE_ALLOWED_CONDITION_STATUSES = ['WARNING', 'CRITICAL'];

// Phase 3: a shipment must be actively moving for its vehicle location to
// be meaningful for proximity discovery, and for "rescue" to make sense at
// all (nothing to rescue before pickup, nothing to rescue after delivery).
// Matches Stage 10's own ALERTABLE_STATUSES choice for the same reason.
const RESCUE_ALLOWED_SHIPMENT_STATUSES = ['IN_TRANSIT'];

// Phase 5: vehicle location reused from the existing IoT location read-side
// (Device.deviceLocation). Matches the STALE_READING_MAX_AGE_MINUTES
// already used by the Condition Engine and the pre-existing frontend
// freshness.js cutoff, so "stale" means the same thing everywhere in the
// app.
const VEHICLE_LOCATION_STALE_MINUTES = 15;

// Phase 8/9: a Customer's saved location is a low-frequency "where to
// deliver rescue goods" signal, not a live GPS feed like vehicle telemetry
// — reusing the 15-minute vehicle threshold here would make consent
// re-prompt practically every session. 30 days is a deliberately generous,
// disclosed cutoff: long enough that a customer who opted in last week is
// still eligible, short enough that a location captured months ago isn't
// silently trusted.
const CUSTOMER_LOCATION_STALE_DAYS = 30;

// Mean Earth radius in km, used consistently by both the MongoDB
// $centerSphere geospatial pre-filter (server/services/rescueService.js)
// and the authoritative Haversine distance calculation, so the two never
// disagree at the eligibility boundary.
const EARTH_RADIUS_KM = 6371;

// Every "<= radiusKm" eligibility comparison in rescueService.js is widened
// by this amount before comparing. A customer placed at exactly the radius
// boundary can land a few times 1e-14 km past it purely from
// sin/cos/atan2 floating-point rounding in the Haversine calculation (verified
// empirically — a point constructed to be precisely 30km away round-tripped
// through the formula as 30.000000000000068). 1e-6 km (1mm) absorbs that
// noise with room to spare while being far below GPS accuracy (~meters), so
// it never changes a real-world eligibility outcome — Phase 11's own spec
// ("30 km -> eligible, 30.1 km -> not eligible") only needs to hold at
// meter precision, not femtometer precision.
const DISTANCE_EPSILON_KM = 1e-6;

module.exports = {
  DEFAULT_RESCUE_RADIUS_KM,
  RESCUE_ALLOWED_CONDITION_STATUSES,
  RESCUE_ALLOWED_SHIPMENT_STATUSES,
  VEHICLE_LOCATION_STALE_MINUTES,
  CUSTOMER_LOCATION_STALE_DAYS,
  EARTH_RADIUS_KM,
  DISTANCE_EPSILON_KM,
};
