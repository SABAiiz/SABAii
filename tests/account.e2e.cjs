// บัญชีและซิงก์ในเบราว์เซอร์จริง (Playwright) — Supabase ปลอม (ดักคำขอไปที่ *.supabase.co) ไม่ต่อเน็ตจริง
//   node tests/account.e2e.cjs [โฟลเดอร์เก็บภาพ]
// 0.13 ต้องเข้าสู่ระบบก่อนใช้แอปทุกครั้ง
// เครื่อง A: หน้าแนะนำ → "ลองใช้เลย" → หน้าเข้าสู่ระบบ (ไม่เห็นแอป) → ยกเลิกที่ Google → เข้าจริง → แบบสอบถาม → เพิ่มงาน + เขียนสมุด → ขึ้นบัญชี
// เครื่อง B (เบราว์เซอร์ใหม่): เข้าบัญชีเดียวกัน → เห็นงานและสมุด · หลุดจากระบบกลางทาง → หน้าเข้าสู่ระบบทับ · ออกจากระบบ → กลับหน้าเข้าสู่ระบบ
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://sabaii.test/'; // https = secure context (PKCE ใช้ crypto.subtle)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- Supabase ปลอม ----------
const UID = '11111111-2222-3333-4444-555555555555', EMAIL = 'mint@example.com', NAME = 'มิ้นท์ ทดสอบ';
const rows = new Map(), files = new Map(); let seq = 0; const calls = []; const profilePatches = []; let denyNext = false, lastVerifier = null, refreshDead = false;
async function supa(route) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname;
  calls.push(req.method() + ' ' + p);
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (p === '/auth/v1/authorize') {
    // หน้าเลือกบัญชี Google ปลอม: เด้งกลับไปที่ redirect_to ทันที
    const back = new URL(u.searchParams.get('redirect_to'));
    if (!['google', 'facebook', 'apple'].includes(u.searchParams.get('provider')) || u.searchParams.get('code_challenge_method') !== 's256' || !u.searchParams.get('code_challenge')) back.searchParams.set('error', 'invalid_request');
    else if (denyNext) { denyNext = false; back.searchParams.set('error', 'access_denied'); back.searchParams.set('error_description', 'denied'); }
    else back.searchParams.set('code', 'GOOD:' + u.searchParams.get('code_challenge'));
    return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Google (ปลอม)</title><script>location.replace(${JSON.stringify(back.toString())})</script>` });
  }
  if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'pkce') {
    const [, challenge] = String(body.auth_code).split(':');
    const crypto = require('crypto');
    const want = crypto.createHash('sha256').update(body.code_verifier || '').digest('base64url');
    lastVerifier = body.code_verifier;
    if (challenge !== want) return json(400, { error_code: 'bad_code_verifier' });
    return json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: UID, email: EMAIL, user_metadata: { full_name: NAME } } });
  }
  // อีเมล: ขอรหัส → กรอกรหัส (รหัสที่ถูกคือ 123456)
  if (p === '/auth/v1/otp') return body.email && body.create_user ? json(200, {}) : json(400, { error_code: 'validation_failed' });
  if (p === '/auth/v1/verify') return body.type === 'email' && body.token === '123456'
    ? json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: { id: UID, email: body.email, user_metadata: {} } })
    : json(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
  if (p.startsWith('/storage/v1/object/')) {
    const name = decodeURIComponent(p.replace(/^\/storage\/v1\/object\/(authenticated\/)?attachments\/?/, ''));
    if (req.method() === 'POST') { files.set(name, req.postDataBuffer()); return json(200, { Key: name }); }
    if (req.method() === 'GET') return files.has(name) ? route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: files.get(name) }) : json(404, { message: 'not found' });
    if (req.method() === 'DELETE') { for (const x of body.prefixes || []) files.delete(x); return json(200, []); }
  }
  if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token')
    return refreshDead ? json(400, { error_code: 'refresh_token_not_found' }) : json(200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600, user: { id: UID, email: EMAIL, user_metadata: { full_name: NAME } } });
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
  if (p === '/rest/v1/rpc/touch_last_seen') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  if (p === '/rest/v1/profiles' && req.method() === 'PATCH') { profilePatches.push(body); return json(200, [{ id: UID, ...body }]); }
  return json(404, { message: 'not in fake' });
}

async function newDevice(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
  await ctx.route('https://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await ctx.route('https://*.supabase.co/**', supa);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
/** กดปุ่ม Google → ไปหน้า authorize (ปลอม) → เด้งกลับ → แอปเปิดใหม่ */
async function google(page) {
  const back = page.waitForEvent('framenavigated', { predicate: f => f === page.mainFrame() && /[?&](code|error)=/.test(f.url()) });
  await page.click('#acc-google');
  await Promise.race([back, wait(5000).then(async () => { throw new Error('ไม่ได้ไป Google: ' + await page.evaluate(() => document.querySelector('.ferr')?.textContent + ' | ' + location.href + ' | ' + navigator.onLine) + ' | ' + calls.join(',')); })]);
  await page.waitForLoadState('load'); await page.waitForSelector('#login, #onboard');
}
const gated = page => page.evaluate(() => !!document.querySelector('#login') && getComputedStyle(document.querySelector('#nav')).visibility === 'hidden');
const shot = async (page, n) => { if (SHOTS) { await wait(350); await page.screenshot({ path: `${SHOTS}/${n}.png` }); } };
const liveTitles = page => page.evaluate(() => window.__sabaii.state.tasks.filter(t => !t.deleted_at).map(t => t.title).sort());

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();

  // ----- เครื่อง A: เริ่มจากหน้าแนะนำ -----
  const A = await newDevice(browser);
  await A.page.goto(BASE + 'landing.html'); await wait(600);
  await Promise.all([A.page.waitForURL(/index\.html|\/$|\?from=landing/), A.page.locator('.ctas .app-link').first().click()]);
  await A.page.waitForSelector('#login');
  check('หน้าแนะนำ → "ลองใช้เลย" → หน้าเข้าสู่ระบบ · ไม่เห็นแอป · ไม่ยิงไปเซิร์ฟเวอร์', await gated(A.page) && !(await A.page.evaluate(() => !!window.__sabaii)) && calls.length === 0);
  await shot(A.page, 'acc-1-login');
  // กดยกเลิกที่หน้า Google
  denyNext = true;
  await google(A.page); await wait(500);
  check('ยกเลิกที่ Google → กลับมาหน้าเข้าสู่ระบบ + ข้อความไทย · แถบที่อยู่ไม่มี ?error', await gated(A.page) && /ยกเลิก/.test(await A.page.locator('.lg-err').textContent()) && !(await A.page.evaluate(() => location.search)));
  await shot(A.page, 'acc-2-cancelled');
  // เข้าจริง → แบบสอบถาม (ข้ามหน้าต้อนรับ) → แอป
  await google(A.page); await wait(800);
  check('เข้าสู่ระบบแล้ว → แบบสอบถามเริ่มที่ข้อ 1 · หน้าเข้าสู่ระบบหายไป', await A.page.locator('#onboard').isVisible() && !(await A.page.locator('#login').count()));
  await A.page.locator('#ob-skip').click(); await wait(400);
  await A.page.evaluate(async () => { const s = window.__sabaii; await s.addTasks([{ title: 'ทำการบ้านเลขบทที่ 3', subject_name: 'คณิตศาสตร์' }]);
    const b = await s.addBook({ title: 'สมุดฟิสิกส์' }); const p = s.pagesOf(b.id)[0];
    await s.savePage({ ...p, strokes: [{ id: 'k1', t: 'pen', c: '#0B1B4D', w: 6, p: [100, 100, .5, 400, 300, .5] }], texts: [{ id: 'k2', x: 80, y: 500, w: 600, s: 40, c: '#0B1B4D', v: 'F = ma' }] }); });
  await wait(2500);
  await A.page.goto(BASE + '#/me'); await wait(800);
  check('ส่งรหัสลับ PKCE ตอนแลก code (ไม่ได้อยู่ในลิงก์)', !!lastVerifier && !calls.some(c => c.includes(lastVerifier)));
  check('งานที่เพิ่มขึ้นบัญชีเอง', [...rows.values()].some(r => r.kind === 'task' && r.data.title === 'ทำการบ้านเลขบทที่ 3'));
  check('สมุด: เล่ม + หัวหน้าเป็นแถว · เนื้อหาเป็นไฟล์', [...rows.values()].some(r => r.kind === 'book' && r.data.title === 'สมุดฟิสิกส์') && [...files.keys()].some(k => /^[\w-]+\/page-.+\.json$/.test(k)));
  check('แถวบัญชีแสดงชื่อ + อีเมล + "ซิงก์แล้ว"', /ซิงก์แล้ว/.test(await A.page.locator('#me-sync').textContent()) && await A.page.getByText(EMAIL).isVisible() && await A.page.getByText(NAME).first().isVisible());
  await shot(A.page, 'acc-4-signed-in');
  await A.page.getByText(NAME).first().click(); await wait(400);
  check('กล่องบัญชี: อีเมล · สถานะ · ออกจากระบบ · ลบบัญชี', await A.page.locator('.accuser').getByText(EMAIL).isVisible() && await A.page.locator('#acc-out').isVisible() && await A.page.locator('#acc-del').isVisible());
  await shot(A.page, 'acc-5-account');
  await A.page.keyboard.press('Escape'); await wait(300);
  await A.page.reload(); await A.page.waitForSelector('.mecard'); await wait(300);
  check('เปิดแอปใหม่ = ยังเข้าสู่ระบบอยู่ ไม่ต้องเข้าใหม่', !(await A.page.locator('#login').count()));
  // แก้งานแล้วซิงก์เอง (หน่วง ~1.5 วินาที)
  await A.page.evaluate(() => { const t = window.__sabaii.state.tasks.find(t => t.title.startsWith('ทำการบ้าน')); return window.__sabaii.patchTask(t.id, { status: 'done' }); });
  await wait(2500);
  check('แก้งานแล้วส่งขึ้นบัญชีเองภายในไม่กี่วินาที', [...rows.values()].some(r => r.kind === 'task' && r.data.status === 'done'));
  check('เปิดแอป → บอกเซิร์ฟเวอร์ว่ายังใช้อยู่ · โปรไฟล์ได้เขตเวลาของเครื่อง (ส่งครั้งเดียว ไม่ส่ง role)', calls.includes('POST /rest/v1/rpc/touch_last_seen') && profilePatches.length === 1 && profilePatches[0].timezone === 'Asia/Bangkok' && !('role' in profilePatches[0]), JSON.stringify(profilePatches));

  // ----- เครื่อง B -----
  const B = await newDevice(browser);
  await B.page.goto(BASE); await B.page.waitForSelector('#login');
  await google(B.page); await B.page.locator('#ob-skip').click(); await wait(2000);
  const bt = await B.page.evaluate(() => window.__sabaii.state.tasks.filter(t => !t.deleted_at).map(t => ({ title: t.title, status: t.status, subj: window.__sabaii.state.subjects.find(s => s.id === t.subject_id)?.name })));
  check('เครื่อง B เข้าบัญชีเดียวกัน → เห็นงาน (สถานะ + วิชาตรง)', bt.length === 1 && bt[0].title === 'ทำการบ้านเลขบทที่ 3' && bt[0].status === 'done' && bt[0].subj === 'คณิตศาสตร์', JSON.stringify(bt));
  const subjCount = await B.page.evaluate(() => window.__sabaii.state.subjects.length);
  check('วิชาตั้งต้นไม่ซ้ำเป็น 2 ชุด', subjCount === 8, String(subjCount));
  const bp = await B.page.evaluate(() => { const s = window.__sabaii.state; const b = s.books.find(b => b.title === 'สมุดฟิสิกส์'); const p = b && s.pages.find(p => p.book_id === b.id); return p && { strokes: p.strokes.length, text: p.texts[0]?.v, need: !!p.need_body }; });
  check('เครื่อง B เห็นสมุด + ลายมือ + ข้อความในหน้า', bp && bp.strokes === 1 && bp.text === 'F = ma' && !bp.need, JSON.stringify(bp));
  await B.page.goto(BASE + '#/notebook'); await wait(600);
  await shot(B.page, 'acc-7-b-notebook');
  await B.page.goto(BASE + '#/me'); await wait(400);

  // หลุดจากระบบกลางทาง (refresh token ใช้ไม่ได้แล้ว) → หน้าเข้าสู่ระบบทับแอป · งานในเครื่องยังอยู่
  refreshDead = true;
  await A.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('sabaii-auth')); s.expires_at = 0; localStorage.setItem('sabaii-auth', JSON.stringify(s)); });
  await A.page.reload(); await A.page.waitForSelector('#login', { timeout: 8000 }).catch(() => {});
  check('หลุดจากระบบ → "เข้าสู่ระบบอีกครั้ง" ทับแอป · งานในเครื่องยังอยู่', await gated(A.page) && /อีกครั้ง/.test(await A.page.locator('#lg-title').textContent()) && (await liveTitles(A.page)).length === 1);
  await shot(A.page, 'acc-8-again');
  refreshDead = false;

  // B ออกจากระบบ → ล้างเครื่อง → หน้าเข้าสู่ระบบ
  await B.page.getByText(NAME).first().click(); await wait(400);
  await B.page.click('#acc-out'); await wait(600);
  await shot(B.page, 'acc-6-signout-confirm');
  await B.page.locator('.confirm button').last().click();
  await B.page.waitForLoadState('load'); await B.page.waitForSelector('#login', { timeout: 8000 }).catch(() => {});
  check('ออกจากระบบ → เครื่องถูกล้าง · กลับมาหน้าเข้าสู่ระบบ', await gated(B.page) && await B.page.evaluate(() => !localStorage.getItem('sabaii-auth') && !window.__sabaii));

  // ----- เครื่อง C: เข้าด้วยอีเมล (รหัส 6 หลัก) -----
  const C = await newDevice(browser);
  await C.page.goto(BASE); await C.page.waitForSelector('#login');
  check('หน้าเข้าสู่ระบบมีครบ 4 ทาง: Google · Facebook · Apple · อีเมล', (await Promise.all(['#acc-google', '#acc-facebook', '#acc-apple', '#acc-email'].map(s => C.page.locator(s).isVisible()))).every(Boolean));
  await shot(C.page, 'acc-4-choices');
  await C.page.click('#acc-email');
  await C.page.fill('#acc-email-in', 'mind@'); await C.page.click('#acc-send');
  check('อีเมลผิดรูปแบบ → บอกให้แก้ ไม่ยิงไปเซิร์ฟเวอร์', /ใส่อีเมลให้ถูก/.test(await C.page.locator('.lg-err').textContent()) && !calls.includes('POST /auth/v1/otp'));
  await C.page.fill('#acc-email-in', 'mind@school.ac.th'); await C.page.click('#acc-send');
  await C.page.waitForSelector('#acc-code-in', { state: 'visible' });
  check('ส่งรหัสแล้ว → ช่องกรอกรหัส + บอกอีเมลที่ส่งไป', /mind@school\.ac\.th/.test(await C.page.locator('.lg-note').textContent()));
  await shot(C.page, 'acc-5-code');
  await C.page.fill('#acc-code-in', '000000'); await wait(500);
  check('รหัสผิด → ข้อความไทย · ยังไม่เข้า', /รหัสหมดอายุหรือไม่ถูกต้อง/.test(await C.page.locator('.lg-err').textContent()) && await gated(C.page));
  await Promise.all([C.page.waitForEvent('load'), C.page.fill('#acc-code-in', '123456')]);
  await C.page.waitForSelector('#onboard, #nav'); await wait(500);
  check('รหัสถูก → เปิดแอป (แบบสอบถามครั้งแรก) · จำบัญชีไว้', !(await C.page.locator('#login').count()) && await C.page.evaluate(() => JSON.parse(localStorage.getItem('sabaii-auth')).user.email === 'mind@school.ac.th'));

  // ----- เครื่อง D: เข้าด้วย Facebook -----
  const D = await newDevice(browser);
  await D.page.goto(BASE); await D.page.waitForSelector('#login');
  const fbBack = D.page.waitForEvent('framenavigated', { predicate: f => f === D.page.mainFrame() && /[?&]code=/.test(f.url()) });
  await D.page.click('#acc-facebook'); await fbBack;
  await D.page.waitForLoadState('load'); await D.page.waitForSelector('#onboard, #nav'); await wait(500);
  check('Facebook → ไปหน้า authorize (provider=facebook) → กลับมาเข้าแอปได้', !(await D.page.locator('#login').count()) && await D.page.evaluate(() => !!localStorage.getItem('sabaii-auth')));

  check('ไม่มี error ใน console', !A.errors.length && !B.errors.length && !C.errors.length && !D.errors.length, [...A.errors, ...B.errors, ...C.errors, ...D.errors].join(' | '));
  await browser.close();
  const ok = results.filter(Boolean).length;
  console.log(`\nรวม ${ok}/${results.length} ผ่าน`);
  process.exit(ok === results.length ? 0 : 1);
})();
