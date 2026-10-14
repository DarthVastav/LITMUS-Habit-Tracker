// Data access layer. Everything above this file speaks the prototype's
// shapes ("Twice a week", "Heavy", `log: [iso]`); everything below speaks
// Postgres enums and rows. The mapping lives here and nowhere else.
import { supabase } from './supabase.js';
import { hhmm, isoOf } from './date.js';

// ---- enum <-> label -------------------------------------------------
export const FREQ_LABELS = ['Daily', 'Twice a week', 'Thrice a week', 'Weekly', 'Monthly'];
const FREQ_TO_DB = { Daily: 'daily', 'Twice a week': 'twice_week', 'Thrice a week': 'thrice_week', Weekly: 'weekly', Monthly: 'monthly' };
const FREQ_FROM_DB = { daily: 'Daily', twice_week: 'Twice a week', thrice_week: 'Thrice a week', weekly: 'Weekly', monthly: 'Monthly' };

export const INTENSITY_LABELS = ['Light', 'Medium', 'Heavy'];

/** Starting set for a new account; every user can edit their own list. */
export const DEFAULT_CATEGORIES = ['Study', 'Fitness', 'Personal', 'Errands', 'Social'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const need = () => {
  if (!supabase) throw new Error('offline');
  return supabase;
};

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

// =====================================================================
//  Profile
// =====================================================================
export async function fetchProfile(userId) {
  const db = need();
  const row = unwrap(
    await db.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  );
  if (!row) return null;
  return {
    name: row.name,
    email: row.email,
    theme: row.theme,
    homeVariant: row.home_variant,
    habitRemind: row.habit_remind,
    habitRemindTime: hhmm(row.habit_remind_time),
    classRemind: row.class_remind,
    asgRemind: row.asg_remind,
    timezone: row.timezone,
    categories: row.task_categories?.length ? row.task_categories : DEFAULT_CATEGORIES,
    clearedClass: row.cleared_class_at || null,
    clearedMess: row.cleared_mess_at || null,
    clearedContinental: row.cleared_continental_at || null,
    momentum:
      row.score_momentum != null && row.score_momentum_date
        ? { value: row.score_momentum, date: row.score_momentum_date }
        : null,
  };
}

export async function upsertProfile(userId, patch) {
  const db = need();
  const row = { user_id: userId };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.homeVariant !== undefined) row.home_variant = patch.homeVariant;
  if (patch.habitRemind !== undefined) row.habit_remind = patch.habitRemind;
  if (patch.habitRemindTime !== undefined) row.habit_remind_time = patch.habitRemindTime;
  if (patch.classRemind !== undefined) row.class_remind = patch.classRemind;
  if (patch.asgRemind !== undefined) row.asg_remind = patch.asgRemind;
  if (patch.timezone !== undefined) row.timezone = patch.timezone;
  if (patch.categories !== undefined) row.task_categories = patch.categories;
  if (patch.clearedClass !== undefined) row.cleared_class_at = patch.clearedClass;
  if (patch.clearedMess !== undefined) row.cleared_mess_at = patch.clearedMess;
  if (patch.clearedContinental !== undefined) row.cleared_continental_at = patch.clearedContinental;
  if (patch.momentum !== undefined) {
    row.score_momentum = patch.momentum?.value ?? null;
    row.score_momentum_date = patch.momentum?.date ?? null;
  }
  unwrap(await db.from('profiles').upsert(row, { onConflict: 'user_id' }));
}

// =====================================================================
//  Tasks
// =====================================================================
const taskFromRow = (r) => ({
  id: r.id,
  title: r.title,
  cat: r.category,
  due: r.due,
  time: hhmm(r.due_time),
  done: r.done,
  doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
});

export async function fetchTasks(userId) {
  const db = need();
  const rows = unwrap(
    await db.from('tasks').select('*').eq('user_id', userId).order('due', { ascending: true })
  );
  return rows.map(taskFromRow);
}

export async function insertTask(userId, t) {
  const db = need();
  const row = unwrap(
    await db
      .from('tasks')
      .insert({
        user_id: userId,
        title: t.title,
        category: t.cat,
        due: t.due,
        due_time: t.time,
        done: false,
      })
      .select()
      .single()
  );
  return taskFromRow(row);
}

