import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import { WEIGHTS, scoreOf } from '../store/selectors.js';
import { Card } from '../ui/primitives.jsx';
import { accentButton, sectionLabel } from '../lib/theme.js';

const TABS = [
  ['Home', "Your score, today's focus and what's up next."],
  ['Tasks', 'One-off to-dos with category, date and time — grouped by deadline, ticked items drop to the bottom.'],
  ['Timetable', 'Your class week built from the master sheet (only your courses), plus the mess menus.'],
  ['Assign', 'Assignments with deadline, intensity and sub-tasks — the app plans when you should start.'],
  ['Habits', 'Recurring routines (daily, weekly, twice a week, monthly) with streaks and reminders.'],
  ['Settings', 'Theme, account, reminder times — and this page.'],
];

/**
 * The score, computed live with the user's own numbers over the rolling
 * 30-day window — the exact arithmetic behind the Home tab, penalty and
 * all. Transparency beats trust.
 */
function LiveScoreMath() {
  const state = useStore();
  const summary = scoreOf(state);

  const row = { display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '3px 0' };
  const dim = { color: 'var(--ink3)' };
  const num = { fontVariantNumeric: 'tabular-nums', fontWeight: 600 };

  if (summary.score === null) {
    return (
      <div style={{ marginTop: '11px', paddingTop: '11px', borderTop: '1px solid var(--gBrd)', fontSize: '11.5px', color: 'var(--ink2)', lineHeight: 1.5 }}>
        <div style={{ ...sectionLabel, marginBottom: '6px' }}>YOUR NUMBERS, LIVE</div>
        Nothing tracked yet — once you add a task, habit or assignment, this
        section shows the score computed from your own 30-day record.
      </div>
    );
  }

  const parts = [
    ['Tasks', 'tasks'],
    ['Habits', 'habits'],
    ['Assignments', 'asg'],
  ];
  const measured = parts.filter(([, k]) => summary.pcts[k] !== null);
  const weightSum = measured.reduce((s, [, k]) => s + WEIGHTS[k], 0);
  const contrib = measured.reduce((s, [, k]) => s + (WEIGHTS[k] * summary.pcts[k]) / 100, 0);

  return (
    <div style={{ marginTop: '11px', paddingTop: '11px', borderTop: '1px solid var(--gBrd)' }}>
      <div style={{ ...sectionLabel, marginBottom: '7px' }}>YOUR NUMBERS, LIVE</div>

      <div style={{ fontSize: '11px', color: 'var(--ink3)', marginBottom: '4px' }}>Last 30 days</div>
      {parts.map(([label, k]) =>
        summary.pcts[k] === null ? (
          <div key={k} style={{ ...row, ...dim }}>
            <span>{label}</span>
            <span>not tracked — excluded</span>
          </div>
        ) : (
          <div key={k} style={row}>
            <span>
              {label} · {WEIGHTS[k]} × {summary.pcts[k]}%
            </span>
            <span style={num}>{((WEIGHTS[k] * summary.pcts[k]) / 100).toFixed(1)}</span>
          </div>
        )
      )}
      <div style={{ ...row, borderTop: '1px solid var(--gBrd)', marginTop: '3px', paddingTop: '6px' }}>
        <span style={dim}>{contrib.toFixed(1)} of {weightSum} weight, rescaled to 100</span>
        <span style={num}>{Math.round((contrib / weightSum) * 100)}</span>
      </div>
      {summary.penalty > 0 && (
        <div style={row}>
          <span style={{ color: '#e24b4a' }}>
            {summary.overdueCount} overdue task{summary.overdueCount > 1 ? 's' : ''} — grows daily
          </span>
          <span style={{ ...num, color: '#e24b4a' }}>−{summary.penalty}</span>
        </div>
      )}
      <div style={{ ...row, paddingTop: '5px' }}>
        <span style={{ fontWeight: 700 }}>Your score</span>
        <span style={{ ...num, fontSize: '13px' }}>{summary.score}</span>
      </div>
      <div style={{ fontSize: '10.5px', color: 'var(--ink3)', lineHeight: 1.55, marginTop: '8px' }}>
        Overdue penalty: −3 the first day, −2 each further day, capped at −12
        per task and −20 in total. Clearing the task clears it instantly.
      </div>
    </div>
  );
}

const LEGEND = [
  ['Tasks — share of tasks due in the last 30 days that got done', `${WEIGHTS.tasks} pts`],
  [
    'Habits — check-ins vs what each cadence expects over the last 30 days',
    `${WEIGHTS.habits} pts`,
  ],
  ['Assignments — average sub-task completion (exam prep is not scored)', `${WEIGHTS.asg} pts`],
];

const BANDS = [
  ['oklch(0.72 0.17 150)', '90–100 · green — thriving'],
  ['oklch(0.68 0.14 195)', '75–89 · teal — trending well'],
  ['oklch(0.62 0.17 245)', '50–74 · blue — steady'],
  ['oklch(0.6 0.17 310)', '25–49 · purple — slipping'],
  ['oklch(0.62 0.19 25)', '0–24 · red — needs a reset'],
];

