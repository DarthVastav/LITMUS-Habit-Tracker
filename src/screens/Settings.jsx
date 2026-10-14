import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { Card, Screen, Dropdown, Toggle, Segmented } from '../ui/primitives.jsx';
import { glass, pageTitle, accentButton, sectionLabel } from '../lib/theme.js';
import { fmt12, timeOptions } from '../lib/date.js';
import { enablePush, disablePush, pushSupported } from '../lib/push.js';
import About from './About.jsx';
import Updates from './Updates.jsx';
import InstallCTA from '../ui/InstallCTA.jsx';

const HOME_HINTS = {
  ring: 'Score ring — dial with the full breakdown and stat cards.',
  hero: 'Score hero — one giant number, minimal everything else.',
  agenda: 'Timeline — compact score with today’s classes, tasks and habits in order.',
};

/**
 * Erasing everything is the most destructive act in the app, so it takes
 * two deliberate taps: the first arms the button for four seconds and
 * spells out what will be lost; only the second actually erases.
 */
function ResetAllButton() {
  const resetAllData = useStore((s) => s.resetAllData);
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  const tap = () => {
    if (!armed) {
      setArmed(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(timer.current);
    setArmed(false);
    resetAllData();
  };

  return (
    <button
      type="button"
      onClick={tap}
      style={{
        marginTop: '14px',
        width: '100%',
        background: armed ? 'rgba(226,75,74,0.14)' : 'transparent',
        border: `1px solid ${armed ? '#e24b4a' : 'var(--gBrd)'}`,
        borderRadius: '14px',
        padding: '13px',
        fontSize: armed ? '12.5px' : '14px',
        fontWeight: 600,
        color: armed ? '#e24b4a' : 'var(--ink3)',
        transition: 'all .2s',
      }}
    >
      {armed
        ? 'Tap again to erase tasks, habits, assignments, prep & score — no undo'
        : 'Reset all data'}
    </button>
  );
}

export default function Settings() {
  const state = useStore();
  const {
    theme,
    homeVariant,
    habitRemind,
    habitRemindTime,
    classRemind,
    asgRemind,
    aboutOpen,
    updatesOpen,
    user,
    setUI,
  } = state;

  const setTheme = useStore((s) => s.setTheme);
  const setHomeVariant = useStore((s) => s.setHomeVariant);
  const setReminderPref = useStore((s) => s.setReminderPref);
  const saveAccount = useStore((s) => s.saveAccount);
  const signOut = useStore((s) => s.signOut);
  const say = useStore((s) => s.say);

  const [name, setName] = useState(user?.name || '');

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  // While the profile is still hydrating, empty editable fields read as
  // "your account has no data" — show a loading state instead and keep
  // the inputs inert until the real values arrive.
  const profileLoading = !user;

  // Nothing to save until the name actually differs from what's stored.
  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== (user?.name || '');

  /**
   * Any reminder toggle switching on is the moment to ask for
   * notification permission — before that we'd be asking for nothing.
   */
  const setRemind = async (key, on, onMessage, offMessage) => {
    setReminderPref(key, on);
    if (!on) {
      say(offMessage);
      const stillOn =
        (key !== 'habitRemind' && useStore.getState().habitRemind) ||
        (key !== 'classRemind' && useStore.getState().classRemind) ||
        (key !== 'asgRemind' && useStore.getState().asgRemind);
      if (!stillOn) await disablePush();
      return;
    }
    if (!pushSupported()) {
      say('Saved — this browser cannot show push reminders');
      return;
    }
    const { ok, reason } = await enablePush();
    say(ok ? onMessage : reason);
  };

  if (aboutOpen) return <About onBack={() => setUI({ aboutOpen: false })} />;
  if (updatesOpen) return <Updates onBack={() => setUI({ updatesOpen: false })} />;

  return (
    <Screen label="Settings">
      <div style={pageTitle}>Settings</div>

      <Card style={{ marginTop: '14px', padding: '18px' }}>
        <div style={sectionLabel}>Appearance</div>
        <Segmented
          style={{ marginTop: '12px' }}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />

        <div style={{ ...sectionLabel, marginTop: '16px' }}>Home screen</div>
        <Segmented
          style={{ marginTop: '10px' }}
          value={homeVariant}
          onChange={setHomeVariant}
          options={[
            { value: 'ring', label: 'Score ring' },
            { value: 'hero', label: 'Score hero' },
            { value: 'agenda', label: 'Timeline' },
          ]}
        />
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--ink3)', lineHeight: 1.5 }}>
          {HOME_HINTS[homeVariant]}
        </div>
      </Card>

      <Card style={{ position: 'relative', zIndex: 30, marginTop: '14px', padding: '18px' }}>
        <div style={sectionLabel}>Reminders</div>

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Daily habits</div>
            <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '1px' }}>
              One nudge for unchecked habits
            </div>
          </div>
          <Toggle
            on={habitRemind}
            label="Daily habit reminders"
            onClick={() =>
              setRemind(
                'habitRemind',
                !habitRemind,
                `Daily habit reminders on — ${fmt12(habitRemindTime)}`,
                'Daily habit reminders off'
              )
            }
          />
        </div>

        {habitRemind && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--ink2)' }}>Remind me at</span>
            <div style={{ position: 'relative' }}>
              <Dropdown
                id="rtime"
                flex="none"
                align="right"
                minWidth="130px"
                value={fmt12(habitRemindTime)}
                options={timeOptions((t) => setReminderPref('habitRemindTime', t))}
              />
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--gBrd)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Classes</div>
            <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '1px' }}>30 min before each class</div>
          </div>
          <Toggle
            on={classRemind}
            label="Class reminders"
            onClick={() =>
              setRemind(
                'classRemind',
                !classRemind,
                'Class reminders on — 30 min before each class',
                'Class reminders off'
              )
            }
          />
        </div>

        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--gBrd)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Assignment start dates</div>
            <div style={{ fontSize: '11px', color: 'var(--ink3)', marginTop: '1px' }}>
              Nudge when the runway opens
            </div>
          </div>
          <Toggle
            on={asgRemind}
            label="Assignment reminders"
            onClick={() =>
              setRemind(
                'asgRemind',
                !asgRemind,
                'You’ll be nudged when an assignment’s runway opens',
                'Assignment reminders off'
              )
            }
          />
        </div>
      </Card>

      <Card style={{ marginTop: '14px', padding: '18px' }}>
        <div style={sectionLabel}>Account</div>
        <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--ink3)' }}>Display name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={accountInput} />
        <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--ink3)' }}>Email</div>
        <input
          value={user?.email || ''}
          readOnly
          type="email"
          aria-label="Sign-in email (not editable)"
          style={{ ...accountInput, color: 'var(--ink3)', cursor: 'not-allowed' }}
        />
        <div style={{ marginTop: '6px', fontSize: '10.5px', color: 'var(--ink3)', lineHeight: 1.45 }}>
          This is where your sign-in codes are sent, so it can&apos;t be changed here.
        </div>

        <button
          type="button"
          onClick={() => saveAccount(name)}
          disabled={!dirty}
          style={{
            ...accentButton,
            marginTop: '14px',
            width: '100%',
            cursor: dirty ? 'pointer' : 'default',
            transition: 'background .3s ease, color .3s ease, box-shadow .3s ease',
            ...(dirty
              ? {}
              : {
                  background: 'var(--field)',
                  color: 'var(--ink3)',
                  border: '1px solid var(--gBrd)',
                  boxShadow: 'none',
                }),
          }}
        >
          {dirty ? 'Save changes' : 'Saved'}
        </button>
      </Card>

      <button
        type="button"
        onClick={() => setUI({ aboutOpen: true })}
        style={{
          marginTop: '14px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          ...glass(20, 20),
          padding: '16px 18px',
          color: 'var(--ink)',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <circle cx="12" cy="7.5" r="0.6" fill="var(--acc)" />
          </svg>
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Know the App</span>
          <span style={{ display: 'block', marginTop: '1px', fontSize: '11px', color: 'var(--ink3)' }}>
            Why it exists, how it works, score legend &amp; feedback
          </span>
        </span>
        <span style={{ fontSize: '16px', color: 'var(--ink3)' }}>›</span>
      </button>

      <InstallCTA variant="settings" />

      <button
        type="button"
        onClick={() => setUI({ updatesOpen: true })}
        style={{
          marginTop: '10px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          ...glass(20, 20),
          padding: '16px 18px',
          color: 'var(--ink)',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            background: 'var(--soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 8v5l3 2" />
            <path d="M4 12a8 8 0 1 0 2.34-5.66" />
            <path d="M4 5v3h3" />
          </svg>
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Update log</span>
          <span style={{ display: 'block', marginTop: '1px', fontSize: '11px', color: 'var(--ink3)' }}>
            What changed, version by version
          </span>
        </span>
        <span style={{ fontSize: '16px', color: 'var(--ink3)' }}>›</span>
      </button>

      <ResetAllButton />

      <button
        type="button"
        onClick={signOut}
        style={{
          marginTop: '10px',
          width: '100%',
          background: 'transparent',
          border: '1px solid rgba(255,110,90,0.4)',
          borderRadius: '14px',
          padding: '13px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#ff8d7e',
        }}
      >
        Sign out
      </button>

      <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '10.5px', color: 'var(--ink3)' }}>
        Designed by a person who needed this 🫰{state.localOnly ? ' · offline' : ''}
      </div>
    </Screen>
  );
}

const accountInput = {
  marginTop: '6px',
  width: '100%',
  background: 'var(--field)',
  border: '1px solid var(--gBrd)',
  borderRadius: '13px',
  padding: '12px 14px',
  fontSize: '14px',
  color: 'var(--ink)',
  outline: 'none',
};
