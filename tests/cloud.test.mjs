// ตัวคุยกับหลังบ้าน (src/data/cloud.js) — ใช้ fetch ปลอม ไม่ต่อเน็ตจริง
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloud } from '../src/data/cloud.js';

function mem() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; }
const res = (status, body) => ({ ok: status < 300, status, json: async () => body, blob: async () => body });

test('Google: ไปหน้า authorize พร้อม PKCE → กลับมาด้วย ?code → แลกเป็นการเข้าสู่ระบบ · จำบัญชีไว้หลังเปิดใหม่', async () => {
  const calls = [], storage = mem();
  const fetchFn = async (url, o) => {
    calls.push([url.replace(/^https:\/\/[^/]+/, ''), o.method, o.body && JSON.parse(o.body)]);
    if (url.endsWith('/auth/v1/token?grant_type=pkce')) return res(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600,
      user: { id: 'u1', email: 'a@b.co', user_metadata: { full_name: 'มายด์ ใจดี', avatar_url: 'https://lh3.example/p.jpg' } } });
    return res(404, {});
  };
  const c = createCloud({ storage, fetchFn, url: 'https://x' });
  const u = new URL(await c.googleUrl('https://sabaii.vercel.app/app/'));
  assert.equal(u.origin + u.pathname, 'https://x/auth/v1/authorize');
  assert.equal(u.searchParams.get('provider'), 'google');
  assert.equal(u.searchParams.get('redirect_to'), 'https://sabaii.vercel.app/app/');
  assert.equal(u.searchParams.get('code_challenge_method'), 's256');
  const verifier = storage.getItem('sabaii-pkce');
  assert.ok(verifier.length >= 43);
  // ค่าที่ส่งไปคือแฮชของรหัสลับ ไม่ใช่ตัวรหัสลับ
  const want = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  assert.equal(u.searchParams.get('code_challenge'), want);
  assert.equal(calls.length, 0);

  assert.equal(await c.finishRedirect('?from=landing'), false);
  assert.equal(await c.finishRedirect('?code=CODE1'), true);
  assert.deepEqual(calls[0], ['/auth/v1/token?grant_type=pkce', 'POST', { auth_code: 'CODE1', code_verifier: verifier }]);
  assert.deepEqual(c.user(), { id: 'u1', email: 'a@b.co', name: 'มายด์ ใจดี', avatar: 'https://lh3.example/p.jpg' });
  assert.equal(storage.getItem('sabaii-pkce'), null); // ใช้ครั้งเดียว
  assert.equal(createCloud({ storage, fetchFn, url: 'https://x' }).user().email, 'a@b.co');
});

