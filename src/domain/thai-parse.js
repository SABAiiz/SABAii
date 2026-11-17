// ตัวแกะข้อความไทยของ SABAii — "คณิตทำแบบฝึกหัดหน้า 20 ส่งวันศุกร์" → วิชา / ชื่องาน / วัน / เวลา / ประเภท
// หลักการ: เจออะไรชัด ๆ ค่อยใส่ · ไม่เจอให้ว่าง (ห้ามเดาเวลา ห้ามเดาวัน) · หน้าตรวจสอบเป็นคนตัดสินสุดท้าย
import { toYMD } from './dates.js';

const DOW = [
  ['อาทิตย์', 0], ['อา.', 0], ['จันทร์', 1], ['จ.', 1], ['อังคาร', 2], ['อ.', 2], ['พุธ', 3], ['พ.', 3],
  ['พฤหัสบดี', 4], ['พฤหัส', 4], ['พฤ.', 4], ['ศุกร์', 5], ['ศ.', 5], ['เสาร์', 6], ['ส.', 6],
];
const MONTHS = [
  ['มกราคม', 0], ['ม.ค.', 0], ['กุมภาพันธ์', 1], ['ก.พ.', 1], ['มีนาคม', 2], ['มี.ค.', 2], ['เมษายน', 3], ['เม.ย.', 3],
  ['พฤษภาคม', 4], ['พ.ค.', 4], ['มิถุนายน', 5], ['มิ.ย.', 5], ['กรกฎาคม', 6], ['ก.ค.', 6], ['สิงหาคม', 7], ['ส.ค.', 7],
  ['กันยายน', 8], ['ก.ย.', 8], ['ตุลาคม', 9], ['ต.ค.', 9], ['พฤศจิกายน', 10], ['พ.ย.', 10], ['ธันวาคม', 11], ['ธ.ค.', 11],
];
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const WORD_NUM = { 'หนึ่ง': 1, 'นึง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8, 'เก้า': 9, 'สิบ': 10, 'สิบเอ็ด': 11, 'สิบสอง': 12 };
const NUM = `(\\d{1,2}|${Object.keys(WORD_NUM).sort((a, b) => b.length - a.length).join('|')})`;
const num = s => /^\d+$/.test(s) ? +s : WORD_NUM[s];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const EXAM_WORDS = /(สอบ|ควิซ|quiz|test|มิดเทอม|ไฟนอล|midterm|final)/i;
const PROJECT_WORDS = /(งานกลุ่ม|โครงงาน|โปรเจกต์|โปรเจค|project)/i;
const ACTIVITY_WORDS = /(กิจกรรม|ประชุม|ซ้อม|แข่ง|ทัศนศึกษา)/i;

const normalize = t => String(t || '')
  .replace(/[๐-๙]/g, d => THAI_DIGITS.indexOf(d))
  .replace(/\s+/g, ' ')
  .trim();

/** หาเวลา → { hh, mm, text } หรือ null */
export function findTime(t) {
  t = normalize(t);
  const pats = [
    [/(\d{1,2})[:.](\d{2})\s*(?:น\.|นาฬิกา)?/, m => [+m[1], +m[2]]],
    [/เที่ยงคืน/, () => [23, 59]],
    [/เที่ยง(?:วัน)?(?!คืน)/, () => [12, 0]],
    [new RegExp(`บ่าย\\s?${NUM}(?:\\s?โมง)?(?:\\s?ครึ่ง)?`), m => [12 + (num(m[1]) % 12 || 1), /ครึ่ง/.test(m[0]) ? 30 : 0]],
    [/บ่ายโมง/, () => [13, 0]],
    [new RegExp(`${NUM}\\s?ทุ่ม(?:\\s?ครึ่ง)?`), m => [18 + num(m[1]), /ครึ่ง/.test(m[0]) ? 30 : 0]],
    [new RegExp(`(?:ตี)\\s?${NUM}(?:\\s?ครึ่ง)?`), m => [num(m[1]), /ครึ่ง/.test(m[0]) ? 30 : 0]],
    [new RegExp(`${NUM}\\s?โมง(?:เช้า|เย็น)?(?:\\s?ครึ่ง)?`), m => {
      let h = num(m[1]);
      if (/เย็น/.test(m[0]) && h < 12) h += 12;
      else if (!/เช้า/.test(m[0]) && h >= 1 && h <= 6) h += 12; // "4 โมง" ในบริบทนักเรียน = 16:00
      return [h, /ครึ่ง/.test(m[0]) ? 30 : 0];
    }],
  ];
  for (const [re, fn] of pats) {
    const m = t.match(re);
    if (!m) continue;
    const [hh, mm] = fn(m);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return { hh, mm, text: m[0] };
  }
  return null;
}

/** หาวัน → { date: Date, text, fuzzy } หรือ null · now = เวลาปัจจุบันของเครื่อง */
export function findDate(t, now = new Date()) {
  t = normalize(t);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const plus = n => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

  const rel = [[/มะรืน(?:นี้)?/, 2], [/พรุ่งนี้/, 1], [/วันนี้|คืนนี้|เย็นนี้|ตอนนี้/, 0]];
  for (const [re, n] of rel) { const m = t.match(re); if (m) return { date: plus(n), text: m[0] }; }

  // วันที่ 20 / 20 พ.ย. / 20/11 / 20 พฤศจิกายน 2569
  const monthAlt = MONTHS.map(([k]) => esc(k)).join('|');
  let m = t.match(new RegExp(`(?:วันที่\\s?)?(\\d{1,2})\\s?(${monthAlt})(?:\\s?(\\d{2,4}))?`));
  if (m) {
    const mon = MONTHS.find(([k]) => k === m[2])[1];
    return { date: pickYear(+m[1], mon, m[3], base), text: m[0] };
  }
  m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { date: pickYear(+m[1], +m[2] - 1, m[3], base), text: m[0] };
  m = t.match(/วันที่\s?(\d{1,2})(?!\s?\d)/);
  if (m) {
    const day = +m[1];
    let d = new Date(base.getFullYear(), base.getMonth(), day);
    if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, day);
    return { date: d, text: m[0] };
  }

  // "อาทิตย์หน้า" (ไม่มีคำว่า วัน นำ) = สัปดาห์หน้า ไม่ใช่วันอาทิตย์
  m = t.match(/(?:สัปดาห์หน้า|(?<!วัน)อาทิตย์หน้า)/);
  if (m) return { date: plus(7), text: m[0], fuzzy: true };

  // วันในสัปดาห์ (+ "หน้า" = สัปดาห์หน้า) — วันเดียวกับวันนี้ = สัปดาห์หน้า
  for (const [k, dow] of DOW) {
    const short = k.endsWith('.');
    const re = new RegExp(`(?:วัน)?${esc(k)}(\\s?(?:หน้า|ถัดไป))?`);
    const mm = t.match(re);
    if (!mm) continue;
    // คำย่อ "จ." "อ." ใช้ได้เฉพาะเมื่อตามด้วยช่องว่าง/ตัวเลข/ท้ายข้อความ — กัน "อ.สมชาย"
    if (short && !new RegExp(`(?:^|\\s|วัน)${esc(k)}(?=\\s|\\d|$)`).test(t)) continue;
    let diff = (dow - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (mm[1] && diff < 7) diff += 7;
    return { date: plus(diff), text: mm[0] };
  }
  return null;
}

function pickYear(day, mon, yearTxt, base) {
  let y = base.getFullYear();
  if (yearTxt) {
    let n = +yearTxt;
    if (n < 100) n += n >= 50 ? 2500 : 2000; // 69 → 2569 (พ.ศ.)
    y = n > 2400 ? n - 543 : n;
    return new Date(y, mon, day);
  }
  let d = new Date(y, mon, day);
  if (d < new Date(base.getFullYear(), base.getMonth() - 1, base.getDate())) d = new Date(y + 1, mon, day); // ผ่านไปนานแล้ว = ปีหน้า
  return d;
}

/** หาวิชาจากรายชื่อวิชาของผู้ใช้ (ชื่อ + ชื่อเล่น) — คำยาวก่อน กัน "ไทย" แย่ง "ภาษาไทย" */
export function findSubject(t, subjects) {
  const low = t.toLowerCase().replace(/เลขที่/g, ' ');
  const keys = subjects.flatMap(s => [s.name, ...(s.aliases || [])].map(k => ({ s, k: k.toLowerCase() })))
    .filter(x => x.k.length >= 2).sort((a, b) => b.k.length - a.k.length);
  const hit = keys.find(x => low.includes(x.k));
  return hit ? { subject: hit.s, text: hit.k } : null;
}

/** ข้อความ 1 งาน → ผลแกะ */
export function parseTask(text, { now = new Date(), subjects = [] } = {}) {
  const t = normalize(text);
  const time = findTime(t);
  const date = findDate(t, now);
  const subj = findSubject(t, subjects);
  const type = EXAM_WORDS.test(t) ? 'exam' : PROJECT_WORDS.test(t) ? 'project' : ACTIVITY_WORDS.test(t) ? 'activity' : 'homework';

  // ชื่องาน = ข้อความที่เหลือหลังตัดวิชา วัน เวลา และคำเชื่อม
  let title = t;
  for (const piece of [time?.text, date?.text].filter(Boolean)) title = title.replace(piece, ' ');
  if (subj) title = title.replace(new RegExp(`^\\s*(?:วิชา|การบ้าน|งาน)?\\s*${esc(subj.text)}`, 'i'), ' ');
  title = title
    .replace(/(?:ส่ง|ภายใน|กำหนดส่ง|ก่อน|ตอน|เวลา|วัน)\s*$/g, ' ')
    .replace(/(?:^|\s)(?:ส่ง|ภายใน|กำหนดส่ง|เวลา)(?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·,:;\-–—]+|[\s·,:;\-–—]+$/g, '')
    .trim();
  if (title.length < 2) title = t;

  return {
    title: title.slice(0, 200),
    subject: subj?.subject || null,
    type,
    due_date: date ? toYMD(date.date) : null,
    due_time: time ? `${String(time.hh).padStart(2, '0')}:${String(time.mm).padStart(2, '0')}` : null,
    flags: { noSubject: !subj, noDate: !date, noTime: !!date && !time, dateFuzzy: !!date?.fuzzy },
  };
}

const HEADER = /^(?:การบ้าน|งาน|รายการ)(?:ประจำ)?(?:สัปดาห์|วัน|เดือน)|^สรุปงาน|^งานที่ต้องส่ง/;
const BULLET = /^[\s\-–—•·*▪◦●○➤>+~]+|^\(?\d{1,2}[.)\]]\s+/;

/** ข้อความหลายบรรทัด → หลายท่อน · บรรทัดหัวเรื่องไม่นับเป็นงาน · บรรทัดต่อที่ไม่มีขีดนำหน้า (ในรายการมีขีด) = ต่อข้อก่อน */
export function splitLines(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  const bulleted = lines.filter(l => BULLET.test(l)).length >= 2;
  const out = [];
  for (const l of lines) {
    const hasBullet = BULLET.test(l);
    const clean = l.replace(BULLET, '').trim();
    if (!clean) continue;
    if (!out.length && HEADER.test(clean)) continue;
    if (bulleted && !hasBullet) { if (out.length) out[out.length - 1] += ' ' + clean; continue; }
    out.push(clean);
  }
  return out.length ? out : lines.slice(0, 1);
}
