/**
 * 狀態色表 - 對應後端 evaluateStatus() 回傳的 level
 */
export const STATUS_COLORS = {
  normal: {
    bg: '#16a34a',
    bgSoft: '#dcfce7',
    text: '#14532d',
    label: '正常',
    emoji: '🟢',
  },
  humidity_warning: {
    bg: '#ca8a04',
    bgSoft: '#fef9c3',
    text: '#713f12',
    label: '水氣注意',
    emoji: '🟡',
  },
  fire_alert: {
    bg: '#dc2626',
    bgSoft: '#fee2e2',
    text: '#7f1d1d',
    label: '火災警報',
    emoji: '🔴',
  },
};

export function getStatusStyle(level) {
  return STATUS_COLORS[level] || STATUS_COLORS.normal;
}

export const COLORS = {
  bg: '#0f172a',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  accent: '#0ea5e9',
};
