// Pure derivations from store state. Nothing here touches React or the
// network, so the scoring rules stay testable and live in one place.
import { d, addDays, dayDiff, fmtDay, fmt12 } from '../lib/date.js';
import { TERM_CATALOG } from '../data/termCatalog.js';

/**
 * When an assignment's runway opens — before that day it exists but is
 * neither scored nor nagged about. Group work needs less individual lead
 * time than solo work; a custom day-count overrides the matrix entirely.
 */
export const RUNWAY = {
  Group: { Light: 2, Medium: 4, Heavy: 10 },
  Individual: { Light: 3, Medium: 7, Heavy: 14 },
};
export const runwayDaysFor = (a) =>
  a.runway ?? RUNWAY[a.type]?.[a.intensity] ?? RUNWAY.Individual.Medium;
export const runwayOpenIso = (a) => addDays(a.due, -runwayDaysFor(a));
export const runwayIsOpen = (a, today = d(0)) => today >= runwayOpenIso(a);

/** Check-ins each cadence expects per period (day / week / month). */
export const QUOTA = { Daily: 1, 'Twice a week': 2, 'Thrice a week': 3, Weekly: 1, Monthly: 1 };

const weekStartOf = (iso) => {
  const dow = (new Date(`${iso}T12:00`).getDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dow);
};
const monthStartOf = (iso) => `${iso.slice(0, 8)}01`;

/** Check-ins inside the habit's current period (today / Mon–Sun / month). */
export function checksThisPeriod(habit, today = d(0)) {
  const from =
    habit.freq === 'Daily' ? today : habit.freq === 'Monthly' ? monthStartOf(today) : weekStartOf(today);
  return (habit.log || []).filter((x) => x >= from && x <= today).length;
}

/**
 * On track = this period's quota is met: checked today for daily, twice
 * this week for twice-a-week, once this week/month for the rest. This one
 * rule drives Routine, the greeting, Today's Focus, list sinking, and the
 * push reminders — so the app never nags about a habit it shows as done.
 */
export const isOnTrack = (habit, today = d(0)) =>
  checksThisPeriod(habit, today) >= (QUOTA[habit.freq] || 1);

/**
 * A habit sinks to the bottom of the list when it needs nothing right now:
 * checked today, or its period quota already met. A twice-a-week habit
 * checked once sinks for the day and floats back tomorrow; checked twice,
 * it stays down for the rest of the week.
 */
export const isSettled = (habit, today = d(0)) =>
  (habit.log || []).includes(today) || isOnTrack(habit, today);

/**
 * Score weights — the About legend renders from this same object, so the
 * documentation can never drift from the arithmetic. Streaks weigh most
 * (hardest to earn), then routine and assignments, then tasks.
 */
export const WEIGHTS = { tasks: 30, habits: 45, asg: 25 };

/**
 * Litmus score.
 *
 * A category only counts once there is something to measure. With no tasks,
 * no habits and no assignments there is nothing to say, so the score is
 * `null` and the UI shows a dash rather than inventing a number. Categories
 * that do have data are renormalised across the weights that apply, so
 * your first task isn't diluted by three empty categories.
 *
 *   tasks 20 · streaks 30 · routine 25 · assignments 25 (see WEIGHTS)
 *   minus min(12, 3 · overdue)
 */
