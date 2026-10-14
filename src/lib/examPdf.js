// End-term exam schedule extraction.
//
// The PDF is a five-column table (Day & Date | Course Name | Venue | Time |
// Invigilator). pdf.js gives text fragments at coordinates; this module
// reconstructs rows from geometry alone and is deliberately free of any
// pdf.js import so it can be tested in Node against the real file.
//
// Approach: every Time cell ("9:00 am to 12:00 pm") anchors one exam row.
// Midpoints between consecutive anchors define horizontal bands; name and
// venue fragments fall into whichever band contains their y — which is what
// makes two-line course names (one line above the time, one below) come out
// whole. Dates attach to the nearest anchor, then flow down: a date cell is
// vertically centred across its whole day, so later rows of the same day
// inherit the last seen date.

const COLS = {
  date: [0, 160],
  name: [160, 246],
  venue: [246, 300],
  time: [300, 360],
};
const inCol = (x, [lo, hi]) => x >= lo && x < hi;

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_RE = /(\d{1,2})[:.](\d{2})\s*(am|pm)?/gi;
const DATE_RE = /(\d{1,2})\s*(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})/;

function parseLongDate(text) {
  const m = text.match(DATE_RE);
  if (!m) return null;
  const monIx = MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase()));
  if (monIx === -1) return null;
  const dt = new Date(+m[3], monIx, +m[1], 12);
  const p = (n) => String(n).padStart(2, '0');
  return {
    iso: `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`,
    ix: (dt.getDay() + 6) % 7,
    day: DAY_NAMES[(dt.getDay() + 6) % 7],
  };
}

/**
 * Normalise a time cell to "9:00 AM – 12:00 PM" plus a 24h start for
 * sorting. Tolerates the sheet's typos ("4:30 - pm to 6:30 pm") and a
 * missing meridiem: hours 8–11 read as am, everything else pm — which is
 * how the institute's slots actually run.
 */
export function normaliseTimeRange(text) {
  const found = [...String(text).matchAll(TIME_RE)].map((m) => ({
    h: +m[1],
    m: +m[2],
    mer: m[3] ? m[3].toLowerCase() : null,
  }));
  if (!found.length) return null;
  const fix = (t) => {
    const mer = t.mer || (t.h >= 8 && t.h <= 11 ? 'am' : 'pm');
    let h24 = t.h % 12;
    if (mer === 'pm') h24 += 12;
    return { label: `${t.h}:${String(t.m).padStart(2, '0')} ${mer.toUpperCase()}`, h24, mm: t.m };
  };
  const a = fix(found[0]);
  const b = found.length > 1 ? fix(found[found.length - 1]) : null;
  const p = (n) => String(n).padStart(2, '0');
  return {
    label: b ? `${a.label} – ${b.label}` : a.label,
    start: `${p(a.h24)}:${p(a.mm)}`,
  };
}

/**
 * @param items  [{ s, x, y }] text fragments of one page, any order
 * @returns      [{ iso, ix, day, name, time, start, venue }]
 *
 * Fragments are first clustered into BLOCKS (contiguous lines in the same
 * column), and whole blocks are then assigned to the exam row whose time
 * anchor is nearest — bounded so the page title above the table claims
 * nothing. Assigning blocks rather than lines is what keeps a ten-line
 * venue stack (Capstone) together instead of leaking into the row above.
 */