export async function updateTask(id, patch) {
  const db = need();
  const row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.cat !== undefined) row.category = patch.cat;
  if (patch.due !== undefined) row.due = patch.due;
  if (patch.time !== undefined) row.due_time = patch.time;
  if (patch.done !== undefined) {
    row.done = patch.done;
    row.done_at = patch.done ? new Date().toISOString() : null;
  }
  unwrap(await db.from('tasks').update(row).eq('id', id));
}

export const deleteTask = async (id) => void unwrap(await need().from('tasks').delete().eq('id', id));

// =====================================================================
//  Habits + logs
// =====================================================================
export async function fetchHabits(userId) {
  const db = need();
  const [habits, logs] = await Promise.all([
    db.from('habits').select('*').eq('user_id', userId).order('created_at'),
    db.from('habit_logs').select('habit_id,date').eq('user_id', userId),
  ]);
  const rows = unwrap(habits);
  const logRows = unwrap(logs);
  const byHabit = new Map();
  logRows.forEach((l) => {
    if (!byHabit.has(l.habit_id)) byHabit.set(l.habit_id, []);
    byHabit.get(l.habit_id).push(l.date);
  });
  return rows.map((r) => {
    const log = (byHabit.get(r.id) || []).sort();
    return {
      id: r.id,
      name: r.name,
      freq: FREQ_FROM_DB[r.freq] || 'Daily',
      streak: r.streak,
      notif: r.notif,
      created: isoOf(new Date(r.created_at)),
      log,
      last: log.length ? log[log.length - 1] : null,
    };
  });
}

export async function insertHabit(userId, h) {
  const db = need();
  const row = unwrap(
    await db
      .from('habits')
      .insert({ user_id: userId, name: h.name, freq: FREQ_TO_DB[h.freq] || 'daily', streak: 0, notif: true })
      .select()
      .single()
  );
  return {
    id: row.id,
    name: row.name,
    freq: FREQ_FROM_DB[row.freq],
    streak: 0,
    notif: true,
    created: isoOf(new Date(row.created_at)),
    log: [],
    last: null,
  };
}

export const updateHabit = async (id, patch) => {
  const db = need();
  const row = {};
  if (patch.streak !== undefined) row.streak = patch.streak;
  if (patch.notif !== undefined) row.notif = patch.notif;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.freq !== undefined) row.freq = FREQ_TO_DB[patch.freq] || 'daily';
  unwrap(await db.from('habits').update(row).eq('id', id));
};

export const deleteHabit = async (id) => void unwrap(await need().from('habits').delete().eq('id', id));

export const addHabitLog = async (userId, habitId, date) =>
  void unwrap(
    await need()
      .from('habit_logs')
      .upsert({ user_id: userId, habit_id: habitId, date }, { onConflict: 'habit_id,date' })
  );

export const removeHabitLog = async (habitId, date) =>
  void unwrap(await need().from('habit_logs').delete().eq('habit_id', habitId).eq('date', date));

// =====================================================================
//  Assignments + subtasks
// =====================================================================
export async function fetchAssignments(userId) {
  const db = need();
  const [asg, subs] = await Promise.all([
    db.from('assignments').select('*').eq('user_id', userId).order('due'),
    db.from('assignment_subtasks').select('*').eq('user_id', userId).order('position'),
  ]);
  const rows = unwrap(asg);
  const subRows = unwrap(subs);
  const byAsg = new Map();
  subRows.forEach((s) => {
    if (!byAsg.has(s.assignment_id)) byAsg.set(s.assignment_id, []);
    byAsg.get(s.assignment_id).push({ id: s.id, text: s.text, done: s.done });
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subj: r.subject,
    due: r.due,
    intensity: cap(r.intensity),
    type: cap(r.type),
    runway: r.runway_days ?? null,
    done: !!r.done,
    desc: r.description || '',
    subs: byAsg.get(r.id) || [],
  }));
}

