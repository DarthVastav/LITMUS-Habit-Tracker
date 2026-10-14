import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { Card, Screen } from '../ui/primitives.jsx';
import { glass, wordmark, sectionLabel, accentButton, ERROR_INK } from '../lib/theme.js';
import { greetingFor, fmt12, d } from '../lib/date.js';
import {
  scoreOf,
  scoreLabel,
  greetingLine,
  isOnTrack,
  focusAdvice,
  todayTimeline,
  pendingTasks,
  currentSession,
  nextClassChip,
  PERSONALITY_QUOTES,
} from '../store/selectors.js';

const bar = (pct) => ({
  height: '4px',
  borderRadius: '2px',
  background: 'var(--acc)',
  width: `${pct}%`,
  transition: 'width 1s ease',
});

const FOCUS_PRESETS = [15, 25, 50];

/** Pick a duration, start focusing — the screen takeover does the rest. */
function FocusPanel() {
  const focusMin = useStore((s) => s.focusMin);
  const startFocus = useStore((s) => s.startFocus);
  const [customOpen, setCustomOpen] = useState(false);
  const [minutes, setMinutes] = useState(focusMin);

  const pill = (on) => ({
    padding: '8px 14px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
    border: on ? '1px solid var(--acc)' : '1px solid transparent',
    background: on ? 'var(--soft)' : 'var(--field)',
    color: on ? 'var(--acc)' : 'var(--ink2)',
  });

  return (
    <Card style={{ marginTop: '12px', padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M6 3h12M6 21h12M8 3v3.5c0 2 4 3.5 4 5.5s-4 3.5-4 5.5V21M16 3v3.5c0 2-4 3.5-4 5.5s4 3.5 4 5.5V21" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Focus mode</div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink3)', marginTop: '1px' }}>
            Silence the noise for a stretch
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '7px', marginTop: '12px', flexWrap: 'wrap' }}>
        {FOCUS_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMinutes(m);
              setCustomOpen(false);
            }}
            style={pill(!customOpen && minutes === m)}
          >
            {m} min
          </button>
        ))}
        <button type="button" onClick={() => setCustomOpen(true)} style={pill(customOpen)}>
          Custom
        </button>
        {customOpen && (
          <input
            type="number"
            min="1"
            max="180"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            autoFocus
            style={{
              width: '72px',
              background: 'var(--field)',
              border: '1px solid var(--gBrd)',
              borderRadius: '999px',
              padding: '8px 12px',
              fontSize: '12px',
              color: 'var(--ink)',
              textAlign: 'center',
            }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => startFocus(minutes)}
        style={{ ...accentButton, width: '100%', marginTop: '12px' }}
      >
        Start focusing
      </button>
    </Card>
  );
}

