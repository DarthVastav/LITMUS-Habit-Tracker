import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { Card, Screen, Dropdown, CheckBox, RowMenu } from '../ui/primitives.jsx';
import { glass, pageTitle, accentButton, sectionLabel, fieldInput } from '../lib/theme.js';
import { monthGrid, isSettled, QUOTES } from '../store/selectors.js';
import { FREQ_LABELS } from '../lib/db.js';

const cellBase = {
  aspectRatio: '1',
  borderRadius: '9px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10.5px',
  fontWeight: 600,
  transition: 'all .2s',
};

/** Partial days fill bottom-up by the exact share of habits completed. */
function cellStyle(cell) {
  let style;
  switch (cell.state) {
    case 'pad':
      return cellBase;
    case 'future':
    case 'inactive':
      style = { ...cellBase, background: 'transparent', color: 'var(--ink3)', opacity: 0.45 };
      break;
    case 'full':
      style = {
        ...cellBase,
        background: 'color-mix(in oklab, var(--acc) 85%, transparent)',
        color: 'var(--onAcc)',
        boxShadow: '0 2px 8px var(--glow)',
      };
      break;
    case 'partial':
      style = {
        ...cellBase,
        background: `linear-gradient(to top, color-mix(in oklab, var(--acc) 70%, transparent) ${cell.pct}%, var(--field) ${cell.pct}%)`,
        color: 'var(--ink)',
        border: '1px solid var(--gBrd)',
      };
      break;
    case 'missed':
      style = { ...cellBase, background: 'rgba(255,110,90,0.16)', color: '#ff9a8c' };
      break;
    default:
      style = { ...cellBase, background: 'var(--field)', color: 'var(--ink3)' };
  }
  if (cell.isToday) style = { ...style, outline: '1.5px solid var(--acc)', outlineOffset: '1px' };
  return style;
}

