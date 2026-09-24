/**
 * Stage 12 — the one reusable server-side OpenRouteService client.
 *
 * This is intentionally separate from the pre-existing ORS calls already in
 * server/routes/driverRoutes.js (getDistrictsBetween / reverseGeocode),
 * which exist only to label Shipment.routes[] with district names at
 * delivery-start time and are left untouched structurally (Stage 12 Phase 1
 * only changed where their API key comes from). This module is the single
 * routing entry point for the new reroute-preview/confirm flow.
 *
 * Reads ORS_API_KEY from the environment only — never hardcoded, never sent
 * to any client (see server/.env.example). If the key is missing, routing
 * fails loudly (RoutingError) rather than silently degrading, because a
 * reroute confirmation must never proceed on a route the vendor never
 * actually saw.
 */
const axios = require('axios');

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const ORS_REVERSE_GEOCODE_URL = 'https://api.openrouteservice.org/geocode/reverse';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const REQUEST_TIMEOUT_MS = 10000;

class RoutingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * origin/destination: { latitude, longitude }.
 * Returns { polyline: [[lat,lng], ...], distanceKm, durationMinutes, provider }.
 * Never falls back to a straight line — Phase 20 requires a hard failure
 * here, unlike the pre-existing display-only map screens which silently
 * degrade because they're not gating an irreversible confirmation.
 */
async function calculateRoute(origin, destination) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    throw new RoutingError('ROUTING_NOT_CONFIGURED', 'Routing service is not configured on the server.');
  }
  if (![origin.latitude, origin.longitude, destination.latitude, destination.longitude].every(Number.isFinite)) {
    throw new RoutingError('INVALID_COORDINATES', 'Origin or destination coordinates are invalid.');
  }

  let response;
  try {
    response = await axios.post(
      ORS_DIRECTIONS_URL,
      { coordinates: [[origin.longitude, origin.latitude], [destination.longitude, destination.latitude]] },
      {
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new RoutingError('ROUTE_TIMEOUT', 'Routing service timed out.');
    }
    throw new RoutingError('ROUTE_CALCULATION_FAILED', 'Failed to calculate route.');
  }

  const feature = response.data?.features?.[0];
  const summary = feature?.properties?.summary;
  if (!feature || !summary || !Array.isArray(feature.geometry?.coordinates)) {
    throw new RoutingError('NO_ROUTE_FOUND', 'No drivable route could be found between these points.');
  }

  return {
    polyline: feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distanceKm: Math.round((summary.distance / 1000) * 10) / 10,
    durationMinutes: Math.round(summary.duration / 60),
    provider: 'openrouteservice',
  };
}

/**
 * Human-readable area label for a point (e.g. "Salem, Tamil Nadu") — never
 * the raw coordinates themselves. Mirrors the existing ORS-then-Nominatim
 * fallback chain already used in driverRoutes.js's reverseGeocode, so the
 * app has one consistent "how do we label a point" behavior. Best-effort:
 * returns null on failure rather than throwing, since a missing label
 * should never block a reroute preview/confirmation.
 */
async function resolveDestinationLabel(latitude, longitude) {
  const apiKey = process.env.ORS_API_KEY;
  if (apiKey) {
    try {
      const res = await axios.get(ORS_REVERSE_GEOCODE_URL, {
        params: { api_key: apiKey, 'point.lat': latitude, 'point.lon': longitude, size: 1 },
        timeout: REQUEST_TIMEOUT_MS,
      });
      const props = res.data?.features?.[0]?.properties;
      const label = props?.locality || props?.county || props?.region;
      if (label) return label;
    } catch {
      // fall through to Nominatim
    }
  }

  try {
    const res = await axios.get(NOMINATIM_REVERSE_URL, {
      params: { format: 'json', lat: latitude, lon: longitude, zoom: 10, addressdetails: 1 },
      headers: { 'User-Agent': 'FreshGoods/1.0 (rescue-routing)' },
      timeout: REQUEST_TIMEOUT_MS,
    });
    const address = res.data?.address;
    return address?.county || address?.state || address?.region || address?.city || null;
  } catch {
    return null;
  }
}

module.exports = { calculateRoute, resolveDestinationLabel, RoutingError };
