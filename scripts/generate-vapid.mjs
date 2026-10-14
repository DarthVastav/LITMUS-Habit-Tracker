#!/usr/bin/env node
// Generates the VAPID keypair used for Web Push.
// Uses Web Crypto only — no dependencies. Run once:  npm run vapid
import { webcrypto } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
);

// Public key as the uncompressed point (0x04 || X || Y) the spec expects.
const rawPublic = await webcrypto.subtle.exportKey('raw', publicKey);
// Private key is the `d` scalar from the JWK.
const jwk = await webcrypto.subtle.exportKey('jwk', privateKey);

console.log(`
VAPID keys generated. Add these to your Cloudflare Worker.

  Public — safe in the browser, set as a plain var in wrangler.toml or
  as a build-time variable named VITE_VAPID_PUBLIC_KEY:

    ${b64url(rawPublic)}

  Private — set as a secret, never commit it:

    npx wrangler secret put VAPID_PRIVATE_KEY
    ${jwk.d}
`);
