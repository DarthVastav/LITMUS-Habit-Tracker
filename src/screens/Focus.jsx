import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';

/**
 * Focus mode: a full-screen takeover with a serene night scene, rotating
 * calm quotes, and one big countdown. When time runs out — a soft chime,
 * a vibration, and a gentle completion state. A screen wake-lock (where
 * the browser grants one) keeps the phone from sleeping mid-session.
 */

const QUOTES = [
  ['Almost everything will work again if you unplug it for a few minutes — including you.', 'Anne Lamott'],
  ['It is not that we have a short time to live, but that we waste a lot of it.', 'Seneca'],
  ['The successful warrior is the average man, with laser-like focus.', 'Bruce Lee'],
  ['Nothing is less productive than to make more efficient what should not be done at all.', 'Peter Drucker'],
  ['You do not rise to the level of your goals. You fall to the level of your systems.', 'James Clear'],
  ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
  ['The mind is everything. What you think, you become.', 'Buddha'],
  ['One thing at a time. Done well. That is enough.', ''],
];

const mmss = (s) => {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
};

/** Three soft sine chimes through WebAudio — no asset, no permission. */
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((at, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = [523.25, 659.25, 783.99][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + at + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 1.2);
    });
  } catch {
    /* audio is a nicety, never a failure */
  }
  try {
    navigator.vibrate?.([220, 90, 220]);
  } catch {
    /* same */
  }
}

function Scene() {
  return (
    <svg
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <rect width="400" height="800" fill="#070b14" />
      <circle cx="316" cy="130" r="38" fill="#dfe6f2" opacity="0.9" />
      <circle cx="303" cy="121" r="33" fill="#0a101c" />
      {[
        [58, 84, 1.6, 0.8],
        [126, 148, 1.2, 0.55],
        [206, 70, 1.5, 0.7],
        [262, 190, 1.1, 0.5],
        [44, 224, 1.3, 0.6],
        [352, 250, 1.2, 0.5],
        [170, 240, 1.0, 0.45],
        [90, 300, 1.2, 0.5],
        [330, 60, 1.1, 0.6],
      ].map(([x, y, r, o], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#dfe6f2" opacity={o} />
      ))}
      <path d="M0 560 L95 430 L160 520 L228 405 L305 530 L400 455 L400 800 L0 800 Z" fill="#101a2c" />
      <path d="M0 640 L75 550 L170 615 L265 545 L345 610 L400 570 L400 800 L0 800 Z" fill="#0b1322" />
      <path d="M0 715 Q100 693 200 710 Q300 727 400 705 L400 800 L0 800 Z" fill="#080e1a" />
    </svg>
  );
}

export default function Focus() {
  const focusActive = useStore((s) => s.focusActive);
  const endFocus = useStore((s) => s.endFocus);
  const [now, setNow] = useState(Date.now());
  const [quoteIx, setQuoteIx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const chimed = useRef(false);
  const wakeLock = useRef(null);

  const remaining = Math.max(0, Math.ceil((focusActive.endsAt - now) / 1000));
  const finished = remaining === 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    const q = setInterval(() => setQuoteIx((i) => (i + 1) % QUOTES.length), 25000);
    return () => {
      clearInterval(t);
      clearInterval(q);
    };
  }, []);

  // Keep the screen awake while focusing, and re-acquire when the tab
  // comes back to the foreground (locks release on visibility loss).
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      try {
        if (!cancelled && navigator.wakeLock && !finished) {
          wakeLock.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* not granted — fine */
      }
    };
    acquire();
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      wakeLock.current?.release?.();
    };
  }, [finished]);

  useEffect(() => {
    if (finished && !chimed.current) {
      chimed.current = true;
      chime();
    }
  }, [finished]);

  const [quote, author] = QUOTES[quoteIx];
  const totalMin = Math.round(focusActive.total / 60);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 28px calc(32px + env(safe-area-inset-bottom, 0px))',
        animation: 'fadeUp 0.5s ease',
      }}
    >
      <Scene />
      <div style={{ position: 'relative', textAlign: 'center', width: '100%' }}>
        {finished ? (
          <>
            <div style={{ fontSize: '15px', letterSpacing: '2.5px', color: '#8fa3c4', textTransform: 'uppercase' }}>
              Session complete
            </div>
            <div style={{ marginTop: '14px', fontSize: '52px', fontWeight: 600, color: '#eef2fa' }}>
              {totalMin} min
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#8fa3c4' }}>of undivided attention</div>
            <button
              type="button"
              onClick={() => endFocus(true)}
              style={{
                marginTop: '36px',
                padding: '13px 40px',
                borderRadius: '999px',
                border: 'none',
                background: '#6ea8e8',
                color: '#042c53',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: '72px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: '#eef2fa',
                textShadow: '0 2px 24px rgba(0,0,0,0.5)',
              }}
            >
              {mmss(remaining)}
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#8fa3c4' }}>of {totalMin} minutes</div>
            <div
              style={{
                marginTop: '42px',
                minHeight: '72px',
                fontSize: '14px',
                fontStyle: 'italic',
                lineHeight: 1.6,
                color: '#b8c4dd',
                fontFamily: 'Georgia, serif',
              }}
            >
              “{quote}”
              {author && <div style={{ marginTop: '6px', fontSize: '11.5px', fontStyle: 'normal', color: '#8fa3c4' }}>— {author}</div>}
            </div>
            <button
              type="button"
              onClick={() => endFocus(false)}
              style={{
                marginTop: '48px',
                padding: '11px 34px',
                borderRadius: '999px',
                border: '1px solid #41506b',
                background: 'transparent',
                color: '#8fa3c4',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              End early
            </button>
          </>
        )}
      </div>
    </div>
  );
}
