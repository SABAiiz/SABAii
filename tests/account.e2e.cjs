// บัญชีและซิงก์ในเบราว์เซอร์จริง (Playwright) — Supabase ปลอม (ดักคำขอไปที่ *.supabase.co) ไม่ต่อเน็ตจริง
//   node tests/account.e2e.cjs [โฟลเดอร์เก็บภาพ]
// เครื่อง A: เพิ่มงาน → เข้าสู่ระบบด้วยรหัส 6 หลัก → งานขึ้นบัญชี · เครื่อง B (เบราว์เซอร์ใหม่): เข้าบัญชีเดียวกัน → เห็นงาน
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const BASE = 'http://sabaii.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Supabase ปลอม ----------
const UID = '11111111-2222-3333-4444-555555555555', EMAIL = 'mint@example.com';
const rows = new Map(); let seq = 0; const calls = [];
async function supa(route) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname;
  calls.push(req.method() + ' ' + p);
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === '/auth/v1/otp') return body.email === EMAIL ? json(200, {}) : json(400, { error_code: 'email_address_invalid' });
  if (p === '/auth/v1/verify') return body.token === '123456' ? json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: UID, email: EMAIL } }) : json(403, { error_code: 'otp_expired' });
  if (p === '/auth/v1/logout') return route.fulfill({ status: 204 });
  if (p === '/rest/v1/items') {
    const after = Number(u.searchParams.get('seq').replace('gt.', ''));
    return json(200, [...rows.values()].filter(r => r.seq > after).sort((a, b) => a.seq - b.seq));
  }
  if (p === '/rest/v1/rpc/sync_push') {
    let n = 0;
    for (const it of body.p_items) {
      const k = it.kind + ':' + it.id, cur = rows.get(k);
      if (cur && Date.parse(cur.updated_at) > Date.parse(it.updated_at)) continue;
      rows.set(k, { kind: it.kind, id: it.id, data: it.deleted ? null : it.data, deleted: !!it.deleted, updated_at: it.updated_at, seq: ++seq }); n++;
    }
    return json(200, n);
  }
  return json(404, { message: 'not in fake' });
}

