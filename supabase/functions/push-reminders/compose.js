// ข้อความแจ้งเตือนรายวิชา (0.16) — ฟังก์ชันล้วน (เทสต์ใน Node: tests/push.test.mjs · ใช้ใน Edge Function index.ts)
// row = แถวจาก push_due(): { slot: id วิชา | '_none', subject: ชื่อวิชา | null, tasks: [{ title, type, time, days }] }
//   days = วันกำหนดส่ง − วันนี้ (ติดลบ = เลยกำหนด) · ไม่มีงาน = null (ไม่ส่ง)
const short = s => String(s || '').replace(/^ภาษา/, '');

/** "ส่งพรุ่งนี้" · "สอบอีก 3 วัน" · "เลยกำหนด 2 วัน" */
export function when(t) {
  const d = Number(t.days), exam = t.type === 'exam', verb = exam ? 'สอบ' : 'ส่ง';
  const at = t.time && d >= 0 && d <= 1 ? ` ${String(t.time).slice(0, 5)}` : '';
  if (d < 0) return `เลยกำหนด ${-d} วัน`;
  if (d === 0) return `${verb}วันนี้${at}`;
  if (d === 1) return `${verb}พรุ่งนี้${at}`;
  return `${verb}อีก ${d} วัน`;
}

export function compose(row) {
  const list = (row?.tasks || []).filter(t => t && t.title);
  if (!list.length) return null;
  const name = row.subject ? short(row.subject) : 'งานไม่มีวิชา';
  const exam = list.find(t => t.type === 'exam' && t.days >= 0);
  const title = list.length === 1
    ? (exam ? `${name} · ${when(exam)}` : `${name} · ${list[0].days < 0 ? 'งานค้าง' : 'มีงานต้องส่ง'}`)
    : `${name} · ค้าง ${list.length} งาน`;
  const lines = list.slice(0, 3).map(t => `${t.title} (${when(t)})`);
  if (list.length > 3) lines.push(`และอีก ${list.length - 3} งาน`);
  const slot = row.slot && row.slot !== '_none' ? row.slot : 'none';
  return { title, body: lines.join('\n'), tag: `sabaii-${slot}`, url: `#/subject/${slot}` };
}

export const TEST_MESSAGE = { title: 'แจ้งเตือนของ SABAii ใช้ได้แล้ว', body: 'ถึงเวลาที่ตั้งไว้ของแต่ละวิชา เราจะเตือนงานที่ยังไม่เสร็จที่นี่', tag: 'sabaii-test', url: '#/me' };