export function extractExams(items) {
  const frags = items.filter((i) => i.s && i.s.trim());

  const anchors = frags
    .filter((i) => inCol(i.x, COLS.time) && /\d{1,2}[:.]\d{2}/.test(i.s) && /am|pm/i.test(i.s))
    .sort((a, b) => b.y - a.y);
  if (!anchors.length) return [];

  // The table's top: nothing above the first row's reach may be claimed.
  const firstGap = anchors.length > 1 ? anchors[0].y - anchors[1].y : 24;
  const tableTop = anchors[0].y + firstGap / 2;

  const clusterColumn = (col, excludeRe) => {
    const inColumn = frags
      .filter((i) => inCol(i.x, col) && !(excludeRe && excludeRe.test(i.s.trim())))
      .sort((a, b) => b.y - a.y);
    const blocks = [];
    inColumn.forEach((f) => {
      const cur = blocks[blocks.length - 1];
      if (cur && cur.frags[cur.frags.length - 1].y - f.y <= 13) cur.frags.push(f);
      else blocks.push({ frags: [f] });
    });
    blocks.forEach((b) => {
      b.center = b.frags.reduce((s, f) => s + f.y, 0) / b.frags.length;
    });
    return blocks;
  };

  const nearestAnchor = (y) => {
    let best = -1;
    let bestDist = Infinity;
    anchors.forEach((a, k) => {
      const dist = Math.abs(a.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = k;
      }
    });
    return best;
  };

  const rows = anchors.map((a) => ({ timeText: a.s, y: a.y, nameBlocks: [], venueBlocks: [], date: null }));

  /**
   * Assign a block of lines to exam rows. If two or more anchors fall
   * STRICTLY inside the block's vertical span, the block genuinely covers
   * several rows (adjacent venue stacks touch) and each line goes to its
   * nearest in-span anchor. Otherwise the block belongs wholly to one row —
   * which is what keeps a tall single-row stack (Capstone's ten venues)
   * from leaking into the neighbour above.
   */
  const assignBlocks = (blocks, field) => {
    blocks.forEach((b) => {
      const ys = b.frags.map((f) => f.y);
      const lo = Math.min(...ys);
      const hi = Math.max(...ys);
      const inside = [];
      anchors.forEach((a, k) => {
        if (a.y >= lo && a.y <= hi) inside.push(k);
      });
      if (inside.length >= 2) {
        b.frags.forEach((f) => {
          let best = inside[0];
          let bestDist = Infinity;
          inside.forEach((k) => {
            const dist = Math.abs(anchors[k].y - f.y);
            if (dist < bestDist) {
              bestDist = dist;
              best = k;
            }
          });
          rows[best][field].push({ frags: [f], center: f.y });
        });
      } else {
        const k = inside.length === 1 ? inside[0] : nearestAnchor(b.center);
        rows[k]?.[field].push(b);
      }
    });
  };

  assignBlocks(
    clusterColumn(COLS.name, /^Course Name$/i).filter((b) => b.center <= tableTop),
    'nameBlocks'
  );
  assignBlocks(
    clusterColumn(COLS.venue, /^Venue$/i).filter((b) => b.center <= tableTop),
    'venueBlocks'
  );

  // Each day's date is a label centred over that day's rows, so every row
  // simply takes the date whose centre is nearest.
  const dates = frags
    .map((i) => ({ y: i.y, parsed: inCol(i.x, COLS.date) ? parseLongDate(i.s) : null }))
    .filter((x) => x.parsed);
  rows.forEach((r) => {
    let best = null;
    let bestDist = Infinity;
    dates.forEach((dd) => {
      const dist = Math.abs(dd.y - r.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = dd.parsed;
      }
    });
    r.date = best;
  });

  const joinBlocks = (blocks, sep) =>
    blocks
      .sort((a, b) => b.center - a.center)
      .flatMap((b) => b.frags.sort((x, y) => y.y - x.y || x.x - y.x).map((f) => f.s.trim()))
      .join(sep)
      .replace(/\s+/g, ' ')
      .trim();

  return rows
    .map((r) => {
      const time = normaliseTimeRange(r.timeText);
      const name = joinBlocks(r.nameBlocks, ' ');
      const venue = r.venueBlocks
        .sort((a, b) => b.center - a.center)
        .flatMap((b) => b.frags.sort((x, y) => y.y - x.y || x.x - y.x).map((f) => f.s.trim()))
        .join(', ');
      if (!r.date || !time || !name) return null;
      return { iso: r.date.iso, ix: r.date.ix, day: r.date.day, name, time: time.label, start: time.start, venue };
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------
// Matching exam names to timetable courses.
//
// The PDF carries full names, the timetable carries codes + names, and the
// two disagree in small ways: "&" vs "and", "(Global)" and "(Sec. X)"
// suffixes, capitalisation. Normalise both sides and match; containment
// covers abbreviated forms.
// ---------------------------------------------------------------------
const normalise = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * @returns exams decorated with { code } when a course matches, else code ''.
 */
export function matchExamsToCourses(exams, courses) {
  const byName = courses.map((c) => ({ code: c.code, norm: normalise(c.name) }));
  return exams.map((exam) => {
    const en = normalise(exam.name);
    let hit = byName.find((c) => c.norm === en);
    if (!hit) hit = byName.find((c) => c.norm.includes(en) || en.includes(c.norm));
    return { ...exam, code: hit ? hit.code : '' };
  });
}

/**
 * Exams travel in the quizzes table. Matched ones are named "CODE End Term"
 * so the existing quiz filtering (leading code vs selected courses) applies
 * unchanged; unmatched ones keep their full name and, like unknown quizzes,
 * are shown to everyone.
 */
export function examsToQuizRows(matched) {
  return matched.map((e) => ({
    day: e.day,
    ix: e.ix,
    iso: e.iso,
    name: e.code ? `${e.code} End Term` : `${e.name} — End Term`,
    time: e.time,
    room: e.venue,
  }));
}
