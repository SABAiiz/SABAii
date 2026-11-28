// ข้อความแจ้งเตือนตอนเย็น — ฟังก์ชันล้วน (เทสต์ใน Node: tests/push.test.mjs · ใช้ใน Edge Function index.ts)
// tasks = [{ title, type: 'homework'|'exam'|…, subject, time }] ของ "พรุ่งนี้" ที่ยังไม่เสร็จ · ไม่มีอะไร = null (ไม่ส่ง)
const short = s => String(s || '').replace(/^ภาษา/, '');
const label = t => t.subject ? `${t.title} (${short(t.subject)})` : t.title;

export function compose(tasks) {
  const list = (tasks || []).filter(t => t && t.title);
  if (!list.length) return null;
  const exams = list.filter(t => t.type === 'exam'), work = list.filter(t => t.type !== 'exam');
  const names = items => {
    const shown = items.slice(0, 3).map(label).join(', ');
    return items.length > 3 ? `${shown} และอีก ${items.length - 3} งาน` : shown;
  };
  let title, body;
  if (exams.length) {
    const what = [...new Set(exams.map(t => short(t.subject) || t.title))].join(', ');
    title = `พรุ่งนี้สอบ ${what}`;
    body = work.length ? `และมีงานต้องส่ง ${work.length} งาน: ${names(work)}` : 'อ่านทบทวนคืนนี้อีกนิด แล้วพักผ่อนให้พอ';
  } else if (work.length === 1) {
    title = 'พรุ่งนี้มีงานต้องส่ง';
    body = label(work[0]) + (work[0].time ? ` ก่อน ${work[0].time.slice(0, 5)}` : '');
  } else {
    title = `พรุ่งนี้มีงานต้องส่ง ${work.length} งาน`;
    body = names(work);
  }
  return { title, body, tag: 'sabaii-tomorrow', url: '#/tasks' };
}

export const TEST_MESSAGE = { title: 'แจ้งเตือนของ SABAii ใช้ได้แล้ว', body: 'ตอนเย็นก่อนวันส่ง เราจะเตือนงานและสอบของพรุ่งนี้ที่นี่', tag: 'sabaii-test', url: '#/me' };