export default function About({ onBack }) {
  const sendFeedback = useStore((s) => s.sendFeedback);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const submit = () => {
    if (!rating) {
      useStore.getState().say('Tap a star rating first');
      return;
    }
    sendFeedback(rating, text);
    setRating(0);
    setText('');
  };

  return (
    <div data-screen-label="Know the App" style={{ animation: 'fadeUp 0.35s ease' }}>
      <div style={{ padding: '14px 2px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'var(--soft)',
            border: 'none',
            borderRadius: '12px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--acc)',
          }}
        >
          ‹ Back
        </button>
        <span style={{ fontSize: '22px', fontWeight: 700 }}>Know the App</span>
      </div>

      <Card radius={22} blur={24} style={{ marginTop: '14px', padding: '18px' }}>
        <div style={sectionLabel}>Why this app exists</div>
        <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.6, color: 'var(--ink)' }}>
          Litmus puts your whole routine — tasks, classes, assignments and habits — behind one number. Instead
          of five apps telling you five things, one reading tells you how you&apos;re actually living. Like litmus
          paper, the app changes colour to show the result — which makes it impossible to ignore.
        </div>
      </Card>

      <Card radius={22} blur={24} style={{ marginTop: '12px', padding: '18px' }}>
        <div style={sectionLabel}>How it works</div>
        <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.6, color: 'var(--ink)' }}>
          Everything you check off feeds the Litmus score, and the score drives the colour of every screen.
          Slip on deadlines and the app cools toward red; keep your streaks and it warms into green.
        </div>
        <div
          style={{
            marginTop: '12px',
            height: '8px',
            borderRadius: '4px',
            background:
              'linear-gradient(90deg,oklch(0.62 0.19 25),oklch(0.6 0.17 310),oklch(0.62 0.17 245),oklch(0.68 0.14 195),oklch(0.72 0.17 150))',
          }}
        />
        <div
          style={{
            marginTop: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9.5px',
            color: 'var(--ink3)',
          }}
        >
          <span>0 · off track</span>
          <span>50 · steady</span>
          <span>100 · thriving</span>
        </div>
      </Card>

      <Card radius={22} blur={24} style={{ marginTop: '12px', padding: '18px' }}>
        <div style={sectionLabel}>What each tab does</div>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TABS.map(([tab, copy]) => (
            <div key={tab} style={{ display: 'flex', gap: '10px' }}>
              <span style={{ width: '74px', flex: 'none', fontSize: '12px', fontWeight: 700, color: 'var(--acc)' }}>
                {tab}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--ink2)', lineHeight: 1.5 }}>{copy}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card radius={22} blur={24} style={{ marginTop: '12px', padding: '18px' }}>
        <div style={sectionLabel}>Scorecard legend</div>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {LEGEND.map(([copy, pts]) => (
            <div key={copy} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ flex: 1, fontSize: '12.5px' }}>{copy}</span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: 'var(--acc)',
                  padding: '3px 9px',
                  borderRadius: '10px',
                  background: 'var(--soft)',
                }}
              >
                {pts}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flex: 1, fontSize: '12.5px', color: '#ff8d7e' }}>
              Missed deadlines — per overdue task, up to −12
            </span>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#ff8d7e',
                padding: '3px 9px',
                borderRadius: '10px',
                background: 'rgba(255,110,90,0.12)',
              }}
            >
              −3 pts
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: '11px',
            paddingTop: '11px',
            borderTop: '1px solid var(--gBrd)',
            fontSize: '11.5px',
            color: 'var(--ink2)',
            lineHeight: 1.5,
          }}
        >
          A category counts only once you're tracking something in it — anything
          with no data shows a dash and is left out of the score entirely.
        </div>

        <LiveScoreMath />

        <div
          style={{
            marginTop: '11px',
            paddingTop: '11px',
            borderTop: '1px solid var(--gBrd)',
            fontSize: '11.5px',
            color: 'var(--ink2)',
            lineHeight: 1.5,
          }}
        >
          The score is a straight 30-day reading — no memory, no smoothing.
          Every tick of a task, habit or assignment moves it immediately, in
          both directions: undoing an action takes exactly its points back.
          Because the window is a rolling month, one bad day barely dents it
          and one great day doesn't max it — consistency is the only lever.
        </div>

        <div
          style={{
            marginTop: '11px',
            paddingTop: '11px',
            borderTop: '1px solid var(--gBrd)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {BANDS.map(([color, copy]) => (
            <div key={copy} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, flex: 'none' }} />
              <span style={{ fontSize: '11.5px', color: 'var(--ink2)' }}>{copy}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card radius={22} blur={24} style={{ marginTop: '12px', padding: '18px' }}>
        <div style={sectionLabel}>Feedback</div>
        <div style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--ink2)' }}>
          How is Litmus working for you?
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} out of 5`}
              onClick={() => setRating(n)}
              style={{
                flex: 1,
                background: 'var(--field)',
                border: `1px solid ${n <= rating ? 'transparent' : 'var(--gBrd)'}`,
                borderRadius: '12px',
                padding: '9px 0',
                fontSize: '20px',
                lineHeight: 1,
                color: n <= rating ? 'var(--acc)' : 'var(--ink3)',
                textShadow: n <= rating ? '0 0 10px var(--glow)' : 'none',
                transition: 'all .2s',
                cursor: 'pointer',
              }}
            >
              ★
            </button>
          ))}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Suggestions or improvements…"
          style={{
            marginTop: '12px',
            width: '100%',
            background: 'var(--field)',
            border: '1px solid var(--gBrd)',
            borderRadius: '13px',
            padding: '12px 14px',
            fontSize: '13px',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <button type="button" onClick={submit} style={{ ...accentButton, marginTop: '12px', width: '100%' }}>
          Send feedback
        </button>
      </Card>
    </div>
  );
}