test('Google: กดยกเลิก / ลิงก์ที่ไม่ได้เริ่มจากเครื่องนี้ / ยังไม่เปิด Google ในเซิร์ฟเวอร์ → ข้อความไทย', async () => {
  const c = createCloud({ storage: mem(), url: 'https://x', fetchFn: async () => res(404, {}) });
  await assert.rejects(c.finishRedirect('?error=access_denied&error_description=The+user+denied'), /ยกเลิก/);
  await assert.rejects(c.finishRedirect('', '#error=server_error&error_code=provider_disabled&error_description=x'), /ยังเปิดวิธีเข้าสู่ระบบนี้ไม่ได้/);
  await assert.rejects(c.finishRedirect('?code=STOLEN'), /ไม่ได้เริ่มจากเครื่องนี้/);
  assert.equal(c.user(), null);
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

test('ข้อผิดพลาดจากเซิร์ฟเวอร์เป็นภาษาไทย', async () => {
  const storage = mem(); storage.setItem('sabaii-pkce', 'v'.repeat(50));
  const c = createCloud({ storage, url: 'https://x', fetchFn: async () => res(429, { error_code: 'over_request_rate_limit', msg: 'rate' }) });
  await assert.rejects(c.finishRedirect('?code=C'), /ลองบ่อยเกินไป/);
});

test('Facebook / Apple: ไปหน้า authorize ของผู้ให้บริการนั้น พร้อม PKCE แบบเดียวกับ Google', async () => {
  for (const provider of ['facebook', 'apple']) {
    const storage = mem();
    const c = createCloud({ storage, url: 'https://x', fetchFn: async () => res(404, {}) });
    const u = new URL(await c.oauthUrl(provider, 'https://sabaii.vercel.app/app/'));
    assert.equal(u.origin + u.pathname, 'https://x/auth/v1/authorize');
    assert.equal(u.searchParams.get('provider'), provider);
    assert.equal(u.searchParams.get('code_challenge_method'), 's256');
    assert.ok(storage.getItem('sabaii-pkce'));
  }
});

test('อีเมล: ขอรหัส → กรอกรหัส 6 หลัก → เข้าสู่ระบบ · รหัสผิด/หมดอายุ → ข้อความไทย', async () => {
  const calls = [];
  const fetchFn = async (url, o) => {
    const p = url.replace(/^https:\/\/[^/]+/, ''), b = o.body && JSON.parse(o.body);
    calls.push([p, b]);
    if (p === '/auth/v1/otp') return res(200, {});
    if (p === '/auth/v1/verify') return b.token === '123456'
      ? res(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: 'u2', email: 'mind@school.ac.th', user_metadata: {} } })
      : res(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    return res(404, {});
  };
  const c = createCloud({ storage: mem(), url: 'https://x', fetchFn });
  await c.sendEmailCode('  mind@school.ac.th ');
  assert.deepEqual(calls[0], ['/auth/v1/otp', { email: 'mind@school.ac.th', create_user: true }]);
  await assert.rejects(c.verifyEmailCode('mind@school.ac.th', '000000'), /รหัสหมดอายุหรือไม่ถูกต้อง/);
  assert.equal(c.user(), null);
  await c.verifyEmailCode('mind@school.ac.th', '123 456');
  assert.deepEqual(calls.at(-1), ['/auth/v1/verify', { type: 'email', email: 'mind@school.ac.th', token: '123456' }]);
  assert.deepEqual(c.user(), { id: 'u2', email: 'mind@school.ac.th', name: '', avatar: '' });
});

test('โปรไฟล์: อ่านของตัวเอง · แก้ได้เฉพาะช่องที่อนุญาต (role ไม่ถูกส่ง) · touch ล้มก็ไม่พัง · ลบบัญชีส่งเหตุผล', async () => {
  const calls = [], storage = mem();
  storage.setItem('sabaii-auth', JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_at: Date.now() + 3600e3, user: { id: 'u1', email: 'a@b.co' } }));
  const fetchFn = async (url, o) => {
    const path = url.replace(/^https:\/\/[^/]+/, '');
    calls.push([path, o.method, o.body && typeof o.body === 'string' ? JSON.parse(o.body) : o.body, o.headers]);
    if (path.startsWith('/rest/v1/profiles')) return res(200, [{ id: 'u1', display_name: 'ปลา', role: 'user' }]);
    if (path === '/rest/v1/rpc/touch_last_seen') return res(500, {});
    if (path.startsWith('/storage/v1/object/list/')) return res(200, []);
    return res(200, null);
  };
  const c = createCloud({ storage, fetchFn, url: 'https://x' });
  assert.equal((await c.profile()).display_name, 'ปลา');
  assert.equal(calls[0][0], '/rest/v1/profiles?select=*&id=eq.u1');
  await c.updateProfile({ display_name: 'ปลา', role: 'admin', timezone: 'Asia/Bangkok' });
  assert.deepEqual(calls[1].slice(0, 3), ['/rest/v1/profiles?id=eq.u1', 'PATCH', { display_name: 'ปลา', timezone: 'Asia/Bangkok' }]);
  assert.equal(calls[1][3].Prefer, 'return=representation');
  await c.touch();
  await c.deleteAccount('ไม่ได้ใช้แล้ว');
  assert.deepEqual(calls.at(-1).slice(0, 3), ['/rest/v1/rpc/delete_my_account', 'POST', { p_reason: 'ไม่ได้ใช้แล้ว' }]);
  assert.equal(c.user(), null);
});
