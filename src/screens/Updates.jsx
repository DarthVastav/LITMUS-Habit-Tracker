import { Screen, Card } from '../ui/primitives.jsx';
import { pageTitle, sectionLabel } from '../lib/theme.js';

/**
 * The changelog, newest first. Short bullets, one entry per meaningful
 * release — this is the app's own memory of how it got here.
 */
const LOG = [
  {
    v: '1.2',
    name: 'Upload safety',
    notes: [
      'Every sheet upload now shows a preview — file, dates, course/day count — and asks before importing for everyone',
      'The app detects what a file actually is: a class sheet dropped in the Mess tab routes to the right place, and vice versa',
      'Mess menus are additive like class sheets — an old menu can only refresh its own dates, never wipe current ones',
      'File chips show who uploaded each sheet and when',
      'Assignments can be completed with one master checkbox — it drives all sub-tasks, and assignments without sub-tasks finally count in the score when done',
      'Sub-tasks are editable from their ⋮ menu',
      'The status bar tints with your live score colour',
      'Install prompts on the sign-in page and in Settings — with iPhone steps — that disappear once installed',
      'Minor UI improvements and bug fixes',
    ],
  },
  {
    v: '1.1',
    name: 'Made for the batch',
    notes: [
      'New users get a proper welcome: pick your subjects first, then your timetable appears',
      'Clearing a timetable or mess menu now only hides it for you — everyone else keeps theirs, and any new upload brings it back',
      'Course picker shows the current term only, with search and your picks on top',
      'Built-in Term V catalog: full course names and faculty everywhere, even when the sheet only has codes',
      "One-tap restore: pull the batch's shared timetable back after clearing, no re-upload needed",
      'Minor UI improvements and bug fixes',
    ],
  },
  {
    v: '1.0',
    name: 'Launch ready',
    notes: [
      'Continue with Google — one-tap sign-in, no OTP email needed',
      'Assignment runways: work only counts (and nags) once its window opens — Group 2/4/10 days, Individual 3/7/14, or set your own',
      'Runway-opens-today push reminder at 8 AM',
      'Crash reporting so bugs surface without screenshots',
      'Privacy policy page',
    ],
  },
  {
    v: '0.9',
    name: 'Focus',
    notes: [
      'Focus mode — pick 15/25/50 or custom minutes, a serene full-screen timer with quotes, chime and vibration at zero',
      'Thrice-a-week habit cadence',
      'Score colour remembered across refreshes — no more blue flash',
      'iPhone notch respected',
      'Timetable rows show course name + lecturer',
    ],
  },
  {
    v: '0.8',
    name: 'Honest scoring',
    notes: [
      'Score rebuilt as a transparent 30-day completion formula (Tasks 30 · Habits 45 · Assignments 25) — every tick moves it both ways',
      'Escalating overdue penalty: −3 first day, −2 per further day',
      "Today's pending tasks count immediately",
      'Live arithmetic of your own score in Know the App',
      'Exam prep deliberately not scored',
    ],
  },
  {
    v: '0.7',
    name: 'Edit everything',
    notes: [
      '⋮ menu with Edit / Delete on tasks, habits, assignments and prep topics',
      'Habits editable — rename or change cadence, streak recomputed',
      'Prep topics editable and movable between subjects',
      'Deleted items get a 6-second Undo',
      '"Sounds like a habit" prompt converts recurring tasks in one tap',
    ],
  },
  {
    v: '0.6',
    name: 'Prep',
    notes: [
      'Prep tab: assignments and per-subject exam-topic tracking with progress bars',
      'Custom subjects in every subject dropdown',
      'Finished topics and subjects sink below unfinished ones',
      'Overdue tasks pinned red at the top of the Home timeline',
      'Reset all data in Settings (two-tap, no accidents)',
    ],
  },
  {
    v: '0.5',
    name: 'Exams',
    notes: [
      'End-term PDF import — exams land on the timetable with red END TERM pills and venues',
      'Exams match your selected courses by code and by name',
      'Multi-week timetables: each sheet adds its week instead of replacing everything',
    ],
  },
  {
    v: '0.4',
    name: 'Reminders',
    notes: [
      'Push notifications: habit nudges, 30-minutes-before class reminders',
      'Install to home screen; share sheets straight into the app',
      'Mess menus with veg/continental variants',
    ],
  },
  {
    v: '0.3',
    name: 'Accounts',
    notes: [
      'Sign in with a 6-digit email code — no passwords',
      'Everything syncs to the cloud and works offline',
      'Timetable upload: drop the weekly Excel, pick your courses',
    ],
  },
  {
    v: '0.2',
    name: 'The score',
    notes: [
      'The colour-changing wellness score arrives — the whole app shifts hue with how you are doing',
      'Tasks, habits with streaks, assignments with sub-tasks',
    ],
  },
  {
    v: '0.1',
    name: 'First light',
    notes: ['Litmus is born: a dark-glass tracker for one MBA student who needed it'],
  },
];

export default function Updates({ onBack }) {
  return (
    <Screen label="Updates">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to settings"
          style={{
            background: 'var(--field)',
            border: '1px solid var(--gBrd)',
            borderRadius: '12px',
            padding: '8px 12px',
            fontSize: '14px',
            color: 'var(--ink)',
          }}
        >
          ‹
        </button>
        <h1 style={{ ...pageTitle, margin: 0 }}>Update log</h1>
      </div>

      {LOG.map((rel) => (
        <Card key={rel.v} style={{ marginTop: '12px', padding: '15px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                padding: '3px 9px',
                borderRadius: '9px',
                background: 'var(--soft)',
                color: 'var(--acc)',
              }}
            >
              v{rel.v}
            </span>
            <span style={{ ...sectionLabel }}>{rel.name}</span>
          </div>
          <ul style={{ margin: '10px 0 0', paddingLeft: '18px' }}>
            {rel.notes.map((n, i) => (
              <li key={i} style={{ fontSize: '12.5px', color: 'var(--ink2)', lineHeight: 1.55, margin: '5px 0' }}>
                {n}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </Screen>
  );
}
