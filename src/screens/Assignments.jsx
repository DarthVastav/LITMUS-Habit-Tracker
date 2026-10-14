import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { Card, Screen, Dropdown, CheckBox, DeleteX, RowMenu, Segmented } from '../ui/primitives.jsx';
import { glass, pageTitle, accentButton, fieldInput } from '../lib/theme.js';
import { d, dLabel, dateOptions } from '../lib/date.js';
import { assignmentPlans, chosenCourses, courseInfo, RUNWAY } from '../store/selectors.js';
import { INTENSITY_LABELS } from '../lib/db.js';

const EMPTY = { title: '', desc: '', subj: 'General', due: d(7), intensity: 'Medium', type: 'Individual', runway: null };

const field = {
  width: '100%',
  background: 'var(--field)',
  border: '1px solid var(--gBrd)',
  borderRadius: '13px',
  color: 'var(--ink)',
  outline: 'none',
};

function AssignmentTab() {
  const assignments = useStore((s) => s.assignments);
  const courses = useStore((s) => s.courses);
  const picked = useStore((s) => s.picked);
  const addAssignment = useStore((s) => s.addAssignment);
  const updateAssignment = useStore((s) => s.updateAssignment);
  const deleteAssignment = useStore((s) => s.deleteAssignment);

  const [draft, setDraft] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const formRef = useRef(null);
  // One entry per course code — sections belong on the timetable, not on an
  // assignment, and PM A / PM C are the same subject to write for.
  const bySubject = new Map();
  chosenCourses(courses, picked).forEach((c) => {
    if (!bySubject.has(c.code)) bySubject.set(c.code, courseInfo(c).name);
  });
  const [customSubjects, setCustomSubjects] = useState([]);
  const subjects = [
    { label: 'General', hint: '' },
    ...[...bySubject.entries()].map(([code, hint]) => ({ label: code, hint })),
    ...customSubjects.filter((c) => c !== 'General' && !bySubject.has(c)).map((c) => ({ label: c, hint: '' })),
  ];
  const plans = assignmentPlans(assignments);

  const submit = () => {
    if (editId) {
      updateAssignment(editId, {
        title: draft.title,
        desc: draft.desc,
        subj: draft.subj,
        due: draft.due,
        intensity: draft.intensity,
        runway: draft.runway,
        type: draft.type,
      });
      setDraft(EMPTY);
      setEditId(null);
    } else {
      addAssignment(draft);
      setDraft({ ...draft, title: '', desc: '' });
    }
  };

  /** Load an existing assignment into the form at the top of the screen. */
  const startEdit = (a) => {
    setDraft({ title: a.title, desc: a.desc, subj: a.subj, due: a.due, intensity: a.intensity, type: a.type, runway: a.runway ?? null });
    setEditId(a.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setDraft(EMPTY);
    setEditId(null);
  };

  return (
    <>

      <Card ref={formRef} style={{ position: 'relative', zIndex: 30, marginTop: '14px', padding: '16px' }}>
        {editId && (
          <div
            style={{
              marginBottom: '10px',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              color: 'var(--acc)',
            }}
          >
            Editing assignment
          </div>
        )}
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Assignment title"
          style={{ ...field, padding: '12px 14px', fontSize: '14.5px' }}
        />
        <input
          value={draft.desc}
          onChange={(e) => setDraft({ ...draft, desc: e.target.value })}
          placeholder="Short description (optional)"
          style={{ ...field, marginTop: '8px', padding: '11px 14px', fontSize: '12.5px' }}
        />

        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
          <Dropdown
            id="asubj"
            flex={1.1}
            value={draft.subj}
            addLabel="New subject"
            onAdd={(text) => {
              const code = text.trim();
              if (!code) return;
              setCustomSubjects((cs) => (cs.includes(code) ? cs : [...cs, code]));
              setDraft({ ...draft, subj: code });
            }}
            options={subjects.map((s) => ({
              label: s.label,
              hint: s.hint,
              pick: () => setDraft({ ...draft, subj: s.label }),
            }))}
          />
          <Dropdown
            id="adate"
            flex={1}
            fontSize={12}
            align="right"
            minWidth="170px"
            value={dLabel(draft.due)}
            options={dateOptions((iso) => setDraft({ ...draft, due: iso }))}
          />
        </div>

        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
          <Dropdown
            id="aint"
            flex={1}
            value={draft.intensity}
            options={INTENSITY_LABELS.map((k) => ({ label: k, pick: () => setDraft({ ...draft, intensity: k }) }))}
          />
          <Segmented
            variant="compact"
            style={{ flex: 1.2 }}
            value={draft.type}
            onChange={(v) => setDraft({ ...draft, type: v })}
            options={[
              { value: 'Individual', label: 'Individual' },
              { value: 'Group', label: 'Group' },
            ]}
          />
        </div>

        <div style={{ marginTop: '9px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>
            {draft.runway === null
              ? `Runway opens ${RUNWAY[draft.type]?.[draft.intensity] ?? 7} days before the deadline`
              : `Runway opens ${draft.runway} day${draft.runway === 1 ? '' : 's'} before the deadline`}
          </span>
          {draft.runway === null ? (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, runway: RUNWAY[draft.type]?.[draft.intensity] ?? 7 })}
              style={{ background: 'var(--soft)', border: 'none', borderRadius: '10px', padding: '4px 10px', fontSize: '10.5px', fontWeight: 700, color: 'var(--acc)' }}
            >
              Custom
            </button>
          ) : (
            <>
              <input
                type="number"
                min="1"
                max="60"
                value={draft.runway}
                onChange={(e) => setDraft({ ...draft, runway: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                style={{ width: '58px', background: 'var(--field)', border: '1px solid var(--gBrd)', borderRadius: '10px', padding: '5px 8px', fontSize: '11.5px', color: 'var(--ink)', textAlign: 'center' }}
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, runway: null })}
                style={{ background: 'none', border: 'none', fontSize: '10.5px', color: 'var(--ink3)', textDecoration: 'underline' }}
              >
                auto
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          <button type="button" onClick={submit} style={{ ...accentButton, flex: 1 }}>
            {editId ? 'Save changes' : 'Add assignment'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={cancelEdit}
              style={{
                background: 'transparent',
                border: '1px solid var(--gBrd)',
                borderRadius: '13px',
                padding: '12px 14px',
                fontSize: '13px',
                color: 'var(--ink2)',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </Card>

      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {plans.map((a) => (
          <AssignmentCard key={a.id} a={a} onDelete={deleteAssignment} onEdit={startEdit} editing={editId === a.id} />
        ))}
      </div>

      {!assignments.length && (
        <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink3)' }}>
          No assignments yet — add one above.
        </div>
      )}
    </>
  );
}

export default function Prep() {
  const prepTab = useStore((s) => s.prepTab);
  const setUI = useStore((s) => s.setUI);
  return (
    <Screen label="Prep">
      <div style={{ padding: '14px 2px 0', fontSize: '26px', fontWeight: 700 }}>Prep</div>
      <Segmented
        style={{ marginTop: '14px' }}
        value={prepTab}
        onChange={(v) => setUI({ prepTab: v, drop: null })}
        options={[
          { value: 'asg', label: 'Assignments' },
          { value: 'exam', label: 'Exam prep' },
        ]}
      />
      {prepTab === 'exam' ? <ExamPrepTab /> : <AssignmentTab />}
    </Screen>
  );
}

/**
 * Exam preparation: pick a subject, stack sub-topics under it, tick them
 * off one at a time. Each subject renders as a card with the same progress
 * strip assignments use, and the Prep score pools both.
 */
function ExamPrepTab() {
  const prep = useStore((s) => s.prep);
  const editPrepTopic = useStore((s) => s.editPrepTopic);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editSubj, setEditSubj] = useState('');
  const courses = useStore((s) => s.courses);
  const picked = useStore((s) => s.picked);
  const addPrepTopic = useStore((s) => s.addPrepTopic);
  const togglePrepTopic = useStore((s) => s.togglePrepTopic);
  const deletePrepTopic = useStore((s) => s.deletePrepTopic);

  // Subjects typed in by hand — selectable immediately, and they persist
  // the moment a topic is saved under them (prep rows carry the subject).
  // Declared BEFORE the memo below, which reads it during render.
  const [customSubjects, setCustomSubjects] = useState([]);

  const subjects = useMemo(() => {
    const bySubject = new Map();
    chosenCourses(courses, picked).forEach((c) => {
      if (!bySubject.has(c.code)) bySubject.set(c.code, courseInfo(c).name);
    });
    // Subjects with existing topics stay pickable even if deselected.
    prep.forEach((x) => {
      if (!bySubject.has(x.subject)) bySubject.set(x.subject, '');
    });
    customSubjects.forEach((c) => {
      if (!bySubject.has(c)) bySubject.set(c, '');
    });
    if (!bySubject.size) bySubject.set('General', '');
    return [...bySubject.entries()].map(([code, hint]) => ({ code, hint }));
  }, [courses, picked, prep, customSubjects]);

  const [subj, setSubj] = useState(subjects[0]?.code || 'General');
  const [topic, setTopic] = useState('');
  const activeSubj = subjects.some((s) => s.code === subj) ? subj : subjects[0]?.code || 'General';

  const grouped = useMemo(() => {
    const m = new Map();
    prep.forEach((x) => {
      if (!m.has(x.subject)) m.set(x.subject, []);
      m.get(x.subject).push(x);
    });
    // Subject cards follow the same rule as their topics: anything still
    // to revise stays on top; fully completed subjects sink to the bottom.
    return [...m.entries()].sort(
      (a, b) => Number(a[1].every((x) => x.done)) - Number(b[1].every((x) => x.done))
    );
  }, [prep]);

  const submit = () => {
    addPrepTopic(activeSubj, topic);
    setTopic('');
  };

  return (
    <>
      <Card style={{ position: 'relative', zIndex: 30, marginTop: '14px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Dropdown
            id="prepsubj"
            flex={1}
            value={activeSubj}
            addLabel="New subject"
            onAdd={(text) => {
              const code = text.trim();
              if (!code) return;
              setCustomSubjects((cs) => (cs.includes(code) ? cs : [...cs, code]));
              setSubj(code);
            }}
            options={subjects.map((s) => ({
              label: s.code,
              hint: s.hint,
              pick: () => setSubj(s.code),
            }))}
          />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Add a topic to revise"
            style={{ ...fieldInput, flex: 2 }}
          />
        </div>
        <button type="button" onClick={submit} style={{ ...accentButton, marginTop: '10px', width: '100%' }}>
          Add topic
        </button>
      </Card>

      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {grouped.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 20px', fontSize: '12.5px', color: 'var(--ink3)' }}>
            Nothing queued yet — pick a subject and add your first revision topic.
          </div>
        )}
        {grouped.map(([subject, rawTopics]) => {
          // Finished topics sink; the ones still to revise stay on top.
          const topics = [...rawTopics].sort((a, b) => Number(a.done) - Number(b.done));
          const done = topics.filter((x) => x.done).length;
          const pct = Math.round((done / topics.length) * 100);
          return (
            <div key={subject} style={{ ...glass(20, 20), padding: '15px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>{subject}</span>
                <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>
                  {done}/{topics.length} topics
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '11.5px', fontWeight: 700, color: 'var(--acc)' }}>
                  {pct}%
                </span>
              </div>
              <div style={{ marginTop: '9px', height: '5px', borderRadius: '3px', background: 'var(--track)' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: '3px',
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg,var(--accD),var(--acc))',
                    transition: 'width .4s ease',
                  }}
                />
              </div>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {topics.map((x) =>
                  editingId === x.id ? (
                    <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            editPrepTopic(x.id, { topic: editText, subject: editSubj });
                            setEditingId(null);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={{ ...fieldInput, flex: 1, fontSize: '12.5px', padding: '7px 10px' }}
                        autoFocus
                      />
                      <Dropdown
                        id={`prepmove-${x.id}`}
                        value={editSubj}
                        minWidth="90px"
                        options={subjects.map((s) => ({ label: s.code, pick: () => setEditSubj(s.code) }))}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          editPrepTopic(x.id, { topic: editText, subject: editSubj });
                          setEditingId(null);
                        }}
                        style={{ background: 'var(--soft)', border: 'none', borderRadius: '10px', padding: '7px 11px', fontSize: '11px', fontWeight: 700, color: 'var(--acc)' }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckBox done={x.done} onClick={() => togglePrepTopic(x.id)} tick={12} size={22} label={x.topic} />
                      <span
                        style={{
                          flex: 1,
                          fontSize: '12.5px',
                          color: x.done ? 'var(--ink3)' : 'var(--ink)',
                          textDecoration: x.done ? 'line-through' : 'none',
                        }}
                      >
                        {x.topic}
                      </span>
                      <RowMenu
                        label={x.topic}
                        onEdit={() => {
                          setEditingId(x.id);
                          setEditText(x.topic);
                          setEditSubj(subject);
                        }}
                        onDelete={() => deletePrepTopic(x.id)}
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AssignmentCard({ a, onDelete, onEdit, editing }) {
  const addSubtask = useStore((s) => s.addSubtask);
  const toggleSubtask = useStore((s) => s.toggleSubtask);
  const deleteSubtask = useStore((s) => s.deleteSubtask);
  const toggleAssignmentComplete = useStore((s) => s.toggleAssignmentComplete);
  const editSubtask = useStore((s) => s.editSubtask);
  const [sub, setSub] = useState('');
  const [editingSub, setEditingSub] = useState(null);
  const [editSubText, setEditSubText] = useState('');
  const complete = a.subs.length ? a.subs.every((x) => x.done) : !!a.done;

  const submitSub = () => {
    if (!sub.trim()) return;
    addSubtask(a.id, sub);
    setSub('');
  };

  return (
    <div
      style={{
        ...glass(20, 20),
        padding: '15px 16px',
        opacity: a.open === false ? 0.62 : 1,
        ...(editing ? { border: '1px solid var(--acc)', boxShadow: 'var(--gSh),0 0 20px var(--glow)' } : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CheckBox
          done={complete}
          onClick={() => toggleAssignmentComplete(a.id)}
          size={23}
          radius={8}
          tick={12}
          label={complete ? `Mark ${a.title} incomplete` : `Mark ${a.title} complete`}
        />
        {a.open === false && (
          <span
            style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.8px',
              padding: '3px 8px',
              borderRadius: '9px',
              background: 'var(--track)',
              color: 'var(--ink3)',
              flex: 'none',
              order: 2,
            }}
          >
            {a.opensPhrase}
          </span>
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '15px',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.title}
        </span>
        <span
          style={{
            fontSize: '8.5px',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '9px',
            background: 'var(--soft)',
            color: 'var(--acc)',
            flex: 'none',
          }}
        >
          {a.type}
        </span>
        <RowMenu label={a.title} onEdit={() => onEdit(a)} onDelete={() => onDelete(a.id)} />
      </div>

      <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--ink3)' }}>{a.meta}</div>
      {a.desc && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--ink2)', lineHeight: 1.5 }}>{a.desc}</div>
      )}

      <div
        style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '12px',
          background: 'var(--soft)',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: 'var(--acc)',
            boxShadow: '0 0 7px var(--glow)',
            flex: 'none',
          }}
        />
        <span style={{ fontSize: '11.5px', color: 'var(--ink2)', lineHeight: 1.4 }}>{a.plan}</span>
      </div>

      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--track)', overflow: 'hidden' }}>
          <div
            style={{
              height: '5px',
              borderRadius: '3px',
              background: 'linear-gradient(90deg,var(--accD),var(--acc))',
              width: `${a.pct}%`,
              transition: 'width .5s ease',
            }}
          />
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--acc)', width: '34px', textAlign: 'right' }}>
          {a.pct}%
        </span>
      </div>

      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {a.subs.map((st) => (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckBox
              done={st.done}
              onClick={() => toggleSubtask(a.id, st.id)}
              size={21}
              radius={7}
              tick={11}
              label={st.text}
            />
            {editingSub === st.id ? (
              <input
                value={editSubText}
                autoFocus
                onChange={(e) => setEditSubText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editSubtask(a.id, st.id, editSubText);
                    setEditingSub(null);
                  }
                  if (e.key === 'Escape') setEditingSub(null);
                }}
                onBlur={() => {
                  editSubtask(a.id, st.id, editSubText);
                  setEditingSub(null);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'var(--field)',
                  border: '1px solid var(--acc)',
                  borderRadius: '9px',
                  padding: '5px 9px',
                  fontSize: '12.5px',
                  color: 'var(--ink)',
                }}
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: '12.5px',
                  textDecoration: st.done ? 'line-through' : 'none',
                  opacity: st.done ? 0.5 : 1,
                  transition: 'opacity .3s',
                }}
              >
                {st.text}
              </span>
            )}
            <RowMenu
              label={st.text}
              onEdit={() => {
                setEditingSub(st.id);
                setEditSubText(st.text);
              }}
              onDelete={() => deleteSubtask(a.id, st.id)}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '9px', display: 'flex', gap: '7px' }}>
        <input
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitSub()}
          placeholder="Add a sub-task"
          style={{
            flex: 1,
            background: 'var(--field)',
            border: '1px solid var(--gBrd)',
            borderRadius: '11px',
            padding: '9px 12px',
            fontSize: '12px',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={submitSub}
          aria-label="Add sub-task"
          style={{
            border: 'none',
            borderRadius: '11px',
            padding: '0 14px',
            fontSize: '16px',
            fontWeight: 600,
            background: 'var(--soft)',
            color: 'var(--acc)',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
