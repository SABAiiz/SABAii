// หน้า "ฉัน" — ชื่อ · สรุปจากงานจริง · กราฟงานเสร็จ 7 วัน · วิชาของฉัน · ธีม · สำรอง/กู้คืน · งานตัวอย่าง · ข้อมูลในเครื่อง
import { h, ic, put, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { toYMD, fromYMD, addDaysYMD, daysBetween, DOW_SHORT } from '../domain/dates.js';
import { summary, isLive, nextExam } from '../domain/tasks.js';
import { SUBJECT_COLORS } from '../data/store.js';
import { app, S, subj, today } from './shared.js';

const THEME = { system: 'ตามเครื่อง', light: 'สว่าง', dark: 'มืด' };
export function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export function meView(root) {
  const s = S(), td = today(), sum = summary(s.tasks, td);
  const name = s.prefs.display_name || '';
  const theme = s.prefs.theme || 'system';
  const hasSamples = s.tasks.some(t => t.source === 'sample');
  const exam = nextExam(s.tasks.filter(isLive), td);

  const days = Array.from({ length: 7 }, (_, i) => addDaysYMD(td, i - 6));
  const doneBy = Object.fromEntries(days.map(d => [d, 0]));
  for (const t of s.tasks) if (isLive(t) && t.status === 'done' && t.completed_at) { const d = toYMD(new Date(t.completed_at)); if (d in doneBy) doneBy[d]++; }
  const week = Object.values(doneBy).reduce((a, b) => a + b, 0), max = Math.max(1, ...Object.values(doneBy));
  const row = (icon, label, value, onclick, sub) => h('button.list-btn', { onclick },
    h('span', { html: ic(icon) }), h('span.lk', label, sub ? h('small', sub) : ''), value != null ? h('span.lv', value) : '', h('span.chev', { html: ic('right') }));

  put(root,
    h('div.phead', h('h1', 'ฉัน')),
    h('div.meline', h('span.avatar.big', (name || 'ฉ').slice(0, 1)),
      h('div', h('b', name || 'ยังไม่ได้ตั้งชื่อ'), h('small.muted.block', 'ยังไม่มีบัญชี · ข้อมูลอยู่ในเครื่องนี้')),
      h('button.btn.ghost.auto', { onclick: editName }, name ? 'แก้ชื่อ' : 'ตั้งชื่อ')),
    h('div.stats',
      h('div.stat', h('b', String(sum.open)), h('small', 'งานค้าง')),
      h('div.stat', h('b', String(sum.soon)), h('small', 'ใกล้กำหนด')),
      h('div.stat', h('b', exam ? String(Math.max(0, daysBetween(td, exam.due_date))) : '—'), h('small', exam ? `วันถึงสอบ${subj(exam.subject_id).id ? ' ' + subj(exam.subject_id).name.replace(/^ภาษา/, '') : ''}` : 'ยังไม่มีสอบ'))),
    h('section.weekcard', { 'aria-label': 'งานที่ทำเสร็จ 7 วันล่าสุด' },
      h('div.sec', h('h2', 'ทำเสร็จ 7 วันนี้'), h('span', `${week} งาน · ทั้งหมด ${sum.done}`)),
      h('div.week', { role: 'img', 'aria-label': `งานที่ทำเสร็จ 7 วันล่าสุด รวม ${week} งาน` }, days.map(d => {
        const n = doneBy[d];
        return h('div.wcol' + (d === td ? '.today' : ''), h('div.wbar', h('i', { style: { height: `${n ? Math.max(10, n / max * 100) : 0}%` } }), n ? h('em', String(n)) : ''),
          h('span', DOW_SHORT[fromYMD(d).getDay()]));
      })),
      week === 0 ? h('p.muted.center', 'ยังไม่มีงานที่ทำเสร็จใน 7 วันนี้') : ''),
    h('div.mlist',
      row('book', 'วิชาของฉัน', `${s.subjects.filter(x => !x.hidden).length} วิชา`, subjectsModal),
      row('moon', 'ธีมสี', THEME[theme], themeModal),
      row('spark', 'งานตัวอย่าง', hasSamples ? 'ลบออก' : 'ลองใส่', toggleSamples),
      row('save', 'สำรองข้อมูล', 'ไฟล์ JSON', exportData, 'ไม่รวมรูป'),
      row('restore', 'กู้คืนจากไฟล์สำรอง', null, restoreModal),
      row('bell', 'การแจ้งเตือน', 'ยังไม่เปิดในรุ่นนี้', () => openModal({ title: 'การแจ้งเตือน', body: h('p', 'รุ่นนี้ยังแจ้งเตือนตอนปิดแอปไม่ได้ — ดูงานด่วนได้ที่หน้าแรก งานใกล้ส่งเป็นตัวสีแดง') })),
      row('lock', 'ข้อมูลและความเป็นส่วนตัว', s.dbKind === 'indexeddb' ? 'เก็บในเครื่อง' : 'ชั่วคราว', privacyModal),
      row('info', 'เกี่ยวกับ SABAii.com', `รุ่น ${globalThis.SABAII_VERSION || ''}`, () => openModal({ title: 'เกี่ยวกับ SABAii.com', body: h('div',
        h('p', 'แอปจัดการงานเรียน: เพิ่มงานง่าย รู้ว่าต้องทำอะไร และไม่พลาดกำหนดส่ง'),
        h('p.muted', `รุ่น ${globalThis.SABAII_VERSION || ''} · รุ่นทดลอง ยังไม่มีบัญชี การซิงก์ การอ่านรูปอัตโนมัติ และการแจ้งเตือนตอนปิดแอป`)) }))),
  );
}

function editName() {
  const inp = h('input.field', { id: 'me-name', value: S().prefs.display_name || '', maxlength: 40, 'aria-label': 'ชื่อที่แสดง', placeholder: 'ชื่อเล่น' });
  openModal({ title: 'ชื่อที่แสดง', body: h('div', inp, h('p.muted', 'ไม่ต้องใส่ชื่อจริง ไม่ต้องบอกโรงเรียน')),
    foot: h('button.btn.primary', { onclick: async () => { await app.store.setPref('display_name', inp.value.trim()); closeModal(); } }, 'บันทึก') });
  setTimeout(() => inp.focus(), 300);
}
function themeModal() {
  const body = h('div.seg');
  const paint = () => put(body, Object.entries(THEME).map(([k, l]) => h('button', { 'aria-pressed': String((S().prefs.theme || 'system') === k), onclick: async () => { await app.store.setPref('theme', k); applyTheme(k); paint(); } }, l)));
  paint();
  openModal({ title: 'ธีมสี', body: h('div', body, h('p.muted', 'สีตามโลโก้: กรมท่า + ฟ้า · ธีมมืดเป็นกรมท่าเข้ม')) });
}
async function toggleSamples() {
  if (S().tasks.some(t => t.source === 'sample')) {
    if (!await confirmBox({ title: 'ลบงานตัวอย่าง?', body: 'ลบเฉพาะงานที่ติดป้าย "ตัวอย่าง" งานของคุณเองไม่หาย', ok: 'ลบงานตัวอย่าง', danger: true })) return;
    toast(`ลบงานตัวอย่าง ${await app.store.removeSamples()} งานแล้ว`);
  } else { await app.store.addSamples(); toast('ใส่งานตัวอย่าง 6 งานแล้ว'); }
}
function exportData() {
  const json = app.store.exportJSON();
  const ta = h('textarea.field.mono', { id: 'backup-json', readOnly: true, 'aria-label': 'ข้อมูลสำรอง' }); ta.value = json;
  openModal({ title: 'สำรองข้อมูล', body: h('div', h('p.muted', `${S().tasks.length} งาน · ${S().subjects.length} วิชา · ไม่รวมรูป — เก็บไว้แล้วกู้คืนได้จากเมนู "กู้คืนจากไฟล์สำรอง"`), ta),
    foot: [
      h('button.btn.ghost', { onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: `sabaii-backup-${today()}.json` }); document.body.append(a); a.click(); a.remove(); } }, 'ดาวน์โหลดไฟล์'),
      h('button.btn.primary', { onclick: async () => { try { await navigator.clipboard.writeText(json); toast('คัดลอกแล้ว'); } catch { ta.focus(); ta.select(); toast('เลือกข้อความให้แล้ว กดคัดลอกเองได้เลย'); } } }, 'คัดลอก')] });
}
function restoreModal() {
  const file = h('input', { type: 'file', id: 'restore-file', accept: 'application/json,.json' });
  const ta = h('textarea.field', { id: 'restore-text', placeholder: 'หรือวางข้อความที่คัดลอกไว้ตอนสำรอง' });
  const run = async raw => { try { const r = await app.store.restoreBackup(raw); closeModal(); toast(`กู้คืน ${r.added} งาน${r.skipped ? ` · ข้าม ${r.skipped} งานที่มีอยู่แล้ว` : ''}`); } catch (e) { toast(e.message); } };
  file.onchange = async () => { const f = file.files?.[0]; if (f) run(await f.text()); };
  openModal({ title: 'กู้คืนจากไฟล์สำรอง', body: h('div', h('p.muted', 'งานที่มีอยู่แล้วจะไม่ถูกเขียนทับ กู้ซ้ำได้ไม่เกิดงานซ้ำ'),
    h('label.flabel', { for: 'restore-file' }, 'เลือกไฟล์'), file, h('label.flabel', { for: 'restore-text' }, 'หรือวางข้อความ'), ta),
    foot: h('button.btn.primary', { onclick: () => ta.value.trim() && run(ta.value) }, 'กู้คืนจากข้อความ'), isDirty: () => !!ta.value.trim() });
}
function privacyModal() {
  openModal({ title: 'ข้อมูลและความเป็นส่วนตัว', body: h('div',
    h('p', 'งาน วิชา รูป และโน้ตทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ยังไม่มีการส่งขึ้นเซิร์ฟเวอร์'),
    h('p.muted', 'ถ้าล้างข้อมูลเบราว์เซอร์หรือลบแอป ข้อมูลจะหาย — สำรองเป็นไฟล์ไว้ก่อน'),
    h('button.btn.danger.full', { onclick: async () => {
      if (!await confirmBox({ title: 'ลบข้อมูลทั้งหมด?', body: 'งาน วิชา รูป และโน้ตในเครื่องนี้จะหายถาวร แนะนำให้สำรองข้อมูลก่อน', ok: 'ลบทั้งหมด', danger: true })) return;
      indexedDB.deleteDatabase('sabaii'); location.reload();
    } }, 'ลบข้อมูลทั้งหมดในเครื่อง')) });
}
function subjectsModal() {
  const body = h('div');
  const paint = () => {
    const list = [...S().subjects].sort((a, b) => a.order - b.order);
    const newIn = h('input.field', { placeholder: 'ชื่อวิชาใหม่', 'aria-label': 'ชื่อวิชาใหม่', maxlength: 40 });
    put(body, list.map((sj, i) => h('div.subjrow' + (sj.hidden ? '.off' : ''),
      h('button.sw', { style: { background: sj.color }, 'aria-label': `เปลี่ยนสี ${sj.name}`, onclick: async () => { await app.store.updateSubject(sj.id, { color: SUBJECT_COLORS[(SUBJECT_COLORS.indexOf(sj.color) + 1) % SUBJECT_COLORS.length] }); paint(); } }),
      h('input.field', { value: sj.name, 'aria-label': 'ชื่อวิชา', maxlength: 40, onchange: async e => { const v = e.target.value.trim(); if (v) await app.store.updateSubject(sj.id, { name: v }); } }),
      h('button.iconbtn.sm', { 'aria-label': `เลื่อน ${sj.name} ขึ้น`, disabled: i === 0, html: ic('up'), onclick: async () => { const p = list[i - 1]; await app.store.updateSubject(sj.id, { order: p.order }); await app.store.updateSubject(p.id, { order: sj.order }); paint(); } }),
      h('button.iconbtn.sm', { 'aria-label': sj.hidden ? `แสดง ${sj.name}` : `ซ่อน ${sj.name}`, html: ic(sj.hidden ? 'eyeoff' : 'eye'), onclick: async () => { await app.store.updateSubject(sj.id, { hidden: !sj.hidden }); paint(); } }),
      h('button.iconbtn.sm', { 'aria-label': `ลบ ${sj.name}`, html: ic('trash'), onclick: async () => {
        const n = S().tasks.filter(t => isLive(t) && t.subject_id === sj.id).length;
        if (!await confirmBox({ title: `ลบวิชา ${sj.name}?`, body: n ? `มี ${n} งานในวิชานี้ งานจะไม่หาย แต่จะกลายเป็น "ไม่ระบุวิชา"` : 'ไม่มีงานในวิชานี้', ok: 'ลบวิชา', danger: true })) return;
        await app.store.deleteSubject(sj.id); paint();
      } }))),
      h('div.addrow', newIn, h('button.btn.primary.auto', { onclick: async () => { const v = newIn.value.trim(); if (!v) return; await app.store.ensureSubject(v); app.refresh(); paint(); } }, 'เพิ่ม')));
  };
  paint();
  openModal({ title: 'วิชาของฉัน', body: h('div', h('p.muted', 'แตะวงกลมเพื่อเปลี่ยนสี · ซ่อนวิชาที่ไม่ได้เรียนเทอมนี้ได้'), body) });
}
