// ครูพูดยาว ๆ → หลายงาน (src/domain/speech.js) · รัน: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { tasksFromSpeech, splitSpeech } from '../src/domain/speech.js';

const NOW = new Date(2026, 10, 18, 11, 48); // พ. 18 พ.ย. 2569
const SUBJ = [{ id: 's_phy', name: 'ฟิสิกส์', aliases: ['ฟิสิก'] }, { id: 's_math', name: 'คณิตศาสตร์', aliases: ['คณิต', 'เลข'] }];
const run = t => tasksFromSpeech(t, { now: NOW, subjects: SUBJ });

test('ครูสั่ง 2 งานในประโยคเดียว → 2 งาน + วัน/เวลา + ประโยคที่ครูพูด', () => {
  const r = run('โอเค วันนี้พอแค่นี้ การบ้านนะ แบบฝึกหัด 4.3 ข้อ 1 ถึง 15 ไม่ต้องทำข้อ 9 นะ ส่งวันศุกร์ก่อนแปดโมง แล้วก็อาทิตย์หน้าสอบย่อยบทที่ 4 วันอังคาร ออกเรื่องโพรเจกไทล์กับวงกลม 10 คะแนน');
  assert.equal(r.length, 2);
  assert.equal(r[0].title, 'แบบฝึกหัด 4.3 ข้อ 1–15 ไม่ต้องทำข้อ 9');
  assert.equal(r[0].due_date, '2026-11-20');
  assert.equal(r[0].due_time, '08:00');
  assert.match(r[0].raw, /ไม่ต้องทำข้อ 9/);
  assert.equal(r[1].type, 'exam');
  assert.equal(r[1].due_date, '2026-11-24', '"อาทิตย์หน้า … วันอังคาร" = อังคารของสัปดาห์หน้า');
  assert.match(r[1].title, /^สอบย่อยบทที่ 4/);
});
test('คำพูดทั่วไปที่ไม่ใช่งาน → ไม่ได้งาน', () => {
  assert.deepEqual(run('โอเคทุกคน วันนี้พอแค่นี้นะครับ'), []);
  assert.deepEqual(run(''), []);
});
test('ท่อนที่มีแค่วันส่ง → ต่อท้ายงานก่อนหน้า ไม่เป็นงานใหม่', () => {
  const r = run('การบ้านคณิตทำใบงาน 9 แล้วก็ส่งวันศุกร์นะ');
  assert.equal(r.length, 1);
  assert.equal(r[0].subject_id, 's_math');
  assert.equal(r[0].due_date, '2026-11-20');
});
test('ช่วงหน้า/ข้อ เขียนสั้นลง · ของที่ต้องเอามาเป็นงาน · "คิดเลข" ไม่ใช่วิชาคณิต', () => {
  const r = run('อ่านหน้า 40 ถึง 52 มาก่อนคาบหน้า อย่าลืมเอาเครื่องคิดเลขมาวันพฤหัส');
  assert.equal(r.length, 2);
  assert.match(r[0].title, /หน้า 40–52/);
  assert.equal(r[0].due_date, null, 'ไม่บอกวัน = ไม่เดา');
  assert.equal(r[1].title, 'เอาเครื่องคิดเลขมา');
  assert.equal(r[1].due_date, '2026-11-19');
  assert.equal(r[1].subject_id, null);
});
test('splitSpeech ตัดที่คำเชื่อม', () => {
  assert.deepEqual(splitSpeech('ทำ A แล้วก็ทำ B อีกอย่างทำ C'), ['ทำ A', 'ทำ B', 'ทำ C']);
});
