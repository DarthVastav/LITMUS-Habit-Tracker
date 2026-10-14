// Date helpers. Every date the app stores is a local-time ISO day string
// (YYYY-MM-DD); times are 24h "HH:MM". Parsing always pins noon so a
// timezone shift can never roll a day forward or back.

const p = (n) => String(n).padStart(2, '0');

export const isoOf = (dateObj) =>
  `${dateObj.getFullYear()}-${p(dateObj.getMonth() + 1)}-${p(dateObj.getDate())}`;

/** ISO day string `offset` days from now. d(0) = today, d(1) = tomorrow. */
export const d = (offset = 0) => isoOf(new Date(Date.now() + offset * 864e5));

export const addDays = (iso, n) => {
  const x = new Date(`${iso}T12:00`);
  x.setDate(x.getDate() + n);
  return isoOf(x);
};

export const dayDiff = (a, b) =>
  Math.round((new Date(`${a}T12:00`) - new Date(`${b}T12:00`)) / 864e5);

/** "Fri 28 Aug" */
export const fmtDay = (iso) =>
  new Date(`${iso}T12:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/** "6:30 PM" from "18:30" (tolerates "18:30:00" from a Postgres `time`). */
export const fmt12 = (t) => {
  const [hh, mm] = String(t).split(':');
  const h = +hh;
  return `${h % 12 || 12}:${String(+mm || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Normalise a Postgres `time` value back to "HH:MM". */
export const hhmm = (t) => String(t || '').slice(0, 5);

export const dLabel = (iso) =>
  iso === d(0) ? 'Today' : iso === d(1) ? 'Tomorrow' : fmtDay(iso);

/** Fourteen days of dropdown options, starting today. */
export const dateOptions = (onPick) =>
  Array.from({ length: 14 }, (_, i) => {
    const iso = d(i);
    return {
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDay(iso),
      pick: () => onPick(iso),
    };
  });

/** All half-hour slots from 06:00 to 23:30. */
const allSlots = () => {
  const out = [];
  for (let h = 6; h < 24; h++) for (const m of ['00', '30']) out.push(`${p(h)}:${m}`);
  return out;
};

/** The next half-hour boundary at or after now, e.g. 07:40 → "08:00". */
export const nextSlot = (now = new Date()) => {
  const mins = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(mins / 30) * 30;
  if (rounded >= 24 * 60) return null;
  return `${p(Math.floor(rounded / 60))}:${p(rounded % 60)}`;
};

/**
 * Half-hour slots for a picker.
 *
 * Pass `forDate` and, when it's today, past slots are dropped — offering
 * 6:00 AM at four in the afternoon just makes the user scroll. Any other
 * date gets the full day. Omit `forDate` entirely for recurring times
 * (like a daily reminder), where "past" has no meaning.
 */
export const timeOptions = (onPick, forDate) => {
  let slots = allSlots();
  if (forDate && forDate === d(0)) {
    const from = nextSlot();
    const remaining = from ? slots.filter((s) => s >= from) : [];
    // Late at night nothing is left; show the full day rather than an
    // empty menu, since the user may still want to log something.
    if (remaining.length) slots = remaining;
  }
  return slots.map((t) => ({ label: fmt12(t), pick: () => onPick(t) }));
};

/** Clamp a time to the first available slot for a date, if it's now past. */
export const firstAvailableTime = (forDate, preferred = '18:00') => {
  if (forDate !== d(0)) return preferred;
  const from = nextSlot();
  if (!from) return preferred;
  return preferred >= from ? preferred : from;
};

export const greetingFor = (hour = new Date().getHours()) =>
  hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
