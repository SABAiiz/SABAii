// วันที่ทั้งแอปเก็บเป็น "วันตามปฏิทินของผู้ใช้" (YYYY-MM-DD) + เวลา (HH:MM หรือ null)
// ไม่เก็บเป็น ISO/UTC เพราะ "ส่งวันศุกร์" คือวันศุกร์ของเครื่องนักเรียนเสมอ —
// แปลงผ่าน UTC เมื่อไหร่ งานที่ส่งตีหนึ่งจะเด้งย้อนไปวันก่อนหน้า (สเปกข้อ 5.4)

export const DOW_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const DOW_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const MONTH_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const pad = n => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' ตามเวลาท้องถิ่น (ไม่ผ่าน UTC) */
export function toYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Date → 'HH:MM' ตามเวลาท้องถิ่น */
export function toHM(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** 'YYYY-MM-DD' → Date เที่ยงคืนท้องถิ่น */
export function fromYMD(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDaysYMD(ymd, n) {
  const d = fromYMD(ymd);
  d.setDate(d.getDate() + n);
  return toYMD(d);
}
/** จำนวนวันจาก a ถึง b (ตามปฏิทิน ไม่สนเวลาออมแสง) */
export function daysBetween(a, b) {
  const A = fromYMD(a), B = fromYMD(b);
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
}
/** เวลาที่ใช้เรียงลำดับ — ไม่ระบุเวลาให้ถือเป็นปลายวัน แต่ใช้แค่เรียง ไม่โชว์ผู้ใช้ */
export function dueSortKey(task) {
  if (!task.due_date) return Number.POSITIVE_INFINITY;
  const d = fromYMD(task.due_date);
  if (task.due_time) {
    const [h, m] = task.due_time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else d.setHours(23, 59, 59, 0);
  return d.getTime();
}

/** ปี พ.ศ. */
export const beYear = y => y + 543;

/** "วันนี้" "พรุ่งนี้" "ศ. 20 พ.ย." */
export function relDay(ymd, today) {
  const n = daysBetween(today, ymd);
  if (n === 0) return 'วันนี้';
  if (n === 1) return 'พรุ่งนี้';
  if (n === -1) return 'เมื่อวาน';
  const d = fromYMD(ymd);
  const sameYear = d.getFullYear() === fromYMD(today).getFullYear();
  return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}${sameYear ? '' : ' ' + String(beYear(d.getFullYear())).slice(2)}`;
}

/** ข้อความกำหนดส่งที่โชว์บนการ์ด เช่น "ส่งพรุ่งนี้ 08:00" · "ส่งศ. 20 พ.ย. · ไม่ระบุเวลา" */
export function dueLabel(task, today) {
  if (!task.due_date) return 'ยังไม่มีกำหนดส่ง';
  const verb = task.type === 'exam' ? 'สอบ' : 'ส่ง';
  const day = relDay(task.due_date, today);
  const time = task.due_time ? ` ${task.due_time}` : '';
  const late = daysBetween(today, task.due_date) < 0 ? 'เลยกำหนด · ' : '';
  const gap = /^(วันนี้|พรุ่งนี้|เมื่อวาน)/.test(day) ? '' : ' '; // "ส่งพรุ่งนี้" ติดกัน · "ส่ง พ. 18 พ.ย." เว้นวรรค
  return `${late}${verb}${gap}${day}${time}`;
}

export function fullThaiDate(ymd) {
  const d = fromYMD(ymd);
  return `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]} ${beYear(d.getFullYear())}`;
}

/** ช่องวันในปฏิทินเดือน (เริ่มวันจันทร์) — 6 แถว × 7 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // จันทร์ = 0
  const start = new Date(year, month, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ ymd: toYMD(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}
/** 14 วันเริ่มจากวันจันทร์ของสัปดาห์ที่มี ymd */
export function twoWeeks(ymd) {
  const d = fromYMD(ymd);
  const offset = (d.getDay() + 6) % 7;
  const start = addDaysYMD(ymd, -offset);
  return Array.from({ length: 14 }, (_, i) => {
    const y = addDaysYMD(start, i);
    return { ymd: y, day: fromYMD(y).getDate(), inMonth: true };
  });
}