export default function Home() {
  const state = useStore();
  const setTab = useStore((s) => s.setTab);
  const { homeVariant, quoteIx, user } = state;

  const summary = useMemo(() => scoreOf(state), [state.tasks, state.habits, state.assignments]);
  const best = useMemo(
    () => currentSession(state.courses, state.picked),
    [state.courses, state.picked]
  );

  const { score, penalty, overdueCount, pcts } = summary;
  const pending = pendingTasks(state.tasks);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const line = greetingLine(state, best, firstName);
  const advice = focusAdvice(state, summary);

  const upNext = pending.length
    ? `${pending[0].title} · ${
        pending[0].due === d(0)
          ? 'Today'
          : pending[0].due === d(1)
            ? 'Tomorrow'
            : new Date(`${pending[0].due}T12:00`).toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
      } · ${fmt12(pending[0].time)}`
    : 'Nothing scheduled — add a task';

  const hasScore = score !== null;
  const dash = `${(((hasScore ? score : 0) / 100) * 314.16).toFixed(1)} 314.16`;
  const dashMini = `${(((hasScore ? score : 0) / 100) * 150.8).toFixed(1)} 150.8`;

  const onTrackCount = state.habits.filter((h) => isOnTrack(h)).length;

  return (
    <Screen label="Home">
      <div style={{ textAlign: 'center', padding: '12px 0 2px' }}>
        <span style={wordmark(32)}>Litmus</span>
      </div>

      {homeVariant === 'ring' && (
        <>
          <div style={{ marginTop: '14px', fontSize: '23px', fontWeight: 600, lineHeight: 1.25 }}>
            {greetingFor()}, {firstName}.
          </div>
          <div style={{ marginTop: '6px', fontSize: '13.5px', color: 'var(--ink2)', lineHeight: 1.55 }}>
            {line}
          </div>
          <div
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              borderRadius: '16px',
              background: 'var(--soft)',
              border: '1px solid var(--gBrd)',
              font: "italic 400 14.5px 'Instrument Serif',serif",
              lineHeight: 1.5,
              color: 'var(--ink2)',
            }}
          >
            &ldquo;{PERSONALITY_QUOTES[quoteIx % PERSONALITY_QUOTES.length]}&rdquo;
          </div>

          <Card radius={26} style={{ marginTop: '18px', padding: '20px' }}>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '118px', height: '118px', flex: 'none' }}>
                <svg width="118" height="118" viewBox="0 0 118 118" aria-hidden="true" style={{ overflow: 'visible' }}>
                  <circle cx="59" cy="59" r="50" fill="none" strokeWidth="9" style={{ stroke: 'var(--track)' }} />
                  <circle
                    cx="59"
                    cy="59"
                    r="50"
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    transform="rotate(-90 59 59)"
                    strokeDasharray={dash}
                    style={{
                      stroke: 'var(--acc)',
                      filter: 'drop-shadow(0 0 4px var(--glow)) drop-shadow(0 0 14px var(--soft))',
                      transition: 'stroke-dasharray 1s ease,stroke 1s ease',
                    }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1, color: hasScore ? undefined : 'var(--ink3)' }}>
                    {hasScore ? score : '—'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink3)', letterSpacing: '1px' }}>/ 100</div>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={sectionLabel}>Litmus score</div>
                <div
                  style={{
                    marginTop: '4px',
                    display: 'inline-block',
                    padding: '4px 11px',
                    borderRadius: '20px',
                    background: 'var(--soft)',
                    color: 'var(--acc)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                  }}
                >
                  {scoreLabel(score)}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <Breakdown label="Tasks" value={pcts.tasks} />
                  <Breakdown label="Habits" value={pcts.habits} />
                  <Breakdown label="Assign." value={pcts.asg} />
                </div>
              </div>
            </div>

            {penalty > 0 && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--gBrd)',
                  fontSize: '11.5px',
                  color: ERROR_INK,
                }}
              >
                −{penalty} pts · missed-deadline penalty ({overdueCount} overdue)
              </div>
            )}
          </Card>
        </>
      )}

      {homeVariant === 'hero' && (
        <div style={{ marginTop: '26px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--ink2)' }}>
            {greetingFor()}, {firstName}.
          </div>
          <div
            style={{
              marginTop: '18px',
              fontSize: '112px',
              fontWeight: 600,
              letterSpacing: '-5px',
              lineHeight: 0.95,
              color: hasScore ? 'var(--acc)' : 'var(--ink3)',
              textShadow: hasScore ? '0 0 46px var(--glow)' : 'none',
              transition: 'color 1s',
            }}
          >
            {hasScore ? score : '—'}
          </div>
          <div style={{ marginTop: '8px', fontSize: '10px', letterSpacing: '3.5px', color: 'var(--ink3)' }}>
            LITMUS SCORE
          </div>
          <div
            style={{
              marginTop: '12px',
              display: 'inline-block',
              padding: '5px 14px',
              borderRadius: '20px',
              background: 'var(--soft)',
              color: 'var(--acc)',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {scoreLabel(score)}
          </div>
          <div
            style={{
              margin: '18px auto 0',
              width: '72%',
              height: '5px',
              borderRadius: '3px',
              background: 'var(--track)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '5px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg,var(--accD),var(--acc))',
                width: `${hasScore ? score : 0}%`,
                transition: 'width 1s ease',
              }}
            />
          </div>
          <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--ink3)', letterSpacing: '0.3px' }}>
            Tasks {pct(pcts.tasks)}&nbsp; · &nbsp;Habits {pct(pcts.habits)}&nbsp; · &nbsp;Assignments {pct(pcts.asg)}
          </div>
          {penalty > 0 && (
            <div style={{ marginTop: '6px', fontSize: '11.5px', color: ERROR_INK }}>
              −{penalty} pts missed-deadline penalty
            </div>
          )}
          <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--ink2)', lineHeight: 1.55, padding: '0 10px' }}>
            {line}
          </div>
        </div>
      )}

      {homeVariant === 'agenda' && (
        <Timeline
          state={state}
          score={score}
          dashMini={dashMini}
          greeting={`${greetingFor()}, ${firstName}.`}
          line={line}
        />
      )}

      <Card radius={26} style={{ marginTop: '14px', padding: '18px 20px' }}>
        <div style={sectionLabel}>Today&apos;s focus</div>
        <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.55 }}>{advice}</div>
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--gBrd)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--acc)',
              boxShadow: '0 0 8px var(--glow)',
              flex: 'none',
            }}
          />
          <span style={{ fontSize: '12.5px', color: 'var(--ink2)' }}>
            Up next: <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{upNext}</span>
          </span>
        </div>
      </Card>

      {homeVariant === 'ring' && (
        <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
          <Stat
            value={`${state.tasks.filter((t) => t.done).length} of ${state.tasks.length}`}
            label="TASKS DONE"
            onClick={() => setTab('tasks')}
          />
          <Stat
            value={`${onTrackCount} of ${state.habits.length}`}
            label="HABITS ON TRACK"
            onClick={() => setTab('habits')}
          />
          <Stat value={nextClassChip(state, best)} label="NEXT CLASS" small onClick={() => setTab('tt')} />
        </div>
      )}

      <FocusPanel />
    </Screen>
  );
}

