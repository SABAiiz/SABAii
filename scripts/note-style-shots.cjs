// ทำภาพตัวอย่างหน้าโน้ต 6 แบบ (assets/note-styles/ns-1…6.jpg) จาก mockups/sabaii-note-variants.html
// แต่ละแบบใช้รูปถ่ายคนละรูป + ชื่องาน/วิชาให้ตรงกับรูป — ไม่ให้ทุกเครื่องเป็นรูปเดิมซ้ำกัน
// ใช้: node scripts/note-style-shots.cjs   (ต้องมี playwright + รูปใน assets/landing/photos/)
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SHORT = ['ฟิส', 'คณิต', 'สังคม', 'ชีวะ', 'อังกฤษ', 'วิทย์'];
const SHOTS = [ // [รูป, ชื่องาน, วิชา]
  ['assets/landing/photos/board.jpg', 'แบบฝึกหัด 4.3', 'ฟิสิกส์'],
  ['assets/landing/photos/chalk.jpg', 'สอบย่อยบทที่ 4', 'คณิตศาสตร์'],
  ['assets/landing/photos/hands.jpg', 'รายงานแผนที่โลก', 'สังคมศึกษา'],
  ['assets/landing/photos/notes.jpg', 'สรุปบทที่ 2', 'ชีววิทยา'],
  ['assets/landing/photos/sticky.jpg', 'ท่องศัพท์ Unit 5', 'ภาษาอังกฤษ'],
  ['assets/landing/note-photo.jpg', 'Mind mapping', 'วิทยาศาสตร์'],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(ROOT, 'mockups/sabaii-note-variants.html'));
  await p.evaluate(() => document.fonts.ready);
  for (let i = 1; i <= 6; i++) {
    const [img, title, subj] = SHOTS[i - 1];
    const url = 'file://' + path.join(ROOT, img);
    await p.evaluate(({ i, url, title, subj, short }) => {
      const ph = document.querySelector('.phone.v' + i);
      ph.querySelectorAll('img').forEach(el => { el.src = url; });
      ph.querySelectorAll('.bg').forEach(el => { el.style.backgroundImage = `url("${url}")`; });
      const walk = document.createTreeWalker(ph, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) n.nodeValue = n.nodeValue.replace('Mind mapping', title).replace('วิทยาศาสตร์', subj).replace(/^วิทย์$/, short);
    }, { i, url, title, subj, short: SHORT[i - 1] });
    await p.waitForTimeout(400);
    const el = await p.$('.phone.v' + i);
    await el.screenshot({ path: path.join(ROOT, `assets/note-styles/ns-${i}.png`) });
  }
  await b.close();
  console.log('ok — ได้ ns-N.png แล้วย่อเป็น jpg กว้าง 440 (สูง 951) ทับไฟล์เดิม');
})();
