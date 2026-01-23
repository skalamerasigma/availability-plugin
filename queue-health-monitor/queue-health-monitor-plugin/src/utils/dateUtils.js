/**
 * Date formatting utilities for consistent UTC date display across the application
 */

/**
 * Format a timestamp to UTC date and time string
 * Format: Jan 01 2026 HH:MM:SS UTC
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date string or "-" if invalid
 */
export function formatTimestampUTC(timestamp) {
  if (!timestamp) return "-";
  const date = typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (isNaN(date.getTime())) return "-";
  
  const month = date.toLocaleString('en-US', { timeZone: 'UTC', month: 'short' });
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${month} ${day} ${year} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Format a timestamp to UTC date and time string (without seconds)
 * Format: Jan 01 2026 HH:MM UTC
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date string or "-" if invalid
 */
export function formatDateTimeUTC(timestamp) {
  if (!timestamp) return "-";
  const date = typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (isNaN(date.getTime())) return "-";
  
  const month = date.toLocaleString('en-US', { timeZone: 'UTC', month: 'short' });
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  
  return `${month} ${day} ${year} ${hours}:${minutes} UTC`;
}

/**
 * Format a date string (YYYY-MM-DD) to display format for charts
 * Format: Jan 01
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string (Jan 01)
 */
export function formatDateForChart(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString('en-US', { month: 'short' });
  const dayPadded = String(date.getDate()).padStart(2, '0');
  return `${monthName} ${dayPadded}`;
}

/**
 * Format a date string (YYYY-MM-DD) to tooltip format
 * Format: "Mon, Jan 1"
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDateForTooltip(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format a date string (YYYY-MM-DD) to full date format for tooltips
 * Format: "Jan 01 2026"
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDateFull(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const date = new Date(year, month - 1, day);
  const monthName = date.toLocaleString('en-US', { month: 'short' });
  const dayPadded = String(date.getDate()).padStart(2, '0');
  return `${monthName} ${dayPadded} ${year}`;
}

/**
 * Format a date string (YYYY-MM-DD) to UTC date string
 * Format: "Jan 01 2026 UTC"
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDateUTC(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  const date = new Date(Date.UTC(year, month - 1, day));
  const monthName = date.toLocaleString('en-US', { timeZone: 'UTC', month: 'short' });
  const dayPadded = String(date.getUTCDate()).padStart(2, '0');
  return `${monthName} ${dayPadded} ${year} UTC`;
}

/**
 * Calculate time remaining until a target date
 * @param {Date|string|number} targetDate - The target date to count down to
 * @returns {Object} Object with days, hours, minutes, seconds, and total milliseconds
 */
export function calculateTimeRemaining(targetDate) {
  if (!targetDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
  }
  
  const target = typeof targetDate === "number" 
    ? new Date(targetDate * 1000) 
    : new Date(targetDate);
  
  if (isNaN(target.getTime())) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
  }
  
  const now = new Date();
  const totalMs = target.getTime() - now.getTime();
  const expired = totalMs <= 0;
  
  if (expired) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
  }
  
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, totalMs, expired: false };
}

/**
 * Format time remaining as a readable string
 * @param {Object} timeRemaining - Object from calculateTimeRemaining
 * @returns {string} Formatted string like "2d 5h 30m 15s"
 */
export function formatTimeRemaining(timeRemaining) {
  if (timeRemaining.expired) {
    return "Expired";
  }
  
  const parts = [];
  if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}d`);
  if (timeRemaining.hours > 0) parts.push(`${timeRemaining.hours}h`);
  if (timeRemaining.minutes > 0) parts.push(`${timeRemaining.minutes}m`);
  if (timeRemaining.seconds >= 0 || parts.length === 0) parts.push(`${timeRemaining.seconds}s`);
  
  return parts.join(" ");
}