export function scoreOf({ tasks, habits, assignments }) {
  const today = d(0);
  const windowStart = addDays(today, -29); // the last 30 days, today included

  // TASKS — everything due in the window INCLUDING all of today. Adding a
  // task for tonight dips the score until it's done — deliberate pressure,
  // chosen over neutrality. Ticks move this both ways, symmetrically.
  const relevant = tasks.filter((t) => t.due >= windowStart && (t.done || t.due <= today));
  const taskRate = relevant.length ? relevant.filter((t) => t.done).length / relevant.length : null;

  // HABITS — actual check-ins over expected check-ins for each habit's
  // cadence, from its creation day, within the window. Capped at 100% per
  // habit so over-checking one can't subsidise neglecting another.
  const PER_DAY = { Daily: 1, 'Twice a week': 2 / 7, 'Thrice a week': 3 / 7, Weekly: 1 / 7, Monthly: 1 / 30 };
  const ratios = habits
    .map((h) => {
      const from = (h.created || windowStart) > windowStart ? h.created : windowStart;
      if (from > today) return null;
      const daysActive = dayDiff(today, from) + 1;
      const expected = daysActive * (PER_DAY[h.freq] || 1);
      if (expected <= 0) return null;
      const actual = (h.log || []).filter((x) => x >= from && x <= today).length;
      return Math.min(1, actual / expected);
    })
    .filter((r) => r !== null);
  const habitRate = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

  // ASSIGNMENTS — average sub-task completion of assignments due in or
  // after the window. Prep topics are deliberately NOT scored.
  const activeAsg = assignments.filter((a) => a.due >= windowStart && runwayIsOpen(a));
  const asgRate = activeAsg.length
    ? activeAsg.reduce((s, a) => s + (a.subs.length ? a.subs.filter((x) => x.done).length / a.subs.length : a.done ? 1 : 0), 0) /
      activeAsg.length
    : null;

  // PENALTY — escalates per day overdue: 3 the first day, +2 each further
  // day, capped at 12 per task and 20 in total. Clearing the task clears
  // its penalty instantly.
  const overdue = tasks.filter((t) => !t.done && t.due < today);
  const penalty = Math.min(
    20,
    overdue.reduce((s, t) => s + Math.min(12, 3 + 2 * (dayDiff(today, t.due) - 1)), 0)
  );

  const parts = [
    { key: 'tasks', weight: WEIGHTS.tasks, rate: taskRate },
    { key: 'habits', weight: WEIGHTS.habits, rate: habitRate },
    { key: 'asg', weight: WEIGHTS.asg, rate: asgRate },
  ];
  const measured = parts.filter((p) => p.rate !== null);
  const pcts = Object.fromEntries(parts.map((p) => [p.key, p.rate === null ? null : Math.round(p.rate * 100)]));

  if (!measured.length) return { score: null, penalty: 0, overdueCount: overdue.length, pcts };

  const weightSum = measured.reduce((s, p) => s + p.weight, 0);
  const raw = measured.reduce((s, p) => s + p.weight * p.rate, 0);
  const score = Math.max(0, Math.round((raw / weightSum) * 100) - penalty);
  return { score, penalty, overdueCount: overdue.length, pcts };
}

export const scoreLabel = (score) =>
  score === null
    ? 'Getting started'
    : score >= 90
      ? 'Excellent'
      : score >= 75
        ? 'Very good'
        : score >= 50
          ? 'Steady'
          : 'Needs care';


/** The hue needs a number even before a score exists — this is neutral blue. */
export const NEUTRAL_SCORE = 62;

/** Tasks that are still open, earliest deadline first. */
export const pendingTasks = (tasks) =>
  tasks.filter((t) => !t.done).sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));

/** Courses the user has selected. `picked` holds course KEYS ("PM C"),
 *  not row ids — keys survive re-uploads and timetable resets. */
export const chosenCourses = (courses, picked) => courses.filter((c) => picked.includes(c.key));

/**
 * The class that is either running right now or is next up. A session
 * stays "current" for its full 1h15m before the highlight moves on.
 */
export function currentSession(courses, picked, now = new Date()) {
  let best = null;
  chosenCourses(courses, picked).forEach((c) =>
    c.sessions.forEach((x) => {
      const startsAt = new Date(`${x.iso}T${x.start}:00`);
      const endsAt = new Date(startsAt.getTime() + 75 * 60000);
      if (endsAt > now && (!best || startsAt < best.startsAt)) best = { startsAt, course: c, session: x };
    })
  );
  return best ? { ...best, ongoing: best.startsAt <= now } : null;
}

export function nextClassChip({ courses, picked, imports }, best) {
  if (!imports.class) return 'Upload sheet';
  if (!chosenCourses(courses, picked).length) return 'Pick courses';
  if (!best) return '—';
  const sameDay = best.session.iso === d(0);
  if (best.ongoing) return `${best.course.code} · now`;
  return `${best.course.code} · ${sameDay ? '' : `${best.session.day} `}${fmt12(best.session.start)}`;
}

