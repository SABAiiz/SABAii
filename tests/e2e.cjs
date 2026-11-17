// ทดสอบในเบราว์เซอร์จริง (Playwright/Chromium) — ต้องเปิดเซิร์ฟเวอร์ก่อน:
//   cd sabaii && python3 -m http.server 8765
//   node tests/e2e.cjs [โฟลเดอร์เก็บภาพ]
// ครอบคลุมสเปกข้อ 15: A เพิ่มงาน · B หลายงาน · C ไมค์ไม่ได้ · D ออฟไลน์/เปิดใหม่ · E ปฏิทิน · G หลายขนาดจอ · H แผ่นล่าง
const { chromium } = require('playwright');
const BASE = process.env.SABAII_URL || 'http://localhost:8765/';
const SHOTS = process.argv[2] || null;
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'ผ่าน' : 'ตก  '}  ${name}${extra ? '  — ' + extra : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  await ctx.clock.setFixedTime(new Date('2026-11-16T09:40:00Z')); // จ. 16 พ.ย. 69 16:40 เวลาไทย — ตรึงวัน เทสต์จะได้ไม่เปลี่ยนผลตามวันที่รัน
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '#/home');
  await page.waitForSelector('.qgrid2');
  const shot = async n => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });

  // หน้าแรกว่าง
  check('หน้าแรกว่างมีข้อความ "วันนี้ยังไม่มีงานที่ต้องทำ" + ปุ่มเพิ่ม', await page.getByText('วันนี้ยังไม่มีงานที่ต้องทำ').isVisible() && await page.getByRole('button', { name: '+ เพิ่มงานใหม่' }).isVisible());
  check('ปุ่มเพิ่มงานครบ 4 ปุ่มตามภาพวาด', (await page.locator('.qgrid2 .qb b').allTextContents()).join(',') === 'พูด,แนบรูป,พิมพ์,ถ่ายรูป');
  await shot('01-home-empty');

  // A: พิมพ์งานเดียว
  await page.getByRole('button', { name: /พิมพ์/ }).first().click();
  await page.fill('#add-text', 'คณิตทำแบบฝึกหัดหน้า 20 ส่งวันศุกร์');
  await page.getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
  const subj = await page.locator('#d0-subj option:checked').textContent();
  const time = await page.inputValue('#d0-time');
  check('A แยกวิชา "คณิตศาสตร์" ได้', subj === 'คณิตศาสตร์', subj);
  check('A ไม่ระบุเวลา → ช่องเวลาว่าง และบอกผู้ใช้', time === '' && await page.getByText('ไม่ได้ระบุเวลา — ระบบจะไม่เดาเวลาให้').isVisible());
  await shot('02-review-single');
  await page.getByRole('button', { name: 'บันทึกงาน' }).click();
  await page.waitForSelector('.tlist .trow');
  check('A งานโผล่ในหน้าแรก', (await page.locator('.tlist .trow').count()) === 1);

  // B: หลายงาน + กันบันทึกซ้ำ
  await page.getByRole('button', { name: /พิมพ์/ }).first().click();
  await page.fill('#add-text', 'ไทย ทำใบงานบทที่ 2 ส่งพรุ่งนี้\nอังกฤษ ท่องศัพท์วันศุกร์\nวิทย์ ทำรายงานส่งสัปดาห์หน้า');
  await page.getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
  check('B แยกได้ 3 งาน', (await page.locator('.draft').count()) === 3);
  await shot('03-review-multi');
  const save = page.getByRole('button', { name: 'บันทึก 3 งาน' });
  await save.click();
  await page.waitForTimeout(400);
  check('B บันทึกครบ ไม่ซ้ำ (รวม 4 งาน)', (await page.evaluate(() => window.__sabaii.state.tasks.length)) === 4);
  await shot('04-home-list');

  // H: แผ่นล่าง — พิมพ์ค้างแล้วกดย้อนกลับ ต้องถามก่อนทิ้ง
  await page.getByRole('button', { name: /พิมพ์/ }).first().click();
  await page.fill('#add-text', 'ข้อความที่ยังไม่บันทึก');
  await page.goBack();
  await page.waitForTimeout(200);
  check('H กดย้อนกลับตอนพิมพ์ค้าง → ถามก่อนทิ้ง', await page.getByText('ทิ้งข้อความที่พิมพ์ไว้?').isVisible());
  await page.getByRole('button', { name: 'กลับไปแก้ต่อ' }).click();
  check('H เลือกแก้ต่อ → ข้อความยังอยู่', (await page.inputValue('#add-text')) === 'ข้อความที่ยังไม่บันทึก');
  await page.getByRole('button', { name: 'ปิด' }).click();
  await page.getByRole('button', { name: 'ทิ้ง' }).click();
  await page.waitForTimeout(350);
  check('H ยืนยันทิ้ง → แผ่นปิด', (await page.locator('.sheet').count()) === 0);

  // รายละเอียด: ทำเลย ไม่ติ๊กเสร็จทันที
  await page.locator('.tlist .trow .go').first().click();
  await page.waitForSelector('.sheet.open');
  check('"ทำเลย" เปิดรายละเอียด ไม่ได้ติ๊กเสร็จ', (await page.evaluate(() => window.__sabaii.state.tasks.filter(t => t.status === 'done').length)) === 0);
  await page.locator('.sheet .sbody').getByRole('button', { name: '+ ข้อความ' }).click();
  await page.locator('.sheet textarea').fill('ครูบอกทำแค่ข้อคี่');
  await page.getByRole('button', { name: 'บันทึกโน้ต' }).click();
  await page.waitForSelector('.note.text');
  await shot('05-detail');
  await page.getByRole('button', { name: 'ทำเสร็จแล้ว' }).click();
  await page.waitForTimeout(200);
  check('ทำเสร็จแล้ว → สถานะเสร็จ + มีปุ่มเลิกทำ', (await page.evaluate(() => window.__sabaii.state.tasks.filter(t => t.status === 'done').length)) === 1 && await page.locator('.toast button', { hasText: 'เลิกทำ' }).isVisible());
  await page.locator('.toast button', { hasText: 'เลิกทำ' }).click();
  await page.waitForTimeout(200);
  check('เลิกทำ → กลับเป็นยังไม่เสร็จ', (await page.evaluate(() => window.__sabaii.state.tasks.filter(t => t.status === 'done').length)) === 0);
  await page.getByRole('button', { name: 'ปิด' }).click();
  await page.waitForTimeout(300);

  // หน้าเลื่อน: ลากที่จับลงตามนิ้ว (ไม่ต้องกด) → แถบ "จะเริ่มงานไหน?" + โน้ตหน้างาน · ลากขึ้นถึงขอบบนได้
  const drag = async (dy) => {
    const g = await page.locator('.hsheet .grip').boundingBox();
    const x = g.x + g.width / 2, y0 = g.y + g.height / 2;
    const y1 = Math.max(4, Math.min(page.viewportSize().height - 4, y0 + dy)); // ห้ามลากออกนอกจอ
    await page.mouse.move(x, y0);
    await page.mouse.down();
    for (let i = 1; i <= 15; i++) { await page.mouse.move(x, y0 + (y1 - y0) * i / 15); await page.waitForTimeout(25); }
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  await page.locator('.hsheet .grip').click();
  check('แตะที่จับเฉย ๆ ไม่ทำอะไร (ต้องลาก)', (await page.locator('.home').getAttribute('data-snap')) === 'mid');
  await drag(600);
  check('ลากลง → แผ่นลงล่าง มีแถบ "จะเริ่มงานไหน?" และ "อื่นๆ"', (await page.locator('.home').getAttribute('data-snap')) === 'bottom' && await page.getByRole('button', { name: 'จะเริ่มงานไหน?' }).isVisible() && await page.getByRole('button', { name: 'อื่นๆ' }).isVisible());
  check('ลากลง → เห็นโน้ตหน้างานของงานอันดับ 1', await page.locator('.peek .stick', { hasText: 'ครูบอกทำแค่ข้อคี่' }).isVisible());
  await shot('05b-pulldown');
  await page.getByRole('button', { name: 'งานถัดไป' }).click();
  check('กดงานถัดไป → เลื่อนไปงานที่ 2', await page.getByText(/งานที่ 2 จาก/).isVisible());
  await drag(-900);
  const top = (await page.locator('.hsheet').boundingBox()).y;
  check('ลากขึ้น → แผ่นขึ้นถึงขอบบน', (await page.locator('.home').getAttribute('data-snap')) === 'top' && top <= 2, `y=${top}`);
  await shot('05c-top');
  await drag(250);
  check('ลากลงนิดหน่อย → กลับจุดกลาง', (await page.locator('.home').getAttribute('data-snap')) === 'mid');

  // C: ไมโครโฟนไม่รองรับ/ไม่อนุญาต → ยังพิมพ์ได้
  await page.evaluate(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await page.getByRole('button', { name: /พูด/ }).first().click();
  check('C เสียงใช้ไม่ได้ → มีทางพิมพ์แทน', await page.getByRole('button', { name: 'พิมพ์แทน' }).isVisible());
  await page.getByRole('button', { name: 'ปิด' }).click();
  await page.waitForTimeout(300);

  // หน้างาน + ปฏิทิน (E)
  await page.click('a[data-route=tasks]');
  await page.waitForSelector('.drawers');
  check('หน้างานเริ่มที่ลิ้นชักวิชา', (await page.locator('.drawer').count()) >= 4);
  await shot('06-tasks-subjects');
  await page.locator('.calbtn').click();
  await page.waitForSelector('.cal');
  await shot('07-tasks-calendar');
  await page.getByRole('button', { name: 'ดูทั้งเดือน' }).click();
  const fri = await page.evaluate(() => window.__sabaii.state.tasks.find(t => /แบบฝึกหัดหน้า 20/.test(t.title)).due_date);
  const hasMark = async () => page.locator(`.cal .d[aria-label*="งาน"]`).count();
  const before = await hasMark();
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByRole('button', { name: 'ก่อนหน้า' }).click();
  check('E เปลี่ยนเดือนแล้วย้อนกลับ งานยังอยู่วันเดิม', before > 0 && (await hasMark()) === before, `วันศุกร์ = ${fri}`);
  const [y, m, d] = fri.split('-').map(Number);
  await page.locator('.cal .d:not(.out)', { hasText: new RegExp(`^${d}`) }).first().click();
  check('E แตะวัน → เห็นงานของวันนั้น', await page.getByText(/แบบฝึกหัดหน้า 20/).first().isVisible());
  await shot('08-calendar-day');
  await page.locator('.calbtn').click();

  // ตัวกรอง + ค้นหา
  await page.getByRole('button', { name: 'ทั้งหมด' }).click();
  await page.fill('input[type=search]', 'อังกฤษ');
  await page.waitForTimeout(100);
  const n = await page.locator('.tlist .trow').count();
  check('ค้นหาด้วยชื่อวิชาเจอ', n === 1, `${n} งาน`);
  await page.fill('input[type=search]', '');

  // หน้าฉัน
  await page.click('a[data-route=me]');
  await page.waitForSelector('.mehead');
  const stats = await page.locator('.mehead .mstats b').allTextContents();
  check('หน้าฉันนับจากงานจริง (ทั้งหมด 4 · เสร็จ 0 ต้องโชว์เลข 0 · ใกล้กำหนด 1)', stats.join('/') === '4/0/1', stats.join('/'));
  await page.locator('.mlist .mrow', { hasText: 'งานตัวอย่าง' }).click();
  await page.waitForTimeout(300);
  check('ใส่งานตัวอย่างได้ 6 งาน ติดป้ายตัวอย่าง', (await page.evaluate(() => window.__sabaii.state.tasks.filter(t => t.source === 'sample').length)) === 6);
  await page.locator('.mlist .mrow', { hasText: 'งานตัวอย่าง' }).click();
  await page.getByRole('button', { name: 'ลบงานตัวอย่าง' }).click();
  await page.waitForTimeout(300);
  check('ลบงานตัวอย่างได้ งานจริงยังอยู่', (await page.evaluate(() => [window.__sabaii.state.tasks.filter(t => t.source === 'sample').length, window.__sabaii.state.tasks.length].join())) === '0,4');
  await shot('09-me');

  // D: ออฟไลน์ เพิ่มงาน → เปิดใหม่ งานยังอยู่
  await page.click('a[data-route=home]');
  await ctx.setOffline(true);
  await page.getByRole('button', { name: /พิมพ์/ }).first().click();
  await page.fill('#add-text', 'เคมี ทำแลป ส่งพุธ');
  await page.getByRole('button', { name: 'ตรวจสอบก่อนบันทึก' }).click();
  await page.getByRole('button', { name: 'บันทึกงาน' }).click();
  await page.waitForTimeout(300);
  await ctx.setOffline(false);
  await page.reload();
  await page.waitForSelector('.tlist .trow');
  const after = await page.evaluate(() => window.__sabaii.state.tasks.length);
  check('D เพิ่มตอนออฟไลน์ → เปิดใหม่งานยังอยู่ (5 งาน)', after === 5, `${after}`);

  // G: หลายขนาดจอ ไม่มีเลื่อนแนวนอน · หน้าแรกที่ 375×812
  for (const w of [320, 360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 812 });
    await page.waitForTimeout(80);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`G กว้าง ${w}px ไม่มีเลื่อนแนวนอน`, over <= 0, `${over}px`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await shot('10-home-375');

  for (const r of ['home', 'tasks', 'me']) {
    await page.click(`a[data-route=${r}]`);
    if (r === 'tasks') { await page.locator('.calbtn').click(); }
    const txt = await page.locator('#app').innerText();
    check(`หน้า ${r} ไม่มีคำว่า false/null/undefined หลุดมา`, !/\b(false|null|undefined|NaN)\b/.test(txt));
    if (r === 'tasks') {
      const stray = await page.locator('.cal .d .m').evaluateAll(els => els.filter(e => e.textContent.trim()).length);
      check('ปฏิทินไม่มีเลขหลุดใต้วันที่', stray === 0, `${stray} ช่อง`);
      await page.locator('.calbtn').click();
    }
  }
  check('ไม่มี error ใน console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const fail = results.filter(r => !r.ok).length;
  console.log(`\nรวม ${results.length - fail}/${results.length} ผ่าน`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
