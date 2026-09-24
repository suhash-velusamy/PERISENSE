/**
 * freshness.js
 * Shared "is this reading current?" classification for anything with a
 * timestamp — device location, IoT sensor readings. Used instead of
 * fabricating a percentage/risk score: this only ever answers "how old is
 * the real timestamp we actually have," never invents one.
 *
 * Threshold: 15 minutes. Chosen because the live-tracking screens poll
 * every 15s while actively tracking, so anything older than 15 minutes
 * means the device has gone quiet for 60x its own reporting interval —
 * a deliberately generous, disclosed cutoff, not a hidden precision claim.
 */
export const FRESHNESS_THRESHOLD_MINUTES = 15;

export const FRESHNESS = {
  RECENT: 'RECENT',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE',
};

/**
 * @param {string|Date|null|undefined} timestamp
 * @returns {{ status: 'RECENT'|'STALE'|'UNAVAILABLE', label: string, minutesAgo: number|null }}
 */
export const getFreshness = (timestamp) => {
  if (!timestamp) {
    return { status: FRESHNESS.UNAVAILABLE, label: 'Unavailable', minutesAgo: null };
  }
  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) {
    return { status: FRESHNESS.UNAVAILABLE, label: 'Unavailable', minutesAgo: null };
  }
  const minutesAgo = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (minutesAgo <= FRESHNESS_THRESHOLD_MINUTES) {
    return { status: FRESHNESS.RECENT, label: 'Recent', minutesAgo };
  }
  return { status: FRESHNESS.STALE, label: 'Stale', minutesAgo };
};

export const formatMinutesAgo = (minutesAgo) => {
  if (minutesAgo == null) return '';
  if (minutesAgo < 1) return 'just now';
  if (minutesAgo === 1) return '1 minute ago';
  if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
  const hours = Math.floor(minutesAgo / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};
