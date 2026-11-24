// ตัวคุยกับหลังบ้าน (src/data/cloud.js) — ใช้ fetch ปลอม ไม่ต่อเน็ตจริง
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloud } from '../src/data/cloud.js';

function mem() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; }
const res = (status, body) => ({ ok: status < 300, status, json: async () => body, blob: async () => body });

test('อีเมล → รหัส → เข้าสู่ระบบ · จำบัญชีไว้หลังเปิดใหม่', async () => {
  const calls = [], storage = mem();
  const fetchFn = async (url, o) => {
    calls.push([url.replace(/^https:\/\/[^/]+/, ''), o.method, o.body && JSON.parse(o.body)]);
    if (url.endsWith('/auth/v1/otp')) return res(200, {});
    if (url.endsWith('/auth/v1/verify')) return res(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u1', email: 'a@b.co' } });
    return res(404, {});
  };
  const c = createCloud({ storage, fetchFn, url: 'https://x' });
  await assert.rejects(c.sendCode('ไม่ใช่อีเมล'), /อีเมลไม่ถูกต้อง/);
  assert.equal(await c.sendCode('  A@B.co '), 'a@b.co');
  assert.deepEqual(calls[0], ['/auth/v1/otp', 'POST', { email: 'a@b.co', create_user: true }]);
  assert.deepEqual(await c.verifyCode('a@b.co', '12 34 56'), { id: 'u1', email: 'a@b.co' });
  assert.equal(calls[1][2].token, '123456');
  assert.deepEqual(createCloud({ storage, fetchFn, url: 'https://x' }).user(), { id: 'u1', email: 'a@b.co' });
});

test('token ใกล้หมดอายุ → ต่ออายุก่อนเรียก · โดน 401 → ต่ออายุแล้วลองใหม่ครั้งเดียว', async () => {
  let t = 1_000_000, refreshes = 0, firstPull = true;
  const storage = mem();
  storage.setItem('sabaii-auth', JSON.stringify({ access_token: 'old', refresh_token: 'RT', expires_at: t + 30_000, user: { id: 'u1' } }));
  const fetchFn = async (url, o) => {
    if (url.includes('grant_type=refresh_token')) { refreshes++; return res(200, { access_token: 'new' + refreshes, refresh_token: 'RT2', expires_in: 3600 }); }
    if (url.includes('/rest/v1/items')) {
      if (firstPull) { firstPull = false; assert.equal(o.headers.Authorization, 'Bearer new1'); return res(401, { message: 'JWT expired' }); }
      return res(200, [{ id: 'x' }]);
    }
    return res(404, {});
  };
  const c = createCloud({ storage, fetchFn, url: 'https://x', now: () => t });
  assert.deepEqual(await c.pull(0), [{ id: 'x' }]);
  assert.equal(refreshes, 2);
  assert.equal(c.user().id, 'u1'); // ต่ออายุแล้วยังเป็นคนเดิม
});

test('refresh token ใช้ไม่ได้แล้ว → ออกจากระบบเอง · เน็ตหลุด → ไม่ออกจากระบบ', async () => {
  const storage = mem();
  const s = { access_token: 'a', refresh_token: 'r', expires_at: 0, user: { id: 'u1' } };
  storage.setItem('sabaii-auth', JSON.stringify(s));
  const off = createCloud({ storage, url: 'https://x', fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(off.pull(0), e => e.offline === true);
  assert.ok(off.user());
  const bad = createCloud({ storage, url: 'https://x', fetchFn: async () => res(400, { error_code: 'refresh_token_not_found' }) });
  await assert.rejects(bad.pull(0));
  assert.equal(bad.user(), null);
});

test('กดลิงก์ในอีเมล: #access_token=… → เข้าสู่ระบบ · ลิงก์หมดอายุ → ข้อความไทย', async () => {
  const fetchFn = async url => url.endsWith('/auth/v1/user') ? res(200, { id: 'u9', email: 'k@k.co' }) : res(404, {});
  const c = createCloud({ storage: mem(), fetchFn, url: 'https://x' });
  assert.equal(await c.takeLinkSession('#/home'), false);
  assert.equal(await c.takeLinkSession('#access_token=A&refresh_token=R&expires_in=3600&token_type=bearer&type=magiclink'), true);
  assert.equal(c.user().email, 'k@k.co');
  await assert.rejects(c.takeLinkSession('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'), /หมดอายุ/);
});

test('ข้อผิดพลาดจากเซิร์ฟเวอร์เป็นภาษาไทย', async () => {
  const c = createCloud({ storage: mem(), url: 'https://x', fetchFn: async () => res(429, { error_code: 'over_email_send_rate_limit', msg: 'rate' }) });
  await assert.rejects(c.sendCode('a@b.co'), /ขอรหัสถี่เกินไป/);
});