export default function Habits() {
  const state = useStore();
  const { habits, quoteIx, loggerOpen, loggerSel, monthOff, setUI } = state;
  const addHabit = useStore((s) => s.addHabit);
  const checkHabit = useStore((s) => s.checkHabit);
  const checkHabitOn = useStore((s) => s.checkHabitOn);
  const toggleHabitNotif = useStore((s) => s.toggleHabitNotif);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const editHabit = useStore((s) => s.editHabit);
  const [editingHabit, setEditingHabit] = useState(null); // {id, name, freq}

  const [name, setName] = useState('');
  const [freq, setFreq] = useState('Daily');

  // loggerSel is an array of habit ids acting as a filter; empty = all.
  // (Older mirrors may still hold the legacy 'all' string — normalise it.)
  const selection = Array.isArray(loggerSel) ? loggerSel.filter((id) => habits.some((h) => h.id === id)) : [];
  const grid = useMemo(() => monthGrid(state, monthOff, selection), [habits, monthOff, loggerSel]);
  const selectedName =
    selection.length === 0
      ? 'All habits'
      : selection.length === 1
        ? habits.find((h) => h.id === selection[0])?.name || 'All habits'
        : `${selection.length} habits`;
  const toggleSelected = (id) =>
    setUI({
      loggerSel: selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id],
    });

  // The filter drives the list too: checked-off habits sink to the bottom,
  // pending ones float, original order kept within each group.
  const visibleHabits = selection.length ? habits.filter((h) => selection.includes(h.id)) : habits;
  const sortedHabits = [...visibleHabits].sort(
    (a, b) => Number(isSettled(a)) - Number(isSettled(b))
  );

  // FLIP: when the ORDER changes, slide each row from its old spot to its
  // new one. Two hard-won details: it must run only when the order actually
  // changes (the hue sweep re-renders this screen every frame, and a
  // per-render FLIP measures its own transforms and flings rows offscreen),
  // and positions are measured relative to the list container so scrolling
  // between renders can't corrupt the deltas.
  const listRef = useRef(null);
  const rowRefs = useRef(new Map());
  const prevTops = useRef(new Map());
  const orderSig = sortedHabits.map((h) => h.id).join('|');
  useLayoutEffect(() => {
    const containerTop = listRef.current?.getBoundingClientRect().top ?? 0;
    const tops = new Map();
    rowRefs.current.forEach((el, id) => {
      if (el) tops.set(id, el.getBoundingClientRect().top - containerTop);
    });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      tops.forEach((top, id) => {
        const prev = prevTops.current.get(id);
        const el = rowRefs.current.get(id);
        if (prev != null && el && Math.abs(prev - top) > 1) {
          el.style.transition = 'none';
          el.style.transform = `translateY(${prev - top}px)`;
          requestAnimationFrame(() => {
            el.style.transition = 'transform .35s cubic-bezier(.4,0,.2,1)';
            el.style.transform = 'translateY(0)';
          });
        }
      });
    }
    prevTops.current = tops;
  }, [orderSig]);

  const submit = () => {
    addHabit(name, freq);
    setName('');
  };

  return (
    <Screen label="Habit Tracker">
      <div style={pageTitle}>Habits</div>

      <Card style={{ marginTop: '14px', padding: '20px', textAlign: 'center' }}>
        <div style={{ font: "italic 400 18px 'Instrument Serif',serif", lineHeight: 1.45, color: 'var(--ink)' }}>
          &ldquo;{QUOTES[quoteIx % QUOTES.length]}&rdquo;
        </div>
        <div
          style={{
            marginTop: '8px',
            fontSize: '10.5px',
            letterSpacing: '1.6px',
            textTransform: 'uppercase',
            color: 'var(--acc)',
            fontWeight: 700,
          }}
        >
          Daily motivation
        </div>
      </Card>

      <Card style={{ position: 'relative', zIndex: 25, marginTop: '14px', padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ ...sectionLabel, flex: 1 }}>Habit log</span>
          <button
            type="button"
            onClick={() => setUI({ loggerOpen: !loggerOpen })}
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
            {loggerOpen ? 'Hide' : 'Show'}
          </button>
          <MonthNav
            label={grid.monthLabel}
            onPrev={() => setUI({ monthOff: monthOff - 1 })}
            onNext={() => monthOff < 0 && setUI({ monthOff: monthOff + 1 })}
          />
        </div>

        {loggerOpen && (
          <>
            <div style={{ position: 'relative', marginTop: '10px' }}>
              <Dropdown
                id="hsel"
                value={selectedName}
                fontSize={12}
                multi
                options={[
                  { label: 'All habits', active: selection.length === 0, pick: () => setUI({ loggerSel: [] }) },
                  ...habits.map((h) => ({
                    label: h.name,
                    active: selection.includes(h.id),
                    keepOpen: true,
                    pick: () => toggleSelected(h.id),
                  })),
                ]}
              />
            </div>

            <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dn, i) => (
                <span key={`${dn}-${i}`} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--ink3)' }}>
                  {dn}
                </span>
              ))}
              {grid.cells.map((c) => {
                // One-day grace window: with a single habit selected,
                // today and yesterday can be toggled straight from the
                // grid. Anything older is sealed.
                const editable =
                  selection.length === 1 &&
                  c.state !== 'pad' &&
                  (c.key === todayIso() || c.key === yestIso());
                if (!editable) {
                  return (
                    <div key={c.key} style={cellStyle(c)}>
                      {c.label}
                    </div>
                  );
                }
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={`Toggle ${c.key}`}
                    onClick={() => checkHabitOn(selection[0], c.key)}
                    style={{
                      ...cellStyle(c),
                      border: '1px dashed var(--acc)',
                      cursor: 'pointer',
                      font: 'inherit',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: '11px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <LegendDot background="var(--acc)" label="Done" />
              <LegendDot background="var(--soft)" border label="Partial" />
              <LegendDot background="rgba(255,110,90,0.25)" label="Missed" />
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--ink2)' }}>{grid.summary}</span>
            </div>
            {selection.length === 1 && (
              <div style={{ marginTop: '7px', fontSize: '9.5px', color: 'var(--ink3)' }}>
                Tap today or yesterday in the grid to log or unlog.
              </div>
            )}
          </>
        )}
      </Card>

      <Card style={{ position: 'relative', zIndex: 30, marginTop: '14px', padding: '16px' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="New habit — e.g. Meditate 10 min"
          style={{
            width: '100%',
            background: 'var(--field)',
            border: '1px solid var(--gBrd)',
            borderRadius: '13px',
            padding: '12px 14px',
            fontSize: '14px',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
          <Dropdown
            id="freq"
            value={freq}
            options={FREQ_LABELS.map((f) => ({ label: f, pick: () => setFreq(f) }))}
          />
          <button type="button" onClick={submit} style={{ ...accentButton, flex: 1 }}>
            Add habit
          </button>
        </div>
      </Card>

      <div ref={listRef} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedHabits.map((h) => {
          const done = h.last === todayIso();
          const settled = isSettled(h);
          return (
            <div
              key={h.id}
              ref={(el) => {
                if (el) rowRefs.current.set(h.id, el);
                else rowRefs.current.delete(h.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                ...glass(18, 20),
                padding: '13px 14px',
                opacity: settled && !done ? 0.75 : 1,
              }}
            >
              <CheckBox
                done={done}
                onClick={() => checkHabit(h.id)}
                size={34}
                radius="circle"
                tick={15}
                label={`Check in ${h.name}`}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14.5px', fontWeight: 500 }}>{h.name}</div>
                <div style={{ marginTop: '2px', fontSize: '11.5px', color: 'var(--ink3)' }}>
                  {h.freq} · streak {h.streak}
                  {settled && !done ? ' · done for now' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleHabitNotif(h.id)}
                aria-pressed={h.notif}
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                  padding: '6px 10px',
                  borderRadius: '20px',
                  border: `1px solid ${h.notif ? 'transparent' : 'var(--gBrd)'}`,
                  background: h.notif ? 'var(--soft)' : 'transparent',
                  color: h.notif ? 'var(--acc)' : 'var(--ink3)',
                  cursor: 'pointer',
                  flex: 'none',
                }}
              >
                Remind
              </button>
              <RowMenu
                label={h.name}
                onEdit={() => setEditingHabit({ id: h.id, name: h.name, freq: h.freq })}
                onDelete={() => deleteHabit(h.id)}
              />
            </div>
          );
        })}
      </div>

      {editingHabit && (
        <Card style={{ position: 'relative', zIndex: 35, marginTop: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--ink2)', marginBottom: '9px' }}>
            EDITING HABIT
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={editingHabit.name}
              onChange={(e) => setEditingHabit({ ...editingHabit, name: e.target.value })}
              style={{ ...fieldInput, flex: 1.4 }}
            />
            <Dropdown
              id="habitEditFreq"
              flex={1}
              value={editingHabit.freq}
              options={['Daily', 'Twice a week', 'Weekly', 'Monthly'].map((f) => ({
                label: f,
                pick: () => setEditingHabit({ ...editingHabit, freq: f }),
              }))}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => {
                editHabit(editingHabit.id, { name: editingHabit.name, freq: editingHabit.freq });
                setEditingHabit(null);
              }}
              style={{ ...accentButton, flex: 1 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingHabit(null)}
              style={{ flex: 1, background: 'transparent', border: '1px solid var(--gBrd)', borderRadius: '14px', fontSize: '13px', fontWeight: 600, color: 'var(--ink2)' }}
            >
              Cancel
            </button>
          </div>
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--ink3)' }}>
            Changing the cadence recalculates the streak for the new rhythm.
          </div>
        </Card>
      )}

      {!habits.length && (
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink3)' }}>
          No habits yet — add the one you most want to keep.
        </div>
      )}
    </Screen>
  );
}

const isoAt = (offset) => {
  const n = new Date(Date.now() + offset * 864e5);
  const p = (x) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
};
const todayIso = () => isoAt(0);
const yestIso = () => isoAt(-1);

const navBtn = {
  width: '26px',
  height: '26px',
  border: '1px solid var(--gBrd)',
  borderRadius: '9px',
  background: 'var(--field)',
  color: 'var(--ink2)',
  fontSize: '12px',
  lineHeight: 1,
};

function MonthNav({ label, onPrev, onNext }) {
  return (
    <>
      <button type="button" onClick={onPrev} aria-label="Previous month" style={navBtn}>
        ‹
      </button>
      <span style={{ fontSize: '12.5px', fontWeight: 600, minWidth: '86px', textAlign: 'center' }}>{label}</span>
      <button type="button" onClick={onNext} aria-label="Next month" style={navBtn}>
        ›
      </button>
    </>
  );
}

const LegendDot = ({ background, border, label }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
    <span
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '3px',
        background,
        ...(border ? { border: '1px solid var(--gBrd)' } : {}),
      }}
    />
    <span style={{ fontSize: '9.5px', color: 'var(--ink3)' }}>{label}</span>
  </span>
);
