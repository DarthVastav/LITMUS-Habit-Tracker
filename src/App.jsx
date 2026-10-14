import { useEffect, useMemo, useRef } from 'react';
import { useStore } from './store/useStore.js';
import { scoreOf, NEUTRAL_SCORE } from './store/selectors.js';
import { hueRawFor, wrapHue, rootStyleFor } from './lib/theme.js';
import { useAnimatedNumber } from './lib/useAnimatedNumber.js';
import { registerServiceWorker } from './lib/push.js';
import { Login, Verify, LoginError } from './screens/Auth.jsx';
import Home from './screens/Home.jsx';
import Tasks from './screens/Tasks.jsx';
import Timetable from './screens/Timetable.jsx';
import Assignments from './screens/Assignments.jsx';
import Habits from './screens/Habits.jsx';
import Settings from './screens/Settings.jsx';
import Focus from './screens/Focus.jsx';
import { BottomNav, Toast } from './ui/primitives.jsx';

const orb = (extra) => ({
  position: 'absolute',
  borderRadius: '50%',
  background: 'var(--glow)',
  pointerEvents: 'none',
  ...extra,
});

const TABS = {
  home: Home,
  tasks: Tasks,
  tt: Timetable,
  asg: Assignments,
  habits: Habits,
  settings: Settings,
};

export default function App() {
  const screen = useStore((s) => s.screen);
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.theme);
  const tab = useStore((s) => s.tab);
  const focusActive = useStore((s) => s.focusActive);
  const user = useStore((s) => s.user);
  const prepareImport = useStore((s) => s.prepareImport);

  // Files handed to Litmus from outside — "Open with" (desktop Chrome/Edge)
  // arrives via launchQueue; "Share to Litmus" (Android) is parked in a
  // cache by the service worker. Both wait for a signed-in, hydrated app.
  useEffect(() => {
    if (!user) return;
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (params) => {
        for (const handle of params.files || []) {
          try {
            prepareImport(await handle.getFile());
          } catch (err) {
            console.error('[Litmus] launch file', err);
          }
        }
      });
    }
    (async () => {
      try {
        const cache = await caches.open('litmus-shared');
        const parked = await cache.match('/__shared-file');
        if (!parked) return;
        await cache.delete('/__shared-file');
        const blob = await parked.blob();
        const name = parked.headers.get('X-File-Name') || 'shared.xlsx';
        prepareImport(new File([blob], name, { type: blob.type }));
      } catch (err) {
        console.error('[Litmus] shared pickup', err);
      }
    })();
  }, [user, prepareImport]);
  const boot = useStore((s) => s.boot);

  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const assignments = useStore((s) => s.assignments);

  useEffect(() => {
    boot();
    registerServiceWorker();
  }, [boot]);

  // The score IS the 30-day formula — no smoothing layer between the
  // user's actions and the number. Every tick moves it, both directions.
  const { score } = useMemo(() => scoreOf({ tasks, habits, assignments }), [tasks, habits, assignments]);

  const dark = theme === 'dark';
  // Before anything is tracked there's no reading to colour by, so the
  // app sits at a neutral blue rather than implying a good or bad result.
  // The raw angle is animated so the palette sweeps round the wheel
  // instead of jumping straight from red to blue.
  // Start the colour at the last known score, not neutral — a refresh at
  // 80 stays green from the first frame; the sweep only plays on change.
  const lastKnown = useRef(null);
  if (lastKnown.current === null) {
    const stored = Number(localStorage.getItem('litmus:lastScore'));
    lastKnown.current = Number.isFinite(stored) ? stored : NEUTRAL_SCORE;
  }
  useEffect(() => {
    if (score !== null && score !== undefined) {
      localStorage.setItem('litmus:lastScore', String(score));
    }
  }, [score]);
  const animatedHue = useAnimatedNumber(hueRawFor(score ?? lastKnown.current));
  const hue = wrapHue(animatedHue);
  useEffect(() => {
    // The installed-app icon is frozen by the OS, but the chrome around the
    // app isn't: tint the status bar / task-switcher with the live score hue.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', `oklch(0.17 0.02 ${Math.round(hue)})`);
  }, [Math.round(hue)]);
  const rootStyle = rootStyleFor(hue, dark);

  useEffect(() => {
    // Keep the browser chrome in step with the score colour.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? `oklch(0.16 0.03 ${hue})` : `oklch(0.95 0.014 ${hue})`);
  }, [hue, dark]);

  const Current = TABS[tab] || Home;

  return (
    <div style={rootStyle}>
      <div style={orb({ width: '300px', height: '300px', filter: 'blur(70px)', top: '-70px', left: '-80px', animation: 'drift 14s ease-in-out infinite' })} />
      <div style={orb({ width: '260px', height: '260px', filter: 'blur(80px)', bottom: '-60px', right: '-70px', animation: 'drift2 17s ease-in-out infinite' })} />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {!ready && <Splash />}
        {ready && screen === 'login' && <Login />}
        {ready && screen === 'auth' && <Verify />}
        {ready && screen === 'error' && <LoginError />}

        {ready && screen === 'app' && (
          <>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto',
          overflowX: 'hidden', padding: '4px 18px 118px' }}>
              <Current />
            </div>
            {focusActive && <Focus />}
        <Toast />
            <BottomNav />
          </>
        )}
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12.5px',
        color: 'var(--ink3)',
        letterSpacing: '1.4px',
        textTransform: 'uppercase',
      }}
    >
      Loading
    </div>
  );
}
