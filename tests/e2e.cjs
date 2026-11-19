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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); // กล้องปลอม (ภาพทดสอบ ไม่มีมือ) สำหรับโหมดโบกมือ
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
  // 0.5: ครั้งแรกมีแบบสอบถามก่อนเข้าแอป — ข้ามได้ (เทสต์ส่วนใหญ่ใช้ค่าตั้งต้น · ทดสอบแบบสอบถามเต็มท้ายไฟล์)
  check('0.5 ครั้งแรก: มีแบบสอบถามก่อนเข้าแอป + ปุ่มข้าม', await page.locator('#onboard').isVisible() && await page.locator('#ob-skip').isVisible());
  await page.locator('#ob-skip').click(); await wait(400);
  check('0.5 ข้ามแล้ว: เข้าแอปได้ · หน้าโน้ตใช้แบบ 1', (await page.locator('#onboard').count()) === 0 && await page.evaluate(() => window.__sabaii.state.prefs.onboarded === true && document.body.classList.contains('ns-1')));
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
  await wait(300);
  check('C เสียงใช้ไม่ได้ → หน้าพูดยังเปิด บอกว่าฟังไม่ได้ ให้พิมพ์/วางแทน', /ฟังเสียงไม่ได้.*พิมพ์หรือวาง/.test(await page.locator('.lstatus').textContent()) && await page.locator('#listen-toggle').isHidden());
  await page.fill('#add-text', 'การบ้านนะ แบบฝึก 2.1 ส่งพรุ่งนี้ แล้วก็อ่านหน้า 10 ถึง 12');
  await page.locator('.lmode button', { hasText: 'ครูกำลังสั่งงาน' }).click(); await wait(200);
  check('C พิมพ์/วางสิ่งที่ครูพูดแทน → แยกงานได้เหมือนกัน (2 งาน)', (await page.locator('.lrow').count()) === 2);
  await page.locator('.lmode button', { hasText: 'ฉันพูดเอง' }).click(); await wait(100);
  await page.fill('#add-text', '');
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
  await page.mouse.move(195, 300); await page.mouse.wheel(0, -2000); await wait(400); // หน้าฉันยาว เลื่อนลงแล้วเมนูล่างหลบ → เลื่อนกลับขึ้นก่อน
  await page.locator('#nav a[data-r="home"]').click(); await wait(300);
  await ctx.setOffline(true);
  await typeAdd('เคมี ทำแลป ส่งพุธ');
  await page.locator('#add-save').click(); await wait(300);
  await ctx.setOffline(false);
  await page.reload(); await page.waitForSelector('.pane-home .trow');
  const n = (await tasks()).length;
  check('D เพิ่มตอนออฟไลน์ → เปิดใหม่งานยังอยู่ (6 งาน)', n === 6, String(n));
  check('0.5 เปิดใหม่ไม่ถามแบบสอบถามซ้ำ', (await page.locator('#onboard').count()) === 0);
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

  // ธีมสว่างอย่างเดียว: เครื่องตั้งโหมดมืด หรือเคยเลือกธีมมืดไว้ ก็ยังสว่าง · ไม่มีเมนูธีมสี
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => window.__sabaii.setPref('theme', 'dark'));
  await page.goto(BASE + '#/me'); await page.waitForSelector('.stats'); await wait(200);
  const bg = await page.evaluate(() => getComputedStyle(document.getElementById('page')).backgroundColor);
  check('ธีมสว่างอย่างเดียว (เครื่องโหมดมืด + เคยเลือกมืด → ยังพื้นขาว) · ไม่มีเมนูธีมสี', bg === 'rgb(255, 255, 255)' && (await page.locator('.list-btn', { hasText: 'ธีมสี' }).count()) === 0, bg);
  await page.emulateMedia({ colorScheme: 'light' });

  // นิ้ว (จอสัมผัสจริงผ่าน CDP): แผ่นตามนิ้ว · แตะเฉย ๆ ไม่ขยับ · ดันขึ้นสุดชิดขอบจอบน · เต็มจอแล้วดึงลงจากรายการได้
  {
    const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
    if (!REAL) await tctx.route('http://sabaii.test/**', r => { let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname)); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const tp = await tctx.newPage();
    tp.on('pageerror', e => errors.push('touch: ' + e.message));
    await tp.goto(BASE + '#/home'); await tp.waitForSelector('.tiles');
    await tp.locator('#ob-skip').click(); await wait(300);
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

  // 0.4.2: หน้าฉัน — ดึงงานอัตโนมัติ (ยังไม่เปิด) + ปุ่มพูดเริ่มที่โหมดไหน
  await page.keyboard.press('Escape'); await wait(300);
  await page.evaluate(() => { location.hash = '#/me'; }); await wait(500);
  check('ฉัน: มีหมวด "ดึงงานอัตโนมัติ" (Classroom · ห้องเรียน ยังไม่เปิด)', await page.getByText('ดึงงานอัตโนมัติ').isVisible()
    && (await page.locator('.list-btn', { hasText: 'Google Classroom' }).textContent()).includes('ยังไม่เปิด')
    && (await page.locator('.list-btn', { hasText: 'ห้องเรียน' }).textContent()).includes('ยังไม่เปิด'));
  await page.locator('.list-btn', { hasText: 'Google Classroom' }).click(); await wait(300);
  check('ฉัน: แตะ Classroom → บอกว่ายังไม่เปิด ต้องมีบัญชี', await page.getByText(/ต้องมีบัญชีและเซิร์ฟเวอร์/).isVisible());
  await page.keyboard.press('Escape'); await wait(400);
  const listenRow = page.locator('.list-btn', { hasText: 'ปุ่มพูด เริ่มที่' });
  const modeBefore = await listenRow.textContent();
  await listenRow.click(); await wait(400);
  check('ฉัน: ปุ่มพูดเริ่มที่ ฉันพูดเอง → ครูกำลังสั่งงาน', modeBefore.includes('ฉันพูดเอง') && (await listenRow.textContent()).includes('ครูกำลังสั่งงาน'));

  // 0.4.2: ฟังครู — เสียงปลอม: รอบแรกพูดแล้วเบราว์เซอร์ตัดเอง (เงียบ) · รอบต่อไปรอจนกดหยุด
  await page.evaluate(() => {
    window.__fakeSR = { starts: 0 };
    const Fake = class {
      start() {
        const n = ++window.__fakeSR.starts;
        if (n === 1) {
          const text = 'โอเค วันนี้พอแค่นี้ การบ้านนะ แบบฝึกหัด 4.3 ข้อ 1 ถึง 15 ไม่ต้องทำข้อ 9 นะ ส่งวันศุกร์ก่อนแปดโมง แล้วก็อาทิตย์หน้าสอบย่อยบทที่ 4 วันอังคาร ออกเรื่องโพรเจกไทล์กับวงกลม 10 คะแนน';
          setTimeout(() => this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] }), 60);
          setTimeout(() => this.onend?.(), 160);
        }
      }
      stop() { setTimeout(() => this.onend?.(), 10); }
      abort() { setTimeout(() => this.onend?.(), 10); }
    };
    for (const k of ['SpeechRecognition', 'webkitSpeechRecognition']) Object.defineProperty(window, k, { value: Fake, configurable: true, writable: true });
  });
  await page.evaluate(() => { location.hash = '#/home'; }); await wait(600);
  check('หน้าแรก: ปุ่มพูดเขียนว่า "พูดเอง หรือฟังครู"', (await page.locator('.tile', { hasText: 'พูด' }).textContent()).includes('พูดเอง หรือฟังครู'));
  await page.locator('.tile', { hasText: 'พูด' }).click(); await wait(900);
  check('ฟังครู: เปิดมาที่โหมดที่ตั้งไว้ · เบราว์เซอร์ตัดแล้วฟังต่อเอง', (await page.locator('.lmode [aria-pressed="true"]').textContent()) === 'ครูกำลังสั่งงาน'
    && (await page.evaluate(() => window.__fakeSR.starts)) >= 2 && (await page.locator('.lstatus').textContent()).includes('กำลังฟัง'));
  check('ฟังครู: แยกได้ 2 งาน · โชว์คำที่ครูพูด', (await page.locator('.lrow').count()) === 2 && (await page.locator('.lquote').first().textContent()).includes('ไม่ต้องทำข้อ 9'));
  await shot('12-listen-teacher');
  await page.locator('.qchips .qchip').first().click(); await wait(200);
  const cls = await page.locator('.qchips .qchip[aria-pressed="true"]').textContent();
  await page.locator('#add-save').click(); await wait(700);
  const tt = (await tasks()).filter(t => t.source === 'teacher');
  const att = await page.evaluate(ids => window.__sabaii.state.attachments.filter(a => ids.includes(a.task_id) && a.kind === 'text').map(a => a.text), tt.map(t => t.id));
  const hw = tt.find(t => /4\.3/.test(t.title)), ex = tt.find(t => t.type === 'exam');
  check('ฟังครู: บันทึก 2 งาน วัน/เวลาถูก · วิชาของคาบใช้กับทุกงาน', tt.length === 2 && hw?.due_date === '2026-11-20' && hw?.due_time === '08:00' && ex?.due_date === '2026-11-24'
    && tt.every(t => t.subject_id && t.subject_id === tt[0].subject_id), `${cls} · ${tt.map(t => `${t.title}/${t.due_date}`).join(' | ')}`);
  check('ฟังครู: ทุกงานมีโน้ต "ครูพูด" เก็บประโยคจริง', att.length === 2 && att.every(a => a.startsWith('ครูพูด')) && att.some(a => a.includes('ไม่ต้องทำข้อ 9')));
  check('ฟังครู: ปิดแล้วหยุดฟัง (ไม่ฟังค้าง)', await page.evaluate(() => { const n = window.__fakeSR.starts; return new Promise(r => setTimeout(() => r(window.__fakeSR.starts === n), 600)); }));
  await page.fill('#home-q', 'แบบฝึกหัด 4.3'); await wait(300);
  check('หน้าแรก: งานจากฟังครูมีป้าย "ฟังครู"', (await page.locator('.pane-home .trow .tag.teach').count()) >= 1);
  await page.fill('#home-q', ''); await wait(200);

  // 0.5: แบบสอบถามเต็ม (เครื่องใหม่) → ค่าที่ตอบลงข้อมูลจริงของแอป · หน้าโน้ต 6 แบบ
  {
    const octx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block' });
    await octx.clock.setFixedTime(new Date('2026-11-16T09:40:00Z'));
    if (!REAL) await octx.route('http://sabaii.test/**', r => { let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname)); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const op = await octx.newPage();
    op.on('pageerror', e => errors.push('onboard: ' + e.message));
    await op.goto(BASE + '#/home'); await op.waitForSelector('#onboard'); await wait(400);
    const nextBtn = op.locator('#ob-next');
    await nextBtn.click(); await wait(350);
    await op.fill('#ob-name', 'มิ้นท์'); await op.press('#ob-name', 'Enter'); await wait(350);
    await op.locator('.ob-chip', { hasText: 'เคมี' }).click();
    await op.locator('.ob-addbtn').click(); await op.fill('#ob-newsubj', 'ประวัติศาสตร์'); await op.press('#ob-newsubj', 'Enter'); await wait(200);
    check('แบบสอบถาม: เพิ่มวิชาเองได้ · เลือกแล้ว 8 วิชา', (await op.locator('.ob-chip[aria-pressed="true"]').count()) === 8 && (await nextBtn.textContent()) === 'ต่อไป · 8 วิชา');
    await nextBtn.click(); await wait(350);
    check('แบบสอบถาม: ต้องเลือกก่อนถึงไปต่อได้', await nextBtn.isDisabled());
    await op.locator('.ob-opt', { hasText: 'ครูพูดในห้อง' }).click(); await nextBtn.click(); await wait(450);
    await op.locator('.ob-style').nth(4).click(); await wait(700);
    check('แบบสอบถาม: เลือกหน้าโน้ตจากภาพตัวอย่าง 6 แบบ', (await op.locator('.ob-style').count()) === 6 && (await nextBtn.textContent()) === 'ใช้แบบ "สีวิชาเต็มหัว"'
      && await op.locator('.ob-style img').first().evaluate(i => i.complete && i.naturalWidth > 0));
    await nextBtn.click(); await wait(350);
    await op.locator('.ob-opt', { hasText: 'ใส่งานตัวอย่าง' }).click(); await nextBtn.click(); await wait(350);
    check('แบบสอบถาม: หน้าสรุปก่อนเข้าแอป (ภาพหน้าโน้ตที่เลือก + วิชา)', /พร้อมแล้ว มิ้นท์/.test(await op.locator('.ob-q').textContent()) && (await op.locator('.ob-fchip').count()) === 6
      && /ns-5\.jpg$/.test(await op.locator('.ob-phone img').getAttribute('src')));
    await nextBtn.click(); await wait(700);
    const got = await op.evaluate(() => { const s = window.__sabaii.state; return { p: s.prefs, hidden: s.subjects.filter(x => x.hidden).map(x => x.name), extra: s.subjects.some(x => x.name === 'ประวัติศาสตร์' && !x.hidden), samples: s.tasks.filter(t => t.source === 'sample').length, ns5: document.body.classList.contains('ns-5') }; });
    check('แบบสอบถาม: คำตอบลงข้อมูลจริง (ชื่อ · ซ่อนวิชา · ปุ่มพูด · หน้าโน้ต · งานตัวอย่าง)', got.p.display_name === 'มิ้นท์' && got.hidden.join() === 'เคมี' && got.extra
      && got.p.listen_mode === 'teacher' && got.p.note_style === 5 && got.ns5 && got.samples === 6 && got.p.onboarded === true, JSON.stringify(got));
    // แบบ 5: แตะปุ่มปัดเฉย ๆ ไม่เริ่ม · ปัดขวาจึงเริ่ม
    await op.evaluate(() => window.__ui.setSnap(0)); await wait(700);
    const doing = () => op.evaluate(() => window.__sabaii.state.tasks.filter(t => t.status === 'doing').length);
    await op.locator('.pane-note .cta.slide').click(); await wait(300);
    const tapDoing = await doing();
    const th = await op.locator('.cta.slide .th').boundingBox();
    await op.mouse.move(th.x + 20, th.y + 20); await op.mouse.down();
    for (let i = 1; i <= 10; i++) { await op.mouse.move(th.x + 20 + i * 32, th.y + 20); await wait(16); }
    await op.mouse.up(); await wait(600);
    check('แบบ 5: แตะเฉย ๆ ไม่เริ่ม (กันกดพลาด) · ปัดขวาแล้วเริ่มจับเวลา', tapDoing === 0 && (await doing()) === 1 && await op.locator('.pane-note .timer').isVisible());
    // ทุกแบบ: ชื่องาน + ปุ่มอยู่ในแผ่นล่างครบ ไม่ล้น (จอ 320 และ 390)
    const bad = [];
    for (const w of [320, 390]) {
      await op.setViewportSize({ width: w, height: w === 320 ? 640 : 844 }); await wait(200);
      for (let v = 1; v <= 6; v++) {
        await op.evaluate(v => window.__sabaii.setPref('note_style', v), v); await op.evaluate(() => window.__ui.setSnap(0)); await wait(450);
        const r = await op.evaluate(() => { const sh = document.getElementById('sheet').getBoundingClientRect(), pn = document.getElementById('pane-note');
          const out = [...pn.querySelectorAll('button, h2')].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.bottom > sh.bottom - 2 || b.right > sh.right + 1 || b.left < sh.left - 1); }).length;
          return { out, h2: pn.querySelector('h2')?.textContent || '', over: document.documentElement.scrollWidth - innerWidth }; });
        if (r.out || !r.h2 || r.over > 0) bad.push(`${w}px แบบ ${v}: ${JSON.stringify(r)}`);
      }
    }
    check('หน้าโน้ต 6 แบบ: ชื่องานและปุ่มอยู่ในแผ่นครบทุกแบบ (จอ 320 และ 390)', bad.length === 0, bad.join(' | '));
    await op.setViewportSize({ width: 390, height: 844 });
    // หน้าฉัน: เปลี่ยนหน้าโน้ตได้ · ทำแบบสอบถามใหม่ได้ (ค่าเดิมเติมไว้ให้)
    await op.evaluate(() => window.__ui.setSnap(2)); await wait(500);
    await op.evaluate(() => { location.hash = '#/me'; }); await wait(500);
    await op.locator('.list-btn', { hasText: 'หน้าโน้ตงาน' }).click(); await wait(400);
    await op.locator('.stylepick', { hasText: 'การ์ดลอย' }).click(); await wait(400);
    check('ฉัน: เปลี่ยนหน้าโน้ตเป็น "การ์ดลอย"', await op.evaluate(() => window.__sabaii.state.prefs.note_style === 6 && document.body.classList.contains('ns-6')));
    await op.locator('.list-btn', { hasText: 'ตอบแบบสอบถามเริ่มต้นใหม่' }).click(); await wait(400);
    await op.locator('#ob-next').click(); await wait(350);
    check('ฉัน: ทำแบบสอบถามใหม่ → ชื่อเดิมเติมไว้ · ข้าม = ไม่เปลี่ยนอะไร', (await op.inputValue('#ob-name')) === 'มิ้นท์'
      && await op.locator('#ob-skip').click().then(() => wait(400)).then(() => op.evaluate(() => !document.getElementById('onboard') && window.__sabaii.state.prefs.note_style === 6)));
    await octx.close();
  }

  // 0.7: โหมดโบกมือ — โมเดลจริงจาก assets/vendor + กล้องปลอม · กล้องต้องใช้ https จึงเสิร์ฟผ่าน https://sabaii-hand.test
  {
    const hctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'th-TH', timezoneId: 'Asia/Bangkok', serviceWorkers: 'block', permissions: ['camera'] });
    await hctx.route('https://sabaii-hand.test/**', r => { let f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname)); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const hp = await hctx.newPage();
    hp.on('pageerror', e => errors.push('hand: ' + e.message));
    hp.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push('hand: ' + m.text()); });
    await hp.goto('https://sabaii-hand.test/#/home'); await hp.waitForSelector('#onboard'); await hp.click('#ob-skip'); await wait(300);
    await hp.evaluate(async () => { await window.__sabaii.addSamples(); const s = window.__sabaii; const id = s.state.tasks.find(t => t.title.startsWith('แบบฝึกหัดบทที่ 3')).id; await s.addAttachment(id, { kind: 'text', text: 'โน้ตที่สอง' }); }); await wait(400);
    const handOpacity = () => hp.evaluate(() => +getComputedStyle(document.getElementById('note-hand')).opacity);
    const hiddenAtHome = (await handOpacity()) === 0;
    await hp.evaluate(() => window.__ui.setSnap(0)); await wait(700);
    check('โบกมือ: ปุ่มมือโผล่เฉพาะตอนดูโน้ต', hiddenAtHome && (await handOpacity()) === 1);
    await hp.locator('#note-hand').click();
    const st = await hp.waitForSelector('.hf[data-state="ready"], .hf[data-state="unsupported"], .hf[data-state="denied"]', { timeout: 90000 }).then(e => e.getAttribute('data-state')).catch(() => 'timeout');
    check('โบกมือ: เปิดกล้อง + โหลดตัวตามมือจากเว็บเราเองได้ (พร้อม)', st === 'ready' && await hp.evaluate(() => !!document.querySelector('.hf video').srcObject?.active), st);
    const cur = () => hp.evaluate(() => window.__ui.homeState().cur);
    const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(150); } return false; };
    await hp.evaluate(() => window.__ui.handSwipe('up'));
    const up = await until(async () => (await cur()) === 1);
    await hp.evaluate(() => window.__ui.handSwipe('down'));
    const down = await until(async () => (await cur()) === 0 && await hp.evaluate(() => document.getElementById('stage').scrollTop) < 2, 10000);
    const left0 = await hp.evaluate(() => document.querySelector('#stage .npage .nrow').scrollLeft);
    await hp.evaluate(() => window.__ui.handSwipe('left'));
    const left = await until(() => hp.evaluate(l => document.querySelector('#stage .npage .nrow').scrollLeft > l + 50, left0));
    check('โบกมือ: ขึ้น = งานถัดไป · ลง = งานก่อนหน้า · ซ้าย = โน้ตถัดไป', up && down && left, `${up} ${down} ${left}`);
    await hp.evaluate(() => window.__ui.setSnap(2)); await wait(500);
    check('โบกมือ: ออกจากหน้าโน้ต = กล้องดับ', await hp.evaluate(() => !document.querySelector('.hf') && !document.body.classList.contains('hf-on')));
    // หน้าแนะนำ: ปุ่มโบกมือ → ตัวตามมือพร้อม → ปิดได้
    await hp.goto('https://sabaii-hand.test/landing.html'); await wait(800);
    await hp.locator('.handbtn').click();
    const ls = await hp.waitForSelector('.hb[data-state="ready"], .hb[data-state="unsupported"], .hb[data-state="denied"]', { timeout: 90000 }).then(e => e.getAttribute('data-state')).catch(() => 'timeout');
    await hp.locator('.handbtn').click(); await wait(400);
    check('หน้าแนะนำ: ปุ่มโบกมือเปิดกล้อง พร้อมใช้ แล้วปิดได้', ls === 'ready' && await hp.evaluate(() => !document.querySelector('.hb')), ls);
    await hctx.close();
  }

  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\nรวม ${results.length - fail}/${results.length} ผ่าน`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
