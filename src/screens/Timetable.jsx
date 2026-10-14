import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { Screen, Toggle, Segmented } from '../ui/primitives.jsx';
import { glass } from '../lib/theme.js';
import { chosenCourses, currentSession, weekSchedule, scheduleRangeLabel, activeCourses, courseInfo } from '../store/selectors.js';
import { splitMeal } from '../lib/mainDish.js';

const rowBase = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  borderRadius: '12px',
  padding: '5px 8px',
  margin: '0 -8px',
  transition: 'all .3s',
};

const dayCard = (isToday) => ({
  ...glass(20, 20),
  padding: '14px 16px',
  ...(isToday ? { border: '1px solid var(--acc)', boxShadow: 'var(--gSh),0 0 24px var(--glow)' } : {}),
});

export default function Timetable() {
  const state = useStore();
  const { ttTab, messView, imports, setUI } = state;
  // Header range mirrors what the class tab actually shows: the days that
  // remain, across however many uploaded weeks.
  const headerBest = currentSession(state.courses, state.picked);
  const headerDays = weekSchedule(state, headerBest);

  return (
    <Screen label="Timetable">
      <div style={{ padding: '14px 2px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '26px', fontWeight: 700 }}>Timetable</span>
        <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>
          {scheduleRangeLabel(headerDays) || imports.class?.week_label || ''}
        </span>
      </div>

      <Segmented
        style={{ marginTop: '14px', ...glass(18, 20), padding: '5px' }}
        value={ttTab}
        onChange={(v) => setUI({ ttTab: v, drop: null })}
        options={[
          { value: 'class', label: 'Class timetable' },
          { value: 'mess', label: 'Mess timetable' },
        ]}
      />

      <ImportPreview />
      {ttTab === 'class' ? <ClassTab /> : <MessTab view={messView} />}
    </Screen>
  );
}

// =====================================================================
//  Class timetable
// =====================================================================
function ClassTab() {
  const state = useStore();
  const { courses, picked, imports, classRemind, coursesOpen, user } = state;
  const [courseQuery, setCourseQuery] = useState('');
  // Only this term's courses (future sessions or exams) — old terms fade
  // out of the picker; picks float to the top; a search box tames the rest.
  const pickable = useMemo(() => {
    const act = activeCourses(state);
    const q = courseQuery.trim().toLowerCase();
    const filtered = q
      ? act.filter((c) => c.key.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) || courseInfo(c).name.toLowerCase().includes(q))
      : act;
    return [...filtered].sort(
      (a, b) => Number(picked.includes(b.key)) - Number(picked.includes(a.key)) || a.key.localeCompare(b.key)
    );
  }, [state.courses, state.quizzes, picked, courseQuery]);
  const setCoursesOpen = useStore((s) => s.setCoursesOpen);
  const toggleCourse = useStore((s) => s.toggleCourse);
  const setReminderPref = useStore((s) => s.setReminderPref);
  const resetImport = useStore((s) => s.resetImport);
  const setUI = useStore((s) => s.setUI);
  const say = useStore((s) => s.say);

  const best = useMemo(() => currentSession(courses, picked), [courses, picked]);
  const week = useMemo(() => weekSchedule(state, best), [courses, picked, state.quizzes, best]);
  const chosen = chosenCourses(courses, picked);

  // No class sheet AND nothing scheduled → pure onboarding. But an exam
  // PDF can populate the schedule with no class sheet at all, and those
  // days must render — the upload prompt just rides above them.
  const classOnboarding = (
    <UploadCard
      kind="class"
      title="Upload master timetable"
      body="Drop in the weekly Excel sheet — then pick your courses and we'll keep only your classes."
      icon={
        <>
          <rect x="4" y="5" width="16" height="16" rx="4" />
          <line x1="4" y1="10" x2="20" y2="10" />
          <line x1="9" y1="3" x2="9" y2="6" />
          <line x1="15" y1="3" x2="15" y2="6" />
        </>
      }
    />
  );
  if (!imports.class && week.length === 0) {
    return classOnboarding;
  }

  // A brand-new user meets the batch's shared timetable as a SETUP step:
  // pick your subjects first; the schedule, exams and reminder controls
  // appear only after. No wall of other people's data, and no destructive
  // buttons in reach.
  const needsSetup = picked.length === 0 && courses.length > 0;

  return (
    <>
      {needsSetup ? null : imports.class ? (
        <FileChip
          name={imports.class.file_name}
          kind="class"
          uploader={imports.class.uploader_name}
          uploadedAt={imports.class.created_at}
          onClear={() => resetImport('class')}
        />
      ) : (
        <CompactUpload kind="class" label="No class sheet yet — add the weekly timetable" />
      )}

      {needsSetup && (
        <div style={{ marginTop: '14px', ...glass(20, 22), padding: '18px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Welcome — your batch's timetable is already here</div>
          <div style={{ marginTop: '6px', fontSize: '12.5px', color: 'var(--ink2)', lineHeight: 1.55 }}>
            A classmate uploaded this term's schedule, so you don't have to.
            Pick your subjects below and your classes and exams appear —
            only yours.
          </div>
        </div>
      )}

      {!needsSetup && (
      <div
        style={{
          marginTop: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...glass(18, 20),
          padding: '13px 16px',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Class reminders</div>
          <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '1px' }}>
            Notify me 30 min before each class
          </div>
        </div>
        <Toggle
          on={classRemind}
          label="Class reminders"
          onClick={() => {
            const on = !classRemind;
            setReminderPref('classRemind', on);
            say(on ? 'Class reminders on — 30 min before each class' : 'Class reminders off');
          }}
        />
      </div>
      )}

      {courses.length > 0 && (
      <>
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 4px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '1.4px',
            textTransform: 'uppercase',
            color: 'var(--ink2)',
          }}
        >
          Your courses
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--acc)', fontWeight: 700 }}>{picked.length} selected</span>
          <button
            type="button"
            onClick={() => setCoursesOpen(!coursesOpen)}
            style={{
              background: 'var(--soft)',
              border: 'none',
              borderRadius: '10px',
              padding: '4px 10px',
              fontSize: '10.5px',
              fontWeight: 700,
              color: 'var(--acc)',
            }}
          >
            {needsSetup ? 'Pick yours' : coursesOpen ? 'Hide' : 'Show'}
          </button>
        </span>
      </div>

      {(coursesOpen || needsSetup) && (
        <>
        {(pickable.length > 12 || courseQuery) && (
          <input
            value={courseQuery}
            onChange={(e) => setCourseQuery(e.target.value)}
            placeholder="Search courses…"
            style={{
              marginTop: '8px',
              width: '100%',
              background: 'var(--field)',
              border: '1px solid var(--gBrd)',
              borderRadius: '12px',
              padding: '9px 13px',
              fontSize: '12.5px',
              color: 'var(--ink)',
            }}
          />
        )}
        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {pickable.map((c) => {
            const on = picked.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCourse(c.key)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${on ? 'transparent' : 'var(--gBrd)'}`,
                  background: on ? 'linear-gradient(135deg,var(--acc),var(--accD))' : 'var(--field)',
                  color: on ? 'var(--onAcc)' : 'var(--ink2)',
                  boxShadow: on ? '0 4px 14px var(--glow)' : 'none',
                  transition: 'all .25s',
                }}
              >
                {c.key}
              </button>
            );
          })}
        </div>
        </>
      )}
      </>
      )}

      {!needsSetup && (
      <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {week.map((dy) => (
          <div key={dy.day} style={dayCard(dy.isToday)}>
            <DayHeader day={dy.day} date={dy.date} isToday={dy.isToday} />
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {dy.items.map((cl, i) => (
                <div
                  key={`${cl.key}-${cl.start}-${i}`}
                  style={
                    cl.isNext
                      ? { ...rowBase, background: 'var(--soft)', border: '1px solid var(--acc)', boxShadow: '0 0 14px var(--glow)' }
                      : rowBase
                  }
                >
                  <span style={{ width: '62px', flex: 'none', fontSize: '11.5px', fontWeight: 600, color: 'var(--ink2)' }}>
                    {cl.time}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{cl.key}</span>
                      {cl.isNext && (
                        <span
                          style={{
                            fontSize: '8.5px',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            padding: '2px 7px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg,var(--acc),var(--accD))',
                            color: 'var(--onAcc)',
                            boxShadow: '0 2px 8px var(--glow)',
                          }}
                        >
                          {best?.ongoing ? 'NOW' : 'NEXT'}
                        </span>
                      )}
                      {cl.isQuiz && (
                        <span
                          style={{
                            fontSize: '8.5px',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            padding: '2px 7px',
                            borderRadius: '8px',
                            background: cl.badge === 'EXAM' ? 'rgba(226,75,74,0.16)' : 'var(--soft)',
                            color: cl.badge === 'EXAM' ? '#e24b4a' : 'var(--acc)',
                            flex: 'none',
                          }}
                        >
                          {cl.badge === 'EXAM' ? 'END TERM' : cl.badge || 'QUIZ'}
                        </span>
                      )}
                      {cl.allSections && (
                        <span
                          style={{
                            fontSize: '8.5px',
                            padding: '2px 7px',
                            borderRadius: '8px',
                            background: 'var(--track)',
                            color: 'var(--ink3)',
                            flex: 'none',
                          }}
                        >
                          All sections
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: '1px',
                        fontSize: '10.5px',
                        color: 'var(--ink3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cl.sub}
                    </div>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--ink3)', flex: 'none' }}>{cl.room}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}

      {!chosen.length && (
        <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink3)' }}>
          Tap courses above to build your week.
        </div>
      )}
    </>
  );
}

// =====================================================================
//  Mess timetable
// =====================================================================
function MessTab({ view }) {
  const mess = useStore((s) => s.mess);
  const user = useStore((s) => s.user);
  const imports = useStore((s) => s.imports);
  const setUI = useStore((s) => s.setUI);
  const resetImport = useStore((s) => s.resetImport);

  const isRegular = view === 'reg';
  const days = isRegular ? mess.regular : mess.continental;
  // Finished days fall away — the first card you see is today's menu.
  const todayIsoStr = new Date().toLocaleDateString('en-CA');
  const visibleDays = days.filter((md) => md.iso >= todayIsoStr);
  const meta = isRegular ? imports.mess : imports.continental;

  return (
    <>
      <Segmented
        variant="soft"
        style={{ marginTop: '12px' }}
        value={view}
        onChange={(v) => setUI({ messView: v, drop: null })}
        options={[
          { value: 'reg', label: 'Regular' },
          { value: 'cont', label: 'Continental' },
        ]}
      />

      {!meta ? (
        <UploadCard
          kind={isRegular ? 'mess' : 'continental'}
          title={isRegular ? 'Upload mess sheet' : 'Upload continental sheet'}
          body={
            isRegular
              ? "We'll turn it straight into your weekly menu — nothing to select."
              : 'Drop in the continental menu Excel — it becomes a weekly table just like the regular mess.'
          }
          icon={
            <>
              <rect x="4" y="4" width="16" height="16" rx="4" />
              <line x1="4" y1="10" x2="20" y2="10" />
              <line x1="4" y1="15" x2="20" y2="15" />
              <line x1="12" y1="10" x2="12" y2="20" />
            </>
          }
        />
      ) : (
        <>
          <FileChip
            name={meta.file_name}
            kind={isRegular ? 'mess' : 'continental'}
            uploader={meta.uploader_name}
            uploadedAt={meta.created_at}
            onClear={() => resetImport(isRegular ? 'mess' : 'continental')}
          />
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleDays.map((md) => (
              <MessDay key={md.iso} md={md} />
            ))}
            {days.length > 0 && visibleDays.length === 0 && (
              <div style={{ ...glass(18, 20), padding: '16px', fontSize: '12px', color: 'var(--ink3)' }}>
                This menu is entirely in the past — upload the new week's sheet when it arrives.
              </div>
            )}
          </div>
          {!days.length && (
            <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink3)' }}>
              That sheet had no readable day blocks — re-upload with the standard weekly layout.
            </div>
          )}
        </>
      )}
    </>
  );
}

function MessDay({ md }) {
  const today = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const isToday = md.iso === `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;

  return (
    <div style={dayCard(isToday)}>
      <DayHeader day={md.day} date={md.date} isToday={isToday} />
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {md.meals.map((ml) => (
          <div key={ml.name}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  color: 'var(--acc)',
                }}
              >
                {ml.name}
              </span>
              <span style={{ fontSize: '9.5px', color: 'var(--ink3)' }}>{ml.time}</span>
            </div>
            <MealItems items={ml.items} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mains bold, accompaniments dimmed — classification lives in
 * src/lib/mainDish.js and was verified against both real sheets.
 */
function MealItems({ items }) {
  const { mains } = splitMeal(items);
  const mainSet = new Set(mains);
  return (
    <div style={{ marginTop: '3px', fontSize: '11.5px', lineHeight: 1.55 }}>
      {items.map((item, i) => (
        <span key={`${item}-${i}`}>
          <span
            style={
              mainSet.has(item)
                ? { fontWeight: 700, color: 'var(--ink)' }
                : { color: 'var(--ink3)' }
            }
          >
            {item}
          </span>
          {i < items.length - 1 ? <span style={{ color: 'var(--ink3)' }}> · </span> : null}
        </span>
      ))}
    </div>
  );
}

// =====================================================================
//  Shared bits
// =====================================================================
function DayHeader({ day, date, isToday }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--acc)',
        }}
      >
        {day}
      </span>
      <span style={{ fontSize: '10.5px', color: 'var(--ink3)' }}>{date}</span>
      {isToday && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '1px',
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg,var(--acc),var(--accD))',
            color: 'var(--onAcc)',
          }}
        >
          TODAY
        </span>
      )}
    </div>
  );
}

/** One-line upload prompt for when content already fills the screen. */
function CompactUpload({ kind, label }) {
  const { busy, onFile } = useSheetImport(kind);
  return (
    <label
      style={{
        marginTop: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 14px',
        borderRadius: '14px',
        border: '1px dashed var(--gBrd)',
        background: 'var(--soft)',
        cursor: 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 20h16" />
      </svg>
      <span style={{ flex: 1, fontSize: '11.5px', color: 'var(--ink2)' }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--acc)', flex: 'none' }}>
        {busy ? 'Reading…' : 'Choose file'}
      </span>
      <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
    </label>
  );
}

function FileChip({ name, kind, onClear, uploader, uploadedAt, canClear = true }) {
  const { busy, onFile } = useSheetImport(kind);
  // Clearing is destructive, so it takes two taps: the first arms the
  // button for three seconds, the second actually clears.
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);

  const clear = () => {
    if (!armed) {
      setArmed(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    clearTimeout(timerRef.current);
    setArmed(false);
    onClear();
  };

  return (
    <div
      style={{
        marginTop: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 13px',
        borderRadius: '14px',
        background: 'var(--soft)',
        border: '1px solid var(--gBrd)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <polyline points="4,13 9,18 20,6" />
      </svg>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          title={name}
          style={{
            display: 'block', // ellipsis only works on block-level text
            fontSize: '11px',
            color: 'var(--ink2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        {(uploader || uploadedAt) && (
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--ink3)', marginTop: '1px' }}>
            {[uploader && `by ${uploader}`, uploadedAt && new Date(uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </span>
      <label
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--acc)',
          cursor: 'pointer',
          flex: 'none',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Reading…' : kind === 'class' ? 'Add week' : 'Re-upload'}
        <input type="file" accept={kind === 'class' ? '.xlsx,.xls,.csv,.pdf' : '.xlsx,.xls,.csv'} onChange={onFile} disabled={busy} style={{ display: 'none' }} />
      </label>
      {canClear && (
      <button
        type="button"
        onClick={clear}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: '11px',
          fontWeight: 600,
          color: armed ? '#ff8d7e' : 'var(--ink3)',
          transition: 'color .2s',
          flex: 'none',
        }}
      >
        {armed ? 'Clears for you only' : 'Clear'}
      </button>
      )}
    </div>
  );
}

/** One import path shared by the dropzone and the Re-upload chip. */
/**
 * The confirm step between parsing a sheet and committing it to shared
 * data: what the file is, which dates it speaks for, and any warning —
 * wrong-tab routing or staleness — before 200 people see the result.
 */
function ImportPreview() {
  const pendingImport = useStore((s) => s.pendingImport);
  const confirmImport = useStore((s) => s.confirmImport);
  const cancelImport = useStore((s) => s.cancelImport);
  if (!pendingImport) return null;
  return (
    <div style={{ marginTop: '14px', ...glass(20, 22), padding: '16px 18px', border: '1px solid var(--acc)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.4px', color: 'var(--acc)' }}>
        READY TO IMPORT
      </div>
      <div style={{ marginTop: '7px', fontSize: '14px', fontWeight: 600, overflowWrap: 'anywhere' }}>
        {pendingImport.fileName}
      </div>
      <div style={{ marginTop: '3px', fontSize: '12.5px', color: 'var(--ink2)' }}>{pendingImport.summary}</div>
      {pendingImport.note && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--warn, #e6b45a)', lineHeight: 1.5 }}>
          {pendingImport.note}
        </div>
      )}
      <div style={{ marginTop: '13px', display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={confirmImport}
          style={{
            flex: 1,
            background: 'linear-gradient(135deg,var(--acc),var(--accD))',
            color: 'var(--onAcc)',
            border: 'none',
            borderRadius: '13px',
            padding: '11px',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          Import for everyone
        </button>
        <button
          type="button"
          onClick={cancelImport}
          style={{
            background: 'transparent',
            border: '1px solid var(--gBrd)',
            borderRadius: '13px',
            padding: '11px 18px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--ink2)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function useSheetImport(kind) {
  const prepareImport = useStore((s) => s.prepareImport);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await prepareImport(file, kind);
    } finally {
      setBusy(false);
    }
  };

  return { busy, onFile };
}

function UploadCard({ kind, title, body, icon }) {
  const { busy, onFile } = useSheetImport(kind);
  const restoreShared = useStore((s) => s.restoreShared);
  const loading = useStore((s) => s.loading);
  const localOnly = useStore((s) => s.localOnly);

  return (
    <div
      style={{
        marginTop: '16px',
        ...glass(24, 20),
        border: '1px dashed var(--gBrd)',
        padding: '28px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          margin: '0 auto',
          borderRadius: '16px',
          background: 'var(--soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {icon}
        </svg>
      </div>
      <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: 600 }}>{title}</div>
      <div style={{ marginTop: '6px', fontSize: '12.5px', color: 'var(--ink2)', lineHeight: 1.5 }}>{body}</div>
      <label
        style={{
          marginTop: '16px',
          display: 'inline-block',
          borderRadius: '13px',
          padding: '12px 22px',
          fontSize: '13.5px',
          fontWeight: 600,
          background: 'linear-gradient(135deg,var(--acc),var(--accD))',
          color: 'var(--onAcc)',
          boxShadow: '0 6px 20px var(--glow)',
          cursor: 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'Reading sheet…' : 'Choose file'}
        <input type="file" accept={kind === 'class' ? '.xlsx,.xls,.csv,.pdf' : '.xlsx,.xls,.csv'} onChange={onFile} disabled={busy} style={{ display: 'none' }} />
      </label>
      {!localOnly && (
        <button
          type="button"
          onClick={() => restoreShared(kind)}
          disabled={loading || busy}
          style={{
            display: 'block',
            margin: '12px auto 0',
            background: 'transparent',
            border: '1px solid var(--gBrd)',
            borderRadius: '13px',
            padding: '11px 20px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: 'var(--acc)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Fetching…' : "Use the batch's shared one"}
        </button>
      )}
    </div>
  );
}
