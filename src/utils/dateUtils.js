/**
 * Date & Timestamp formatting utilities for ProcureFlow.
 *
 * - Sheet Storage format: "M/D/YYYY H:mm:ss" (Native Google Sheets Date format for formula compatibility)
 * - Frontend Display format: "DD-MM-YYYY HH:mm:ss" (or "DD-MM-YYYY" for date-only values)
 */

const pad = (n) => String(n).padStart(2, '0');

/**
 * Generate current timestamp string in Google Sheet native "M/D/YYYY H:mm:ss" format.
 * Example: "7/25/2026 13:16:44"
 */
export const makeTimestamp = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Check if a date value is valid and non-empty
 */
export const isValidDate = (val) => {
  return val != null && String(val).trim() !== '' && String(val).trim() !== '—' && String(val).trim() !== '-';
};

/**
 * Check if a value is present (not null, not empty, not dash)
 */
export const hasValue = (val) => {
  return val != null && String(val).trim() !== '' && String(val).trim() !== '—' && String(val).trim() !== '-';
};

/**
 * Parse any date input (ISO string, M/D/YYYY, YYYY-MM-DD, DD-MM-YYYY) and format as:
 * - includeTime = true:  "DD-MM-YYYY HH:mm:ss"
 * - includeTime = false: "DD-MM-YYYY"
 */
export const formatDisplayDate = (val, includeTime = false) => {
  if (!isValidDate(val)) return '—';

  const s = String(val).trim();

  // If already in DD-MM-YYYY HH:mm:ss format
  const dmYMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (dmYMatch) {
    const [_, day, month, year, hh, mm, ss] = dmYMatch;
    if (!includeTime || !hh) return `${day}-${month}-${year}`;
    return `${day}-${month}-${year} ${hh}:${mm}:${ss}`;
  }

  // If YYYY-MM-DD format (HTML date picker value or ISO date prefix)
  const yMdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/);
  if (yMdMatch) {
    const [_, year, month, day, hh, mm, ss] = yMdMatch;
    if (!includeTime || !hh) return `${day}-${month}-${year}`;
    return `${day}-${month}-${year} ${hh}:${mm}:${ss}`;
  }

  // If M/D/YYYY H:mm:ss format
  const mDyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?/);
  if (mDyMatch) {
    const [_, month, day, year, hh, mm, ss] = mDyMatch;
    const formattedDay = pad(day);
    const formattedMonth = pad(month);
    if (!includeTime || !hh) return `${formattedDay}-${formattedMonth}-${year}`;
    return `${formattedDay}-${formattedMonth}-${year} ${pad(hh)}:${mm}:${ss}`;
  }

  // Generic Date parsing fallback
  try {
    const d = new Date(s);
    if (isNaN(d.getTime()) || d.getFullYear() < 1990) return s;
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    if (!includeTime) return `${day}-${month}-${year}`;
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return s;
  }
};

/**
 * Convert HTML date input (YYYY-MM-DD) or string into stored timestamp format "M/D/YYYY 00:00:00"
 */
export const formatToTimestamp = (dateVal) => {
  if (!dateVal) return '';
  const match = String(dateVal).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, year, month, day] = match;
    return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year} 00:00:00`;
  }
  return makeTimestamp(dateVal);
};
