import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { Card, Screen, Dropdown, CheckBox, RowMenu } from '../ui/primitives.jsx';
import { glass, pageTitle, accentButton } from '../lib/theme.js';
import { d, dLabel, fmt12, dateOptions, timeOptions, firstAvailableTime } from '../lib/date.js';
import { pendingTasks } from '../store/selectors.js';

const emptyDraft = (cat) => ({ title: '', cat, due: d(0), time: firstAvailableTime(d(0)) });

export default function Tasks() {
  const tasks = useStore((s) => s.tasks);
  const categories = useStore((s) => s.categories);
  const addCategory = useStore((s) => s.addCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const [draft, setDraft] = useState(() => emptyDraft(categories[0]));
  const [editId, setEditId] = useState(null);

  // If the app has been open a while, a time picked earlier may now be in
  // the past; nudge it to the next available slot.
  useEffect(() => {
    const snapped = firstAvailableTime(draft.due, draft.time);
    if (snapped !== draft.time) setDraft((prev) => ({ ...prev, time: snapped }));
  }, [draft.due, draft.time]);

  // If the selected category gets deleted, fall back to the first one.
  useEffect(() => {
    if (categories.length && !categories.includes(draft.cat)) {
      setDraft((prev) => ({ ...prev, cat: categories[0] }));
    }
  }, [categories, draft.cat]);

  const submit = () => {
    if (editId) {
      if (!draft.title.trim()) return;
      updateTask(editId, { title: draft.title.trim(), cat: draft.cat, due: draft.due, time: draft.time });
      setDraft(emptyDraft(categories[0]));
      setEditId(null);
    } else {
      addTask(draft);
      setDraft({ ...draft, title: '' });
    }
  };

  const startEdit = (t) => {
    setDraft({ title: t.title, cat: t.cat, due: t.due, time: t.time });
    setEditId(t.id);
  };

  const today = d(0);
  const tomorrow = d(1);
  const pending = pendingTasks(tasks);
  const groups = [
    ['Overdue', pending.filter((t) => t.due < today)],
    ['Today', pending.filter((t) => t.due === today)],
    ['Tomorrow', pending.filter((t) => t.due === tomorrow)],
    ['Later', pending.filter((t) => t.due > tomorrow)],
  ].filter(([, list]) => list.length);

  const completed = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  return (
    <Screen label="Tasks">
      <div style={pageTitle}>Tasks</div>

      <Card style={{ position: 'relative', zIndex: 30, marginTop: '14px', padding: '16px' }}>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What needs doing?"
          style={{
            width: '100%',
            background: 'var(--field)',
            border: '1px solid var(--gBrd)',
            borderRadius: '13px',
            padding: '12px 14px',
            fontSize: '14.5px',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />

        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          <Dropdown
            id="cat"
            flex={1.2}
            value={draft.cat}
            options={categories.map((c) => ({ label: c, pick: () => setDraft({ ...draft, cat: c }) }))}
            onAdd={addCategory}
            onRemove={removeCategory}
            addLabel="New category"
          />
          <Dropdown
            id="tdate"
            flex={1}
            fontSize={12}
            minWidth="170px"
            value={dLabel(draft.due)}
            options={dateOptions((iso) =>
              setDraft({ ...draft, due: iso, time: firstAvailableTime(iso, draft.time) })
            )}
          />
          <Dropdown
            id="ttime"
            flex={0.9}
            fontSize={12}
            align="right"
            minWidth="130px"
            value={fmt12(draft.time)}
            options={timeOptions((t) => setDraft({ ...draft, time: t }), draft.due)}
          />
        </div>

        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" onClick={submit} style={{ ...accentButton, flex: 1 }}>
            {editId ? 'Save changes' : 'Add task'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setDraft(emptyDraft(categories[0]));
                setEditId(null);
              }}
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

      {groups.map(([label, list]) => (
        <div key={label} style={{ marginTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '0 4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1.4px',
                textTransform: 'uppercase',
                color: 'var(--ink2)',
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--acc)', fontWeight: 700 }}>{list.length}</span>
          </div>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} onEdit={startEdit} />
            ))}
          </div>
        </div>
      ))}

      {completed.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div
            style={{
              padding: '0 4px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              color: 'var(--ink3)',
            }}
          >
            Completed
          </div>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
            ))}
          </div>
        </div>
      )}

      {!groups.length && !completed.length && (
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink3)' }}>
          Nothing here yet — add your first task above.
        </div>
      )}
    </Screen>
  );
}

function TaskRow({ task, onToggle, onDelete, onEdit }) {
  const when = `${dLabel(task.due)} · ${fmt12(task.time)}`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        ...glass(18, task.done ? 16 : 20),
        boxShadow: task.done ? 'none' : 'var(--gSh)',
        padding: task.done ? '12px 14px' : '13px 14px',
        opacity: task.done ? 0.75 : 1,
      }}
    >
      <CheckBox
        done={task.done}
        onClick={() => onToggle(task.id)}
        size={26}
        radius={9}
        tick={13}
        label={`Mark "${task.title}" ${task.done ? 'not done' : 'done'}`}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 500,
            textDecoration: task.done ? 'line-through' : 'none',
            opacity: task.done ? 0.55 : 1,
            transition: 'opacity .3s',
          }}
        >
          {task.title}
        </div>
        <div style={{ marginTop: '2px', fontSize: '11.5px', color: 'var(--ink3)' }}>
          {task.cat} · {when}
        </div>
      </div>
      <RowMenu
        label={task.title}
        onEdit={onEdit ? () => onEdit(task) : undefined}
        onDelete={() => onDelete(task.id)}
      />
    </div>
  );
}