export async function insertAssignment(userId, a) {
  const db = need();
  const row = unwrap(
    await db
      .from('assignments')
      .insert({
        user_id: userId,
        title: a.title,
        subject: a.subj,
        due: a.due,
        intensity: a.intensity.toLowerCase(),
        runway_days: a.runway ?? null,
        type: a.type.toLowerCase(),
        description: a.desc || '',
      })
      .select()
      .single()
  );
  return {
    id: row.id,
    title: row.title,
    subj: row.subject,
    due: row.due,
    intensity: cap(row.intensity),
    type: cap(row.type),
    desc: row.description || '',
    subs: [],
  };
}

export async function updateAssignment(id, patch) {
  const db = need();
  const row = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.subj !== undefined) row.subject = patch.subj;
  if (patch.due !== undefined) row.due = patch.due;
  if (patch.intensity !== undefined) row.intensity = patch.intensity.toLowerCase();
  if (patch.type !== undefined) row.type = patch.type.toLowerCase();
  if (patch.runway !== undefined) row.runway_days = patch.runway;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.desc !== undefined) row.description = patch.desc;
  unwrap(await db.from('assignments').update(row).eq('id', id));
}

export const deleteAssignment = async (id) =>
  void unwrap(await need().from('assignments').delete().eq('id', id));

export async function insertSubtask(userId, assignmentId, text, position) {
  const db = need();
  const row = unwrap(
    await db
      .from('assignment_subtasks')
      .insert({ user_id: userId, assignment_id: assignmentId, text, position })
      .select()
      .single()
  );
  return { id: row.id, text: row.text, done: row.done };
}

export const setSubtasksDone = async (assignmentId, done) =>
  void unwrap(await need().from('assignment_subtasks').update({ done }).eq('assignment_id', assignmentId));

export const updateSubtaskText = async (id, text) =>
  void unwrap(await need().from('assignment_subtasks').update({ text }).eq('id', id));

export const updateSubtask = async (id, done) =>
  void unwrap(await need().from('assignment_subtasks').update({ done }).eq('id', id));

export const deleteSubtask = async (id) =>
  void unwrap(await need().from('assignment_subtasks').delete().eq('id', id));

// =====================================================================
//  Shared timetable data
// =====================================================================
export async function fetchTimetable(userId) {
  const db = need();
  const [courseRes, sessionRes, quizRes, pickedRes, messRes, importRes] = await Promise.all([
    db.from('courses').select('*').order('key'),
    db.from('sessions').select('*'),
    db.from('quizzes').select('*'),
    db.from('selected_courses').select('course_key').eq('user_id', userId),
    db.from('mess_menu').select('*').order('iso').order('position'),
    db.from('imports').select('*').order('created_at', { ascending: false }),
  ]);

  const courseRows = unwrap(courseRes);
  const sessionRows = unwrap(sessionRes);
  const byCourse = new Map();
  sessionRows.forEach((s) => {
    if (!byCourse.has(s.course_id)) byCourse.set(s.course_id, []);
    byCourse.get(s.course_id).push({
      day: s.day,
      ix: s.ix,
      iso: s.iso,
      start: hhmm(s.start),
      end: hhmm(s.end),
      room: s.room || '',
      cnt: s.cnt || '',
    });
  });

  const courses = courseRows.map((c) => ({
    id: c.id,
    key: c.key,
    code: c.code,
    sec: c.sec || '',
    name: c.name,
    faculty: c.faculty || '',
    sessions: (byCourse.get(c.id) || []).sort((a, b) => a.ix - b.ix || a.start.localeCompare(b.start)),
  }));

  const messRows = unwrap(messRes);
  const groupMess = (variant) => {
    const days = new Map();
    messRows
      .filter((m) => m.variant === variant)
      .forEach((m) => {
        if (!days.has(m.iso)) days.set(m.iso, { day: m.day, date: m.date, iso: m.iso, meals: [] });
        days.get(m.iso).meals.push({ name: m.meal, time: m.time || '', items: m.items || [] });
      });
    return [...days.values()].sort((a, b) => a.iso.localeCompare(b.iso));
  };

  const imports = unwrap(importRes);
  // Who uploaded each sheet — shown on the file chip so the batch knows
  // whom to ping when something looks wrong.
  const uploaderIds = [...new Set(imports.map((i) => i.uploaded_by).filter(Boolean))];
  let namesById = new Map();
  if (uploaderIds.length) {
    try {
      const profs = unwrap(await db.from('profiles').select('user_id,name').in('user_id', uploaderIds));
      namesById = new Map(profs.map((p) => [p.user_id, p.name]));
    } catch {
      /* names are decoration — never sink the fetch */
    }
  }
  const latest = (kind) => {
    const row = imports.find((i) => i.kind === kind) || null;
    return row ? { ...row, uploader_name: namesById.get(row.uploaded_by) || null } : null;
  };

  return {
    courses,
    quizzes: unwrap(quizRes).map((q) => ({
      day: q.day,
      ix: q.ix,
      iso: q.iso,
      name: q.name,
      time: q.time || '',
      room: q.room || '',
    })),
    picked: unwrap(pickedRes).map((r) => r.course_key),
    mess: { regular: groupMess('regular'), continental: groupMess('continental') },
    imports: {
      class: latest('class'),
      mess: latest('mess'),
      continental: latest('continental'),
    },
  };
}

