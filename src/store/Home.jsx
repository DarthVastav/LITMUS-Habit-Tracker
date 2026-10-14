import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { Card, Screen } from '../ui/primitives.jsx';
import { glass, wordmark, sectionLabel, ERROR_INK } from '../lib/theme.js';
import { greetingFor, fmt12, d } from '../lib/date.js';
import {
  scoreOf,
  scoreLabel,
  greetingLine,
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

export default function Home() {
  const state = useStore();
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

  const daily = state.habits.filter((h) => h.freq === 'Daily');
  const habitsDone = daily.filter((h) => h.last === d(0)).length;

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
                <svg width="118" height="118" viewBox="0 0 118 118" aria-hidden="true">
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
                      filter: 'drop-shadow(0 0 7px var(--glow))',
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
                  <Breakdown label="Streaks" value={pcts.streaks} />
                  <Breakdown label="Routine" value={pcts.routine} />
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
            Tasks {pct(pcts.tasks)}&nbsp; · &nbsp;Streaks {pct(pcts.streaks)}&nbsp; · &nbsp;Routine{' '}
            {pct(pcts.routine)}&nbsp; · &nbsp;Assignments {pct(pcts.asg)}
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
          <Stat value={`${state.tasks.filter((t) => t.done).length}/${state.tasks.length}`} label="TASKS DONE" />
          <Stat value={`${habitsDone}/${daily.length}`} label="HABITS TODAY" />
          <Stat value={nextClassChip(state, best)} label="NEXT CLASS" small />
        </div>
      )}
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

function Stat({ value, label, small }) {
  return (
    <div style={{ flex: 1, ...glass(20, 20), padding: '14px 12px', textAlign: 'center' }}>
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
      <div style={{ marginTop: small ? '4px' : '2px', fontSize: '10px', color: 'var(--ink3)', letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
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
                  background: 'var(--acc)',
                  boxShadow: '0 0 7px var(--glow)',
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
                    background: 'var(--soft)',
                    color: 'var(--acc)',
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
