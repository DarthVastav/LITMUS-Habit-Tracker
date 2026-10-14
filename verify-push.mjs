import crypto from 'node:crypto';
import ece from 'http_ece';
import { sendNotification, __internals, bytesToB64url, b64urlToBytes } from './worker/webpush.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
let pass = 0, fail = 0;
const check = (name, ok, extra='') => { ok ? pass++ : fail++; console.log(`${ok?'PASS':'FAIL'}  ${name}${extra?' — '+extra:''}`); };

// ---- 1. Encrypt with our Web Crypto code, decrypt with http_ece -------
const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
const uaPublic = ecdh.getPublicKey();          // 65 bytes
const authSecret = crypto.randomBytes(16);

const plaintext = JSON.stringify({ title: 'Litmus', body: '3 habits still open', tag: 'habits' });
const body = await __internals.encryptPayload(plaintext, b64u(uaPublic), b64u(authSecret));

console.log('ciphertext length:', body.length, 'bytes');
check('header salt is 16 bytes + rs + keyid', body.length > 16+4+1+65);
check('key id length byte is 65', body[20] === 65, `got ${body[20]}`);
const rs = Buffer.from(body.slice(16,20)).readUInt32BE(0);
check('record size field is 4096', rs === 4096, `got ${rs}`);

let decrypted;
try {
  decrypted = ece.decrypt(Buffer.from(body), {
    version: 'aes128gcm',
    privateKey: ecdh,
    authSecret: b64u(authSecret),
  });
} catch (e) { console.log('decrypt threw:', e.message); }

check('http_ece decrypts our ciphertext', decrypted != null);
check('round-trip plaintext matches', decrypted?.toString() === plaintext,
      decrypted ? `got ${decrypted.toString().slice(0,40)}...` : 'no output');

// ---- 2. Tampered ciphertext must fail (GCM tag works) ----------------
const tampered = Buffer.from(body); tampered[tampered.length-5] ^= 0xff;
let tamperOk = false;
try { ece.decrypt(tampered, { version:'aes128gcm', privateKey: ecdh, authSecret: b64u(authSecret) }); }
catch { tamperOk = true; }
check('tampered ciphertext is rejected', tamperOk);

// ---- 3. VAPID JWT structure + signature ------------------------------
const vapidPub  = 'BKfG6hTutuDImoTnA6LYMBIrY_IgG1PPnaHxQcYcghjqFQjwAldmfa3kWtVHB4hwIshL9mnUbZrbo3s4mZlML9s';
const vapidPriv = 'gRB_o-ZKjw7N8vlV3M8uFBmjW1-7w7hpKpq4bLl92zo';
const hdr = await __internals.vapidAuthHeader(
  'https://fcm.googleapis.com/fcm/send/abc123',
  { publicKey: vapidPub, privateKey: vapidPriv, subject: 'mailto:me@example.com' }
);
check('auth header uses vapid scheme', hdr.startsWith('vapid t='));
check('auth header carries k=publicKey', hdr.includes(`k=${vapidPub}`));

const jwt = hdr.slice('vapid t='.length).split(',')[0];
const [h,p,s] = jwt.split('.');
const payload = JSON.parse(Buffer.from(p,'base64url').toString());
check('JWT header alg is ES256', JSON.parse(Buffer.from(h,'base64url').toString()).alg === 'ES256');
check('JWT aud is endpoint origin', payload.aud === 'https://fcm.googleapis.com', payload.aud);
check('JWT sub is the subject', payload.sub === 'mailto:me@example.com');
check('JWT exp within 24h', payload.exp > Date.now()/1000 && payload.exp < Date.now()/1000 + 86400);
check('JWT signature is 64 bytes (raw r||s)', Buffer.from(s,'base64url').length === 64);

// verify signature against the VAPID public key
const pubBytes = b64urlToBytes(vapidPub);
const key = await crypto.webcrypto.subtle.importKey('jwk', {
  kty:'EC', crv:'P-256',
  x: bytesToB64url(pubBytes.slice(1,33)),
  y: bytesToB64url(pubBytes.slice(33,65)),
}, {name:'ECDSA', namedCurve:'P-256'}, false, ['verify']);
const valid = await crypto.webcrypto.subtle.verify(
  {name:'ECDSA', hash:'SHA-256'}, key,
  Buffer.from(s,'base64url'), new TextEncoder().encode(`${h}.${p}`)
);
check('JWT signature verifies against public key', valid);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
