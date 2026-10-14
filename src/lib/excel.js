// Client-side Excel parsing (SheetJS). Implements the rules that were
// worked out against the real sheets:
//
//   Class master  — rows 3–9 are Mon–Sun, row 2 holds the time-slot
//                   columns, each cell can hold several offerings in the
//                   form `CODE [A-E]? nn/nn (room)`. The abbreviation
//                   table further down the same sheet maps code → name.
//                   Quiz entries sit in the unlabelled lunch-adjacent
//                   column and apply to everybody.
//
//   Mess menu     — a day block starts at a "Monday 24th August 2026"
//                   style cell; columns B–E are Breakfast / Lunch /
//                   Snacks / Dinner. Rows are collected until the next
//                   day cell. The first item in a meal is the headline.
import * as XLSX from 'xlsx';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MEALS = [
  { name: 'Breakfast', time: '8:15–11:00 AM' },
  { name: 'Lunch', time: '12:15–2:30 PM' },
  { name: 'Snacks', time: '4:15–6:00 PM' },
  { name: 'Dinner', time: '8:15–10:15 PM' },
];

const p2 = (n) => String(n).padStart(2, '0');
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

async function readGrid(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

/** Excel stores times as a fraction of a day; strings come through as-is. */
function toHHMM(cell) {
  if (cell === '' || cell == null) return null;
  if (typeof cell === 'number') {
    const frac = cell % 1;
    const mins = Math.round(frac * 24 * 60);
    return `${p2(Math.floor(mins / 60) % 24)}:${p2(mins % 60)}`;
  }
  const s = clean(cell);
  const m = s.match(/(\d{1,2})[.:h](\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = +m[1];
  const min = +m[2];
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  // Bare afternoon slots on these sheets are written in 12-hour form.
  if (!ap && h < 7) h += 12;
  return `${p2(h)}:${p2(min)}`;
}

const addMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${p2(Math.floor(t / 60) % 24)}:${p2(t % 60)}`;
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Build the day descriptor from a known y/m/d, filling in the weekday. */
function dayFrom(year, monIx, dd) {
  if (!(monIx >= 0 && monIx < 12) || !(dd >= 1 && dd <= 31)) return null;
  const dt = new Date(year, monIx, dd, 12);
  if (dt.getDate() !== dd || dt.getMonth() !== monIx) return null; // rejects 31 Feb
  return {
    ix: (dt.getDay() + 6) % 7, // Monday-indexed
    iso: `${year}-${p2(monIx + 1)}-${p2(dd)}`,
    day: LONG_DAYS[(dt.getDay() + 6) % 7],
    date: `${dd} ${SHORT_MONTHS[monIx]}`,
  };
}

/**
 * Recognise a day anchor in any of the forms these sheets use:
 *   "Monday 24th August 2026"   (regular mess)
 *   "24.8.2026" / "24-8-26" / "24/08/2026"   (continental) — day first,
 *                               matching the Indian convention the sheets use
 *   an Excel date serial, when the cell was typed as a real date
 */
function matchDayCell(cell) {
  // Excel serials: days since 1899-12-30.
  if (typeof cell === 'number' && cell > 20000 && cell < 80000) {
    const dt = new Date(Math.round((cell - 25569) * 86400 * 1000));
    return dayFrom(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  }

  const s = clean(cell);
  if (!s) return null;

  // "Monday 24th August 2026"
  const named = LONG_DAYS.findIndex((d) => new RegExp(`^${d}\\b`, 'i').test(s));
  if (named !== -1) {
    const m = s.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+([A-Za-z]+)\s*(\d{4})?/);
    if (!m) return null;
    const monIx = MONTHS.findIndex((mo) => mo.startsWith(m[2].toLowerCase()));
    const year = m[3] ? +m[3] : new Date().getFullYear();
    const built = dayFrom(year, monIx, +m[1]);
    // Trust the sheet's own weekday label over the computed one.
    return built ? { ...built, ix: named, day: LONG_DAYS[named] } : null;
  }

  // "24.8.2026", "24/08/26", "24-8-2026"
  const numeric = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (numeric) {
    let year = +numeric[3];
    if (year < 100) year += 2000;
    return dayFrom(year, +numeric[2] - 1, +numeric[1]);
  }

  return null;
}

/** Find the row that labels the meal columns, and which column is which. */
function findMealHeader(grid) {
  const known = ['breakfast', 'lunch', 'snacks', 'dinner', 'supper', 'brunch'];
  for (let r = 0; r < Math.min(grid.length, 15); r++) {
    const row = grid[r] || [];
    const cols = [];
    row.forEach((cell, c) => {
      const v = clean(cell).toLowerCase();
      const hit = known.find((k) => v === k || v === `${k} menu`);
      if (hit) cols.push({ col: c, name: hit.charAt(0).toUpperCase() + hit.slice(1) });
    });
    if (cols.length) return { row: r, cols };
  }
  return null;
}

// =====================================================================
//  Class master timetable
// =====================================================================

/**
 * The abbreviation table sits below the grid, laid out as
 *   B: code | D: course name | G: credits | J: faculty
 * with blank columns between, so scan rightwards rather than assuming the
 * next cell along. Credits are numeric and skipped; the faculty is the
 * second prose cell to the right of the code.
 */
function readAbbreviations(grid, startRow) {
  const map = {};
  const isCode = (s) => /^[A-Z][A-Z0-9&/.\- ]{1,14}$/.test(s) && /[A-Z]{2}/.test(s);
  const isProse = (s) => s.length >= 4 && /[a-z]{2}/.test(s);

  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r] || [];
    let codeCol = -1;
    let code = '';
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const v = clean(row[c]);
      if (v && isCode(v) && !/^(ABBR|COURSE|CREDITS|FACULTY)$/i.test(v)) {
        code = v;
        codeCol = c;
        break;
      }
    }
    if (codeCol === -1 || map[code]) continue;

    const prose = [];
    for (let c = codeCol + 1; c < row.length; c++) {
      const v = clean(row[c]);
      if (v && isProse(v)) prose.push(v);
    }
    if (prose.length) map[code] = { name: prose[0], faculty: prose[1] || '' };
  }
  return map;
}

/**
 * Pull the offerings out of one grid cell, e.g.
 *   "COMSTR A 20/24 (CR 4) FIS 19/24 (GF) (CR 12)"
 * Codes are matched against the abbreviation table so that room prefixes
 * like "CR" are never mistaken for a course.
 */
function parseOfferings(cellText, knownCodes) {
  const s = clean(cellText);
  if (!s) return [];
  const out = [];
  const alt = knownCodes.length
    ? knownCodes
        .slice()
        .sort((a, b) => b.length - a.length)
        .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')
    : '[A-Z][A-Z0-9&/]{1,12}';

  // Capture every trailing "(...)" group so "(VP) (CR 1)" keeps the room.
  const re = new RegExp(
    `\\b(${alt})\\b\\s*([A-E])?\\s*(?:[-–]\\s*)?(\\d{1,3}\\s*/\\s*\\d{1,3})?((?:\\s*\\([^)]*\\))*)`,
    'g'
  );

  let m;
  while ((m = re.exec(s))) {
    const groups = (m[4] || '').match(/\(([^)]*)\)/g)?.map((g) => g.slice(1, -1).trim()) || [];
    // The room is whichever group names a room; otherwise the last one
    // (covers "online"). Faculty markers like (GF)/(VP) fall away.
    const room =
      groups.find((g) => /\b(CR|LAB|ROOM)\b/i.test(g)) ||
      groups.find((g) => /online/i.test(g)) ||
      groups[groups.length - 1] ||
      '';
    out.push({
      code: m[1],
      sec: m[2] || '',
      cnt: m[3] ? m[3].replace(/\s+/g, '') : '',
      room,
      key: m[2] ? `${m[1]} ${m[2]}` : m[1],
    });
  }
  return out;
}

function looksLikeQuiz(text) {
  return /\bquiz\b/i.test(String(text || ''));
}

/**
 * Read the time-slot header row into { col: {start, end} }.
 *
 * The sheet writes 12-hour times with no am/pm ("7.00-8.15" is 7pm), so the
 * only reliable signal is that slots run left to right in order. Walk the
 * row and push any time that goes backwards into the afternoon. Both ends
 * are parsed because slot lengths vary — most are 75 minutes, but the
 * 8.15-8.45 slot is 30.
 */
function readTimeSlots(row) {
  const raw = [];
  (row || []).forEach((cell, col) => {
    const s = clean(cell);
    const m = s.match(/(\d{1,2})[.:h](\d{2})\s*[-–]\s*(\d{1,2})[.:h](\d{2})/);
    if (m) raw.push({ col, sh: +m[1], sm: +m[2], eh: +m[3], em: +m[4] });
  });

  const slots = {};
  let prev = -1;
  for (const r of raw) {
    let start = r.sh * 60 + r.sm;
    while (start < prev) start += 12 * 60; // crossed into the afternoon
    let end = r.eh * 60 + r.em;
    while (end <= start) end += 12 * 60;
    const fmt = (mins) => `${p2(Math.floor(mins / 60) % 24)}:${p2(mins % 60)}`;
    slots[r.col] = { start: fmt(start), end: fmt(end) };
    prev = start;
  }
  return slots;
}

/** Locate the header row of time slots — the first row with 3+ ranges. */
function findTimeRow(grid) {
  for (let r = 0; r < Math.min(grid.length, 8); r++) {
    if (Object.keys(readTimeSlots(grid[r])).length >= 3) return r;
  }
  return 1;
}

/**
 * @returns {{courses:Array, quizzes:Array, weekLabel:string}}
 */
export async function parseClassSheet(file) {
  const grid = await readGrid(file);

  const timeRow = findTimeRow(grid);
  const slots = readTimeSlots(grid[timeRow]);

  // Day rows follow the header. The date may be a real Excel date (a number)
  // or written out, so the raw cell value is passed through untouched.
  const dayRows = [];
  for (let r = timeRow + 1; r < grid.length && dayRows.length < 7; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < Math.min(row.length, 4); c++) {
      const hit = matchDayCell(row[c]);
      if (hit) {
        dayRows.push({ r, ...hit });
        break;
      }
    }
  }

  // If the sheet carries no dates at all, fall back to the current week so
  // the grid is still usable — the label makes clear the dates are inferred.
  let datesInferred = false;
  if (!dayRows.length) {
    datesInferred = true;
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 0; i < 7 && timeRow + 1 + i < grid.length; i++) {
      const dt = new Date(monday);
      dt.setDate(dt.getDate() + i);
      dayRows.push({
        r: timeRow + 1 + i,
        ix: i,
        iso: `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`,
        day: LONG_DAYS[i],
        date: `${dt.getDate()} ${SHORT_MONTHS[dt.getMonth()]}`,
      });
    }
  }

  const abbrev = readAbbreviations(grid, (dayRows[dayRows.length - 1]?.r ?? timeRow) + 1);
  const knownCodes = Object.keys(abbrev);

  const byKey = new Map();
  const quizzes = [];

  for (const dayRow of dayRows) {
    const row = grid[dayRow.r] || [];
    row.forEach((cell, col) => {
      const text = clean(cell);
      if (!text) return;

      if (looksLikeQuiz(text)) {
        const time = (text.match(/\(([^)]*)\)/) || [])[1] || '';
        quizzes.push({
          day: DAY_NAMES[dayRow.ix],
          ix: dayRow.ix,
          iso: dayRow.iso,
          name: text.replace(/\(([^)]*)\)/, '').trim(),
          time: clean(time),
        });
        return;
      }

      const slot = slots[col];
      if (!slot) return;

      for (const off of parseOfferings(text, knownCodes)) {
        if (!byKey.has(off.key)) {
          // The sheet has two tables: base codes ("PM") carry the faculty,
          // while sectioned rows ("PM C") carry only a name. Split the
          // section off so the code stays "PM" and the faculty resolves.
          const split = off.code.match(/^(.+?)\s+([A-E])$/);
          const base = split && abbrev[split[1]] ? split[1] : off.code;
          const sec = split && base !== off.code ? split[2] : off.sec;
          const own = abbrev[off.key] || abbrev[off.code] || {};
          const parent = abbrev[base] || {};
          byKey.set(off.key, {
            key: off.key,
            code: base,
            sec,
            name: own.name || parent.name || base,
            faculty: own.faculty || parent.faculty || '',
            sessions: [],
          });
        }
        byKey.get(off.key).sessions.push({
          day: DAY_NAMES[dayRow.ix],
          ix: dayRow.ix,
          iso: dayRow.iso,
          start: slot.start,
          end: slot.end,
          room: off.room,
          cnt: off.cnt,
        });
      }
    });
  }

  const courses = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  courses.forEach((c) =>
    c.sessions.sort((a, b) => a.ix - b.ix || a.start.localeCompare(b.start))
  );

  const isos = dayRows.map((x) => x.iso).sort();
  const fd = new Date(`${isos[0]}T12:00`);
  const ld = new Date(`${isos[isos.length - 1]}T12:00`);
  const weekLabel =
    `${fd.getDate()} ${SHORT_MONTHS[fd.getMonth()]} – ${ld.getDate()} ${SHORT_MONTHS[ld.getMonth()]} ${ld.getFullYear()}` +
    (datesInferred ? ' (dates estimated)' : '');

  return { courses, quizzes, weekLabel };
}

// =====================================================================
//  Mess menu
// =====================================================================

/**
 * Parse a weekly menu sheet.
 *
 * Handles both layouts these sheets come in:
 *   - a labelled header row naming the meal columns (LUNCH / DINNER / …),
 *     with days as dates down the left; and
 *   - no header row, in which case the four standard mess meals are assumed
 *     to sit in the columns immediately right of the day cell.
 *
 * @returns {Array<{day,date,iso,meals:Array<{name,time,items:string[]}>}>}
 */
export async function parseMessSheet(file) {
  const grid = await readGrid(file);
  const header = findMealHeader(grid);

  // Locate every day anchor, wherever it sits in the first few columns.
  const anchors = [];
  grid.forEach((row, r) => {
    if (header && r <= header.row) return; // don't treat the header as a day
    for (let c = 0; c < Math.min(3, (row || []).length); c++) {
      const hit = matchDayCell((row || [])[c]);
      if (hit) {
        anchors.push({ row: r, col: c, ...hit });
        break;
      }
    }
  });

  const defaultTime = (name) => MEALS.find((m) => m.name === name)?.time || '';

  const days = [];
  anchors.forEach((anchor, i) => {
    const stop = anchors[i + 1] ? anchors[i + 1].row : grid.length;

    // Which columns hold which meal: from the header when there is one,
    // otherwise the four standard meals immediately right of the day cell.
    const layout = header
      ? header.cols
      : MEALS.map((m, mi) => ({ col: anchor.col + 1 + mi, name: m.name }));

    const meals = layout
      .map(({ col, name }) => {
        const items = [];
        for (let r = anchor.row; r < stop; r++) {
          const val = clean((grid[r] || [])[col]);
          if (!val) continue;
          if (new RegExp(`^${name}$`, 'i').test(val)) continue; // repeated heading
          items.push(val);
        }
        return { name, time: defaultTime(name), items };
      })
      .filter((m) => m.items.length);

    if (meals.length) days.push({ day: anchor.day, date: anchor.date, iso: anchor.iso, meals });
  });

  return days;
}
