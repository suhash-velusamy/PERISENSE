/**
 * Single source of truth for the Shipment/Work status lifecycle.
 * Both vendor-initiated and driver-initiated transitions (e.g. "start",
 * "complete" each have two route entry points) must call through here so
 * there is exactly one place that decides whether a transition is legal.
 */

const STATUSES = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

const STATUS_VALUES = Object.values(STATUSES);

// Terminal states have no outgoing transitions.
const ALLOWED_TRANSITIONS = Object.freeze({
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
});

// Statuses in which a shipment may still be safely deleted/withdrawn
// (i.e. it never reached an active/committed state).
const DELETABLE_STATUSES = Object.freeze(['CREATED', 'ASSIGNED', 'REJECTED']);

function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Array.isArray(allowed) && allowed.includes(toStatus);
}

/**
 * Throws a descriptive Error if the transition is not legal; otherwise
 * returns silently. Route handlers convert the error to a 400 response.
 */
function assertTransition(fromStatus, toStatus) {
  if (!STATUS_VALUES.includes(toStatus)) {
    throw new Error(`Unknown shipment status "${toStatus}"`);
  }
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(`Illegal shipment status transition: ${fromStatus} -> ${toStatus}`);
  }
}

module.exports = {
  STATUSES,
  STATUS_VALUES,
  ALLOWED_TRANSITIONS,
  DELETABLE_STATUSES,
  canTransition,
  assertTransition,
};
