// รายละเอียดงาน — ปุ่ม "ทำเลย" มาที่นี่ ไม่ได้ติ๊กเสร็จทันที (สเปก 2.3) · "ทำเสร็จแล้ว" เป็นปุ่มแยก
import { h, ICON, toast, confirmBox, subjectBadge } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { dueLabel, toYMD, daysBetween, fullThaiDate } from '../domain/dates.js';
import { TYPES, STATUS } from '../domain/tasks.js';
import { draftEditor } from './add.js';
import { pickImage, prepareImage } from './images.js';

let store;
export function initDetail(s) { store = s; }

export function openDetail(id) {
  const sh = openSheet({ title: '', state: 'expanded', label: 'รายละเอียดงาน' });
  const urls = [];
  sh.onClose(() => urls.forEach(u => URL.revokeObjectURL(u)));
  const unsub = store.subscribe(() => { if (!editing) render(); });
  sh.onClose(unsub);
  let editing = false;
  render();

  function render() {
    const t = store.state.tasks.find(x => x.id === id);
    if (!t || t.deleted_at) { sh.forceClose(); return; }
    const subj = store.subjectsById()[t.subject_id];
    const today = toYMD(new Date());
    const late = t.status !== 'done' && t.due_date && daysBetween(today, t.due_date) < 0;
    sh.setTitle(subj?.name || 'ไม่ระบุวิชา');

    const notes = store.attachmentsOf(id).map(a => {
      let inner;
      if (a.kind === 'image' && a.blob) { const u = URL.createObjectURL(a.blob); urls.push(u); inner = h('img', { src: u, alt: 'รูปโน้ตของงาน', loading: 'lazy' }); }
      else inner = h('span', a.text);
      return h('div.note' + (a.kind === 'text' ? '.text' : ''), inner,
        h('button.x', { 'aria-label': 'ลบโน้ตนี้', onclick: async () => {
          if (await confirmBox({ title: 'ลบโน้ตนี้?', ok: 'ลบ', danger: true })) store.removeAttachment(a.id);
        } }, '×'));
    });

    const addText = () => {
      const ta = h('textarea.in', { rows: 3, 'aria-label': 'ข้อความโน้ต', placeholder: 'เช่น ครูบอกทำแค่ข้อคี่' });
      const box = h('div', { style: { marginTop: '8px' } }, ta, h('div.row', { style: { marginTop: '6px' } },
        h('button.btn', { onclick: () => { box.remove(); sh.setDirty(() => false); } }, 'ยกเลิก'),
        h('button.btn.blue', { onclick: async () => { const v = ta.value.trim(); if (!v) return; sh.setDirty(() => false); await store.addAttachment(id, { kind: 'text', text: v.slice(0, 2000) }); } }, 'บันทึกโน้ต')));
      noteActions.after(box);
      sh.setDirty(() => ta.value.trim().length > 0);
      ta.focus();
    };
    const addImage = async camera => {
      const file = await pickImage({ camera }); if (!file) return;
      try { const img = await prepareImage(file); await store.addAttachment(id, { kind: 'image', blob: img.blob, size: img.blob.size, mime_type: img.blob.type }); URL.revokeObjectURL(img.url); }
      catch (e) { toast(e.message); }
    };
    const noteActions = h('div.seg', { style: { marginTop: '8px' } },
      h('button', { onclick: () => addImage(false) }, '+ รูป'),
      h('button', { onclick: () => addImage(true) }, '+ ถ่ายรูป'),
      h('button', { onclick: addText }, '+ ข้อความ'));

    const setStatus = async (status, msg) => {
      const prev = t.status;
      await store.patchTask(id, { status });
      toast(msg, { label: 'เลิกทำ', run: () => store.patchTask(id, { status: prev }) });
    };
    const primary = t.status === 'done'
      ? [h('button.btn.block', { onclick: () => setStatus('todo', 'ย้ายกลับไปที่ยังไม่เสร็จ') }, 'ยังไม่เสร็จ')]
      : [t.status === 'todo' && h('button.btn.blue', { onclick: () => setStatus('doing', 'เริ่มทำแล้ว') }, 'เริ่มทำ'),
         h('button.btn.green', { onclick: () => setStatus('done', 'เยี่ยม! ทำเสร็จแล้ว') }, 'ทำเสร็จแล้ว')];

    sh.setBody(
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, subjectBadge(subj),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', t.type !== 'homework' && h('span.pill' + (t.type === 'exam' ? '.exam' : ''), TYPES[t.type]),
            t.status !== 'todo' && h('span.pill.' + t.status, STATUS[t.status]), t.pinned_at && h('span.pill.doing', 'ปักหมุด')),
          h('h3', { style: { fontSize: '20px', lineHeight: 1.35 } }, t.title))),
      h('p.dmeta', { style: { marginTop: '10px' } },
        h('span', { class: late ? 'late' : '' }, dueLabel(t, today)),
        t.due_date && ` · ${fullThaiDate(t.due_date)}`,
        !t.due_time && t.due_date ? ' · ไม่ระบุเวลา' : '',
        t.end_time && ` – ${t.end_time}`, t.place && ` · ห้อง ${t.place}`),
      t.description && h('p', { style: { marginTop: '8px', whiteSpace: 'pre-wrap' } }, t.description),
      h('div.sec-title', h('h2', 'โน้ตหน้างาน'), h('span', notes.length ? `${notes.length} รายการ` : 'ยังไม่มี')),
      notes.length ? h('div.notes', notes) : h('p.hint', 'แนบรูปใบงาน รูปกระดาน หรือจดสิ่งที่ครูบอกไว้กับงานนี้'),
      noteActions,
      h('div.sec-title', h('h2', 'จัดการงาน')),
      h('div.row',
        h('button.btn.ghost', { onclick: edit }, 'แก้ไข / เลื่อนวัน'),
        h('button.btn.ghost', { onclick: () => store.patchTask(id, { pinned_at: t.pinned_at ? null : new Date().toISOString() }) }, t.pinned_at ? 'เลิกปักหมุด' : 'ปักไว้บนสุด')),
      h('button.btn.danger.block', { style: { marginTop: '8px' }, onclick: async () => {
        if (!await confirmBox({ title: 'ลบงานนี้?', body: 'กู้คืนได้ทันทีจากปุ่ม "เลิกทำ" หลังลบ', ok: 'ลบงาน', danger: true })) return;
        await store.removeTask(id);
        sh.forceClose();
        toast('ลบงานแล้ว', { label: 'เลิกทำ', run: () => store.restoreTask(id) });
      } }, 'ลบงาน'),
    );
    sh.setFoot(h('div.row', primary));
  }

  function edit() {
    const t = store.state.tasks.find(x => x.id === id);
    editing = true;
    const d = { ...t, subject_name: '', flags: {} };
    sh.setTitle('แก้ไขงาน');
    sh.setDirty(() => true);
    sh.setBody(draftEditor(d, 0, null, store.state.subjects));
    sh.setFoot(h('div.row',
      h('button.btn', { onclick: () => { editing = false; sh.setDirty(() => false); render(); } }, 'ยกเลิก'),
      h('button.btn.blue', { onclick: async () => {
        if (!String(d.title).trim()) { toast('ต้องมีชื่องาน'); return; }
        let subject_id = d.subject_id;
        if (!subject_id && d.subject_name) subject_id = (await store.ensureSubject(d.subject_name)).id;
        editing = false; sh.setDirty(() => false);
        await store.patchTask(id, { title: d.title.trim(), subject_id, type: d.type, due_date: d.due_date, due_time: d.due_time, end_time: d.end_time || null, place: d.place || '', description: d.description || '' });
        toast('บันทึกแล้ว');
      } }, 'บันทึก')));
  }
}
