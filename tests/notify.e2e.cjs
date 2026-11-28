// แจ้งเตือนรายวิชา (0.16) ในเบราว์เซอร์จริง (Playwright) — Supabase ปลอม + PushManager ปลอม (เบราว์เซอร์ทดสอบส่ง push จริงไม่ได้)
//   node tests/notify.e2e.cjs [โฟลเดอร์เก็บภาพ]
// หน้าฉัน › การแจ้งเตือน: วิชาละบรรทัด 19:00 → เปิด → ส่งเครื่องขึ้นเซิร์ฟเวอร์ → เปลี่ยนเวลาคณิต · ปิดอังกฤษ → ขึ้นบัญชี (sync) → ทดสอบ → ปิด
// iPhone ที่ยังไม่เพิ่มลงหน้าจอโฮม → บอกวิธีเพิ่ม ไม่ขออนุญาต
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const { SESSION } = require('./fake-login.cjs');
const ROOT = path.join(__dirname, '..');
const BASE = 'https://sabaii.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const PUBLIC_KEY = 'B' + 'A'.repeat(86); // รูปแบบเดียวกับกุญแจ VAPID จริง (65 ไบต์)
const calls = [];

async function device(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block', ...opts });
  await ctx.grantPermissions(['notifications'], { origin: 'https://sabaii.test' });
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sabaii-auth')) localStorage.setItem('sabaii-auth', s); localStorage.setItem('sabaii-onboarded', '1'); } catch {} }, JSON.stringify(SESSION));
  // PushManager ปลอม: subscribe คืนเครื่องสมมติ · นับการยกเลิก
  await ctx.addInitScript(() => {
    const sub = { endpoint: 'https://push.example/dev1', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'P256', auth: 'AUTH' } }; },
      async unsubscribe() { window.__unsub = (window.__unsub || 0) + 1; sessionStorage.removeItem('fake-sub'); return true; } };
    // เบราว์เซอร์จริงจำการสมัครไว้ข้ามการเปิดใหม่ → จำลองด้วย sessionStorage
    let current = sessionStorage.getItem('fake-sub') ? sub : null;
    const pushManager = { getSubscription: async () => current, subscribe: async o => { window.__keyBytes = o.applicationServerKey.length; current = sub; sessionStorage.setItem('fake-sub', '1'); return sub; } };
    if (!window.PushManager) window.PushManager = function PushManager() {};
    // Chromium แบบไม่มีจอ ตอบ "denied" เสมอแม้ให้สิทธิ์แล้ว → จำลองผู้ใช้กด "อนุญาต"
    Object.defineProperty(Notification, 'permission', { get: () => sessionStorage.getItem('fake-perm') || 'default' });
    Notification.requestPermission = async () => { sessionStorage.setItem('fake-perm', 'granted'); return 'granted'; };
    if (navigator.serviceWorker) Object.defineProperty(navigator.serviceWorker, 'ready', { get: () => Promise.resolve({ pushManager }) });
  });
  await ctx.route('https://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await ctx.route('https://*.supabase.co/**', route => {
    const req = route.request(), p = new URL(req.url()).pathname;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (p.startsWith('/rest/v1/rpc/push_') || p.startsWith('/functions/') || p === '/rest/v1/rpc/sync_push') calls.push({ p, body, auth: req.headers().authorization });
    const json = v => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(v) });
    if (p === '/rest/v1/rpc/push_public_key') return json(PUBLIC_KEY);
    if (p === '/rest/v1/rpc/push_subscribe' || p === '/rest/v1/rpc/push_unsubscribe') return route.fulfill({ status: 204, headers: cors });
    if (p === '/functions/v1/push-reminders') return json({ devices: 1, sent: 1, results: ['sent'] });
    if (p === '/rest/v1/items') return json([]);
    if (p === '/rest/v1/rpc/sync_push') return json(0);
    return json({});
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '#/me');
  await page.waitForSelector('.mecard');
  if (await page.locator('#ob-skip').count()) { await page.locator('#ob-skip').click(); await wait(300); }
  return { ctx, page, errors };
}
const rowValue = page => page.locator('.list-btn', { hasText: 'การแจ้งเตือน' }).locator('.lv').textContent();
const openRow = async page => { await page.locator('.list-btn', { hasText: 'การแจ้งเตือน' }).click(); await wait(400); };
const row = (page, name) => page.locator('.rm-row', { hasText: name });
const shot = async (page, n) => { if (SHOTS) { await wait(350); await page.screenshot({ path: `${SHOTS}/${n}.png` }); } };

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const A = await device(browser);
  const { page } = A;
  const pushed = () => calls.filter(c => c.p === '/rest/v1/rpc/sync_push').flatMap(c => c.body.p_items || []);

  check('หน้าฉัน: แถว "การแจ้งเตือน" = ปิด · ไม่มีการ์ด "เร็ว ๆ นี้" ของแจ้งเตือนแล้ว', (await rowValue(page)) === 'ปิด' && !(await page.locator('.soon-tile', { hasText: 'การแจ้งเตือน' }).count()));
  await openRow(page);
  const names = await page.locator('.rm-row .rm-name').allTextContents();
  check('กล่อง: วิชาละบรรทัด (8 วิชาตั้งต้น + งานไม่มีวิชา) ทุกวิชา 19:00 · ปุ่มเปิด', names.length === 9 && names[0] === 'คณิตศาสตร์' && names.at(-1) === 'งานไม่มีวิชา'
    && (await page.locator('.rm-time b').allTextContents()).every(t => t === '19:00') && await page.locator('#nt-on').isVisible(), names.join(','));
  await shot(page, 'nt-1-off');
  await page.click('#nt-on'); await wait(800);
  const sub1 = calls.find(c => c.p === '/rest/v1/rpc/push_subscribe');
  check('เปิด → ขอกุญแจสาธารณะ → subscribe (65 ไบต์) → ส่งเครื่องขึ้นเซิร์ฟเวอร์ในนามผู้ใช้', calls.some(c => c.p === '/rest/v1/rpc/push_public_key') && (await page.evaluate(() => window.__keyBytes)) === 65
    && sub1 && sub1.body.p_endpoint === 'https://push.example/dev1' && sub1.body.p_p256dh === 'P256' && sub1.body.p_auth === 'AUTH' && sub1.body.p_tz === 'Asia/Bangkok' && /^Bearer /.test(sub1.auth), JSON.stringify(sub1));
  check('เปิดแล้ว: ปุ่มเปิดหาย · มีปุ่มลองส่ง + ปิด', !(await page.locator('#nt-on').count()) && await page.locator('#nt-test').isVisible() && await page.locator('#nt-off').isVisible());

  // คณิต 17:30 (ตัวเลือกเวลาของเครื่อง) · ปิดอังกฤษ (สวิตช์)
  const math = row(page, 'คณิตศาสตร์');
  await math.locator('input[type=time]').fill('17:30'); await math.locator('input[type=time]').dispatchEvent('change'); await wait(300);
  await row(page, 'ภาษาอังกฤษ').locator('.rm-sw').click(); await wait(300);
  check('คณิต = 17:30 · อังกฤษ = ปิด (สวิตช์ปิด) · วิชาอื่นยัง 19:00', (await row(page, 'คณิตศาสตร์').locator('.rm-time b').textContent()) === '17:30'
    && (await row(page, 'ภาษาอังกฤษ').locator('.rm-time b').textContent()) === 'ปิด' && (await row(page, 'ภาษาอังกฤษ').locator('.rm-sw').getAttribute('aria-checked')) === 'false'
    && (await row(page, 'ภาษาไทย').locator('.rm-time b').textContent()) === '19:00');
  const st = await page.evaluate(() => Object.fromEntries(window.__sabaii.state.subjects.map(s => [s.name, s.remind_at ?? null])));
  check('เก็บในวิชา: remind_at คณิต 17:30 · อังกฤษ off · วิชาที่ไม่แตะ = ไม่มีค่า (19:00)', st['คณิตศาสตร์'] === '17:30' && st['ภาษาอังกฤษ'] === 'off' && st['ภาษาไทย'] === null, JSON.stringify(st));
  await row(page, 'งานไม่มีวิชา').locator('input[type=time]').fill('07:05'); await row(page, 'งานไม่มีวิชา').locator('input[type=time]').dispatchEvent('change'); await wait(2600);
  const items = pushed();
  check('ขึ้นบัญชี (sync): วิชาคณิต remind_at 17:30 · อังกฤษ off · pref remind_none 07:05', items.some(i => i.kind === 'subject' && i.data?.name === 'คณิตศาสตร์' && i.data.remind_at === '17:30')
    && items.some(i => i.kind === 'subject' && i.data?.name === 'ภาษาอังกฤษ' && i.data.remind_at === 'off') && items.some(i => i.kind === 'pref' && i.id === 'remind_none' && i.data?.value === '07:05'));
  await shot(page, 'nt-2-on');
  await row(page, 'ภาษาอังกฤษ').locator('.rm-sw').click(); await wait(300);
  check('เปิดอังกฤษกลับ = 19:00', (await row(page, 'ภาษาอังกฤษ').locator('.rm-time b').textContent()) === '19:00');

  await page.click('#nt-test'); await wait(600);
  const t = calls.find(c => c.p === '/functions/v1/push-reminders');
  check('ลองส่ง → เรียก Edge Function พร้อม token ผู้ใช้ { test: true }', t && t.body.test === true && /^Bearer /.test(t.auth));
  await page.keyboard.press('Escape'); await wait(400);
  check('หน้าฉัน: แถว = "เปิด · 8 วิชา"', (await rowValue(page)) === 'เปิด · 8 วิชา', await rowValue(page));

  const before = calls.filter(c => c.p === '/rest/v1/rpc/push_subscribe').length;
  await page.reload(); await page.waitForSelector('.mecard'); await wait(1200);
  check('เปิดแอปใหม่ → ส่งข้อมูลเครื่องซ้ำเงียบ ๆ · ยังเปิดอยู่', calls.filter(c => c.p === '/rest/v1/rpc/push_subscribe').length === before + 1 && (await rowValue(page)).startsWith('เปิด'));
  await openRow(page);
  await page.click('#nt-off'); await wait(600);
  check('ปิดในเครื่องนี้ → ลบเครื่องจากเซิร์ฟเวอร์ + ยกเลิกในเบราว์เซอร์ · ปุ่มเปิดกลับมา · เวลาของวิชายังอยู่', calls.some(c => c.p === '/rest/v1/rpc/push_unsubscribe' && c.body.p_endpoint === 'https://push.example/dev1')
    && (await page.evaluate(() => window.__unsub)) === 1 && await page.locator('#nt-on').isVisible() && (await row(page, 'คณิตศาสตร์').locator('.rm-time b').textContent()) === '17:30');
  await page.keyboard.press('Escape'); await wait(400);
  check('แถว = ปิด', (await rowValue(page)) === 'ปิด');

  // iPhone (Safari ไม่ได้เพิ่มลงหน้าจอโฮม)
  const I = await device(browser, { ...devices['iPhone 13'], serviceWorkers: 'block' });
  await openRow(I.page);
  check('iPhone ยังไม่เพิ่มลงหน้าจอโฮม → บอกวิธีเพิ่ม 3 ขั้น ไม่มีปุ่มเปิด (ตั้งเวลาไว้ก่อนได้)', await I.page.locator('.nios').isVisible() && (await I.page.locator('.nios li').count()) === 3
    && !(await I.page.locator('#nt-on').count()) && (await I.page.locator('.rm-row').count()) === 9);
  await shot(I.page, 'nt-3-ios');

  check('ไม่มี error ใน console', !A.errors.length && !I.errors.length, [...A.errors, ...I.errors].join(' | '));
  await browser.close();
  const ok = results.filter(Boolean).length;
  console.log(`\nรวม ${ok}/${results.length} ผ่าน`);
  process.exit(ok === results.length ? 0 : 1);
})();
