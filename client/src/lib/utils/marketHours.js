// US equities regular session: 9:30–16:00 ET, Mon–Fri. Holidays are out of scope.

const OPEN_MINUTES = 9 * 60 + 30; // 09:30
const CLOSE_MINUTES = 16 * 60; // 16:00

// Minutes since midnight and weekday (0=Sun..6=Sat) in America/New_York for `date`.
function etParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // Intl can emit "24" at midnight
  const minute = parseInt(get('minute'), 10);
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[get('weekday')] ?? 0;

  return { minutes: hour * 60 + minute, weekday };
}

function formatDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getMarketStatus(now = new Date()) {
  const { minutes, weekday } = etParts(now);
  const isWeekday = weekday >= 1 && weekday <= 5;
  const isOpen = isWeekday && minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES;

  if (isOpen) {
    return { isOpen: true, label: `Market open · Closes in ${formatDuration(CLOSE_MINUTES - minutes)}` };
  }

  // Closed: compute minutes until the next 09:30 ET open.
  let daysAhead = 0;
  let untilOpen;
  if (isWeekday && minutes < OPEN_MINUTES) {
    untilOpen = OPEN_MINUTES - minutes;
  } else {
    // Later today or a weekend: advance to the next weekday's open.
    untilOpen = OPEN_MINUTES + (24 * 60 - minutes);
    let day = (weekday + 1) % 7;
    daysAhead = 1;
    while (day === 0 || day === 6) {
      untilOpen += 24 * 60;
      day = (day + 1) % 7;
      daysAhead += 1;
    }
  }

  // For opens more than a day out, show a coarser label.
  const label =
    untilOpen >= 24 * 60
      ? `Market closed · Opens in ${Math.round(untilOpen / 60 / 24) || daysAhead}d`
      : `Market closed · Opens in ${formatDuration(untilOpen)}`;

  return { isOpen: false, label };
}
