// ทดสอบ SABAii โครงใหม่ (shell/) ในเบราว์เซอร์จริง — ไม่ต้องเปิดเซิร์ฟเวอร์
//   node tests/shell.e2e.cjs [โฟลเดอร์เก็บภาพ]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const BASE = (process.env.SABAII_URL || 'http://sabaii.test/') + 'shell/';
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SHOTS = process.argv[2] || null;
let fail = 0;
const check = (name, ok, extra = '') => { if (!ok) fail++; console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  if (!process.env.SABAII_URL) await ctx.route('http://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector('.tiles');
  await wait(500);
  const shot = async n => SHOTS && page.screenshot({ path: `${SHOTS}/shell-${n}.png` });
  const st = () => page.evaluate(() => window.__shell.state());

  check('หน้าแรก: ปุ่มเพิ่มงาน 4 แบบตามภาพ', (await page.locator('.tile b').allTextContents()).join(',') === 'พูด,แนบรูป,พิมพ์,ถ่ายรูป');
  const rows = await page.locator('.pane-home .trow b').allTextContents();
  check('งานแนะนำเรียงตามกำหนดส่ง (ฟิสิกส์พรุ่งนี้มาก่อน)', /แบบฝึกบทที่ 3/.test(rows[0]), rows.slice(0, 3).join(' | '));
  check('เมนูล่างเห็นอยู่', !(await page.locator('#nav.away').count()));
  await shot('01-home');

  // ดึงแผ่นลง → โน้ตของงานอันดับ 1
  const g = await page.locator('.grab').boundingBox();
  await page.mouse.move(195, g.y + 6); await page.mouse.down();
  await page.mouse.move(195, 760, { steps: 10 }); await page.mouse.up();
  await wait(500);
  let s = await st();
  check('ดึงแผ่นลง → โหมดโน้ต · งานแรก', s.noteMode && s.cur === 0);
  check('โหมดโน้ต: เมนูล่างหลบ + มีปุ่ม "ทำเลย"', (await page.locator('#nav.away').count()) === 1 && await page.locator('.pane-note .cta').isVisible());
  check('โน้ตกระดานของฟิสิกส์ขึ้น', await page.locator('.npage').first().locator('.nitem.board').isVisible());
  await shot('02-notes-physics');

  // ปัดขึ้น (ล้อเมาส์บนชั้นหลัง) → งานถัดไป แผ่นล่างเปลี่ยนตาม
  await page.mouse.move(195, 250); await page.mouse.wheel(0, 900);
  await wait(900);
  s = await st();
  const title2 = await page.locator('.pane-note h2').textContent();
  check('ปัดขึ้น → งานที่ 2 · แผ่นล่างเปลี่ยนตาม', s.cur === 1 && !/แบบฝึกบทที่ 3/.test(title2), title2);
  await shot('03-notes-next');
  // ลากด้วยเมาส์ลง → กลับงานแรก
  await page.mouse.move(195, 300); await page.mouse.down(); await page.mouse.move(195, 420, { steps: 6 }); await page.mouse.up();
  await wait(800);
  check('ลากชั้นโน้ตลง → กลับงานแรก', (await st()).cur === 0);

  // ทำเลย → จับเวลา → เสร็จแล้ว
  await page.locator('.pane-note .cta').click();
  await wait(1200);
  check('ทำเลย → มีตัวจับเวลา + ปุ่มเสร็จแล้ว', await page.locator('.pane-note .timer').isVisible() && /เสร็จแล้ว/.test(await page.locator('.pane-note .cta').textContent()));
  // เพิ่มโน้ตข้อความ
  await page.getByRole('button', { name: 'ข้อความ' }).click();
  await page.fill('#note-text', 'จำไว้: ส่งในกูเกิลคลาสรูม');
  await page.getByRole('button', { name: 'บันทึกโน้ต' }).click();
  await wait(400);
  check('เพิ่มโน้ตข้อความ → โน้ตขึ้นในชั้นหลัง', (await page.locator('.npage').first().locator('.nitem.sticky').count()) === 2);
  await page.locator('.pane-note .cta').click();
  await wait(400);
  check('เสร็จแล้ว → งานหายจากคิว', (await page.evaluate(() => window.__shell.db().tasks.find(t => t.id === 't1').status)) === 'done');
  await page.getByRole('button', { name: 'เลิกทำ' }).click();
  await wait(300);
  check('เลิกทำ → กลับมา', (await page.evaluate(() => window.__shell.db().tasks.find(t => t.id === 't1').status)) === 'doing');

  // กลับหน้าแรก แล้วพิมพ์งาน
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click();
  await wait(500);
  check('ปุ่มกลับ → แผ่นขึ้น เมนูล่างกลับมา', !(await st()).noteMode && !(await page.locator('#nav.away').count()));
  await page.getByRole('button', { name: /พิมพ์/ }).first().click();
  await page.fill('#add-text', 'เคมี ทำแบบฝึกบท 2 ส่งพรุ่งนี้\nอังกฤษ เขียนเรียงความวันศุกร์');
  await page.getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
  check('พิมพ์ 2 บรรทัด → ร่าง 2 งาน', (await page.locator('.draft').count()) === 2);
  await shot('04-review');
  await page.getByRole('button', { name: 'บันทึก 2 งาน' }).click();
  await wait(400);
  check('บันทึก → มี 9 งาน', (await page.evaluate(() => window.__shell.db().tasks.length)) === 9);

  // หน้างาน: ปฏิทิน 2 สัปดาห์ ↔ เดือน + การ์ดโปรเจกต์
  await page.locator('#nav a[data-r="tasks"]').click();
  await page.waitForSelector('.cal');
  check('หน้างาน: ปฏิทินย่อ = 14 วัน', (await page.locator('.day').count()) === 14);
  check('การ์ดโปรเจกต์ต่อวิชา', (await page.locator('.proj:not(.new)').count()) >= 4);
  await shot('05-tasks');
  await page.locator('.monthchip').click();
  const n = await page.locator('.day').count();
  check('แตะชิปเดือน → ปฏิทินทั้งเดือน', n === 35 || n === 42 || n === 28, String(n));
  await page.locator('.day.today').click();
  check('แตะวัน → มีรายการของวันนั้น', await page.locator('.daylist').isVisible());
  await shot('06-tasks-month');
  await page.locator('.proj', { hasText: 'คณิต' }).first().click();
  await page.waitForSelector('#page .tcard'); // อย่าใช้ .board — ชนกับโน้ตกระดานในชั้นหลัง
  check('แตะการ์ดคณิต → หน้าโปรเจกต์มีโน้ต', (await page.locator('.tcard .strip > div').count()) >= 2);
  await shot('07-subject');
  await page.getByRole('button', { name: 'เปิดโน้ตเต็มจอ' }).first().click();
  await wait(700);
  s = await st();
  check('เปิดโน้ตเต็มจอ → กลับหน้าแรกโหมดโน้ตที่งานนั้น', s.noteMode && /ใบงานลำดับเลขคณิต/.test(await page.locator('.pane-note h2').textContent()));
  await shot('08-notes-math');

  // หน้าฉัน + ธีมมืด
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click();
  await wait(400);
  await page.locator('#nav a[data-r="me"]').click();
  await page.getByRole('button', { name: /สลับธีม/ }).click();
  await shot('09-me-dark');
  await page.locator('#nav a[data-r="home"]').click();
  await wait(400);
  await shot('10-home-dark');
  await page.reload(); await page.waitForSelector('.tiles');
  check('เปิดใหม่ → ข้อมูลยังอยู่', (await page.evaluate(() => window.__shell.db().tasks.length)) === 9);

  check('ไม่มี error ใน console', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail ? `ตก ${fail} ข้อ` : 'ผ่านทั้งหมด');
  process.exit(fail ? 1 : 0);
})();
