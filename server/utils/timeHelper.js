/**
 * timeHelper.js
 * Real-world system clock validation for showtimes and cancellation rules.
 */

/**
 * Parse showDate and showTime strings into a unified JavaScript Date object.
 * Handles varied date (YYYY-MM-DD, ISO) and time formats (12-hr with AM/PM or 24-hr).
 * @param {string|Date} showDate - e.g. "2026-10-25" or ISO string
 * @param {string} showTime - e.g. "10:30 AM", "02:45 PM", "20:00"
 * @returns {Date|null}
 */
function parseShowDateTime(showDate, showTime) {
  if (!showDate || !showTime) return null;

  try {
    let year, month, day;
    const dateStr = String(showDate).trim();

    if (dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    } else {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }

    const timeStr = String(showTime).trim().toUpperCase();
    const isPM = timeStr.includes('PM');
    const isAM = timeStr.includes('AM');
    const cleanTime = timeStr.replace(/(AM|PM)/g, '').trim();
    const timeParts = cleanTime.split(':');

    let hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const showDateTime = new Date(year, month, day, hours, minutes, 0, 0);
    return isNaN(showDateTime.getTime()) ? null : showDateTime;
  } catch (err) {
    console.error('[timeHelper Error] Failed to parse show date/time:', err);
    return null;
  }
}

/**
 * Checks whether a given show has already passed relative to server current time.
 * @param {string|Date} showDate
 * @param {string} showTime
 * @returns {boolean} true if show has already commenced or passed
 */
function isShowExpired(showDate, showTime) {
  const dt = parseShowDateTime(showDate, showTime);
  if (!dt) return false;
  return dt.getTime() <= Date.now();
}

/**
 * Evaluates the strict 2-hour cancellation rule:
 * Cancellation Allowed = (Show Start Time - Current Time) >= 2 hours
 * @param {string|Date} showDate
 * @param {string} showTime
 * @returns {{ canCancel: boolean, diffHours: number, cutoffTime: Date|null, reason?: string }}
 */
function getCancellationEligibility(showDate, showTime) {
  const showDateTime = parseShowDateTime(showDate, showTime);
  if (!showDateTime) {
    return {
      canCancel: false,
      diffHours: 0,
      cutoffTime: null,
      reason: 'Invalid show date or time'
    };
  }

  const now = Date.now();
  const cutoffMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
  const diffMs = showDateTime.getTime() - now;
  const diffHours = diffMs / (60 * 60 * 1000);
  const cutoffTime = new Date(showDateTime.getTime() - cutoffMs);
  const hoursUntilCutoff = Math.max(0, (diffMs - cutoffMs) / (60 * 60 * 1000));
  const minutesUntilCutoff = Math.max(0, Math.floor((diffMs - cutoffMs) / (60 * 1000)));

  if (diffMs <= 0) {
    return {
      canCancel: false,
      eligible: false,
      diffHours,
      cutoffTime,
      hoursUntilCutoff: 0,
      minutesUntilCutoff: 0,
      reason: 'This show has already started or concluded.'
    };
  }

  if (diffMs < cutoffMs) {
    return {
      canCancel: false,
      eligible: false,
      diffHours,
      cutoffTime,
      hoursUntilCutoff: 0,
      minutesUntilCutoff: 0,
      reason: 'Cancellations are only permitted up to 2 hours prior to showtime. No refunds or cancellations will be processed within 2 hours of the scheduled start time.'
    };
  }

  return {
    canCancel: true,
    eligible: true,
    diffHours,
    cutoffTime,
    hoursUntilCutoff: Math.floor(hoursUntilCutoff),
    minutesUntilCutoff: Math.floor(minutesUntilCutoff % 60)
  };
}

module.exports = {
  parseShowDateTime,
  isShowExpired,
  getCancellationEligibility
};
