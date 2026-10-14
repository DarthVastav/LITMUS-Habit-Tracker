import { create } from 'zustand';
import { supabase, configured, sendOtp, verifyOtp, signInWithGoogle as oauthGoogle, signOut as authSignOut } from '../lib/supabase.js';
import * as db from '../lib/db.js';
import { DEFAULT_CATEGORIES } from '../lib/db.js';
import { d, fmtDay } from '../lib/date.js';
import { applyClears, computeStreak, mergeParsedClass, mergeParsedMess } from './selectors.js';
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
  coursesOpen: s.coursesOpen,
  focusMin: s.focusMin,
  clearedClass: s.clearedClass,
  clearedMess: s.clearedMess,
  clearedContinental: s.clearedContinental,
  focusActive: s.focusActive,
  prep: s.prep,
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
    prep: [],

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
    clearedClass: null,
    clearedMess: null,
    clearedContinental: null,
    pendingImport: null,
    focusMin: 25,
    focusActive: null, // { endsAt, total } — survives reload via the mirror
    toast: null,
    toastAction: null,
    _toastFn: null,
    pendingDelete: null,
    aboutOpen: false,
    updatesOpen: false,
    coursesOpen: true,
    prepTab: 'asg',
    loggerOpen: true,
    loggerSel: [],
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

    /**
     * Toast, optionally carrying one action button. Undo uses this; so
     * does the task→habit conversion prompt. Action toasts linger longer —
     * they're holding a decision open.
     */
    say(message, { actionLabel = null, onAction = null } = {}) {
      set({ toast: message, toastAction: actionLabel, _toastFn: onAction });
      clearTimeout(get()._toastTimer);
      const t = setTimeout(() => set({ toast: null, toastAction: null, _toastFn: null }), actionLabel ? 6000 : 2600);
      set({ _toastTimer: t });
    },

    runToastAction() {
      const fn = get()._toastFn;
      set({ toast: null, toastAction: null, _toastFn: null });
      clearTimeout(get()._toastTimer);
      if (fn) fn();
    },

    /**
     * Soft delete: the item leaves the screen immediately, but the remote
     * delete is held for six seconds while the toast offers Undo. Undo
     * cancels the remote call entirely and re-inserts the untouched item —
     * same id, logs and sub-tasks intact, nothing to reconstruct. One slot:
     * a second deletion commits the first.
     */
    queueDelete({ label, commit, restore }) {
      get()._flushDelete();
      const timer = setTimeout(() => get()._flushDelete(), 6000);
      set({ pendingDelete: { commit, restore, timer } });
      get().say(label, { actionLabel: 'Undo', onAction: () => get().undoDelete() });
    },

    _flushDelete() {
      const pd = get().pendingDelete;
      if (!pd) return;
      clearTimeout(pd.timer);
      set({ pendingDelete: null });
      remote(pd.commit);
    },

    undoDelete() {
      const pd = get().pendingDelete;
      if (!pd) return;
      clearTimeout(pd.timer);
      set({ pendingDelete: null });
      pd.restore();
      get().say('Restored');
      get()._mirror();
    },

    // ---- edits ------------------------------------------------------
    editHabit(id, { name, freq }) {
      const h = get().habits.find((x) => x.id === id);
      if (!h) return;
      const nm = (name ?? h.name).trim() || h.name;
      const fq = freq ?? h.freq;
      // Changing cadence changes what a streak means — recompute honestly.
      const streak = computeStreak(fq, h.log || []);
      set((s) => ({ habits: s.habits.map((x) => (x.id === id ? { ...x, name: nm, freq: fq, streak } : x)) }));
      get().say('Habit updated');
      remote(() => db.updateHabit(id, { name: nm, freq: fq, streak }));
    },

    editPrepTopic(id, { topic, subject }) {
      const x = get().prep.find((p) => p.id === id);
      if (!x) return;
      const tx = (topic ?? x.topic).trim() || x.topic;
      const sub = subject ?? x.subject;
      set((s) => ({ prep: s.prep.map((p) => (p.id === id ? { ...p, topic: tx, subject: sub } : p)) }));
      remote(() => db.updatePrepTopic(id, { topic: tx, subject: sub }));
    },

    /** Turn a recurring-sounding task into a habit with one tap. */
    convertTaskToHabit(title, freq) {
      const task = [...get().tasks].reverse().find((t) => t.title === title && !t.done);
      if (!task) return;
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id) }));
      remote(() => db.deleteTask(task.id));
      get().addHabit(title, freq);
      get().say(`“${title}” is a ${freq.toLowerCase()} habit now`);
    },

    _mirror: () => mirror(),
    setDrop: (id) => set((s) => ({ drop: s.drop === id ? null : id })),
    closeDrop: () => set({ drop: null }),
    setTab: (tab) => set({ tab, drop: null, aboutOpen: false, updatesOpen: false }),
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
      // getSession can hang indefinitely: with a stored-but-expired token
      // it refreshes over the network, and supabase-js retries failures in
      // a loop. Unbounded, that pinned the app on the splash forever — so
      // the session gets eight seconds, and any failure lands on the login
      // screen instead of nowhere.
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('session check timed out')), 8000)
        );
        const { data } = await Promise.race([supabase.auth.getSession(), timeout]);
        if (data?.session) {
          try {
            await get().hydrate(data.session.user);
          } catch (err) {
            console.error('[Litmus] hydrate at boot', err);
          }
          set({ ready: true, screen: 'app' });
        } else {
          set({ ready: true, screen: 'login' });
        }
      } catch (err) {
        console.error('[Litmus] boot', err);
        set({ ready: true, screen: 'login' });
        get().say("Couldn't reach the server — check your connection and sign in");
      }
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ user: null, screen: 'login', code: '', tab: 'home' });
        } else if (event === 'SIGNED_IN' && session?.user && !get().user) {
          get().hydrate(session.user).then(() => set({ screen: 'app' }));
        }
      });
    },

    async signInWithGoogle() {
      if (get().loading) return;
      if (!configured) {
        get().say('Google sign-in needs the online version');
        return;
      }
      set({ loading: true, emailErr: '' });
      try {
        await oauthGoogle(); // full-page redirect; nothing to do after
      } catch (err) {
        console.warn('[Litmus] Google sign-in failed', err);
        set({ loading: false, emailErr: friendlyAuthError(err) });
      }
    },

    async requestOtp() {
      // A rapid double-tap would fire two OTPs; the second silently
      // invalidates the first, and whichever email the person reads first
      // then "fails". One in flight at a time.
      if (get().loading) return;
      const email = get().email.trim().toLowerCase();
      set({ email });
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
      get()._flushDelete();
      await authSignOut();
      set({ user: null, screen: 'login', code: '', tab: 'home', tasks: [], habits: [], assignments: [] });
    },

    // =================================================================
    //  Hydration
    // =================================================================
    /**
     * Load everything from Supabase. Each fetch settles independently:
     * one failing table degrades one slice of the screen instead of
     * poisoning the lot — the isoOf incident is why. A failure also never
     * rewrites the display name from the email; whatever name is already
     * known (cache or profile) stays.
     */
    async hydrate(authUser, fallbackName) {
      const uid = authUser.id;
      const cached = readMirror(uid);
      if (cached) set({ ...cached, user: { id: uid, ...cached.user } });

      const results = await Promise.allSettled([
        db.fetchProfile(uid),
        db.fetchTasks(uid),
        db.fetchHabits(uid),
        db.fetchAssignments(uid),
        db.fetchTimetable(uid),
        db.fetchPrep(uid),
      ]);
      const [profileR, tasksR, habitsR, assignmentsR, timetableR, prepR] = results;
      const failed = results.filter((r) => r.status === 'rejected');
      failed.forEach((r) => console.error('[Litmus] fetch failed', r.reason));

      const patch = { localOnly: false };

      if (profileR.status === 'fulfilled') {
        const profile = profileR.value;
        patch.user = {
          id: uid,
          name: profile?.name || fallbackName || authUser.user_metadata?.name || get().user?.name || nameFromEmail(authUser.email),
          email: profile?.email || authUser.email,
        };
        patch.theme = profile?.theme || 'dark';
        patch.homeVariant = profile?.homeVariant || 'ring';
        patch.habitRemind = profile?.habitRemind ?? true;
        patch.habitRemindTime = profile?.habitRemindTime || '08:00';
        patch.classRemind = profile?.classRemind ?? true;
        patch.asgRemind = profile?.asgRemind ?? true;
        patch.categories = profile?.categories?.length ? profile.categories : DEFAULT_CATEGORIES;
      } else {
        // Keep whatever name we already have; only invent one if there is
        // truly nothing — never downgrade a real name to an email prefix.
        patch.user = {
          id: uid,
          name: get().user?.name || fallbackName || authUser.user_metadata?.name || nameFromEmail(authUser.email),
          email: get().user?.email || authUser.email,
        };
      }

      if (tasksR.status === 'fulfilled') patch.tasks = tasksR.value;
      if (habitsR.status === 'fulfilled') patch.habits = habitsR.value;
      if (assignmentsR.status === 'fulfilled') patch.assignments = assignmentsR.value;
      if (prepR.status === 'fulfilled') patch.prep = prepR.value;
      if (timetableR.status === 'fulfilled') {
        // Shared data, filtered through this user's personal "cleared"
        // timestamps — clearing hides it for them, never deletes it.
        const prof = profileR.status === 'fulfilled' ? profileR.value : null;
        const cleared = {
          clearedClass: prof?.clearedClass ?? get().clearedClass,
          clearedMess: prof?.clearedMess ?? get().clearedMess,
          clearedContinental: prof?.clearedContinental ?? get().clearedContinental,
        };
        const timetable = applyClears(timetableR.value, cleared);
        patch.courses = timetable.courses;
        patch.quizzes = timetable.quizzes;
        patch.picked = timetable.picked;
        patch.mess = timetable.mess;
        patch.imports = timetable.imports;
        patch.clearedClass = cleared.clearedClass;
        patch.clearedMess = cleared.clearedMess;
        patch.clearedContinental = cleared.clearedContinental;
      }

      set(patch);

      if (failed.length === results.length) {
        get().say('Showing your last synced data — reconnecting…');
      } else if (failed.length) {
        get().say('Some data could not refresh — showing the cached copy for it');
      }

      if (
        profileR.status === 'fulfilled' &&
        fallbackName &&
        profileR.value &&
        profileR.value.name !== fallbackName
      ) {
        remote(() => db.upsertProfile(uid, { name: fallbackName, email: authUser.email }));
      }

      if (failed.length < results.length) mirror();
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

    startFocus(minutes) {
      const min = Math.max(1, Math.min(180, Math.round(minutes)));
      set({ focusMin: min, focusActive: { endsAt: Date.now() + min * 60000, total: min * 60 } });
      get()._mirror();
    },

    endFocus(completed = false) {
      const fa = get().focusActive;
      set({ focusActive: null });
      get()._mirror();
      if (!fa) return;
      // Log what actually happened: the full duration when it rang out,
      // the elapsed minutes when ended early. Under a minute isn't a session.
      const elapsedMin = completed
        ? Math.round(fa.total / 60)
        : Math.round((fa.total - Math.max(0, (fa.endsAt - Date.now()) / 1000)) / 60);
      if (elapsedMin >= 1) {
        remote(() => db.logFocusSession(get().user.id, elapsedMin, completed));
      }
    },

    /** Show/Hide for the course chips — persisted so it's remembered. */
    setCoursesOpen(open) {
      set({ coursesOpen: open });
      get()._mirror();
    },

    // ---- exam prep ---------------------------------------------------
    addPrepTopic(subject, topic) {
      const txt = topic.trim();
      if (!txt) return get().say('Give the topic a name');
      const temp = { id: `tmp-${Date.now()}`, subject, topic: txt, done: false };
      set((s) => ({ prep: [...s.prep, temp] }));
      remote(async () => {
        const row = await db.insertPrepTopic(get().user.id, subject, txt);
        set((s) => ({ prep: s.prep.map((x) => (x.id === temp.id ? row : x)) }));
      }, 'Topic saved on this device only');
    },

    togglePrepTopic(id) {
      const item = get().prep.find((x) => x.id === id);
      if (!item) return;
      set((s) => ({ prep: s.prep.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) }));
      remote(() => db.togglePrepTopic(id, !item.done));
    },

    deletePrepTopic(id) {
      const item = get().prep.find((x) => x.id === id);
      if (!item) return;
      set((s) => ({ prep: s.prep.filter((x) => x.id !== id) }));
      remote(() => db.deletePrepTopic(id));
    },

    /**
     * Erase all tracked data and start over. Account, theme, reminder
     * preferences, and the shared timetable stay; everything personal
     * goes, including the momentum score, which restarts at 50.
     */
    resetAllData() {
      get()._flushDelete();
      set({
        tasks: [],
        habits: [],
        assignments: [],
        prep: [],
        picked: [],
            pendingDelete: null,
      });
      get()._mirror();
      get().say('Everything cleared — fresh start');
      remote(() => db.resetAllData(get().user.id), 'Cleared on this device — server reset failed');
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

      // Recurring-sounding titles are probably habits — offer the switch.
      const guess = guessHabitFreq(title);
      if (guess) {
        get().say(`“${title}” sounds like a ${guess.toLowerCase()} habit`, {
          actionLabel: 'Move to Habits',
          onAction: () => get().convertTaskToHabit(title, guess),
        });
      } else {
        get().say('Task added');
      }
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
      const idx = get().tasks.findIndex((x) => x.id === id);
      if (idx === -1) return;
      const item = get().tasks[idx];
      set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }));
      get().queueDelete({
        label: `Deleted “${item.title}”`,
        commit: () => db.deleteTask(id),
        restore: () =>
          set((s) => {
            const tasks = [...s.tasks];
            tasks.splice(Math.min(idx, tasks.length), 0, item);
            return { tasks };
          }),
      });
    },

    // =================================================================
    //  Habits
    // =================================================================
    addHabit(name, freq) {
      const nm = name.trim();
      if (!nm) return get().say('Give the habit a name');
      const temp = { id: `tmp-${Date.now()}`, name: nm, freq, streak: 0, notif: true, created: d(0), log: [], last: null };
      set((s) => ({ habits: [...s.habits, temp] }));
      get().say('Habit added — reminders on');
      remote(async () => {
        const saved = await db.insertHabit(get().user.id, temp);
        set((s) => ({ habits: s.habits.map((h) => (h.id === temp.id ? saved : h)) }));
      });
    },
    checkHabit(id) {
      get().checkHabitOn(id, d(0));
    },

    /**
     * Toggle a habit for a specific day. Only today and yesterday are
     * editable — a one-day grace window covers "did it, forgot to log it"
     * without turning the calendar into a colouring book. The streak is
     * recomputed from the log so a back-filled yesterday heals it.
     */
    checkHabitOn(id, iso) {
      const today = d(0);
      const yesterday = d(-1);
      if (iso !== today && iso !== yesterday) {
        return get().say('Only today and yesterday can be logged');
      }
      const h = get().habits.find((x) => x.id === id);
      if (!h) return;
      if ((h.created || '0000-01-01') > iso) {
        return get().say(`“${h.name}” didn't exist yet on that day`);
      }

      const had = (h.log || []).includes(iso);
      const log = had ? h.log.filter((q) => q !== iso) : [...(h.log || []), iso].sort();
      const streak = computeStreak(h.freq, log);
      const next = { ...h, log, streak, last: log.length ? log[log.length - 1] : null };
      set((s) => ({ habits: s.habits.map((x) => (x.id === id ? next : x)) }));

      if (iso === yesterday) {
        get().say(had ? `Unchecked “${h.name}” for yesterday` : `Logged “${h.name}” for yesterday — streak ${streak}`);
      }

      remote(async () => {
        if (had) await db.removeHabitLog(id, iso);
        else await db.addHabitLog(get().user.id, id, iso);
        await db.updateHabit(id, { streak });
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
      const idx = get().habits.findIndex((x) => x.id === id);
      if (idx === -1) return;
      const item = get().habits[idx];
      set((s) => ({ habits: s.habits.filter((x) => x.id !== id) }));
      get().queueDelete({
        label: `Deleted “${item.name}” — streak and log with it`,
        commit: () => db.deleteHabit(id),
        restore: () =>
          set((s) => {
            const habits = [...s.habits];
            habits.splice(Math.min(idx, habits.length), 0, item);
            return { habits };
          }),
      });
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
    /**
     * The master checkbox. With sub-tasks it drives them all (and they
     * drive it back — checked means every sub-task done); without any, it
     * IS the assignment's completion.
     */
    toggleAssignmentComplete(id) {
      const a = get().assignments.find((x) => x.id === id);
      if (!a) return;
      if (a.subs.length) {
        const target = !a.subs.every((x) => x.done);
        set({
          assignments: get().assignments.map((x) =>
            x.id === id ? { ...x, done: target, subs: x.subs.map((s2) => ({ ...s2, done: target })) } : x
          ),
        });
        remote(() => db.setSubtasksDone(id, target));
      } else {
        const target = !a.done;
        set({ assignments: get().assignments.map((x) => (x.id === id ? { ...x, done: target } : x)) });
        remote(() => db.updateAssignment(id, { done: target }));
      }
    },

    editSubtask(assignmentId, subId, text) {
      const clean = text.trim();
      if (!clean) return;
      set({
        assignments: get().assignments.map((a) =>
          a.id === assignmentId
            ? { ...a, subs: a.subs.map((s2) => (s2.id === subId ? { ...s2, text: clean } : s2)) }
            : a
        ),
      });
      remote(() => db.updateSubtaskText(subId, clean));
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
      const idx = get().assignments.findIndex((x) => x.id === id);
      if (idx === -1) return;
      const item = get().assignments[idx];
      set((s) => ({ assignments: s.assignments.filter((x) => x.id !== id) }));
      get().queueDelete({
        label: `Deleted “${item.title}”`,
        commit: () => db.deleteAssignment(id),
        restore: () =>
          set((s) => {
            const assignments = [...s.assignments];
            assignments.splice(Math.min(idx, assignments.length), 0, item);
            return { assignments };
          }),
      });
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
    toggleCourse(courseKey) {
      const on = !get().picked.includes(courseKey);
      set((s) => ({
        picked: on ? [...s.picked, courseKey] : s.picked.filter((k) => k !== courseKey),
      }));
      remote(() => db.setSelectedCourse(get().user.id, courseKey, on));
    },

    async importClassSheet(fileName, parsed) {
      const merged = mergeParsedClass(get().courses, get().quizzes, parsed);
      if (!merged) {
        get().say('That sheet has no dated classes — nothing to add');
        return;
      }
      // A sheet whose last day is already behind us adds nothing but
      // confusion — refuse it outright.
      if (merged.hi < d(0)) {
        get().say('That timetable is entirely in the past — upload a current one');
        return;
      }
      set({
        courses: merged.courses,
        quizzes: merged.quizzes,
        imports: { ...get().imports, class: { file_name: fileName, week_label: parsed.weekLabel } },
      });
      get().say(`Added ${parsed.weekLabel || fileName} — earlier weeks stay put`);
      await remote(async () => {
        await db.replaceClassData(get().user.id, parsed, fileName);
        const fresh = applyClears(await db.fetchTimetable(get().user.id), {
          clearedClass: get().clearedClass,
          clearedMess: get().clearedMess,
          clearedContinental: get().clearedContinental,
        });
        set({ courses: fresh.courses, quizzes: fresh.quizzes, picked: fresh.picked, mess: fresh.mess, imports: fresh.imports });
      }, 'Timetable saved on this device only');
    },

    /**
     * Import the end-term exam PDF. Exams ride the quizzes machinery —
     * matched ones are named "CODE End Term" so the existing selected-
     * course filter applies to them unchanged.
     */
    /** Parse only — used by prepareImport for the preview step. */
    async _parseExamFile(file) {
      const { parseExamPdf } = await import('../lib/pdf.js');
      const { matchExamsToCourses, examsToQuizRows } = await import('../lib/examPdf.js');
      const exams = await parseExamPdf(file);
      if (!exams.length) return null;
      return examsToQuizRows(matchExamsToCourses(exams, get().courses));
    },

    async commitExam(fileName, rows) {
      const isos = rows.map((r) => r.iso).sort();
      const lo = isos[0];
      const hi = isos[isos.length - 1];
      set({
        quizzes: [...get().quizzes.filter((q) => q.iso < lo || q.iso > hi), ...rows],
        tab: 'tt',
        ttTab: 'class',
        drop: null,
      });
      const matchedCount = rows.filter((r) => / End Term$/.test(r.name) && !r.name.includes('—')).length;
      get().say(`Added ${rows.length} exams (${matchedCount} matched to your courses)`);
      await remote(async () => {
        await db.replaceExamData(get().user.id, rows, fileName);
        const fresh = await db.fetchTimetable(get().user.id);
        set({ courses: fresh.courses, quizzes: fresh.quizzes, picked: fresh.picked, imports: fresh.imports });
      }, 'Exams saved on this device only');
    },

    /**
     * Entry point for files arriving from outside the app — "Open with"
     * on desktop, "Share to Litmus" on Android. Detects which sheet this
     * is (class sheets parse with courses; menu sheets with day blocks),
     * imports through the normal path, and lands on the right tab.
     */
    /**
     * ONE intake for every upload path — manual pickers and share-to-app.
     * Detects what the file actually is (a class sheet dropped in the Mess
     * tab routes to Class, and vice versa), then parks a preview for the
     * user to confirm before anything touches shared data.
     */
    async prepareImport(file, preferredKind = null) {
      try {
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          const rows = await get()._parseExamFile(file);
          if (!rows?.length) return get().say("Couldn't find an exam table in that PDF");
          const isos = rows.map((r) => r.iso).sort();
          if (isos[isos.length - 1] < d(0)) return get().say('That exam schedule is entirely in the past');
          set({
            tab: 'tt',
            ttTab: 'class',
            drop: null,
            pendingImport: {
              kind: 'exam',
              fileName: file.name,
              rows,
              summary: `${rows.length} exams · ${fmtDay(isos[0])} – ${fmtDay(isos[isos.length - 1])}`,
              note: null,
            },
          });
          return;
        }
        const { parseClassSheet, parseMessSheet } = await import('../lib/excel.js');
        const cls = await parseClassSheet(file).catch(() => null);
        if (cls?.courses?.length) {
          const merged = mergeParsedClass(get().courses, get().quizzes, cls);
          if (!merged) return get().say('That sheet has no dated classes — nothing to add');
          if (merged.hi < d(0))
            return get().say('That timetable is entirely in the past — upload a current one');
          const maxLoaded = [...get().courses.flatMap((c) => (c.sessions || []).map((s) => s.iso))]
            .sort()
            .pop();
          set({
            tab: 'tt',
            ttTab: 'class',
            drop: null,
            pendingImport: {
              kind: 'class',
              fileName: file.name,
              parsed: cls,
              summary: `${cls.weekLabel || 'Class timetable'} · ${cls.courses.length} courses`,
              note:
                preferredKind === 'mess' || preferredKind === 'continental'
                  ? 'This is the class timetable — it will import there.'
                  : maxLoaded && merged.hi < maxLoaded
                    ? 'Older than what is already loaded — it only refreshes its own week.'
                    : null,
            },
          });
          return;
        }
        const days = await parseMessSheet(file).catch(() => null);
        if (days?.length) {
          const variant =
            /continental/i.test(file.name)
              ? 'continental'
              : preferredKind === 'continental'
                ? 'continental'
                : 'regular';
          const merged = mergeParsedMess(
            get().mess[variant === 'continental' ? 'continental' : 'regular'],
            days
          );
          if (!merged) return get().say('That sheet has no dated menu — nothing to add');
          if (merged.hi < d(0)) return get().say('That menu is entirely in the past — upload a current one');
          set({
            tab: 'tt',
            ttTab: 'mess',
            messView: variant === 'continental' ? 'cont' : 'reg',
            drop: null,
            pendingImport: {
              kind: 'mess',
              variant,
              fileName: file.name,
              days,
              summary: `${variant === 'continental' ? 'Continental menu' : 'Mess menu'} · ${days.length} days · ${fmtDay(merged.lo)} – ${fmtDay(merged.hi)}`,
              note: preferredKind === 'class' ? 'This is a mess menu — it will import there.' : null,
            },
          });
          return;
        }
        get().say(`Couldn't recognise "${file.name}" as a timetable or menu sheet`);
      } catch (err) {
        console.error('[Litmus] prepare import', err);
        get().say('That file could not be read — try the original .xlsx');
      }
    },

    async confirmImport() {
      const p = get().pendingImport;
      if (!p) return;
      set({ pendingImport: null });
      if (p.kind === 'exam') return get().commitExam(p.fileName, p.rows);
      if (p.kind === 'class') return get().importClassSheet(p.fileName, p.parsed);
      return get().importMessSheet(p.fileName, p.days, p.variant);
    },

    cancelImport() {
      set({ pendingImport: null });
      get().say('Nothing was imported');
    },

    async importMessSheet(fileName, days, variant = 'regular') {
      const slot = variant === 'continental' ? 'continental' : 'regular';
      const merged = mergeParsedMess(get().mess[slot], days);
      if (!merged) {
        get().say('That sheet has no dated menu — nothing to add');
        return;
      }
      if (merged.hi < d(0)) {
        get().say('That menu is entirely in the past — upload a current one');
        return;
      }
      set((s) => ({
        mess: { ...s.mess, [slot]: merged.days },
        imports: {
          ...s.imports,
          [variant === 'continental' ? 'continental' : 'mess']: { file_name: fileName },
        },
      }));
      get().say(
        variant === 'continental' ? 'Continental menu added — other dates stay put' : 'Menu added — other dates stay put'
      );
      await remote(
        () => db.replaceMessData(get().user.id, variant, days, fileName, merged.lo, merged.hi),
        'Menu saved on this device only'
      );
    },

    /**
     * The inverse of a personal clear: lift the cleared-at stamp and pull
     * the batch's shared data back down. One tap instead of a re-upload.
     */
    async restoreShared(kind) {
      if (!configured || get().localOnly) return get().say('Nothing in the cloud in offline mode');
      const key =
        kind === 'class' ? 'clearedClass' : kind === 'continental' ? 'clearedContinental' : 'clearedMess';
      set({ [key]: null, loading: true });
      try {
        const tt = applyClears(await db.fetchTimetable(get().user.id), {
          clearedClass: get().clearedClass,
          clearedMess: get().clearedMess,
          clearedContinental: get().clearedContinental,
        });
        const has =
          kind === 'class' ? !!tt.imports.class : kind === 'continental' ? !!tt.imports.continental : !!tt.imports.mess;
        set({
          loading: false,
          courses: tt.courses,
          quizzes: tt.quizzes,
          picked: tt.picked,
          mess: tt.mess,
          imports: tt.imports,
        });
        get()._mirror();
        get().say(has ? 'Restored from the batch\u2019s shared data' : 'Nothing in the cloud yet \u2014 upload the first sheet');
        remote(() => db.upsertProfile(get().user.id, { [key]: null }));
      } catch (err) {
        console.warn('[Litmus] restoreShared', err);
        set({ loading: false });
        get().say('Could not reach the server \u2014 try again');
      }
    },

    /**
     * Personal clear: hides the shared timetable/menu for THIS user only —
     * the data stays for everyone else, and any upload after this moment
     * (theirs or a classmate's) shows again automatically.
     */
    resetImport(kind) {
      const now = new Date().toISOString();
      const key =
        kind === 'class' ? 'clearedClass' : kind === 'continental' ? 'clearedContinental' : 'clearedMess';
      set((s) => {
        const base = { [key]: now };
        if (kind === 'class')
          return { ...base, courses: [], quizzes: [], imports: { ...s.imports, class: null } };
        if (kind === 'continental')
          return { ...base, mess: { ...s.mess, continental: [] }, imports: { ...s.imports, continental: null } };
        return { ...base, mess: { ...s.mess, regular: [] }, imports: { ...s.imports, mess: null } };
      });
      get()._mirror();
      get().say('Cleared for you — everyone else still has it');
      remote(() => db.upsertProfile(get().user.id, { [key]: now }));
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

/**
 * "brush daily", "gym every morning", "call mom weekly" — recurrence words
 * in a task title suggest it belongs in Habits. Conservative on purpose:
 * a wrong guess is just a toast that fades.
 */
function guessHabitFreq(title) {
  const s = title.toLowerCase();
  if (/\btwice a week\b/.test(s)) return 'Twice a week';
  if (/\b(monthly|every month|once a month)\b/.test(s)) return 'Monthly';
  if (/\b(weekly|every week|once a week|every (mon|tues|wednes|thurs|fri|satur|sun)day)\b/.test(s)) return 'Weekly';
  if (/\b(daily|everyday|every day|each day|every (morning|night|evening)|nightly)\b/.test(s)) return 'Daily';
  return null;
}

function friendlyAuthError(err) {
  const msg = String(err?.message || err || '');
  // "For security purposes, you can only request this after N seconds."
  const wait = msg.match(/after (\d+) seconds/i);
  if (wait) return `One code per minute — try again in ${wait[1]}s`;
  if (/provider is not enabled|unsupported provider/i.test(msg)) return 'Google sign-in is not set up on the server yet — use email for now';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many codes requested — wait a minute and try again';
  if (/invalid|not allowed/i.test(msg)) return 'That email address was rejected — check it and try again';
  if (/network|fetch/i.test(msg)) return 'No connection — check your network and try again';
  return 'Could not send the code. Try again in a moment.';
}
