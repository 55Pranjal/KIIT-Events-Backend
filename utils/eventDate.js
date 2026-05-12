// Event date/time helpers.
//
// Events are stored as plain strings: `date` is "YYYY-MM-DD" and `time` is
// "HH:MM" — both representing wall-clock time at the venue (KIIT, IST).
//
// The bug we're avoiding: `new Date("2026-05-12 18:00")` is parsed in the
// runtime's local timezone. On Render that's UTC; for an event that's really
// 6pm IST the server would treat it as 6pm UTC and be off by 5h30m. That
// flips "is the event over?" answers around midnight IST.
//
// Fix: always construct the Date with an explicit IST offset. The result is
// an unambiguous UTC moment that compares correctly against `Date.now()`
// regardless of where the process is running.

const EVENT_TZ_OFFSET = "+05:30"; // KIIT campus is in Bhubaneswar, IST.

/**
 * Build a Date representing the start of an event from its stored date/time
 * strings, interpreting them as IST wall-clock time.
 *
 * `event.date` may be stored as either:
 *   - "YYYY-MM-DD" (what <input type="date"> submits — current code path), or
 *   - a full ISO string like "2026-03-05T00:00:00.000Z" (older records that
 *     went through a different code path)
 * In both cases we want just the calendar date portion, then we layer the
 * venue-local time and IST offset on top. Returns null on malformed input.
 */
export function getEventStart(date, time) {
  if (!date) return null;
  const dateMatch = String(date).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const t = time && /^\d{1,2}:\d{2}/.test(String(time)) ? String(time) : "00:00";
  const d = new Date(`${dateMatch[1]}T${t}${EVENT_TZ_OFFSET}`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Convenience: returns true if the event's start moment is strictly in the
 * future relative to `now` (defaults to current time).
 */
export function isEventInFuture(date, time, now = Date.now()) {
  const start = getEventStart(date, time);
  return start !== null && start.getTime() > now;
}
