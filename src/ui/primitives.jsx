import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore.js';
import { glass, sectionLabel } from '../lib/theme.js';

// ---------------------------------------------------------------------
// Glass card
// ---------------------------------------------------------------------
export const Card = forwardRef(function Card(
  { radius = 24, blur = 26, style, children, ...rest },
  ref
) {
  return (
    <div ref={ref} style={{ ...glass(radius, blur), ...style }} {...rest}>
      {children}
    </div>
  );
});

export const Label = ({ children, style }) => (
  <div style={{ ...sectionLabel, ...style }}>{children}</div>
);

// ---------------------------------------------------------------------
// Custom glass dropdown — no native pickers anywhere in the app.
// Only one can be open at a time; the store holds the open id.
// ---------------------------------------------------------------------
export function Dropdown({
  id,
  value,
  options,
  align = 'left',
  minWidth,
  flex = 1,
  fontSize = 12.5,
  onAdd, // (text) => void — shows a "New…" row at the foot of the menu
  onRemove, // (label) => void — shows a × on each removable option
  addLabel = 'New',
  multi = false, // options may set keepOpen + active for filter-style menus
}) {
  const drop = useStore((s) => s.drop);
  const setDrop = useStore((s) => s.setDrop);
  const closeDrop = useStore((s) => s.closeDrop);
  const open = drop === id;
  const ref = useRef(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setDraft('');
    }
  }, [open]);

  const commitAdd = () => {
    const text = draft.trim();
    if (!text) return setAdding(false);
    onAdd(text);
    setDraft('');
    setAdding(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) closeDrop();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, closeDrop]);

  return (
    <div ref={ref} style={{ position: 'relative', flex }}>
      <button
        type="button"
        onClick={() => setDrop(id)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--field)',
          border: '1px solid var(--gBrd)',
          borderRadius: '13px',
          padding: '11px 12px',
          fontSize: `${fontSize}px`,
          color: 'var(--ink)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <span style={{ fontSize: '9px', color: 'var(--ink3)' }}>▼</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align]: 0,
            // At least as wide as the trigger, growing to fit content —
            // remove buttons and the "+ New" footer need more room than a
            // narrow trigger provides. Capped so it never leaves the shell.
            // (When min and max conflict, min-width wins, so the menu is
            // never narrower than its trigger.)
            minWidth: minWidth || '100%',
            width: 'max-content',
            maxWidth: 'min(300px, calc(100vw - 40px))',
            zIndex: 20,
            maxHeight: '210px',
            overflowY: 'auto',
            background: 'var(--menu)',
            border: '1px solid var(--gBrd)',
            boxShadow: 'var(--gSh)',
            backdropFilter: 'blur(40px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
            borderRadius: '16px',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {options.map((opt, i) => (
            <MenuItem
              key={`${opt.label}-${i}`}
              onClick={() => {
                opt.pick();
                if (!(multi && opt.keepOpen)) closeDrop();
              }}
              active={multi ? !!opt.active : false}
              onRemove={
                onRemove && opt.removable !== false && options.length > 1
                  ? () => onRemove(opt.label)
                  : null
              }
            >
              {opt.label}
              {opt.hint ? <Hint>{opt.hint}</Hint> : null}
            </MenuItem>
          ))}

          {onAdd &&
            (adding ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAdd();
                  if (e.key === 'Escape') setAdding(false);
                }}
                onBlur={commitAdd}
                placeholder={`${addLabel}…`}
                style={{
                  margin: '2px',
                  background: 'var(--field)',
                  border: '1px solid var(--acc)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  fontSize: '12.5px',
                  color: 'var(--ink)',
                  outline: 'none',
                  width: 'calc(100% - 4px)',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderTop: '1px solid var(--gBrd)',
                  marginTop: '2px',
                  paddingTop: '9px',
                  paddingBottom: '7px',
                  paddingLeft: '12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--acc)',
                  whiteSpace: 'nowrap',
                }}
              >
                + {addLabel}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** Secondary line inside a menu row — faculty names, etc. */
const Hint = ({ children }) => (
  <span
    style={{
      display: 'block',
      marginTop: '2px',
      fontSize: '10px',
      fontWeight: 400,
      color: 'var(--ink3)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '190px',
    }}
  >
    {children}
  </span>
);

function MenuItem({ onClick, onRemove, active, children }) {
  const ref = useRef(null);
  const paint = (bg, fg) => {
    if (!ref.current) return;
    ref.current.style.background = bg;
    ref.current.style.color = fg;
  };
  return (
    <div
      ref={ref}
      onMouseEnter={() => paint('var(--soft)', 'var(--acc)')}
      onMouseLeave={() => paint('transparent', 'var(--ink)')}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: active ? 'var(--soft)' : 'transparent',
        borderRadius: '10px',
        color: active ? 'var(--acc)' : 'var(--ink)',
      }}
    >
      {active && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ marginLeft: '10px', flex: 'none' }}
        >
          <polyline points="4,13 9,18 20,6" />
        </svg>
      )}
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: '9px 12px',
          fontSize: '12.5px',
          color: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '6px 10px 6px 4px',
            fontSize: '15px',
            lineHeight: 1,
            color: 'var(--ink3)',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Segmented control
