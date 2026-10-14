import { useStore } from '../store/useStore.js';
import InstallCTA from '../ui/InstallCTA.jsx';
import { configured } from '../lib/supabase.js';
import { glass, wordmark, ERROR_GRADIENT, ERROR_INK } from '../lib/theme.js';

const centered = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '0 26px',
};

const input = {
  marginTop: '14px',
  width: '100%',
  background: 'var(--field)',
  border: '1px solid var(--gBrd)',
  borderRadius: '14px',
  padding: '14px 16px',
  fontSize: '15px',
  color: 'var(--ink)',
  outline: 'none',
};

const primary = {
  marginTop: '14px',
  width: '100%',
  border: 'none',
  borderRadius: '14px',
  padding: '14px',
  fontSize: '15px',
  fontWeight: 600,
  background: 'linear-gradient(135deg,var(--acc),var(--accD))',
  color: 'var(--onAcc)',
  boxShadow: '0 8px 26px var(--glow),inset 0 1px 0 rgba(255,255,255,0.4)',
};

/**
 * Google blocks OAuth inside embedded in-app browsers (WhatsApp, Instagram,
 * Facebook) as a phishing defence — exactly where a launch link gets opened.
 * Detect the cage and say so, so people aren't left tapping a dead button.
 */
const inAppBrowser = /(FBAN|FBAV|FB_IAB|Instagram|Line\/|; wv\))/i.test(navigator.userAgent);

export function Login() {
  const { email, loginName, emailErr, loading, setUI, requestOtp, signInWithGoogle } = useStore();

  const submit = (e) => {
    e.preventDefault();
    requestOtp();
  };

  return (
    <div
      data-screen-label="Login"
      style={{ ...centered, animation: 'fadeUp 0.5s ease' }}
    >
      <div style={{ ...wordmark(42), letterSpacing: '0.5px' }}>Litmus</div>
      <div
        style={{
          marginTop: '10px',
          fontSize: '14px',
          color: 'var(--ink2)',
          lineHeight: 1.55,
          maxWidth: '280px',
        }}
      >
        Your beliefs don&apos;t make you a better person — your behaviour does.
        Litmus keeps the score.
      </div>

      <form onSubmit={submit} style={{ marginTop: '34px', ...glass(26), padding: '22px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '1.6px',
            textTransform: 'uppercase',
            color: 'var(--ink2)',
          }}
        >
          Sign in / Sign up
        </div>
        <input
          value={loginName}
          onChange={(e) => setUI({ loginName: e.target.value })}
          placeholder="Your name"
          autoComplete="name"
          style={input}
        />
        <input
          value={email}
          onChange={(e) => setUI({ email: e.target.value, emailErr: '' })}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          style={input}
        />
        {emailErr && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: ERROR_INK }}>{emailErr}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{ ...primary, marginTop: '16px', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Sending code…' : 'Continue with email'}
        </button>

        {configured && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--gBrd)' }} />
              <span style={{ fontSize: '11px', color: 'var(--ink3)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--gBrd)' }} />
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={signInWithGoogle}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: '#fff',
                color: '#1f1f1f',
                border: 'none',
                borderRadius: '14px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              Continue with Google
            </button>
            {inAppBrowser && (
              <div style={{ marginTop: '8px', fontSize: '10.5px', color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.5 }}>
                Google sign-in doesn't work inside this app's browser — open
                this page in Chrome, or use email above.
              </div>
            )}
          </>
        )}
        <div
          style={{
            marginTop: '12px',
            fontSize: '11.5px',
            color: 'var(--ink3)',
            textAlign: 'center',
          }}
        >
          We&apos;ll email you a 6-digit code — no password needed.
        </div>
      </form>

      <InstallCTA variant="auth" />
    </div>
  );
}

export function Verify() {
  const { email, code, loading, setUI, verifyCode, resendOtp, backToLogin } = useStore();

  const submit = (e) => {
    e.preventDefault();
    verifyCode();
  };

  return (
    <div data-screen-label="Verify code" style={{ ...centered, animation: 'fadeUp 0.4s ease' }}>
      <form onSubmit={submit} style={{ ...glass(26), padding: '24px' }}>
        <div style={{ fontSize: '22px', fontWeight: 600 }}>Check your inbox</div>
        <div style={{ marginTop: '8px', fontSize: '13.5px', color: 'var(--ink2)', lineHeight: 1.5 }}>
          We sent a 6-digit code to
          <br />
          <span style={{ color: 'var(--acc)', fontWeight: 600 }}>{email}</span>
        </div>
        <input
          value={code}
          onChange={(e) => setUI({ code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="6-digit code"
          placeholder="••••••"
          style={{
            marginTop: '18px',
            width: '100%',
            background: 'var(--field)',
            border: '1px solid var(--gBrd)',
            borderRadius: '16px',
            padding: '16px',
            fontSize: '26px',
            fontWeight: 600,
            letterSpacing: '14px',
            textAlign: 'center',
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ ...primary, marginTop: '16px', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>
        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={backToLogin}
            style={{ background: 'none', border: 'none', fontSize: '12.5px', color: 'var(--ink3)', padding: 0 }}
          >
            Change email
          </button>
          <button
            type="button"
            onClick={resendOtp}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12.5px',
              color: 'var(--acc)',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Resend code
          </button>
        </div>
      </form>
    </div>
  );
}

export function LoginError() {
  const backToLogin = useStore((s) => s.backToLogin);
  return (
    <div data-screen-label="Login error" style={{ ...centered, animation: 'fadeUp 0.4s ease' }}>
      <div
        style={{
          ...glass(26),
          border: '1px solid rgba(255,110,90,0.35)',
          boxShadow: 'var(--gSh),0 10px 40px rgba(255,70,50,0.18)',
          padding: '28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            margin: '0 auto',
            borderRadius: '50%',
            background: ERROR_GRADIENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 8px 24px rgba(255,70,50,0.35)',
          }}
        >
          !
        </div>
        <div style={{ marginTop: '16px', fontSize: '21px', fontWeight: 600 }}>Invalid login</div>
        <div style={{ marginTop: '8px', fontSize: '13.5px', color: 'var(--ink2)', lineHeight: 1.5 }}>
          That code didn&apos;t match.
          <br />
          Invalid login, please login again.
        </div>
        <button
          type="button"
          onClick={backToLogin}
          style={{
            marginTop: '20px',
            width: '100%',
            border: 'none',
            borderRadius: '14px',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 600,
            background: ERROR_GRADIENT,
            color: '#fff',
            boxShadow: '0 8px 26px rgba(255,70,50,0.3)',
          }}
        >
          Back to login
        </button>
      </div>
    </div>
  );
}
