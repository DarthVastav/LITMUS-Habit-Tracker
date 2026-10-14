/**
 * Web Push for Cloudflare Workers.
 *
 * The `web-push` npm package depends on Node's crypto module and does not
 * run on Workers, so this implements the two specs it covers directly on
 * top of Web Crypto:
 *
 *   RFC 8291 — message encryption (aes128gcm content coding)
 *   RFC 8292 — VAPID request signing (ES256 JWT)
 *
 * Exported surface mirrors the bit of web-push we actually used:
 *   sendNotification(subscription, payload, vapid) -> { ok, status }
 */

const enc = new TextEncoder();

// ---- base64url helpers ----------------------------------------------
export function b64urlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function bytesToB64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const concat = (...arrays) => {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const a of arrays) {
    out.set(a, at);
    at += a.length;
  }
  return out;
};

// ---- HKDF (extract + expand in one Web Crypto call) ------------------
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

/**
 * Encrypt a payload for one subscription, per RFC 8291.
 * Returns the aes128gcm request body.
 */
async function encryptPayload(plaintext, uaPublicB64, authSecretB64) {
  const uaPublic = b64urlToBytes(uaPublicB64); // 65 bytes: 0x04 || X || Y
  const authSecret = b64urlToBytes(authSecretB64); // 16 bytes

  // Ephemeral application-server keypair for this single message.
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret is the X coordinate, 32 bytes.
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaKey },
    asKeys.privateKey,
    256
  );
  const shared = new Uint8Array(sharedBits);

  // IKM = HKDF(salt=auth_secret, ikm=shared, info="WebPush: info\0"||ua||as)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // Single record: plaintext followed by the 0x02 padding delimiter.
  const record = concat(enc.encode(plaintext), new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record)
  );

  // Header: salt(16) || record size(4, BE) || key id length(1) || as_public(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

// ---- VAPID (RFC 8292) ------------------------------------------------
async function importVapidKey(publicB64, privateB64) {
  const pub = b64urlToBytes(publicB64); // 0x04 || X || Y
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(b64urlToBytes(privateB64)),
    ext: true,
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
}

async function vapidAuthHeader(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      })
    )
  );
  const signingInput = enc.encode(`${header}.${body}`);
  const key = await importVapidKey(publicKey, privateKey);

  // Web Crypto returns the raw r||s pair, which is what JWS ES256 wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput);
  const jwt = `${header}.${body}.${bytesToB64url(sig)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

/**
 * Send one notification.
 * @param subscription { endpoint, keys: { p256dh, auth } }
 * @param payload      string (JSON) delivered to the service worker
 * @param vapid        { publicKey, privateKey, subject }
 */
export async function sendNotification(subscription, payload, vapid, ttl = 3600) {
  const body = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);
  const authorization = await vapidAuthHeader(subscription.endpoint, vapid);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
    },
    body,
  });

  return { ok: res.ok, status: res.status };
}

// Exported for the local test harness only.
export const __internals = { encryptPayload, vapidAuthHeader, hkdf };