//
// The selected state is a single absolutely-positioned pill that slides
// between cells. Painting the background on each button instead would
// snap: CSS can't interpolate between two gradients, so the fill swaps
// instantly no matter what transition is set.
//
// Cells are equal width, which is what lets the indicator move with a
// percentage translate and no measuring.
// ---------------------------------------------------------------------
const SEG_VARIANTS = {
  primary: {
    pad: 5,
    radius: 16,
    cellRadius: 13,
    fontSize: 13,
    padY: 9,
    fill: 'linear-gradient(135deg,var(--acc),var(--accD))',
    shadow: '0 4px 14px var(--glow)',
    on: 'var(--onAcc)',
    off: 'var(--ink2)',
  },
  soft: {
    pad: 4,
    radius: 14,
    cellRadius: 11,
    fontSize: 12,
    padY: 8,
    fill: 'var(--soft)',
    shadow: 'none',
    on: 'var(--acc)',
    off: 'var(--ink3)',
  },
  compact: {
    pad: 4,
    radius: 13,
    cellRadius: 10,
    fontSize: 11.5,
    padY: 7,
    fill: 'linear-gradient(135deg,var(--acc),var(--accD))',
    shadow: 'none',
    on: 'var(--onAcc)',
    off: 'var(--ink2)',
  },
};

export function Segmented({ options, value, onChange, variant = 'primary', style }) {
  const v = SEG_VARIANTS[variant] || SEG_VARIANTS.primary;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const n = options.length;

  return (
    <div
      role="tablist"
      style={{
        position: 'relative',
        display: 'flex',
        gap: 0,
        padding: `${v.pad}px`,
        borderRadius: `${v.radius}px`,
        background: 'var(--field)',
        border: '1px solid var(--gBrd)',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: `${v.pad}px`,
          bottom: `${v.pad}px`,
          left: `${v.pad}px`,
          width: `calc((100% - ${v.pad * 2}px) / ${n})`,
          transform: `translateX(${index * 100}%)`,
          borderRadius: `${v.cellRadius}px`,
          background: v.fill,
          boxShadow: v.shadow,
          transition: 'transform .38s cubic-bezier(.4,0,.2,1)',
          pointerEvents: 'none',
        }}
      />
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(opt.value)}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: `${v.padY}px 0`,
              border: 'none',
              background: 'transparent',
              borderRadius: `${v.cellRadius}px`,
              fontSize: `${v.fontSize}px`,
              fontWeight: 600,
              color: on ? v.on : v.off,
              transition: 'color .28s ease',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// 46×27 pill toggle
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// 46×27 pill toggle
//
// Two things here can't be transitioned directly: the knob was positioned
// with justify-content (not animatable), and the track swaps between a
// gradient and a flat colour (gradients don't interpolate). So the knob
// slides on transform, and the gradient lives on an overlay whose opacity
// cross-fades over the flat track.
// ---------------------------------------------------------------------
const KNOB_TRAVEL = 46 - 3 * 2 - 21; // width − padding − knob

export function Toggle({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        position: 'relative',
        width: '46px',
        height: '27px',
        borderRadius: '20px',
        border: 'none',
        padding: '3px',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--track)',
        boxShadow: on ? '0 4px 12px var(--glow)' : '0 0 0 rgba(0,0,0,0)',
        transition: 'box-shadow .3s ease',
        cursor: 'pointer',
        flex: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '20px',
          background: 'linear-gradient(135deg,var(--acc),var(--accD))',
          opacity: on ? 1 : 0,
          transition: 'opacity .3s ease',
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          width: '21px',
          height: '21px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          transform: `translateX(${on ? KNOB_TRAVEL : 0}px)`,
          transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------
// Tick marks — rounded square (tasks/subtasks) and circle (habits)
// ---------------------------------------------------------------------
const Tick = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <polyline
      points="2.5,7.5 5.8,10.5 11.5,3.5"
      stroke="var(--onAcc)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function CheckBox({ done, onClick, size = 26, radius = 9, tick = 13, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius === 'circle' ? '50%' : `${radius}px`,
        flex: 'none',
        border: done ? 'none' : `${size > 30 ? 1.6 : 1.5}px solid var(--acc)`,
        background: done ? 'linear-gradient(135deg,var(--acc),var(--accD))' : 'var(--soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: done ? '0 4px 14px var(--glow)' : 'none',
        transition: 'all .25s',
      }}
    >
      {done && <Tick size={tick} />}
    </button>
  );
}

