// Seed data for local-only mode — i.e. when the deployment has no
// Supabase env vars. With a backend configured, every user starts empty
// and this file is never touched.
//
// Safe to delete once you no longer want the offline demo: remove the
// import in `src/store/useStore.js` and the `appData.js` sample sheet.
import { d } from '../lib/date.js';
import { COURSES, QUIZZES, MESS, WEEK, CLASS_FILE, MESS_FILE } from './appData.js';

const back = (offsets) => offsets.map((o) => d(-o));

export function seedState() {
  const courses = COURSES.map((c, i) => ({ ...c, id: `sample-${i}` }));

  return {
    tasks: [
      { id: 1, title: 'Submit FRA assignment', cat: 'Study', due: d(-1), time: '17:00', done: false },
      { id: 2, title: 'Gym — push day', cat: 'Fitness', due: d(0), time: '07:30', done: true, doneAt: Date.now() - 36e5 },
      { id: 3, title: 'Morning run 3 km', cat: 'Fitness', due: d(0), time: '06:30', done: true, doneAt: Date.now() - 7e6 },
      { id: 4, title: 'Call home', cat: 'Personal', due: d(0), time: '20:00', done: false },
      { id: 5, title: 'Prep for SDM quiz', cat: 'Study', due: d(1), time: '18:00', done: false },
      { id: 6, title: 'Laundry run', cat: 'Errands', due: d(3), time: '10:00', done: false },
    ],
    habits: [
      { id: 1, name: 'Meditate 10 min', freq: 'Daily', streak: 10, last: d(0), notif: true, created: d(-30), log: back([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 15, 16, 18]) },
      { id: 2, name: 'Read 20 pages', freq: 'Daily', streak: 14, last: d(0), notif: true, created: d(-30), log: back([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16, 17, 19, 20]) },
      { id: 3, name: 'Gym session', freq: 'Twice a week', streak: 6, last: d(-2), notif: false, created: d(-30), log: back([2, 5, 9, 12, 16, 19]) },
      { id: 4, name: 'Weekly review', freq: 'Weekly', streak: 3, last: d(-6), notif: true, created: d(-30), log: back([6, 13, 20]) },
    ],
    assignments: [
      {
        id: 1,
        title: 'Campaign audit report',
        subj: 'DIGMKT A',
        due: d(4),
        intensity: 'Medium',
        type: 'Group',
        desc: 'Audit a D2C brand’s funnel and present findings.',
        subs: [
          { id: 1, text: 'Pick brand & collect data', done: true },
          { id: 2, text: 'Funnel analysis', done: false },
          { id: 3, text: 'Slides & rehearsal', done: false },
        ],
      },
      {
        id: 2,
        title: 'Ratio analysis worksheet',
        subj: 'FRA A',
        due: d(6),
        intensity: 'Heavy',
        type: 'Individual',
        desc: 'Full ratio workup on one annual report.',
        subs: [
          { id: 1, text: 'Download annual report', done: false },
          { id: 2, text: 'Compute ratios', done: false },
        ],
      },
    ],
    courses,
    quizzes: QUIZZES,
    picked: ['DIGMKT A', 'COMSTR A', 'FRA A', 'VAL A', 'MR', 'SCM'],
    mess: { regular: MESS, continental: [] },
    imports: {
      class: { file_name: CLASS_FILE, week_label: WEEK },
      mess: { file_name: MESS_FILE },
      continental: null,
    },
  };
}
