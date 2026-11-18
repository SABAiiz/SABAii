// ครูพูดยาว ๆ ท้ายคาบ → หลายงาน (ใช้ตัวแกะของ SABAii เอง ไม่ใช้ AI)
// หลักการเดียวกับ thai-parse: เจออะไรชัด ๆ ค่อยใส่ · ท่อนที่ไม่ใช่งาน ("โอเค วันนี้พอแค่นี้") ทิ้ง
// ทุกงานเก็บ raw = ประโยคที่ครูพูดจริง ไว้ให้ผู้ใช้เช็กว่าแอปจับถูก
import { parseTask } from './thai-parse.js';
import { toYMD } from './dates.js';

// คำเชื่อมที่ครูใช้ขึ้นเรื่องใหม่ → ตัดท่อน
const CONNECT = /(?:แล้วก็|และก็|แล้วอีกอย่าง|อีกอย่าง(?:นึง|หนึ่ง)?|อีกเรื่อง(?:นึง|หนึ่ง)?|อีกอัน|ต่อมา|นอกจากนี้|แล้วอย่าลืม|อย่าลืม)/g;
// ท่อนที่มีคำพวกนี้ = น่าจะเป็นงาน
const TASK_WORD = /(การบ้าน|แบบฝึก|ใบงาน|ทำ|ส่ง|สอบ|ควิซ|quiz|อ่าน|รายงาน|ท่อง|เขียน|โครงงาน|ชิ้นงาน|เตรียม|เอา.{0,24}มา|ทบทวน|ข้อ\s?\d|หน้า\s?\d|บทที่\s?\d)/i;
// คำเติมที่ไม่ใช่ชื่องาน
const FILLER_HEAD = /^(?:\s|โอเค|โอเคร|ok|เอาล่ะ|เอ้า|เอาละ|งั้น|ทุกคน|นักเรียน|วันนี้พอแค่นี้|พอแค่นี้|ก่อนนะ|นะ|ครับ|ค่ะ|คะ|จ้ะ|จ้า|แล้ว)+/i;
const PARTICLE = /(?:ด้วยนะ|ด้วย|นะครับ|นะคะ|นะจ๊ะ|นะ|ครับ|ค่ะ|คะ|จ้ะ|จ้า|กันด้วย)(?=\s|$)/g;
const NEXT_WEEK = /(?:สัปดาห์หน้า|(?<!วัน)อาทิตย์หน้า)/;
const WEEKDAYS = [['อาทิตย์', 0], ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัสบดี', 4], ['พฤหัส', 4], ['ศุกร์', 5], ['เสาร์', 6]];

/** ข้อความที่ครูพูด → ท่อน (ยังไม่กรอง) */
export function splitSpeech(text) {
  return String(text || '').replace(/\s+/g, ' ').split(CONNECT).map(s => s.trim()).filter(Boolean);
}

/** "อาทิตย์หน้า ... วันอังคาร" = อังคารของสัปดาห์หน้า (สัปดาห์เริ่มวันจันทร์) */
function nextWeekDay(seg, now) {
  if (!NEXT_WEEK.test(seg)) return null;
  const rest = seg.replace(NEXT_WEEK, ' ');
  const hit = WEEKDAYS.find(([k]) => new RegExp(`(?:วัน)?${k}(?!หน้า)`).test(rest) && !(k === 'อาทิตย์' && /อาทิตย์หน้า/.test(seg) && !/วันอาทิตย์/.test(rest)));
  if (!hit) return null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mon = new Date(base); mon.setDate(base.getDate() - ((base.getDay() + 6) % 7) + 7); // จันทร์สัปดาห์หน้า
  const d = new Date(mon); d.setDate(mon.getDate() + ((hit[1] + 6) % 7));
  return { ymd: toYMD(d), word: hit[0] };
}

const tidy = t => t
  .replace(/ข้อ\s?(\d+)\s?(?:ถึง|-|–)\s?(?:ข้อ\s?)?(\d+)/g, 'ข้อ $1–$2')
  .replace(/หน้า\s?(\d+)\s?(?:ถึง|-|–)\s?(?:หน้า\s?)?(\d+)/g, 'หน้า $1–$2')
  .replace(PARTICLE, ' ')
  .replace(/^(?:การบ้าน)\s+(?=\S)/, '')
  .replace(FILLER_HEAD, '')
  .replace(/\s{2,}/g, ' ')
  .replace(/^[\s·,:;\-–—]+|[\s·,:;\-–—]+$/g, '')
  .trim();

/** ข้อความที่ครูพูด → ร่างงานหลายชิ้น { title, subject_id, type, due_date, due_time, raw } */
export function tasksFromSpeech(text, { now = new Date(), subjects = [] } = {}) {
  const out = [];
  for (const raw of splitSpeech(text)) {
    const seg = raw.replace(FILLER_HEAD, '').trim();
    if (!seg || !TASK_WORD.test(seg)) continue;
    const nw = nextWeekDay(seg, now);
    const forParse = nw ? seg.replace(NEXT_WEEK, ' ').replace(new RegExp(`(?:วัน)?${nw.word}`), ' ') : seg;
    const p = parseTask(forParse, { now, subjects });
    const title = tidy(p.title);
    const d = { title, subject_id: p.subject?.id || null, type: p.type, due_date: nw ? nw.ymd : p.due_date, due_time: p.due_time, raw: seg };
    // ท่อนที่มีแค่วัน/เวลา เช่น "ส่งวันศุกร์ก่อนแปดโมง" → เป็นวันส่งของงานก่อนหน้า
    const onlyWhen = !/[ก-๙a-z]{2,}/i.test(tidy(title.replace(/^(?:การบ้าน|สอบ|งานกลุ่ม|กิจกรรม)$/, ''))) || title.length < 3;
    const prev = out[out.length - 1];
    if (onlyWhen && prev) {
      if (!prev.due_date) prev.due_date = d.due_date;
      if (!prev.due_time) prev.due_time = d.due_time;
      prev.raw += ' ' + seg;
      continue;
    }
    if (!title || title.length < 2) continue;
    out.push(d);
  }
  return out;
}