// ---------------------------------------------------------------------
// Misc small pieces
// ---------------------------------------------------------------------
export const DeleteX = ({ onClick, size = 17, label = 'Delete' }) => {
  const ref = useRef(null);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => (ref.current.style.color = '#ff8d7e')}
      onMouseLeave={() => (ref.current.style.color = 'var(--ink3)')}
      style={{
        background: 'transparent',
        border: 'none',
        fontSize: `${size}px`,
        color: 'var(--ink3)',
        padding: '2px 4px',
        lineHeight: 1,
        flex: 'none',
      }}
    >
      ×
    </button>
  );
};

/**
 * The ⋮ row menu: one affordance for Edit and Delete everywhere. The menu
 * itself renders in a PORTAL with fixed positioning — every glass card is
 * its own stacking context (backdrop-filter), so an absolutely positioned
 * child gets painted over by the next card down. Portaling to the document
 * root puts the menu above everything, always. Closes on choose, outside
 * tap, scroll, or resize.
 */
export function RowMenu({ onEdit, onDelete, label }) {
  const [pos, setPos] = useState(null); // {top,right} while open
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };

  const item = (text, danger, fn) => (
    <button
      type="button"
      onClick={() => {
        setPos(null);
        fn();
      }}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        padding: '9px 14px',
        fontSize: '12.5px',
        fontWeight: 600,
        color: danger ? '#e24b4a' : 'var(--ink, #eef2fa)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Options for ${label}`}
        aria-expanded={!!pos}
        onClick={toggle}
        style={{
          background: 'none',
          border: 'none',
          padding: '4px 6px',
          color: 'var(--ink3)',
          fontSize: '16px',
          lineHeight: 1,
          letterSpacing: '1px',
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        ⋮
      </button>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: pos.top,
              right: pos.right,
              zIndex: 999,
              ...glass(14, 22),
              // Portal escapes the shell's CSS variables AND its font, so
              // both need concrete values here: same face as the dropdowns,
              // translucent glass rather than a black slab.
              fontFamily: "'Space Grotesk', sans-serif",
              background: 'var(--gBg, rgba(26,32,46,0.68))',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
              border: '1px solid var(--gBrd, rgba(255,255,255,0.14))',
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              padding: '4px',
              minWidth: '110px',
            }}
          >
            {onEdit && item('Edit', false, onEdit)}
            {onDelete && item('Delete', true, onDelete)}
          </div>,
          document.body
        )}
    </>
  );
}

export const Screen = ({ label, children }) => (
  <div data-screen-label={label} style={{ animation: 'fadeUp 0.4s ease' }}>
    {children}
  </div>
);

export function Toast() {
  const toast = useStore((s) => s.toast);
  const actionLabel = useStore((s) => s.toastAction);
  const runToastAction = useStore((s) => s.runToastAction);
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(106px + env(safe-area-inset-bottom, 0px))',
        zIndex: 40,
        ...glass(20, 24),
        padding: actionLabel ? '8px 8px 8px 18px' : '11px 18px',
        fontSize: '12.5px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        maxWidth: '88%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'fadeUp 0.3s ease',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={runToastAction}
          style={{
            flex: 'none',
            background: 'var(--soft)',
            border: 'none',
            borderRadius: '11px',
            padding: '7px 13px',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--acc)',
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Bottom nav
// ---------------------------------------------------------------------
const ICONS = {
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </>
  ),
  tasks: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <polyline points="8.5,12.2 11,14.7 15.7,9.5" />
    </>
  ),
  tt: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="4" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="9" y1="3" x2="9" y2="6" />
      <line x1="15" y1="3" x2="15" y2="6" />
    </>
  ),
  asg: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="4" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </>
  ),
  habits: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="15" cy="8" r="2.6" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="16" r="2.6" />
    </>
  ),
};

const NAV = [
  ['home', 'Home'],
  ['tasks', 'Tasks'],
  ['tt', 'Timetable'],
  ['asg', 'Prep'],
  ['habits', 'Habits'],
  ['settings', 'Settings'],
];

export function BottomNav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  return (
    <nav
      style={{
        position: 'absolute',
        left: '14px',
        right: '14px',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 30,
        display: 'flex',
        ...glass(28, 28),
        backdropFilter: 'blur(28px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
        padding: '6px 4px',
      }}
    >
      {NAV.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-current={tab === key ? 'page' : undefined}
          onClick={() => setTab(key)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            padding: '8px 0 6px',
            border: 'none',
            background: 'transparent',
            color: tab === key ? 'var(--acc)' : 'var(--ink3)',
            fontSize: '9.5px',
            fontWeight: 600,
            letterSpacing: '0.3px',
            cursor: 'pointer',
            transition: 'color .25s',
          }}
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[key]}
          </svg>
          {label}
        </button>
      ))}
    </nav>
  );
}