/** Selections are stored by course KEY, so they survive re-uploads,
 *  timetable resets, and weeks where a course doesn't appear. */
export async function setSelectedCourse(userId, courseKey, on) {
  const db = need();
  if (on) {
    unwrap(
      await db
        .from('selected_courses')
        .upsert({ user_id: userId, course_key: courseKey }, { onConflict: 'user_id,course_key' })
    );
  } else {
    unwrap(await db.from('selected_courses').delete().eq('user_id', userId).eq('course_key', courseKey));
  }
}

/**
 * Merge a freshly parsed class sheet into the shared timetable.
 *
 * ADDITIVE by design: only the date range the sheet itself covers is
 * replaced, so uploading Week 12 leaves Week 11's remaining days intact —
 * weeks accumulate as they're published instead of overwriting each other.
 *
 * Courses are matched on their natural key ("FRA A") and upserted; nothing
 * is deleted for merely being absent from this week's sheet, since a course
 * can skip a week and return. Quizzes follow the same in-range replacement.
 */
export async function replaceClassData(userId, { courses, quizzes, weekLabel }, fileName) {
  const db = need();

  // The window this sheet speaks for.
  const isos = [
    ...courses.flatMap((c) => c.sessions.map((s) => s.iso)),
    ...quizzes.map((q) => q.iso),
  ].sort();
  const rangeStart = isos[0];
  const rangeEnd = isos[isos.length - 1];

  if (courses.length) {
    const saved = unwrap(
      await db
        .from('courses')
        .upsert(
          courses.map((c) => ({
            key: c.key,
            code: c.code,
            sec: c.sec,
            name: c.name,
            faculty: c.faculty || '',
          })),
          { onConflict: 'key' }
        )
        .select()
    );
    const idByKey = new Map(saved.map((r) => [r.key, r.id]));

    // Clear only this sheet's window, across ALL courses — a course that
    // dropped out of this week's grid must not keep ghost sessions in it.
    if (rangeStart) {
      unwrap(await db.from('sessions').delete().gte('iso', rangeStart).lte('iso', rangeEnd));
    }

    const sessionRows = courses.flatMap((c) =>
      c.sessions.map((s) => ({
        course_id: idByKey.get(c.key),
        day: s.day,
        ix: s.ix,
        iso: s.iso,
        start: s.start,
        end: s.end,
        room: s.room,
        cnt: s.cnt,
      }))
    );
    if (sessionRows.length) unwrap(await db.from('sessions').insert(sessionRows));
  }

  if (rangeStart) {
    unwrap(await db.from('quizzes').delete().gte('iso', rangeStart).lte('iso', rangeEnd));
  }
  if (quizzes.length) unwrap(await db.from('quizzes').insert(quizzes));

  unwrap(
    await db
      .from('imports')
      .insert({ kind: 'class', file_name: fileName, week_label: weekLabel, uploaded_by: userId })
  );
}