/** "FRA QUIZ II" → "FRA". Empty when the name doesn't look like one. */
export const quizCode = (name) =>
  (String(name).match(/^(.+?)\s*(?:[—–-]\s*)?(?:quiz|end\s*term|mid\s*term|exam)/i)?.[1] || '').trim();

/**
 * Quizzes shown to this user: only those whose course they've selected.
 * A quiz whose code matches no known course is shown to everyone —
 * a stray quiz you can ignore beats a missing quiz you needed.
 */
/** "Management Consulting (Sec A)" → "management consulting" for matching. */
const normTitle = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\(?\s*sec\.?\s*[a-z].*$/i, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Course display name without the section suffix, however it's spelled. */
/**
 * Additive merge for mess menus, mirroring the class-sheet rule: the new
 * sheet replaces only its own dates within the variant; other dates stay.
 * Returns null when the sheet carries no dated days at all.
 */
export function mergeParsedMess(existingDays, newDays) {
  const isos = (newDays || []).map((dy) => dy.iso).filter(Boolean).sort();
  if (!isos.length) return null;
  const lo = isos[0];
  const hi = isos[isos.length - 1];
  const kept = (existingDays || []).filter((dy) => dy.iso < lo || dy.iso > hi);
  const days = [...kept, ...newDays].sort((a, b) => a.iso.localeCompare(b.iso));
  return { days, lo, hi };
}

/**
 * Apply a user's personal "cleared" timestamps to the shared timetable
 * data. Shared uploads from BEFORE the user's cleared-at are hidden for
 * them (data stays untouched for everyone else); any upload after that
 * moment — theirs or a classmate's — shows again.
 */
export function applyClears(tt, cleared) {
  const out = { ...tt, mess: { ...tt.mess }, imports: { ...tt.imports } };
  const gone = (importRow, at) => at && importRow && importRow.created_at && at >= importRow.created_at;
  if (gone(out.imports.class, cleared?.clearedClass)) {
    out.courses = [];
    out.quizzes = [];
    out.imports.class = null;
  }
  if (gone(out.imports.mess, cleared?.clearedMess)) {
    out.mess.regular = [];
    out.imports.mess = null;
  }
  if (gone(out.imports.continental, cleared?.clearedContinental)) {
    out.mess.continental = [];
    out.imports.continental = null;
  }
  return out;
}

/**
 * Display name + faculty for a course: the Term V catalog is authoritative
 * for any code it knows (week sheets carry abbreviations and rarely carry
 * faculty); unknown codes fall back to the sheet's own data.
 */
export const courseInfo = (c) => {
  const cat = TERM_CATALOG[c.code];
  return {
    name: cat?.name || baseCourseName(c.name),
    faculty: cat?.faculty || c.faculty || '',
  };
};

const baseCourseName = (name) => String(name).replace(/\s*\(?\s*Sec\.?\s*[A-Z].*$/i, '').trim();

/**
 * Resolve a quiz/exam entry to a course. Codes first ("PM — End Term");
 * failing that, the PDF's full-title exams ("Management Consulting — End
 * Term") are matched against course NAMES, so they filter and display
 * exactly like coded ones. Only entries matching nothing — genuinely
 * section-less things like Capstone — stay visible to everyone.
 */
/**
 * Courses worth offering in the picker: anything with an upcoming class
 * session or an upcoming exam that resolves to it. Old terms fade out of
 * the chips automatically (they stay in the database), and a user's
 * existing picks are always kept visible regardless.
 */
export function activeCourses(state) {
  const today = d(0);
  const live = new Set();
  state.courses.forEach((c) => {
    if ((c.sessions || []).some((s) => s.iso >= today)) live.add(c.key);
  });
  state.quizzes.forEach((q) => {
    if (q.iso < today) return;
    const r = resolveQuiz(state.courses, q.name);
    if (r.code) state.courses.filter((c) => c.code === r.code).forEach((c) => live.add(c.key));
  });
  state.picked.forEach((k) => live.add(k));
  return state.courses.filter((c) => live.has(c.key));
}

export function resolveQuiz(courses, name) {
  const kindMatch = String(name).match(/\s*(?:[—–-]\s*)?(end\s*term|mid\s*term|exam|quiz)\s*(i{1,3}|iv|v|\d+)?\s*$/i);
  const isExam = kindMatch ? /end|mid|exam/i.test(kindMatch[1]) : false;
  const title = kindMatch ? String(name).slice(0, kindMatch.index).trim() : String(name).trim();

  const code = quizCode(name);
  let course = code ? courses.find((c) => c.code === code) : null;

  if (!course && title) {
    const tNorm = normTitle(title);
    if (tNorm.length >= 4) {
      const names = (c) => [c.name, TERM_CATALOG[c.code]?.name].filter(Boolean);
      course =
        courses.find((c) => names(c).some((n) => normTitle(n) === tNorm)) ||
        courses.find((c) =>
          names(c).some((n) => normTitle(n).startsWith(tNorm) || tNorm.startsWith(normTitle(n)))
        );
    }
  }

  if (course) {
    return {
      code: course.code,
      display: course.code,
      courseName: courseInfo(course).name,
      allSections: false,
      isExam,
    };
  }
  const words = title.split(/\s+/);
  return {
    code: null,
    display: words.length >= 3 ? words[0] : title,
    courseName: title,
    allSections: true,
    isExam,
  };
}

export function visibleQuizzes(state) {
  const chosen = chosenCourses(state.courses, state.picked);
  const chosenCodes = new Set(chosen.map((c) => c.code));
  return state.quizzes
    .map((q) => ({ ...q, ...resolveQuiz(state.courses, q.name) }))
    .filter((q) => (q.code ? chosenCodes.has(q.code) : true));
}

/**
 * Assignment cards, sorted by deadline, with a computed plan strip.
 *
 * Every message ends in an action, never a verdict. Precedence:
 *   complete > overdue/due-today (urgency leads, progress encourages)
 *   > started (progress leads, deadline carries the urgency)
 *   > not started (timing leads — the only tier where "late start"
 *     appears, because that's the only tier where it's still actionable).
 */
export function assignmentPlans(assignments) {
  const today = d(0);
  const isComplete = (a) => (a.subs.length > 0 ? a.subs.every((x) => x.done) : !!a.done);
  const tier = (a) => (isComplete(a) ? 2 : runwayIsOpen(a) ? 0 : 1);
  return assignments
    .slice()
    // Open unfinished work on top (soonest first), not-yet-open in the
    // middle, completed at the bottom.
    .sort((a, b) => tier(a) - tier(b) || a.due.localeCompare(b.due))
    .map((a) => {
      const total = a.subs.length;
      const done = a.subs.filter((x) => x.done).length;
      const remaining = total - done;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const runway = runwayDaysFor(a);
      const startIso = addDays(a.due, -runway);
      const left = dayDiff(a.due, today);
      const lateBy = dayDiff(today, startIso);
      const duePhrase = left === 0 ? 'due today' : left === 1 ? 'due tomorrow' : `due ${fmtDay(a.due)}`;

      let plan;
      if (total > 0 && pct === 100) {
        plan = 'Complete — submitted or ready to submit.';
      } else if (left < 0) {
        const n = -left;
        const overdue = `Overdue by ${n} day${n > 1 ? 's' : ''}`;
        plan =
          done > 0 && remaining === 1
            ? `${overdue} — but only one sub-task left. Finish it today.`
            : done > 0
              ? `${overdue} — ${remaining} sub-tasks left, push them over the line.`
              : `${overdue} — submit as soon as you can, and trim anything optional.`;
      } else if (left === 0) {
        plan =
          done > 0 && remaining === 1
            ? 'Due today — one sub-task left. Bring it home.'
            : done > 0
              ? `Due today — ${done}/${total} done, ${remaining} to go. Clear the decks.`
              : 'Due today — clear the decks and get it done.';
      } else if (done > 0) {
        plan =
          remaining === 1
            ? `Almost there — one sub-task left, ${duePhrase}.`
            : pct >= 50
              ? `Halfway there — keep the momentum, ${duePhrase}.`
              : done === 1
                ? `That's a good start — ${remaining} to go, ${duePhrase}.`
                : `Underway — ${done}/${total} done, ${duePhrase}.`;
      } else if (today < startIso) {
        plan = `Start by ${fmtDay(startIso)} — ${runway}-day runway for a ${a.intensity.toLowerCase()} workload.`;
      } else if (today === startIso) {
        plan = `Start today — ${a.intensity.toLowerCase()} workload, ${duePhrase}.`;
      } else {
        plan = `Late start — the runway opened ${lateBy} day${lateBy > 1 ? 's' : ''} ago. Cut it to essentials and make ${
          left === 1 ? 'tomorrow' : 'the deadline'
        }.`;
      }

      return {
        ...a,
        pct,
        plan,
        runway,
        startIso,
        open: runwayIsOpen(a),
        opensPhrase: `Opens ${fmtDay(startIso)}`,
        meta: `${a.subj} · due ${fmtDay(a.due)} · ${a.intensity}`,
      };
    });
}

/**
 * The line under the greeting. It names the single most pressing thing
 * rather than counting things, because "1 habit to check in" tells you
 * nothing you didn't already know.
 *
 * Phrasing varies, but is seeded off the date so it stays put while you're
 * using the app and only changes tomorrow.
 */
const hashOf = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const pickOne = (arr, seed) => arr[hashOf(seed) % arr.length];

/** "A and B" / "A, B and C" */
const listOf = (items) =>
  items.length <= 1
    ? items[0] || ''
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function greetingLine(state, best, name = 'there') {
  const today = d(0);
  const seed = today + name;

  const pending = pendingTasks(state.tasks);
  const overdue = pending.filter((t) => t.due < today);
  const dueToday = pending.filter((t) => t.due === today);
  const habitsLeft = state.habits.filter((h) => !isOnTrack(h, today));

  // A class counts as "coming up" if it starts within the next three hours.
  const classSoon =
    best && best.session.iso === today && best.startsAt - Date.now() < 3 * 36e5 ? best : null;

  const nothingTracked =
    !state.tasks.length &&
    !state.habits.length &&
    !state.assignments.length &&
    !state.picked.length;
  if (nothingTracked) {
    return 'Nothing tracked yet — add a task or a habit and your reading starts here.';
  }

  // Everything still outstanding, so the tail can say what's left over.
  const totalOpen = overdue.length + dueToday.length + habitsLeft.length + (classSoon ? 1 : 0);

  let primary = null;
  let consumed = 1; // how many open items the sentence already speaks for

  if (overdue.length) {
    const t = overdue[0];
    const days = dayDiff(today, t.due);
    const when = days === 1 ? 'yesterday' : `${days} days ago`;
    primary = pickOne(
      [
        `“${t.title}” was due ${when} — worth clearing that one first.`,
        `“${t.title}” slipped past ${when}. Shall we get it off the list?`,
        `Still open from ${when}: “${t.title}”.`,
      ],
      seed + t.title
    );
  } else if (classSoon) {
    const label = classSoon.course.name || classSoon.course.key;
    const at = fmt12(classSoon.session.start);
    const room = classSoon.session.room ? ` in ${classSoon.session.room}` : '';
    primary = classSoon.ongoing
      ? `${label} is running right now${room}.`
      : pickOne(
          [
            `${label} at ${at}${room} — all set for it, ${name}?`,
            `You've got ${label} coming up at ${at}${room}.`,
            `${label} starts at ${at}${room}. Ready?`,
          ],
          seed + label
        );
  } else if (dueToday.length) {
    const t = dueToday[0];
    primary = pickOne(
      [
        `A gentle nudge — “${t.title}” is due by ${fmt12(t.time)}.`,
        `“${t.title}” is on today's list, due ${fmt12(t.time)}.`,
        `Don't let “${t.title}” slide — it's due at ${fmt12(t.time)}.`,
      ],
      seed + t.title
    );
  } else if (habitsLeft.length) {
    const names = habitsLeft.slice(0, 2).map((h) => `“${h.name}”`);
    if (habitsLeft.length === 1) {
      const h = habitsLeft[0];
      primary = pickOne(
        [
          `Don't forget “${h.name}” today.`,
          `${names[0]} is still waiting on a tick.`,
          h.streak > 2
            ? `${h.streak} days running on ${names[0]} — keep it going today.`
            : `Still to do today: ${names[0]}.`,
        ],
        seed + h.name
      );
    } else {
      primary = `${listOf(names)} are still waiting on you${
        habitsLeft.length > 2 ? `, plus ${habitsLeft.length - 2} more` : ''
      }.`;
      consumed = habitsLeft.length; // this branch speaks for all of them
    }
  }

  if (!primary) return 'All clear for today — nothing pending. Enjoy it.';

  // One short tail so the named item doesn't hide everything else.
  const rest = totalOpen - consumed;
  if (rest > 0) {
    return `${primary} ${rest === 1 ? 'One other thing after that.' : `${rest} other things after that.`}`;
  }
  return primary;
}

/** The "Today's focus" sentence, built from real tasks/assignments/habits. */
export function focusAdvice(state, { score, penalty }) {
  const today = d(0);
  const pending = pendingTasks(state.tasks);
  const plans = assignmentPlans(state.assignments);
  const bits = [];

  const overdue = pending.find((t) => t.due < today);
  if (overdue) bits.push(`Clear “${overdue.title}” first — it’s overdue and costing you ${penalty} pts`);

  const opened = plans.find((a) => a.pct < 100 && a.due >= today && today >= a.startIso);
  if (opened) {
    bits.push(
      `${bits.length ? 'then start “' : 'Start “'}${opened.title}” — ${opened.intensity.toLowerCase()} workload due ${fmtDay(opened.due)}`
    );
  }

  const unchecked = state.habits.filter((h) => !isOnTrack(h, today)).map((h) => h.name);
  if (unchecked.length && bits.length < 2) {
    bits.push(`${bits.length ? 'and check in on ' : 'Check in on '}${unchecked.join(' and ')}`);
  }

  if (!bits.length) {
    const dueToday = pending.find((t) => t.due === today);
    if (dueToday) bits.push(`Finish “${dueToday.title}” by ${fmt12(dueToday.time)}`);
  }

  if (bits.length) return `${bits.join(', ')}.`;
  if (score === null) {
    return 'Add your first task or habit — the score and the colour follow from what you track.';
  }
  return score >= 90
    ? 'You’re in the green — everything on track. Protect your streaks and keep the rhythm.'
    : 'All caught up for today. Get ahead on an assignment or plan tomorrow’s tasks.';
}

/** Chronological list for the Timeline home variant. */
export function todayTimeline(state) {
  const today = d(0);
  const rows = [];

  // Overdue tasks lead the day — they were vanishing from view, which is
  // exactly backwards for the thing most worth seeing.
  state.tasks
    .filter((t) => !t.done && t.due < today)
    .sort((a, b) => a.due.localeCompare(b.due))
    .forEach((t) =>
      rows.push({
        sort: '00:00',
        timeLabel: `was ${fmtDay(t.due)}`,
        kind: 'Overdue',
        label: t.title,
        sub: t.cat || '',
      })
    );

  chosenCourses(state.courses, state.picked).forEach((c) =>
    c.sessions
      .filter((x) => x.iso === today)
      .forEach((x) =>
        rows.push({
          sort: x.start,
          timeLabel: fmt12(x.start),
          kind: 'Class',
          label: `${c.key} — ${c.name}`,
          sub: x.room,
        })
      )
  );

  visibleQuizzes(state)
    .filter((q) => q.iso === today)
    .forEach((q) =>
      rows.push({
        sort: '13:45',
        timeLabel: q.time ? q.time.replace('-', '–') : '1:45 PM',
        kind: q.isExam ? 'Exam' : 'Quiz',
        label: q.isExam ? `${q.display} End Term` : q.display,
        sub: q.courseName + (q.allSections ? ' · all sections' : ''),
      })
    );

  pendingTasks(state.tasks)
    .filter((t) => t.due === today)
    .forEach((t) =>
      rows.push({ sort: t.time, timeLabel: fmt12(t.time), kind: 'Task', label: t.title, sub: t.cat })
    );

  rows.sort((a, b) => a.sort.localeCompare(b.sort));

  state.habits
    .filter((h) => h.freq === 'Daily' && h.last !== today)
    .forEach((h) =>
      rows.push({
        sort: 'zz',
        timeLabel: 'anytime',
        kind: 'Habit',
        label: h.name,
        sub: `Daily · streak ${h.streak}`,
      })
    );

  return rows;
}

/** Mon–Sun cards for the class timetable, quizzes folded in. */
/** "NAB LAB 1, NAB CR 1, …(x8)" → "NAB LAB 1, NAB CR 1 +8". */
export function trimVenues(room) {
  if (!room) return '';
  const parts = String(room).split(/\s*,\s*/).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  return `${parts[0]}, ${parts[1]} +${parts.length - 2}`;
}


/**
 * The schedule as day cards: grouped by actual DATE (not weekday), because
 * with additive uploads the timetable spans multiple weeks. Days already
 * behind you fall away — today and forward is what renders.
 */
export function weekSchedule(state, best) {
  const today = d(0);
  const chosen = chosenCourses(state.courses, state.picked);
  const quizzes = visibleQuizzes(state);

  const byIso = new Map();
  const dayOf = (iso) => {
    if (!byIso.has(iso)) byIso.set(iso, []);
    return byIso.get(iso);
  };

  chosen.forEach((c) =>
    c.sessions.forEach((x) => {
      if (x.iso < today) return;
      dayOf(x.iso).push({
        start: x.start,
        time: fmt12(x.start),
        key: courseInfo(c).name,
        sub: courseInfo(c).faculty || c.key,
        room: x.room,
        isQuiz: false,
        isNext:
          !!best && best.course.key === c.key && best.session.iso === x.iso && best.session.start === x.start,
      });
    })
  );

  quizzes.forEach((q) => {
    if (q.iso < today) return;
    // Derive a sortable start from the time text ("9:00 AM – 12:00 PM").
    const m = String(q.time).match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
    let start = '13:45';
    if (m) {
      let h = +m[1] % 12;
      const mer = m[3] ? m[3].toLowerCase() : +m[1] >= 8 && +m[1] <= 11 ? 'am' : 'pm';
      if (mer === 'pm') h += 12;
      start = `${String(h).padStart(2, '0')}:${m[2]}`;
    }
    dayOf(q.iso).push({
      start,
      time: q.time ? q.time.replace(/\s*-\s*/, ' – ') : '1:45 PM',
      key: q.courseName,
      sub: q.code || '',
      room: trimVenues(q.room),
      isQuiz: true,
      badge: q.isExam ? 'EXAM' : 'QUIZ',
      allSections: q.allSections,
      isNext: false,
    });
  });

  return [...byIso.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, items]) => {
      items.sort((a, b) => a.start.localeCompare(b.start));
      const dt = new Date(`${iso}T12:00`);
      return {
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(dt.getDay() + 6) % 7],
        date: `${dt.getDate()} ${dt.toLocaleDateString('en-US', { month: 'short' })}`,
        iso,
        isToday: iso === today,
        items,
      };
    });
}

