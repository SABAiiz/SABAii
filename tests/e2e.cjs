// ทดสอบแอปจริงในเบราว์เซอร์ (Playwright/Chromium) — ไม่ต้องเปิดเซิร์ฟเวอร์ (ส่งไฟล์จากโฟลเดอร์ให้เบราว์เซอร์ตรง ๆ)
//   node tests/e2e.cjs [โฟลเดอร์เก็บภาพ]
//   ถ้าอยากทดสอบผ่านเซิร์ฟเวอร์จริง (รวม service worker): SABAII_URL=http://localhost:8765/ node tests/e2e.cjs
// ครอบคลุมสเปกข้อ 15: A เพิ่มงาน · B หลายงาน · C ไมค์ไม่ได้ · D ออฟไลน์/เปิดใหม่ · E ปฏิทิน · G หลายขนาดจอ · H กันข้อความหาย
// + โครงใหม่ 0.4: ชั้นโน้ตหน้างาน · แผ่นล่าง 3 ระดับ · เมนูล่างหลบเอง · การ์ดวิชา · หน้าวิชา · ปักหมุด · ลบ/กู้คืน · งานตัวอย่าง
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const REAL = process.env.SABAII_URL;
const BASE = REAL || 'http://sabaii.test/';
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: REAL ? 'allow' : 'block' });
  await ctx.clock.setFixedTime(new Date('2026-11-16T09:40:00Z')); // จ. 16 พ.ย. 69 16:40 เวลาไทย — ตรึงวัน ผลจะไม่เปลี่ยนตามวันที่รัน
  if (!REAL) await ctx.route('http://sabaii.test/**', r => {
    let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.tiles');
  await wait(400);
  const shot = async n => { if (!SHOTS) return; await page.evaluate(() => document.getElementById('toast')?.classList.remove('show')); await wait(300); await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
  const tasks = () => page.evaluate(() => window.__sabaii.state.tasks.filter(t => !t.deleted_at));
  const ui = () => page.evaluate(() => window.__ui.homeState());
  const typeAdd = async text => { await page.locator('.tile', { hasText: 'พิมพ์' }).click(); await page.fill('#add-text', text); };
  const pressed = () => page.locator('.qchip[aria-pressed="true"]').allTextContents();

  // หน้าแรกว่าง
  check('หน้าแรกว่าง: "วันนี้ยังไม่มีงานที่ต้องทำ" + ปุ่มเพิ่ม', await page.getByText('วันนี้ยังไม่มีงานที่ต้องทำ').isVisible() && await page.getByRole('button', { name: '+ เพิ่มงานใหม่' }).isVisible());
  check('ปุ่มเพิ่มงานครบ 4 แบบตามภาพวาด', (await page.locator('.tile b').allTextContents()).join(',') === 'พูด,แนบรูป,พิมพ์,ถ่ายรูป');
  await shot('01-home-empty');

  // A: พิมพ์งานเดียว
  await typeAdd('คณิตทำแบบฝึกหัดหน้า 20 ส่งวันศุกร์');
  const pA = await pressed();
  check('A ไม่มีหน้าตรวจสอบแยก: พิมพ์แล้วเห็นผลทันที · ชิปวิชา "คณิตศาสตร์" + วันศุกร์ถูกเลือกให้', pA.includes('คณิตศาสตร์') && pA.some(x => /ศ\. 20/.test(x)), pA.join(','));
  const dueA = await page.locator('.qrow small').textContent();
  check('A ไม่ระบุเวลา → ไม่เดาเวลาให้', dueA === 'ส่งศุกร์', dueA);
  await shot('02-quick-add');
  await page.locator('#add-save').click();
  await wait(400);
  check('A งานโผล่ในหน้าแรก', (await page.locator('.pane-home .trow').count()) === 1);

  // B: หลายงาน + กดบันทึกรัว ๆ ต้องไม่ได้งานซ้ำ
  await typeAdd('ไทย ทำใบงานบทที่ 2 ส่งพรุ่งนี้\nอังกฤษ ท่องศัพท์วันศุกร์\nวิทย์ ทำรายงานส่งสัปดาห์หน้า');
  check('B แยกได้ 3 งาน', (await page.locator('.qrow').count()) === 3);
  const save3 = page.getByRole('button', { name: 'บันทึก 3 งาน' });
  await save3.click(); await save3.click({ force: true }).catch(() => {});
  await wait(500);
  check('B บันทึกครบ ไม่ซ้ำ (รวม 4 งาน)', (await tasks()).length === 4);
  const rows = await page.locator('.pane-home .trow b').allTextContents();
  check('งานแนะนำเรียงตามกำหนดส่ง (ไทยพรุ่งนี้มาก่อน)', /ใบงานบทที่ 2/.test(rows[0]), rows.join(' | '));
  await shot('03-home-list');

  // แตะชิปแทนกรอก: "พน." = พรุ่งนี้ · แตะวิชาอื่น → เปลี่ยน
  await typeAdd('คณิต ใบงาน 7 ส่งพน.');
  check('"ส่งพน." → ชิปพรุ่งนี้ถูกเลือก · ชื่องาน "ใบงาน 7"', (await pressed()).includes('พรุ่งนี้') && (await page.locator('.qrow b').textContent()) === 'ใบงาน 7');
  await page.locator('.qchip', { hasText: /^ไทย$/ }).click();
  check('แตะชิปวิชาไทย → เปลี่ยนวิชา', (await pressed()).includes('ไทย'));
  await shot('02b-quick-add');
  await page.locator('#add-save').click(); await wait(400);
  const q7 = (await tasks()).find(t => t.title === 'ใบงาน 7');
  check('บันทึกด้วยปุ่มเดียว · วิชา/วันตามชิป', !!q7 && q7.due_date === '2026-11-17' && (await page.evaluate(id => window.__sabaii.state.subjects.find(s => s.id === id)?.name, q7.subject_id)) === 'ภาษาไทย');
  await page.evaluate(id => window.__sabaii.purgeTask(id), q7.id); await wait(200);

  // H: พิมพ์ค้างแล้วกดย้อนกลับ ต้องถามก่อนทิ้ง
  await page.locator('.tile', { hasText: 'พิมพ์' }).click();
  await page.fill('#add-text', 'ข้อความที่ยังไม่บันทึก');
  await page.goBack(); await wait(250);
  check('H กดย้อนกลับตอนพิมพ์ค้าง → ถามก่อนทิ้ง', await page.getByText('ทิ้งข้อความที่พิมพ์ไว้?').isVisible());
  await page.getByRole('button', { name: 'กลับไปแก้ต่อ' }).click();
  check('H เลือกแก้ต่อ → ข้อความยังอยู่', (await page.inputValue('#add-text')) === 'ข้อความที่ยังไม่บันทึก');
  await page.locator('.modal').getByRole('button', { name: 'ปิด' }).click();
  await page.getByRole('button', { name: 'ทิ้ง', exact: true }).click();
  await wait(400);
  check('H ยืนยันทิ้ง → กล่องปิด', (await page.locator('.modal').count()) === 0);

  // ถ่ายรูป → งานใหม่ที่มีรูปเป็นโน้ตแรก
  const jpg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 300, height: 400 } });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.tile', { hasText: 'ถ่ายรูป' }).click()]);
  await fc.setFiles({ name: 'board.jpg', mimeType: 'image/jpeg', buffer: jpg });
  await page.waitForSelector('.modal .preview');
  await page.fill('#add-text', 'ฟิสิกส์ แบบฝึกหัด 4.1 ข้อ 1-15 ส่งศุกร์ 8.00');
  check('ถ่ายรูป: แยกวิชา + เวลา 08:00 ที่พิมพ์มา', (await pressed()).includes('ฟิสิกส์') && /08:00/.test(await page.locator('.qrow small').textContent()));
  await page.locator('#add-save').click(); await wait(500);
  const phy = (await tasks()).find(t => /4\.1/.test(t.title));
  check('ถ่ายรูป: รูปเก็บเป็นโน้ตของงาน', (await page.evaluate(id => window.__sabaii.attachmentsOf(id).filter(a => a.kind === 'image' && a.blob).length, phy.id)) === 1);

  // ดึงแผ่นลง → โหมดโน้ต
  const g = await page.locator('.grab').boundingBox();
  await page.mouse.move(195, g.y + 6); await page.mouse.down(); await page.mouse.move(195, 780, { steps: 12 }); await page.mouse.up();
  await wait(600);
  let st = await ui();
  check('ดึงแผ่นลง → โหมดโน้ต ที่งานอันดับ 1', st.noteMode && st.cur === 0 && st.snapIdx === 0);
  check('โหมดโน้ต: เมนูล่างหลบ + ปุ่ม "ทำเลย"', (await page.locator('#nav.away').count()) === 1 && await page.locator('.pane-note .cta').isVisible());
  await page.locator('.pane-note .cta').click(); await wait(300);
  check('"ทำเลย" = เริ่มทำ (จับเวลา) ไม่ติ๊กเสร็จ', (await tasks()).filter(t => t.status === 'done').length === 0 && (await tasks()).filter(t => t.status === 'doing').length === 1 && await page.locator('.pane-note .timer').isVisible());
  await page.getByRole('button', { name: 'ข้อความ' }).click();
  await page.fill('#note-text', 'ครูบอกทำแค่ข้อคี่');
  await page.getByRole('button', { name: 'บันทึกโน้ต' }).click(); await wait(400);
  check('จดโน้ต → ขึ้นในชั้นโน้ต', await page.locator('.npage').first().locator('.nitem.sticky', { hasText: 'ครูบอกทำแค่ข้อคี่' }).isVisible());
  await shot('04-notes');
  await page.getByRole('button', { name: 'ทำเสร็จแล้ว' }).click(); await wait(300);
  check('ทำเสร็จแล้ว → เสร็จ + มีปุ่มเลิกทำ', (await tasks()).filter(t => t.status === 'done').length === 1 && await page.locator('#toast button', { hasText: 'เลิกทำ' }).isVisible());
  await page.locator('#toast button', { hasText: 'เลิกทำ' }).click(); await wait(300);
  check('เลิกทำ → กลับมาเป็นกำลังทำ', (await tasks()).filter(t => t.status === 'done').length === 0);
  // ปัดไปงานถัดไป
  await page.mouse.move(195, 250); await page.mouse.wheel(0, 300); await wait(900);
  st = await ui();
  check('ปัดขึ้น → งานที่ 2 · แผ่นล่างเปลี่ยนตาม', st.cur === 1 && (await page.locator('.pane-note h2').textContent()) !== '', await page.locator('.pane-note h2').textContent());
  // ย้อนกลับของเครื่อง = ออกจากโหมดโน้ต
  await page.goBack(); await wait(500);
  check('ปุ่มย้อนกลับของเครื่อง → แผ่นขึ้น เมนูล่างกลับมา', !(await ui()).noteMode && (await page.locator('#nav.away').count()) === 0);

  // C: ไมโครโฟนใช้ไม่ได้ → พิมพ์แทนได้
  await page.evaluate(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await page.locator('.tile', { hasText: 'พูด' }).click();
  check('C เสียงใช้ไม่ได้ → มีปุ่ม "พิมพ์แทน"', await page.getByRole('button', { name: 'พิมพ์แทน' }).isVisible());
  await page.getByRole('button', { name: 'พิมพ์แทน' }).click();
  check('C กดพิมพ์แทน → ช่องพิมพ์เปิด', await page.locator('#add-text').isVisible());
  await page.keyboard.press('Escape'); await wait(400);

  // ปักหมุด + ลบ/กู้คืน
  const eng = (await tasks()).find(t => /ศัพท์/.test(t.title));
  await page.evaluate(id => window.__ui.openNotes(id), eng.id); await wait(700);
  await page.getByRole('button', { name: 'แก้ไขงาน' }).click();
  await page.getByRole('button', { name: /ปักไว้บนสุด/ }).click(); await wait(400);
  await page.evaluate(() => window.__ui.setSnap(2)); await wait(400);
  check('ปักหมุด → ขึ้นบนสุดของงานแนะนำ', /ศัพท์/.test(await page.locator('.pane-home .trow b').first().textContent()));
  await page.evaluate(id => window.__ui.openNotes(id), eng.id); await wait(600);
  await page.getByRole('button', { name: 'แก้ไขงาน' }).click();
  await page.locator('.modal').getByRole('button', { name: 'ลบ', exact: true }).click();
  await page.getByRole('button', { name: 'ลบงาน' }).click(); await wait(300);
  check('ลบงาน → หายจากรายการ', !(await tasks()).some(t => t.id === eng.id));
  await page.locator('#toast button', { hasText: 'เลิกทำ' }).click(); await wait(300);
  check('เลิกทำ → งานกลับมา', (await tasks()).some(t => t.id === eng.id));
  await page.evaluate(() => window.__ui.setSnap(2)); await wait(300);

  // E: หน้างาน + ปฏิทิน
  await page.locator('#nav a[data-r="tasks"]').click();
  await page.waitForSelector('.cal');
  check('E ปฏิทินย่อ = 2 สัปดาห์ (14 วัน)', (await page.locator('.day').count()) === 14);
  check('การ์ดโปรเจกต์ต่อวิชา (5 วิชา)', (await page.locator('.proj:not(.new)').count()) === 5);
  await shot('05-tasks');
  await page.locator('.monthchip').click();
  const nDays = await page.locator('.day').count();
  check('E แตะชิปเดือน → ทั้งเดือน', [28, 35, 42].includes(nDays), String(nDays));
  const marked = () => page.locator('.day[aria-label*="งาน"]').count();
  const before = await marked();
  await page.getByRole('button', { name: 'เดือนถัดไป' }).click();
  await page.getByRole('button', { name: 'เดือนก่อนหน้า' }).click();
  check('E เปลี่ยนเดือนแล้วย้อนกลับ งานยังอยู่วันเดิม', before > 0 && (await marked()) === before, `${before} วัน`);
  const fri = (await tasks()).find(t => /หน้า 20/.test(t.title)).due_date;
  await page.locator(`.day:not(.out)`, { hasText: new RegExp(`^${+fri.slice(8)}$`) }).first().click();
  check('E แตะวัน → เห็นงานของวันนั้น', await page.locator('.daylist', { hasText: 'หน้า 20' }).isVisible());
  await shot('06-tasks-month');
  await page.locator('.proj', { hasText: 'ฟิสิกส์' }).click();
  await page.waitForSelector('#page .tcard');
  check('หน้าวิชาฟิสิกส์: ภาพย่อจากรูปที่ถ่าย', (await page.locator('.tcard .strip .mini').count()) === 1 && (await page.locator('.tcard .strip .mini .nitem.photo').count()) === 1);
  await shot('07-subject');
  await page.getByRole('button', { name: 'เปิดโน้ตเต็มจอ' }).click(); await wait(700);
  check('เปิดโน้ตเต็มจอ → หน้าแรกโหมดโน้ตที่งานนั้น', (await ui()).noteMode && /4\.1/.test(await page.locator('.pane-note h2').textContent()));
  await page.locator('.npage .nitem.photo .zoom').first().click({ force: true });
  check('แตะรูป → ดูเต็มจอ', await page.locator('.viewer').isVisible());
  await page.locator('.viewer').click();
  await page.locator('#note-back').click(); await wait(400);

  // หน้าฉัน
  await page.locator('#nav a[data-r="me"]').click();
  await page.waitForSelector('.stats');
  const stats = await page.locator('.stats b').allTextContents();
  check('หน้าฉันนับจากงานจริง (ค้าง 5 · ใกล้กำหนด 1 = ไทยพรุ่งนี้)', stats.slice(0, 2).join('/') === '5/1', stats.join('/'));
  await page.locator('.list-btn', { hasText: 'งานตัวอย่าง' }).click(); await wait(300);
  check('ใส่งานตัวอย่าง 6 งาน', (await tasks()).filter(t => t.source === 'sample').length === 6);
  await page.locator('.list-btn', { hasText: 'งานตัวอย่าง' }).click();
  await page.getByRole('button', { name: 'ลบงานตัวอย่าง' }).click(); await wait(300);
  check('ลบงานตัวอย่าง งานจริงยังอยู่', (await tasks()).filter(t => t.source === 'sample').length === 0 && (await tasks()).length === 5);
  await page.locator('.list-btn', { hasText: 'วิชาของฉัน' }).click();
  await page.getByRole('button', { name: 'ซ่อน สังคมศึกษา' }).click(); await wait(200);
  check('ซ่อนวิชาได้', (await page.evaluate(() => window.__sabaii.state.subjects.find(s => s.name === 'สังคมศึกษา').hidden)) === true);
  await page.keyboard.press('Escape'); await wait(300);
  await shot('08-me');

  // D: ออฟไลน์ เพิ่มงาน → เปิดใหม่ งานยังอยู่
  await page.locator('#nav a[data-r="home"]').click(); await wait(300);
  await ctx.setOffline(true);
  await typeAdd('เคมี ทำแลป ส่งพุธ');
  await page.locator('#add-save').click(); await wait(300);
  await ctx.setOffline(false);
  await page.reload(); await page.waitForSelector('.pane-home .trow');
  const n = (await tasks()).length;
  check('D เพิ่มตอนออฟไลน์ → เปิดใหม่งานยังอยู่ (6 งาน)', n === 6, String(n));
  check('D รูปยังอยู่หลังเปิดใหม่', (await page.evaluate(() => window.__sabaii.state.attachments.filter(a => a.kind === 'image' && a.blob).length)) === 1);

  // G: หลายขนาดจอ ไม่มีเลื่อนแนวนอน + ไม่มีคำ null/undefined หลุด
  for (const r of ['home', 'tasks', 'me']) {
    await page.goto(BASE + '#/' + r); await page.waitForSelector('.tiles'); await wait(250);
    for (const w of [320, 360, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 812 }); await wait(60);
      const over = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('page').scrollWidth, document.getElementById('pane-home').scrollWidth) - Math.min(window.innerWidth, document.getElementById('page').clientWidth || window.innerWidth));
      if (over > 0) check(`G ${r} กว้าง ${w}px ไม่มีเลื่อนแนวนอน`, false, `${over}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const txt = await page.evaluate(r => (r === 'home' ? document.getElementById('pane-home') : document.getElementById('page')).innerText, r);
    check(`G หน้า ${r}: ทุกขนาดจอไม่ล้น · ไม่มี false/null/undefined/NaN หลุด`, !results.some(x => !x.ok && x.name.startsWith(`G ${r} `)) && !/\b(false|null|undefined|NaN)\b/.test(txt));
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE + '#/home'); await page.waitForSelector('.tiles'); await wait(300);
  await shot('09-home-375');

  // นิ้ว (จอสัมผัสจริงผ่าน CDP): แผ่นตามนิ้ว · แตะเฉย ๆ ไม่ขยับ · ดันขึ้นสุดชิดขอบจอบน · เต็มจอแล้วดึงลงจากรายการได้
  {
    const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
    if (!REAL) await tctx.route('http://sabaii.test/**', r => { let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname)); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push('touch: ' + e.message));
    await tp.goto(BASE + '#/home'); await tp.waitForSelector('.tiles');
    await tp.evaluate(() => window.__sabaii.addSamples()); await wait(500);
    check('งานแนะนำไม่เกิน 3 งาน (มี 6 งาน) · ใต้รายการเว้นว่าง', (await tp.locator('.pane-home .trow').count()) === 3 && (await tp.locator('.pane-home a.more, .pane-home p.muted.center').count()) === 0);
    check('ชั้นโน้ตมีแค่ 3 งานเดียวกัน', (await tp.evaluate(() => window.__ui.homeState().pages.length)) === 3);
    await tp.fill('#home-q', 'ขุนช้าง');
    check('ค้นหา → เจองานที่อยู่นอก 3 อันดับได้', (await tp.locator('.pane-home .trow').count()) === 1 && await tp.getByText('ผลการค้นหา').isVisible());
    await tp.fill('#home-q', ''); await tp.locator('#home-q').blur();
    const late = await tp.evaluate(() => window.__sabaii.state.tasks.find(t => /ขุนช้าง/.test(t.title)).id);
    await tp.evaluate(id => window.__ui.openNotes(id), late); await wait(600);
    check('เปิดโน้ตงานนอก 3 อันดับ (จากหน้าวิชา) → เปิดได้ แล้วกลับหน้าแรกหายไป', /ขุนช้าง/.test(await tp.locator('.pane-note h2').textContent()) && await tp.evaluate(() => { window.__ui.setSnap(2); return window.__ui.homeState().pages.length; }) === 3);
    await wait(400);
    const cdp = await tctx.newCDPSession(tp);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const sheetTop = () => tp.evaluate(() => Math.round(document.getElementById('sheet').getBoundingClientRect().top));
    const tst = () => tp.evaluate(() => window.__ui.homeState());
    const swipe = async (x, y0, y1, { steps = 14, mid } = {}) => {
      await touch('touchStart', x, y0);
      for (let i = 1; i <= steps; i++) { await touch('touchMove', x, y0 + (y1 - y0) * i / steps); await wait(16); if (mid && i === Math.floor(steps / 2)) await mid(y0 + (y1 - y0) * i / steps); }
      await touch('touchEnd'); await wait(500);
    };
    const g0 = await tp.locator('.grab').boundingBox();
    await touch('touchStart', 195, g0.y + 8); await touch('touchEnd'); await wait(400);
    check('นิ้ว: แตะที่จับเฉย ๆ แผ่นไม่ขยับ (ต้องลาก)', (await tst()).snapIdx === 2);
    let follow = null;
    await swipe(195, g0.y + 8, 820, { mid: async y => { follow = [Math.round(y), await sheetTop()]; } });
    check('นิ้ว: ลากที่จับลง แผ่นตามนิ้วระหว่างลาก', follow && Math.abs(follow[1] - (follow[0] - 8)) <= 12, follow?.join(' → '));
    check('นิ้ว: ลากลงสุด → โหมดโน้ต', (await tst()).noteMode);
    await tp.screenshot({ path: SHOTS ? `${SHOTS}/10-touch-notes.png` : '/dev/null' }).catch(() => {});
    const cta = await tp.locator('.pane-note .cta').boundingBox();
    await swipe(195, cta.y + 20, 4, { steps: 18 });
    const top = await sheetTop();
    check('นิ้ว: ดันการ์ดขึ้น (เริ่มบนปุ่ม "ทำเลย") → ชิดขอบจอบน', (await tst()).snapIdx === 2 && top === 0, `top=${top}`);
    check('นิ้ว: ลากผ่านปุ่มแล้ว ปุ่มไม่ถูกกด', (await tp.evaluate(() => window.__sabaii.state.tasks.filter(t => t.status === 'doing').length)) === 0);
    await tp.screenshot({ path: SHOTS ? `${SHOTS}/11-touch-top.png` : '/dev/null' }).catch(() => {});
    await swipe(195, 330, 700);
    check('นิ้ว: เต็มจอแล้วดึงลงจากรายการ (อยู่บนสุด) → แผ่นลงตามนิ้ว', (await tst()).snapIdx < 2, `snap=${(await tst()).snapIdx}`);
    await tctx.close();
  }

  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\nรวม ${results.length - fail}/${results.length} ผ่าน`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
