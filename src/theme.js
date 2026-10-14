// The score drives the hue; the hue drives every accent in the app.
//   0–50   red → magenta/purple → blue
//   50–90  blue → teal
//   90+    green
//
// `hueRawFor` deliberately returns an UNWRAPPED angle that decreases
// monotonically as the score rises (25 → -115 → -210). Animating that raw
// number walks the colour wheel the long way round — red, magenta, purple,
// blue, teal, green — which is the path the scale is designed around.
// Wrapping first would turn a red→blue move into a short hop through grey.
export const hueRawFor = (score) =>
  score <= 50 ? 25 - (score / 50) * 140 : score >= 90 ? 150 - 360 : 245 - 360 - ((score - 50) / 40) * 95;

export const wrapHue = (raw) => (((raw % 360) + 360) % 360).toFixed(0);

export const hueFor = (score) => wrapHue(hueRawFor(score));

export const varsFor = (hue, dark) =>
  dark
    ? {
        '--acc': `oklch(0.74 0.155 ${hue})`,
        '--accD': `oklch(0.58 0.15 ${hue})`,
        '--glow': `oklch(0.65 0.19 ${hue} / 0.45)`,
        '--soft': `oklch(0.74 0.155 ${hue} / 0.14)`,
        '--onAcc': `oklch(0.16 0.05 ${hue})`,
        '--bg0': `oklch(0.16 0.03 ${hue})`,
        '--bg1': `oklch(0.25 0.055 ${hue})`,
        '--ink': 'oklch(0.97 0.004 260)',
        '--ink2': 'rgba(230,236,248,0.62)',
        '--ink3': 'rgba(230,236,248,0.4)',
        '--gBg': 'linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.04))',
        '--gBrd': 'rgba(255,255,255,0.16)',
        '--gSh':
          'inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -1px 0 rgba(255,255,255,0.05),0 14px 40px rgba(0,0,0,0.35)',
        '--field': 'rgba(255,255,255,0.07)',
        '--track': 'rgba(255,255,255,0.12)',
        '--menu': `oklch(0.21 0.035 ${hue} / 0.93)`,
      }
    : {
        '--acc': `oklch(0.55 0.16 ${hue})`,
        '--accD': `oklch(0.45 0.15 ${hue})`,
        '--glow': `oklch(0.7 0.17 ${hue} / 0.4)`,
        '--soft': `oklch(0.55 0.16 ${hue} / 0.12)`,
        '--onAcc': '#fff',
        '--bg0': `oklch(0.95 0.014 ${hue})`,
        '--bg1': `oklch(0.88 0.05 ${hue})`,
        '--ink': `oklch(0.24 0.03 ${hue})`,
        '--ink2': 'rgba(25,35,55,0.62)',
        '--ink3': 'rgba(25,35,55,0.42)',
        '--gBg': 'linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.45))',
        '--gBrd': 'rgba(255,255,255,0.95)',
        '--gSh': 'inset 0 1px 0 rgba(255,255,255,0.95),0 14px 36px rgba(70,90,140,0.16)',
        '--field': 'rgba(255,255,255,0.6)',
        '--track': 'rgba(20,30,60,0.1)',
        '--menu': 'rgba(252,253,255,0.95)',
      };

export const rootStyleFor = (hue, dark) => ({
  ...varsFor(hue, dark),
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  maxWidth: 'var(--shellMax, 430px)',
  height: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: "'Space Grotesk',sans-serif",
  color: 'var(--ink)',
  colorScheme: dark ? 'dark' : 'light',
  background:
    'radial-gradient(120% 55% at 15% -5%,var(--bg1),transparent 60%),radial-gradient(90% 45% at 100% 105%,var(--bg1),transparent 55%),var(--bg0)',
});

// ---- shared style recipes lifted straight from the prototype ----------
export const glass = (radius = 24, blur = 26) => ({
  background: 'var(--gBg)',
  border: '1px solid var(--gBrd)',
  boxShadow: 'var(--gSh)',
  backdropFilter: `blur(${blur}px) saturate(1.5)`,
  WebkitBackdropFilter: `blur(${blur}px) saturate(1.5)`,
  borderRadius: `${radius}px`,
});

export const accentButton = {
  border: 'none',
  borderRadius: '13px',
  padding: '12px',
  fontSize: '14px',
  fontWeight: 600,
  background: 'linear-gradient(135deg,var(--acc),var(--accD))',
  color: 'var(--onAcc)',
  boxShadow: '0 6px 20px var(--glow),inset 0 1px 0 rgba(255,255,255,0.4)',
};

export const fieldInput = {
  width: '100%',
  background: 'var(--field)',
  border: '1px solid var(--gBrd)',
  borderRadius: '13px',
  padding: '12px 14px',
  fontSize: '14px',
  color: 'var(--ink)',
  outline: 'none',
};

export const sectionLabel = {
  fontSize: '10.5px',
  fontWeight: 600,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  color: 'var(--ink2)',
};

export const pageTitle = { padding: '14px 2px 0', fontSize: '26px', fontWeight: 700 };

export const wordmark = (size) => ({
  // inline-block so the gradient box hugs the word: a block element would
  // stretch the box to full width and the short wordmark would only sample
  // the first third of the ramp, losing the highlight at 52%.
  display: 'inline-block',
  font: `italic 400 ${size}px 'Instrument Serif',serif`,
  background:
    'linear-gradient(115deg,#f4f4f8 8%,#8f8f9c 36%,#ffffff 52%,#82828d 72%,#dcdce4 96%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

export const ERROR_GRADIENT =
  'linear-gradient(135deg,oklch(0.68 0.19 25),oklch(0.55 0.19 25))';
export const ERROR_INK = '#ff8d7e';