/**
 * Merge a parsed class sheet into existing local state, mirroring what the
 * server does: only the sheet's own date range is replaced; everything the
 * sheet doesn't speak for survives. Pure, so the optimistic update and
 * local-only mode behave identically to the database.
 */
export function mergeParsedClass(existingCourses, existingQuizzes, parsed) {
  const isos = [
    ...parsed.courses.flatMap((c) => c.sessions.map((s) => s.iso)),
    ...parsed.quizzes.map((q) => q.iso),
  ].sort();
  if (!isos.length) return null;
  const lo = isos[0];
  const hi = isos[isos.length - 1];
  const inRange = (iso) => iso >= lo && iso <= hi;

  const byKey = new Map(
    existingCourses.map((c) => [c.key, { ...c, sessions: c.sessions.filter((s) => !inRange(s.iso)) }])
  );
  parsed.courses.forEach((c, i) => {
    const prev = byKey.get(c.key);
    byKey.set(c.key, {
      ...(prev || {}),
      ...c,
      id: prev?.id || c.id || `local-${i}`,
      sessions: [...(prev?.sessions || []), ...c.sessions].sort(
        (a, b) => a.iso.localeCompare(b.iso) || a.start.localeCompare(b.start)
      ),
    });
  });

  return {
    lo,
    hi,
    courses: [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key)),
    quizzes: [...existingQuizzes.filter((q) => !inRange(q.iso)), ...parsed.quizzes],
  };
}

