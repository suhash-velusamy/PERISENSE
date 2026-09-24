/**
 * condition.js
 * Shared display metadata for the Stage 10 backend Condition Engine result
 * (GET /api/vendor|driver/device/condition/:exportId). This file only maps
 * a backend-computed status to icon/color/label — it performs NO
 * classification of its own. Condition/risk logic is server-side only.
 */
import { colors } from '../theme';

export const CONDITION_META = {
  NORMAL: { icon: '✅', label: 'Normal', color: colors.success, bg: colors.successBg },
  WARNING: { icon: '⚠️', label: 'Warning', color: colors.warning, bg: colors.warningBg },
  CRITICAL: { icon: '🔴', label: 'Critical', color: colors.error, bg: colors.errorBg },
  UNKNOWN: { icon: '❔', label: 'Unknown', color: '#888888', bg: 'rgba(136, 136, 136, 0.1)' },
};

export const RISK_LABELS = {
  LOW: 'LOW RISK',
  MEDIUM: 'MEDIUM RISK',
  HIGH: 'HIGH RISK',
  UNKNOWN: 'UNKNOWN',
};

export const getConditionMeta = (status) => CONDITION_META[status] || CONDITION_META.UNKNOWN;
export const getRiskLabel = (risk) => RISK_LABELS[risk] || RISK_LABELS.UNKNOWN;
