import { useEffect, useState } from 'react';
import {
  canPrompt,
  initInstall,
  isInstalled,
  isIos,
  markInstalled,
  onInstallChange,
  promptInstall,
} from '../lib/install.js';

let inited = false;

const IOS_STEPS = [
  'Open this page in Safari (required on iPhone)',
  'Tap the Share button — the square with an arrow, bottom of the screen',
  "Scroll down and tap 'Add to Home Screen'",
  "Tap 'Add' — Litmus appears like a real app",
];

/**
 * One install call-to-action, two placements: 'auth' renders a card under
 * the sign-in form; 'settings' renders a row-style button. Both vanish
 * permanently once the app is installed (or the user says it is, on iOS,
 * where no API can tell us).
 */
export default function InstallCTA({ variant = 'auth' }) {
  const [, force] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  useEffect(() => {
    if (!inited) {
      inited = true;
      initInstall();
    }
    return onInstallChange(() => force((n) => n + 1));
  }, []);

  if (isInstalled()) return null;
  const ios = isIos();

  const act = async () => {
    if (!ios && canPrompt()) {
      await promptInstall();
      return;
    }
    setShowSteps((s) => !s);
  };

  const steps = ios
    ? IOS_STEPS
    : [
        'Open this page in Chrome',
        "Tap the ⋮ menu (top right) → 'Add to Home screen' or 'Install app'",
        "Confirm — Litmus appears like a real app",
      ];

  const body = (
    <>
      {showSteps && (
        <ol style={{ margin: '10px 0 2px', paddingLeft: '18px' }}>
          {steps.map((s, i) => (
            <li key={i} style={{ fontSize: '12px', color: 'var(--ink2)', lineHeight: 1.6, margin: '3px 0' }}>
              {s}
            </li>
          ))}
        </ol>
      )}
      {showSteps && (
        <button
          type="button"
          onClick={markInstalled}
          style={{
            marginTop: '9px',
            background: 'transparent',
            border: '1px solid var(--gBrd)',
            borderRadius: '11px',
            padding: '8px 14px',
            fontSize: '11.5px',
            fontWeight: 600,
            color: 'var(--ink2)',
          }}
        >
          Done — I&apos;ve added it
        </button>
      )}
    </>
  );

  if (variant === 'settings') {
    return (
      <div style={{ marginTop: '10px', background: 'var(--soft)', border: '1px solid var(--gBrd)', borderRadius: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600 }}>Install Litmus on your phone</span>
          <button
            type="button"
            onClick={act}
            style={{
              background: 'linear-gradient(135deg,var(--acc),var(--accD))',
              color: 'var(--onAcc)',
              border: 'none',
              borderRadius: '11px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {ios || !canPrompt() ? (showSteps ? 'Hide steps' : 'How to') : 'Install'}
          </button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '18px',
        background: 'rgba(255,255,255,0.045)',
        border: '1px solid var(--gBrd)',
        borderRadius: '18px',
        padding: '15px 17px',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
        <span style={{ fontSize: '19px' }} aria-hidden="true">
          📲
        </span>
        <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--ink2)', lineHeight: 1.45 }}>
          Litmus works best installed — full screen, home-screen icon, reminders.
        </span>
        <button
          type="button"
          onClick={act}
          style={{
            background: 'linear-gradient(135deg,var(--acc),var(--accD))',
            color: 'var(--onAcc)',
            border: 'none',
            borderRadius: '12px',
            padding: '9px 16px',
            fontSize: '12px',
            fontWeight: 700,
            flex: 'none',
          }}
        >
          {ios || !canPrompt() ? (showSteps ? 'Hide' : 'Get it') : 'Install'}
        </button>
      </div>
      {body}
    </div>
  );
}