/** "26 Aug – 4 Sep" from whatever days remain visible. */
export function scheduleRangeLabel(days) {
  if (!days.length) return '';
  const first = days[0];
  const last = days[days.length - 1];
  const year = last.iso.slice(0, 4);
  return days.length === 1 ? `${first.date} ${year}` : `${first.date} – ${last.date} ${year}`;
}

/**
 * Streak, recomputed from the log rather than incremented — so grace-window
 * edits to yesterday heal it correctly. Daily habits count consecutive
 * days ending today (or yesterday, so an unticked today doesn't zero it);
 * other frequencies count total check-ins, which survives edits and never
 * lies.
 */
export function computeStreak(freq, log) {
  if (!log?.length) return 0;
  if (freq !== 'Daily') return log.length;
  const days = new Set(log);
  let cursor = days.has(d(0)) ? d(0) : days.has(d(-1)) ? d(-1) : null;
  if (!cursor) return 0;
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/**
 * Month grid for the habit logger.
 *
 * A habit only participates from its creation date: days before it existed
 * are inert, not "missed" — you can't fail a habit that didn't exist.
 * Partial days fill bottom-up by the share of active habits completed.
 */
export function monthGrid({ habits }, monthOff, selection = []) {
  const today = d(0);
  const chosen = Array.isArray(selection) && selection.length
    ? habits.filter((h) => selection.includes(h.id))
    : habits;
  // Single-habit mode (per-day done/miss) applies when the filter narrows
  // to exactly one; any wider set aggregates like the all view.
  const selected = chosen.length === 1 && selection.length === 1 ? chosen[0] : null;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOff, 1);
  const p = (n) => String(n).padStart(2, '0');
  const isoOfDay = (dd) => `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(dd)}`;
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const lead = (base.getDay() + 6) % 7; // Monday-start grid

  const existedOn = (h, iso) => (h.created || '0000-01-01') <= iso;

  const cells = [];
  let logged = 0;
  let missed = 0;

  for (let i = 0; i < lead; i++) cells.push({ key: `pad-${i}`, label: '', state: 'pad', pct: 0 });

  for (let dd = 1; dd <= daysInMonth; dd++) {
    const iso = isoOfDay(dd);
    const past = iso < today;
    const future = iso > today;

    let done;
    let due;
    let active;
    if (selected) {
      active = existedOn(selected, iso);
      done = active && (selected.log || []).includes(iso) ? 1 : 0;
      due = active && selected.freq === 'Daily' ? 1 : 0;
    } else {
      const activeHabits = chosen.filter((h) => existedOn(h, iso));
      active = activeHabits.length > 0;
      done = activeHabits.filter((h) => (h.log || []).includes(iso)).length;
      due = activeHabits.length;
    }
    if (done) logged++;

    const isMiss = past && active && due > 0 && done === 0;
    if (isMiss) missed++;

    const pct = selected ? (done ? 100 : 0) : Math.round((done / Math.max(1, due)) * 100);
    const state = future
      ? 'future'
      : !active
        ? 'inactive'
        : pct >= 100 && done
          ? 'full'
          : done
            ? 'partial'
            : isMiss
              ? 'missed'
              : 'empty';

    cells.push({ key: iso, label: String(dd), state, pct, isToday: iso === today });
  }

  return {
    cells,
    monthLabel: base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    summary: `${logged} logged · ${missed} missed`,
  };
}

export const QUOTES = [
  'Small habits, repeated daily, become who you are.',
  'Discipline is choosing what you want most over what you want now.',
  'You do not rise to your goals — you fall to your systems.',
  'A routine is a promise you keep to yourself.',
  'Consistency beats intensity, every single week.',
  'What gets tracked gets done.',
];

export const PERSONALITY_QUOTES = [
  'Your personality is the sum of your daily choices.',
  'Every habit you keep casts a vote for who you become.',
  'Character is built one kept promise at a time.',
  'Who you are is what you do when no one is watching.',
  'Personality is not given — it is practiced.',
];