/** null means "nothing to measure yet" — render a dash, not a number. */
const pct = (v) => (v === null ? '—' : `${v}%`);

function Breakdown({ label, value }) {
  const measured = value !== null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '56px', fontSize: '10.5px', color: 'var(--ink3)' }}>{label}</span>
      <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--track)' }}>
        {measured && <div style={bar(value)} />}
      </div>
      <span
        style={{
          fontSize: '10.5px',
          color: measured ? 'var(--ink2)' : 'var(--ink3)',
          width: '28px',
          textAlign: 'right',
        }}
      >
        {pct(value)}
      </span>
    </div>
  );
}

function Stat({ value, label, small, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} — open`}
      style={{
        flex: 1,
        ...glass(20, 20),
        padding: '14px 12px',
        textAlign: 'center',
        border: 'none',
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          fontSize: small ? '12.5px' : '20px',
          fontWeight: 700,
          color: 'var(--acc)',
          lineHeight: small ? 1.3 : undefined,
          paddingTop: small ? '4px' : 0,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: small ? '4px' : '2px',
          fontSize: '10px',
          color: 'var(--ink3)',
          letterSpacing: '1px',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </button>
  );
}

function Timeline({ state, score, dashMini, greeting, line }) {
  const rows = todayTimeline(state);
  return (
    <>
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1.25 }}>{greeting}</div>
          <div style={{ marginTop: '4px', fontSize: '12.5px', color: 'var(--ink2)', lineHeight: 1.5 }}>{line}</div>
        </div>
        <div style={{ position: 'relative', width: '60px', height: '60px', flex: 'none' }}>
          <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r="24" fill="none" strokeWidth="5" style={{ stroke: 'var(--track)' }} />
            <circle
              cx="30"
              cy="30"
              r="24"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              transform="rotate(-90 30 30)"
              strokeDasharray={dashMini}
              style={{
                stroke: 'var(--acc)',
                filter: 'drop-shadow(0 0 5px var(--glow))',
                transition: 'stroke-dasharray 1s ease,stroke 1s ease',
              }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px',
              fontWeight: 700,
            }}
          >
            {score === null ? '—' : score}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '18px',
          padding: '0 2px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '1.4px',
          textTransform: 'uppercase',
          color: 'var(--ink2)',
        }}
      >
        Today&apos;s timeline
      </div>

      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((ag, i) => (
          <div key={`${ag.kind}-${ag.label}-${i}`} style={{ display: 'flex', alignItems: 'stretch', gap: '10px' }}>
            <div
              style={{
                width: '60px',
                flex: 'none',
                paddingTop: '12px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--ink2)',
                textAlign: 'right',
              }}
            >
              {ag.timeLabel}
            </div>
            <div style={{ width: '8px', flex: 'none', display: 'flex', justifyContent: 'center', paddingTop: '16px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: ag.kind === 'Overdue' ? '#e24b4a' : 'var(--acc)',
                  boxShadow: ag.kind === 'Overdue' ? '0 0 7px rgba(226,75,74,0.55)' : '0 0 7px var(--glow)',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, ...glass(15, 18), padding: '10px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '8.5px',
                    fontWeight: 700,
                    letterSpacing: '1.2px',
                    textTransform: 'uppercase',
                    padding: '3px 7px',
                    borderRadius: '8px',
                    background: ag.kind === 'Overdue' ? 'rgba(226,75,74,0.16)' : 'var(--soft)',
                    color: ag.kind === 'Overdue' ? '#e24b4a' : 'var(--acc)',
                    flex: 'none',
                  }}
                >
                  {ag.kind}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ag.label}
                </span>
              </div>
              <div style={{ marginTop: '3px', fontSize: '10.5px', color: 'var(--ink3)' }}>{ag.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {!rows.length && (
        <div
          style={{
            marginTop: '8px',
            textAlign: 'center',
            fontSize: '12.5px',
            color: 'var(--ink3)',
            padding: '16px 0',
          }}
        >
          Nothing on today&apos;s timeline — enjoy the quiet.
        </div>
      )}
    </>
  );
}
