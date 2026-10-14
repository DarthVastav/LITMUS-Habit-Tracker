import { create } from 'zustand';
import { supabase, configured, sendOtp, verifyOtp, signOut as authSignOut } from '../lib/supabase.js';
import * as db from '../lib/db.js';
import { DEFAULT_CATEGORIES } from '../lib/db.js';
import { d } from '../lib/date.js';
import { seedState } from '../data/seed.js';

const MIRROR = (uid) => `litmus_v3:${uid || 'local'}`;

/** Snapshot the parts of state worth keeping for offline reads. */
const snapshot = (s) => ({
  user: s.user,
  theme: s.theme,
  homeVariant: s.homeVariant,
  habitRemind: s.habitRemind,
  habitRemindTime: s.habitRemindTime,
  classRemind: s.classRemind,
  asgRemind: s.asgRemind,
  categories: s.categories,
  tasks: s.tasks,
  habits: s.habits,
  assignments: s.assignments,
  courses: s.courses,
  quizzes: s.quizzes,
  picked: s.picked,
  mess: s.mess,
  imports: s.imports,
});

const readMirror = (uid) => {
  try {
    return JSON.parse(localStorage.getItem(MIRROR(uid)) || 'null');
  } catch {
    return null;
  }
};

export const useStore = create((set, get) => {
  /** Persist the offline mirror after any mutation. */
  const mirror = () => {
    const s = get();
    try {
      localStorage.setItem(MIRROR(s.user?.id), JSON.stringify(snapshot(s)));
    } catch {
      /* quota — offline reads simply won't be available */
    }
  };

  /**
   * Run a remote write. The local state has already been updated
   * optimistically, so a failure only needs to tell the user.
   */
  const remote = async (fn, failMessage) => {
    if (!configured || get().localOnly) {
      mirror();
      return null;
    }
    try {
      const out = await fn();
      mirror();
      return out;
    } catch (err) {
      console.error('[Litmus]', err);
      mirror();
      if (failMessage) get().say(failMessage);
      return null;
    }
  };

  return {
    // ---- lifecycle ---------------------------------------------------
    ready: false,
    screen: 'login', // login | auth | error | app
    localOnly: !configured,
    loading: false,
    user: null,

    // ---- settings ----------------------------------------------------
    theme: 'dark',
    homeVariant: 'ring',
    habitRemind: true,
    habitRemindTime: '08:00',
    classRemind: true,
    asgRemind: true,
    categories: DEFAULT_CATEGORIES,

    // ---- data --------------------------------------------------------
    tasks: [],
    habits: [],
    assignments: [],
    courses: [],
    quizzes: [],
    picked: [],
    mess: { regular: [], continental: [] },
    imports: { class: null, mess: null, continental: null },

    // ---- ephemeral UI ------------------------------------------------
    tab: 'home',
    ttTab: 'class',
    messView: 'reg',
    drop: null,
    toast: null,
    aboutOpen: false,
    coursesOpen: true,
    loggerOpen: true,
    loggerSel: 'all',
    monthOff: 0,
    editId: null,
    quoteIx: Math.floor(Math.random() * 6),

    // ---- login form --------------------------------------------------
    email: '',
    loginName: '',
    code: '',
    emailErr: '',

    // =================================================================
    //  Toast + dropdown plumbing
    // =================================================================
    say(message) {
      set({ toast: message });
      clearTimeout(get()._toastTimer);
      const t = setTimeout(() => set({ toast: null }), 2600);
      set({ _toastTimer: t });
    },
    setDrop: (id) => set((s) => ({ drop: s.drop === id ? null : id })),
    closeDrop: () => set({ drop: null }),
    setTab: (tab) => set({ tab, drop: null, aboutOpen: false }),
    setUI: (patch) => set(patch),

    // =================================================================
    //  Auth
    // =================================================================
    async boot() {
      if (!configured) {
        // Local-only mode: restore whatever is on this device, else seed.
        const saved = readMirror(null);
        set({ ...(saved || seedState()), ready: true, screen: saved?.user ? 'app' : 'login', localOnly: true });
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        await get().hydrate(data.session.user);
        set({ ready: true, screen: 'app' });
      } else {
        set({ ready: true, screen: 'login' });
      }
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ user: null, screen: 'login', code: '', tab: 'home' });
        } else if (event === 'SIGNED_IN' && session?.user && !get().user) {
          get().hydrate(session.user).then(() => set({ screen: 'app' }));
        }
      });
    },

    async requestOtp() {
      const email = get().email.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        set({ emailErr: 'Enter a valid email address' });
        return;
      }
      if (!configured) {
        // No backend on this deployment — go straight in, local-only.
        const name = get().loginName.trim() || nameFromEmail(email);
        set({ ...seedState(), user: { id: 'local', name, email }, screen: 'app', localOnly: true });
        mirror();
        return;
      }
      set({ loading: true, emailErr: '' });
      try {
        await sendOtp(email, get().loginName.trim());
        set({ screen: 'auth', code: '', loading: false });
      } catch (err) {
        set({ loading: false, emailErr: friendlyAuthError(err) });
      }
    },

    async verifyCode() {
      const { email, code, loginName } = get();
      if (code.length < 6) {
        get().say('Enter the 6-digit code');
        return;
      }
      set({ loading: true });
      try {
        const { user } = await verifyOtp(email.trim(), code);
        if (loginName.trim() && user) {
          await supabase.auth.updateUser({ data: { name: loginName.trim() } });
        }
        await get().hydrate(user, loginName.trim());
        set({ screen: 'app', tab: 'home', loading: false, code: '' });
      } catch (err) {
        console.warn('[Litmus] OTP verify failed', err);
        set({ screen: 'error', loading: false });
      }
    },

    async resendOtp() {
      try {
        await sendOtp(get().email.trim(), get().loginName.trim());
        get().say(`New code sent to ${get().email.trim()}`);
      } catch (err) {
        get().say(friendlyAuthError(err));
      }
    },

    backToLogin: () => set({ screen: 'login', code: '', emailErr: '' }),

    async signOut() {
      await authSignOut();
      set({ user: null, screen: 'login', code: '', tab: 'home', tasks: [], habits: [], assignments: [] });
    },

    // =================================================================
    //  Hydration
    // =================================================================
    async hydrate(authUser, fallbackName) {
      const uid = authUser.id;
      const cached = readMirror(uid);
      if (cached) set({ ...cached, user: { id: uid, ...cached.user } });

      try {
        const [profile, tasks, habits, assignments, timetable] = await Promise.all([
          db.fetchProfile(uid),
          db.fetchTasks(uid),
          db.fetchHabits(uid),
          db.fetchAssignments(uid),
          db.fetchTimetable(uid),
        ]);
        set({
          user: {
            id: uid,
            name: profile?.name || fallbackName || nameFromEmail(authUser.email),
            email: profile?.email || authUser.email,
          },
          theme: profile?.theme || 'dark',
          homeVariant: profile?.homeVariant || 'ring',
          habitRemind: profile?.habitRemind ?? true,
          habitRemindTime: profile?.habitRemindTime || '08:00',
          classRemind: profile?.classRemind ?? true,
          asgRemind: profile?.asgRemind ?? true,
          categories: profile?.categories?.length ? profile.categories : DEFAULT_CATEGORIES,
          tasks,
          habits,
          assignments,
          courses: timetable.courses,
          quizzes: timetable.quizzes,
          picked: timetable.picked,
          mess: timetable.mess,
          imports: timetable.imports,
          localOnly: false,
        });
        if (fallbackName && profile && profile.name !== fallbackName) {
          await db.upsertProfile(uid, { name: fallbackName, email: authUser.email });
        }
        mirror();
      } catch (err) {
        console.error('[Litmus] hydrate failed, using cached data', err);
        set({ user: { id: uid, name: fallbackName || nameFromEmail(authUser.email), email: authUser.email } });
        get().say('Showing your last synced data — reconnecting…');
      }
    },

    // =================================================================
    //  Settings
    // =================================================================
    setTheme(theme) {
      set({ theme });
      remote(() => db.upsertProfile(get().user.id, { theme }));
    },
    setHomeVariant(homeVariant) {
      set({ homeVariant });
      const label = { ring: 'Score ring', hero: 'Score hero', agenda: 'Timeline' }[homeVariant];
      get().say(`Home set to ${label}`);
      remote(() => db.upsertProfile(get().user.id, { homeVariant }));
    },
    /**
     * Task categories are per-user and editable from the picker itself.
     * Removing one never touches existing tasks: `tasks.category` is plain
     * text, so old tasks keep their label and simply stop being offered.
     */
    addCategory(name) {
      const clean = name.trim().slice(0, 24);
      if (!clean) return;
      const existing = get().categories;
      if (existing.some((c) => c.toLowerCase() === clean.toLowerCase())) {
        get().say(`"${clean}" is already there`);
        return;
      }
      const categories = [...existing, clean];
      set({ categories });
      get().say(`Added "${clean}"`);
      remote(() => db.upsertProfile(get().user.id, { categories }));
    },

    removeCategory(name) {
      const categories = get().categories.filter((c) => c !== name);
      if (!categories.length) {
        get().say('Keep at least one category');
        return;
      }
      set({ categories });
      const stillUsed = get().tasks.filter((t) => t.cat === name).length;
      get().say(
        stillUsed
          ? `Removed "${name}" — ${stillUsed} existing task${stillUsed > 1 ? 's keep' : ' keeps'} the label`
          : `Removed "${name}"`
      );
      remote(() => db.upsertProfile(get().user.id, { categories }));
    },

    setReminderPref(key, value) {
      set({ [key]: value });
      remote(() => db.upsertProfile(get().user.id, { [key]: value }));
    },
    /**
     * Only the display name is editable here. The email is the auth
     * identity — changing `profiles.email` would rename the label while
     * sign-in codes kept going to the old address, so it isn't offered.
     */
    saveAccount(name) {
      const trimmed = name.trim();
      if (!trimmed) return get().say('Your name can\'t be empty');
      const user = { ...get().user, name: trimmed };
      set({ user });
      get().say('Name updated');
      remote(() => db.upsertProfile(user.id, { name: trimmed }));
    },

    // =================================================================
    //  Tasks
    // =================================================================
    addTask(draft) {
      const title = draft.title.trim();
      if (!title) return get().say('Give the task a name');
      const temp = { id: `tmp-${Date.now()}`, ...draft, title, done: false, doneAt: null };
      set((s) => ({ tasks: [...s.tasks, temp] }));
      get().say('Task added');
      remote(async () => {
        const saved = await db.insertTask(get().user.id, temp);
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === temp.id ? saved : t)) }));
      }, 'Saved on this device only — no connection');
    },
    updateTask(id, patch) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      get().say('Task updated');
      remote(() => db.updateTask(id, patch));
    },
    toggleTask(id) {
      const t = get().tasks.find((x) => x.id === id);
      if (!t) return;
      const done = !t.done;
      set((s) => ({
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, done, doneAt: done ? Date.now() : null } : x)),
      }));
      remote(() => db.updateTask(id, { done }));
    },
    deleteTask(id) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
      remote(() => db.deleteTask(id));
    },

    // =================================================================
    //  Habits
    // =================================================================
    addHabit(name, freq) {
      const nm = name.trim();
      if (!nm) return get().say('Give the habit a name');
      const temp = { id: `tmp-${Date.now()}`, name: nm, freq, streak: 0, notif: true, log: [], last: null };
      set((s) => ({ habits: [...s.habits, temp] }));
      get().say('Habit added — reminders on');
      remote(async () => {
        const saved = await db.insertHabit(get().user.id, temp);
        set((s) => ({ habits: s.habits.map((h) => (h.id === temp.id ? saved : h)) }));
      });
    },
    checkHabit(id) {
      const today = d(0);
      const h = get().habits.find((x) => x.id === id);
      if (!h) return;
      const wasDone = h.last === today;
      const log = (h.log || []).filter((q) => q !== today);
      const next = wasDone
        ? { ...h, last: log.length ? log[log.length - 1] : null, streak: Math.max(0, h.streak - 1), log }
        : { ...h, last: today, streak: h.streak + 1, log: [...log, today] };
      set((s) => ({ habits: s.habits.map((x) => (x.id === id ? next : x)) }));
      remote(async () => {
        if (wasDone) await db.removeHabitLog(id, today);
        else await db.addHabitLog(get().user.id, id, today);
        await db.updateHabit(id, { streak: next.streak });
      });
    },
    toggleHabitNotif(id) {
      const h = get().habits.find((x) => x.id === id);
      if (!h) return;
      const notif = !h.notif;
      set((s) => ({ habits: s.habits.map((x) => (x.id === id ? { ...x, notif } : x)) }));
      get().say(notif ? `Reminders on for ${h.name}` : `Reminders off for ${h.name}`);
      remote(() => db.updateHabit(id, { notif }));
    },
    deleteHabit(id) {
      set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
      remote(() => db.deleteHabit(id));
    },

    // =================================================================
    //  Assignments
    // =================================================================
    addAssignment(draft) {
      const title = draft.title.trim();
      if (!title) return get().say('Give the assignment a title');
      const temp = { id: `tmp-${Date.now()}`, ...draft, title, desc: draft.desc.trim(), subs: [] };
      set((s) => ({ assignments: [...s.assignments, temp] }));
      get().say('Assignment added — plan generated');
      remote(async () => {
        const saved = await db.insertAssignment(get().user.id, temp);
        set((s) => ({ assignments: s.assignments.map((a) => (a.id === temp.id ? saved : a)) }));
      });
    },
    updateAssignment(id, patch) {
      const title = patch.title?.trim();
      if (patch.title !== undefined && !title) return get().say('Give the assignment a title');
      const clean = { ...patch, ...(title ? { title } : {}), ...(patch.desc !== undefined ? { desc: patch.desc.trim() } : {}) };
      set((s) => ({ assignments: s.assignments.map((a) => (a.id === id ? { ...a, ...clean } : a)) }));
      get().say('Assignment updated');
      remote(() => db.updateAssignment(id, clean));
    },

    deleteAssignment(id) {
      set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) }));
      remote(() => db.deleteAssignment(id));
    },
    addSubtask(assignmentId, text) {
      const txt = text.trim();
      if (!txt) return;
      const temp = { id: `tmp-${Date.now()}`, text: txt, done: false };
      let position = 0;
      set((s) => ({
        assignments: s.assignments.map((a) => {
          if (a.id !== assignmentId) return a;
          position = a.subs.length;
          return { ...a, subs: [...a.subs, temp] };
        }),
      }));
      remote(async () => {
        const saved = await db.insertSubtask(get().user.id, assignmentId, txt, position);
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.id === assignmentId ? { ...a, subs: a.subs.map((x) => (x.id === temp.id ? saved : x)) } : a
          ),
        }));
      });
    },
    toggleSubtask(assignmentId, subId) {
      let done = false;
      set((s) => ({
        assignments: s.assignments.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                subs: a.subs.map((x) => {
                  if (x.id !== subId) return x;
                  done = !x.done;
                  return { ...x, done };
                }),
              }
            : a
        ),
      }));
      remote(() => db.updateSubtask(subId, done));
    },
    deleteSubtask(assignmentId, subId) {
      set((s) => ({
        assignments: s.assignments.map((a) =>
          a.id === assignmentId ? { ...a, subs: a.subs.filter((x) => x.id !== subId) } : a
        ),
      }));
      remote(() => db.deleteSubtask(subId));
    },

    // =================================================================
    //  Timetable
    // =================================================================
    toggleCourse(courseId) {
      const on = !get().picked.includes(courseId);
      set((s) => ({
        picked: on ? [...s.picked, courseId] : s.picked.filter((id) => id !== courseId),
      }));
      remote(() => db.setSelectedCourse(get().user.id, courseId, on));
    },

    async importClassSheet(file, parsed) {
      set({
        courses: parsed.courses.map((c, i) => ({ ...c, id: c.id || `local-${i}` })),
        quizzes: parsed.quizzes,
        imports: { ...get().imports, class: { file_name: file.name, week_label: parsed.weekLabel } },
      });
      get().say(`Parsed "${file.name}" — pick your courses`);
      await remote(async () => {
        await db.replaceClassData(get().user.id, parsed, file.name);
        const fresh = await db.fetchTimetable(get().user.id);
        set({ courses: fresh.courses, quizzes: fresh.quizzes, picked: fresh.picked, imports: fresh.imports });
      }, 'Timetable saved on this device only');
    },

    async importMessSheet(file, days, variant = 'regular') {
      set((s) => ({
        mess: { ...s.mess, [variant === 'continental' ? 'continental' : 'regular']: days },
        imports: {
          ...s.imports,
          [variant === 'continental' ? 'continental' : 'mess']: { file_name: file.name },
        },
      }));
      get().say(
        variant === 'continental'
          ? 'Continental menu imported'
          : `Menu imported from "${file.name}"`
      );
      await remote(() => db.replaceMessData(get().user.id, variant, days, file.name), 'Menu saved on this device only');
    },

    resetImport(kind) {
      set((s) => {
        if (kind === 'class') return { courses: [], quizzes: [], imports: { ...s.imports, class: null } };
        if (kind === 'continental')
          return { mess: { ...s.mess, continental: [] }, imports: { ...s.imports, continental: null } };
        return { mess: { ...s.mess, regular: [] }, imports: { ...s.imports, mess: null } };
      });
      remote(() => db.clearImport(kind));
    },

    // =================================================================
    //  Feedback
    // =================================================================
    sendFeedback(rating, text) {
      if (!rating) return get().say('Tap a star rating first');
      get().say(`Thanks — feedback recorded (${rating}/5)`);
      remote(() => db.insertFeedback(get().user.id, rating, text.trim()));
    },
  };
});

// ---------------------------------------------------------------------
const nameFromEmail = (email = '') =>
  email
    .split('@')[0]
    .replace(/[._\-]+/g, ' ')
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());

function friendlyAuthError(err) {
  const msg = String(err?.message || err || '');
  if (/rate limit|too many/i.test(msg)) return 'Too many codes requested — wait a minute and try again';
  if (/invalid|not allowed/i.test(msg)) return 'That email address was rejected — check it and try again';
  if (/network|fetch/i.test(msg)) return 'No connection — check your network and try again';
  return 'Could not send the code. Try again in a moment.';
}