/**
 * Merge an exam schedule (parsed from the PDF) into the shared quizzes
 * table. Additive like the class sheets: only the exam window's date range
 * is replaced, so regular weekly quizzes outside it are untouched.
 */
export async function replaceExamData(userId, rows, fileName) {
  const db = need();
  const isos = rows.map((r) => r.iso).sort();
  if (!isos.length) return;
  unwrap(await db.from('quizzes').delete().gte('iso', isos[0]).lte('iso', isos[isos.length - 1]));
  unwrap(await db.from('quizzes').insert(rows));
  // The log row is bookkeeping — it must never sink the import itself
  // (a database missing the 'exam' enum value did exactly that).
  try {
    unwrap(
      await db
        .from('imports')
        .insert({ kind: 'exam', file_name: fileName, week_label: `${isos[0]} – ${isos[isos.length - 1]}`, uploaded_by: userId })
    );
  } catch (err) {
    console.warn('[Litmus] exam import log skipped', err);
  }
}

/** Replace one mess variant with a freshly parsed sheet. */
export async function replaceMessData(userId, variant, days, fileName, lo, hi) {
  const db = need();
  // Additive like class sheets: this sheet only speaks for its own dates.
  unwrap(await db.from('mess_menu').delete().eq('variant', variant).gte('iso', lo).lte('iso', hi));
  const rows = days.flatMap((dy) =>
    dy.meals.map((m, i) => ({
      variant,
      day: dy.day,
      date: dy.date,
      iso: dy.iso,
      meal: m.name,
      time: m.time,
      items: m.items,
      position: i,
    }))
  );
  if (rows.length) unwrap(await db.from('mess_menu').insert(rows));
  unwrap(
    await db
      .from('imports')
      .insert({ kind: variant === 'continental' ? 'continental' : 'mess', file_name: fileName, uploaded_by: userId })
  );
}


// =====================================================================
//  Exam prep topics
// =====================================================================
export async function fetchPrep(userId) {
  const rows = unwrap(
    await need().from('prep_topics').select('*').eq('user_id', userId).order('created_at')
  );
  return rows.map((r) => ({ id: r.id, subject: r.subject, topic: r.topic, done: r.done }));
}

export async function insertPrepTopic(userId, subject, topic) {
  const row = unwrap(
    await need().from('prep_topics').insert({ user_id: userId, subject, topic }).select().single()
  );
  return { id: row.id, subject: row.subject, topic: row.topic, done: row.done };
}

export const updatePrepTopic = async (id, patch) => {
  const row = {};
  if (patch.topic !== undefined) row.topic = patch.topic;
  if (patch.subject !== undefined) row.subject = patch.subject;
  void unwrap(await need().from('prep_topics').update(row).eq('id', id));
};

export const togglePrepTopic = async (id, done) =>
  void unwrap(await need().from('prep_topics').update({ done }).eq('id', id));

export const deletePrepTopic = async (id) =>
  void unwrap(await need().from('prep_topics').delete().eq('id', id));

export const logFocusSession = async (userId, minutes, completed) =>
  void unwrap(await need().from('focus_sessions').insert({ user_id: userId, minutes, completed }));

// =====================================================================
//  Full reset
// =====================================================================
/**
 * Erase everything this user tracks: tasks, habits (+logs via cascade),
 * assignments (+sub-tasks), prep topics, course selections, and the
 * momentum score. The account, its preferences, and the SHARED timetable
 * and menus are untouched — those belong to everyone.
 */
export async function resetAllData(userId) {
  const db = need();
  unwrap(await db.from('tasks').delete().eq('user_id', userId));
  unwrap(await db.from('habits').delete().eq('user_id', userId));
  unwrap(await db.from('assignments').delete().eq('user_id', userId));
  unwrap(await db.from('prep_topics').delete().eq('user_id', userId));
  unwrap(await db.from('selected_courses').delete().eq('user_id', userId));
  unwrap(
    await db.from('profiles').update({ score_momentum: null, score_momentum_date: null }).eq('user_id', userId)
  );
}

// =====================================================================
//  Feedback
// =====================================================================
export const insertFeedback = async (userId, rating, text) =>
  void unwrap(await need().from('feedback').insert({ user_id: userId, rating, text }));