async function newDevice(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  await ctx.route('http://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await ctx.route('https://*.supabase.co/**', supa);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '#/me');
  await page.waitForSelector('#login');
  return { ctx, page, errors };
}
const shot = async (page, n) => { if (SHOTS) { await wait(350); await page.screenshot({ path: `${SHOTS}/${n}.png` }); } };
const liveTitles = page => page.evaluate(() => window.__sabaii.state.tasks.filter(t => !t.deleted_at).map(t => t.title).sort());

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();

  // ----- เครื่อง A: เปิดแอปครั้งแรก → หน้าเข้าสู่ระบบ → ใช้ต่อโดยไม่เข้า -----
  const A = await newDevice(browser);
  check('เปิดแอปครั้งแรก: หน้าเข้าสู่ระบบก่อนแบบสอบถาม · ปุ่มใช้ต่อโดยไม่เข้า', await A.page.locator('#login #acc-email').isVisible() && await A.page.locator('#login-skip').isVisible() && (await A.page.locator('#onboard').count()) === 0);
  await shot(A.page, 'acc-0-gate');
  await A.page.click('#login-skip'); await wait(500);
  check('ใช้ต่อโดยไม่เข้า → แบบสอบถามเริ่มข้อ 1 (ไม่ซ้ำหน้าต้อนรับ)', await A.page.locator('#onboard').isVisible() && await A.page.evaluate(() => document.getElementById('onboard').dataset.step === 'name'));
  await A.page.locator('#ob-skip').click(); await wait(400);
  await A.page.reload(); await A.page.waitForSelector('.tiles'); await wait(400);
  check('เปิดใหม่: ไม่ขึ้นหน้าเข้าสู่ระบบซ้ำ', (await A.page.locator('#login').count()) === 0 && (await A.page.locator('#onboard').count()) === 0);
  await A.page.evaluate(() => window.__sabaii.addTasks([{ title: 'ทำการบ้านเลขบทที่ 3', subject_name: 'คณิตศาสตร์' }]));
  await A.page.goto(BASE + '#/me'); await wait(300);
  check('ยังไม่เข้าสู่ระบบ: แถวบัญชีบอกสถานะ · ไม่ยิงไปเซิร์ฟเวอร์', (await A.page.locator('#me-sync').textContent()) === 'ยังไม่เข้าสู่ระบบ' && calls.length === 0);
  await A.page.getByText('บัญชีและซิงก์').click(); await wait(400);
  await A.page.fill('#acc-email', 'ไม่ใช่อีเมล'); await A.page.click('#acc-send'); await wait(200);
  check('อีเมลผิด → บอกเป็นภาษาไทย ไม่ยิงเซิร์ฟเวอร์', (await A.page.locator('.ferr').textContent()) === 'อีเมลไม่ถูกต้อง' && calls.length === 0);
  await A.page.fill('#acc-email', EMAIL);
  check('พิมพ์ใหม่ → ข้อความผิดหายไป', (await A.page.locator('.ferr').textContent()) === '');
  await A.page.click('#acc-send'); await A.page.waitForSelector('#acc-code');
  await A.page.fill('#acc-code', '000000'); await wait(400);
  check('รหัสผิด → ข้อความไทย', /หมดอายุ|ไม่ถูกต้อง/.test(await A.page.locator('.ferr').textContent()));
  await A.page.fill('#acc-code', '123456'); await wait(1200);
  check('รหัสถูก → เข้าสู่ระบบ · งานในเครื่องขึ้นบัญชี', await A.page.evaluate(() => !document.querySelector('#acc-code')) && [...rows.values()].some(r => r.kind === 'task' && r.data.title === 'ทำการบ้านเลขบทที่ 3'));
  check('แถวบัญชีแสดงอีเมล + "ซิงก์แล้ว"', /ซิงก์แล้ว/.test(await A.page.locator('#me-sync').textContent()) && await A.page.getByText(EMAIL).isVisible());
  await shot(A.page, 'acc-4-signed-in');
  await A.page.getByText('บัญชีและซิงก์').click(); await wait(400);
  check('กล่องบัญชี: อีเมล · สถานะ · ออกจากระบบ · ลบบัญชี', await A.page.locator('.accuser').getByText(EMAIL).isVisible() && await A.page.locator('#acc-out').isVisible() && await A.page.locator('#acc-del').isVisible());
  await shot(A.page, 'acc-5-account');
  await A.page.keyboard.press('Escape'); await wait(300);
  await A.page.evaluate(() => { const t = window.__sabaii.state.tasks.find(t => t.title.startsWith('ทำการบ้าน')); return window.__sabaii.patchTask(t.id, { status: 'done' }); });
  await wait(2500);
  check('แก้งานแล้วส่งขึ้นบัญชีเองภายในไม่กี่วินาที', [...rows.values()].some(r => r.kind === 'task' && r.data.status === 'done'));

  // ----- เครื่อง B: เข้าสู่ระบบจากหน้าแรกเลย -----
  const B = await newDevice(browser);
  await B.page.fill('#acc-email', EMAIL); await B.page.click('#acc-send'); await B.page.waitForSelector('#login #acc-code');
  await shot(B.page, 'acc-0b-gate-code');
  await B.page.fill('#acc-code', '123456'); await wait(1500);
  check('หน้าเข้าสู่ระบบ → เข้าแล้วปิดเอง · บัญชีนี้เคยตอบแบบสอบถามแล้ว ไม่ถามซ้ำ', (await B.page.locator('#login').count()) === 0 && (await B.page.locator('#onboard').count()) === 0);
  const bt = await B.page.evaluate(() => window.__sabaii.state.tasks.filter(t => !t.deleted_at).map(t => ({ title: t.title, status: t.status, subj: window.__sabaii.state.subjects.find(s => s.id === t.subject_id)?.name })));
  check('เครื่อง B เห็นงานของบัญชี (สถานะ + วิชาตรง)', bt.length === 1 && bt[0].title === 'ทำการบ้านเลขบทที่ 3' && bt[0].status === 'done' && bt[0].subj === 'คณิตศาสตร์', JSON.stringify(bt));
  const subjCount = await B.page.evaluate(() => window.__sabaii.state.subjects.length);
  check('วิชาตั้งต้นไม่ซ้ำเป็น 2 ชุด', subjCount === 8, String(subjCount));
  await B.page.reload(); await B.page.waitForSelector('.tiles'); await wait(400);
  check('เปิดใหม่ตอนเข้าสู่ระบบอยู่: ไม่ขึ้นหน้าเข้าสู่ระบบ', (await B.page.locator('#login').count()) === 0);

  // B ออกจากระบบ → ล้างเครื่อง → กลับมาหน้าเข้าสู่ระบบ
  await B.page.goto(BASE + '#/me'); await wait(300);
  await B.page.getByText('บัญชีและซิงก์').click(); await wait(400);
  await B.page.click('#acc-out'); await wait(600);
  await B.page.locator('.confirm button').last().click();
  await B.page.waitForSelector('#login', { timeout: 8000 }).catch(() => {});
  check('ออกจากระบบ → เครื่องถูกล้าง · กลับมาหน้าเข้าสู่ระบบ', (await liveTitles(B.page)).length === 0 && await B.page.evaluate(() => !localStorage.getItem('sabaii-auth')) && await B.page.locator('#login').isVisible());

  check('ไม่มี error ใน console', !A.errors.length && !B.errors.length, [...A.errors, ...B.errors].join(' | '));
  await browser.close();
  const ok = results.filter(Boolean).length;
  console.log(`\nรวม ${ok}/${results.length} ผ่าน`);
  process.exit(ok === results.length ? 0 : 1);
})();
