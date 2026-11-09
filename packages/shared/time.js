export const TIME_ZONE = 'Asia/Ho_Chi_Minh';
export function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value)
    .join('-');
}
export function addDays(date, count) {
  return new Date(Date.parse(`${date}T12:00:00+07:00`) + count * 86400000)
    .toISOString()
    .slice(0, 10);
}
// URL parameters can be edited or bookmarks can become stale. Keep the UI usable.
// The server validates every date independently; this is only a display default.
export function bookingDate(value) {
  const today = localDate();
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(value || '')
    ? Date.parse(`${value}T12:00:00+07:00`)
    : NaN;
  return Number.isFinite(timestamp) &&
    localDate(timestamp) === value &&
    value >= today &&
    value <= addDays(today, 30)
    ? value
    : addDays(today, 1);
}
export function slotStart(date, hour) {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+07:00`).toISOString();
}
export const money = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
export const clockTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
export const displayDate = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value));
