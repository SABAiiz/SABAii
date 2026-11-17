// เพิ่มงาน 4 แบบ (พิมพ์ · พูด · แนบรูป · ถ่ายรูป) → หน้าตรวจสอบ → บันทึก
// + เพิ่มโน้ตให้งาน · แก้ไขงาน · ดูรูปเต็มจอ
// กฎ: ไม่เดาเวลาเมื่อผู้ใช้ไม่ได้บอก (สเปก 3.1) · กดบันทึกซ้ำต้องไม่ได้งานซ้ำ · ข้อความที่พิมพ์ค้างต้องถามก่อนทิ้ง (สเปก 3)
import { h, ic, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { draftsFromText } from '../domain/parse.js';
import { TYPES, newId } from '../domain/tasks.js';
import { pickImage, prepareImage } from './images.js';
import { speechSupported, startListening } from './voice.js';
import { app, S, task, fullTitle, notesOf, urlOf, visibleSubjects } from './shared.js';

const subjOptions = sel => [h('option', { value: '' }, 'ไม่ระบุวิชา'), ...visibleSubjects().map(s => h('option', { value: s.id, selected: s.id === sel }, s.name))];
const typeOptions = sel => Object.entries(TYPES).map(([k, v]) => h('option', { value: k, selected: k === sel }, v));
const micBlock = msg => h('div', { style: { textAlign: 'center' } }, h('div.mic', { html: ic('mic') }), h('p.muted', msg));

async function getImage(camera) {
  const f = await pickImage({ camera });
  if (!f) return null;
  try { return await prepareImage(f); } catch (e) { toast(e.message); return null; }
}

/** kind: text · voice · photo · camera */
export async function addTask(kind = 'text', preset = '') {
  if (kind === 'voice' && !speechSupported()) return voiceUnavailable('เครื่องนี้ใช้การพูดไม่ได้');
  let img = null;
  if (kind === 'photo' || kind === 'camera') { img = await getImage(kind === 'camera'); if (!img) return; }
  const ta = h('textarea.field', { id: 'add-text', 'aria-label': 'งานที่ต้องทำ',
    placeholder: img ? 'งานในรูปคืออะไร? เช่น "ฟิสิกส์ แบบฝึก 4.1 ส่งศุกร์"' : 'เช่น "คณิต ใบงาน 7 ส่งศุกร์"\nวางข้อความจากครูได้เลย — หลายงานก็ได้ บรรทัดละงาน' });
  ta.value = preset;
  let rec = null;
  const body = h('div',
    img ? h('img.preview', { src: img.url, alt: 'รูปที่เลือก' }) : '',
    kind === 'voice' ? micBlock('กำลังฟัง… พูดชื่องาน วิชา และวันส่ง') : '',
    h('label.flabel', { for: 'add-text' }, img ? 'ชื่องาน (ยังไม่มีระบบอ่านรูปอัตโนมัติ — พิมพ์เอง)' : 'งานที่ต้องทำ'), ta);
  const m = openModal({
    title: kind === 'voice' ? 'พูดงาน' : img ? 'งานจากรูป' : 'พิมพ์งาน', body,
    foot: h('button.btn.primary', { onclick: () => { rec?.stop(); review(ta.value, img); } }, 'ตรวจสอบก่อนบันทึก'),
    isDirty: () => !!ta.value.trim() || !!img,
    onClose: () => rec?.abort(),
  });
  if (kind === 'voice') {
    rec = startListening({ onText: t => { ta.value = t; }, onEnd: (t, err) => { if (err && !t) { m.close(true); voiceUnavailable(err === 'not-allowed' ? 'ไม่ได้อนุญาตให้ใช้ไมโครโฟน' : 'ฟังไม่ได้ยิน ลองใหม่หรือพิมพ์แทน'); } } });
  } else setTimeout(() => ta.focus(), 320);
}
function voiceUnavailable(why) {
  openModal({ title: 'พูดงาน', body: h('div', h('p', why), h('p.muted', 'พิมพ์หรือวางข้อความแทนได้ — ระบบแยกวิชาและวันส่งให้เหมือนกัน')),
    foot: h('button.btn.primary', { onclick: () => addTask('text') }, 'พิมพ์แทน') });
}

function review(text, img) {
  const drafts = draftsFromText(text, { now: new Date(), subjects: S().subjects });
  if (!drafts.length) {
    if (!img) { toast('ยังไม่ได้พิมพ์อะไรเลย'); return; }
    drafts.push({ title: 'งานจากรูป', subject_id: null, type: 'homework', due_date: null, due_time: null, flags: { noSubject: true, noDate: true } });
  }
  const key = newId('d'); // กันกดบันทึกซ้ำ: ร่างชุดเดียวกันบันทึกได้ครั้งเดียว
  const rows = drafts.map((d, i) => {
    const title = h('input.field', { value: d.title, 'aria-label': `ชื่องานที่ ${i + 1}`, id: `d${i}-title` });
    const sub = h('select.field', { 'aria-label': 'วิชา', id: `d${i}-subj` }, subjOptions(d.subject_id));
    const type = h('select.field', { 'aria-label': 'ประเภท', id: `d${i}-type` }, typeOptions(d.type));
    const date = h('input.field', { type: 'date', value: d.due_date || '', 'aria-label': 'วันส่ง', id: `d${i}-date` });
    const time = h('input.field', { type: 'time', value: d.due_time || '', 'aria-label': 'เวลาส่ง', id: `d${i}-time` });
    const warn = [d.flags?.noSubject && 'ไม่รู้วิชา', d.flags?.noDate && 'ไม่รู้วันส่ง', (d.flags?.noTime || (d.due_date && !d.due_time)) && 'ไม่ได้ระบุเวลา — ระบบจะไม่เดาเวลาให้'].filter(Boolean);
    const el = h('div.draft', title, h('div.frow', sub, type), h('div.frow', date, time), warn.length ? h('p.warn', warn.join(' · ')) : '',
      drafts.length > 1 ? h('button.link', { onclick: () => { el.remove(); rows.splice(rows.indexOf(row), 1); saveBtn.textContent = `บันทึก ${rows.length} งาน`; } }, 'ไม่เอางานนี้') : '');
    const row = { el, i, get: () => ({ title: title.value.trim(), subject_id: sub.value || null, type: type.value, due_date: date.value || null, due_time: time.value || null, source: img ? 'photo' : 'text', draft_key: `${key}-${i}` }) };
    return row;
  });
  const saveBtn = h('button.btn.primary', {
    onclick: async () => {
      const items = rows.map(r => r.get()).filter(x => x.title);
      if (!items.length) return toast('ใส่ชื่องานก่อนนะ');
      saveBtn.disabled = true;
      try {
        const saved = await app.store.addTasks(items);
        if (img && saved[0]) await app.store.addAttachment(saved[0].id, { kind: 'image', blob: img.blob, size: img.blob.size, mime_type: img.blob.type });
        closeModal();
        toast(`บันทึก ${saved.length} งานแล้ว`, saved[0] ? { label: 'ดูโน้ต', run: () => app.openNotes(saved[0].id) } : null);
      } catch (e) { saveBtn.disabled = false; toast(e.message || 'บันทึกไม่สำเร็จ'); }
    },
  }, rows.length === 1 ? 'บันทึกงาน' : `บันทึก ${rows.length} งาน`);
  openModal({ title: 'ตรวจสอบก่อนบันทึก', body: h('div', img ? h('img.preview.small', { src: img.url, alt: 'รูปที่แนบ' }) : '', rows.map(r => r.el)),
    foot: [h('button.btn.ghost', { onclick: () => addTask('text', text) }, 'แก้ข้อความ'), saveBtn], isDirty: () => !saveBtn.disabled });
}

/** เพิ่มโน้ตให้งาน: photo · camera · text · voice · pick (ให้เลือก) */
export async function addNote(id, kind) {
  const t = task(id); if (!t) return;
  if (kind === 'pick') {
    openModal({ title: 'เพิ่มโน้ต', body: h('div.pills.col',
      h('button.pill', { onclick: () => addNote(id, 'camera'), html: ic('camera') + 'ถ่ายรูป' }),
      h('button.pill', { onclick: () => addNote(id, 'photo'), html: ic('img') + 'เลือกรูป' }),
      h('button.pill', { onclick: () => addNote(id, 'text'), html: ic('text') + 'จดข้อความ' }),
      h('button.pill', { onclick: () => addNote(id, 'voice'), html: ic('mic') + 'พูดเป็นข้อความ' })) });
    return;
  }
  if (kind === 'photo' || kind === 'camera') {
    closeModal();
    const img = await getImage(kind === 'camera'); if (!img) return;
    await app.store.addAttachment(id, { kind: 'image', blob: img.blob, size: img.blob.size, mime_type: img.blob.type });
    URL.revokeObjectURL(img.url);
    toast('เพิ่มรูปแล้ว'); return;
  }
  if (kind === 'voice' && !speechSupported()) { toast('เครื่องนี้ใช้พูดไม่ได้ — จดแทนนะ'); kind = 'text'; }
  const ta = h('textarea.field', { id: 'note-text', 'aria-label': 'ข้อความโน้ต', placeholder: 'ครูบอกอะไร? จำอะไรไว้? เช่น "ทำแค่ข้อคี่"' });
  let rec = null;
  openModal({
    title: `โน้ต · ${fullTitle(t)}`, body: h('div', kind === 'voice' ? micBlock('กำลังฟัง…') : '', ta),
    foot: h('button.btn.primary', { onclick: async () => {
      rec?.stop(); const v = ta.value.trim(); if (!v) return toast('ยังว่างอยู่');
      await app.store.addAttachment(id, { kind: 'text', text: v.slice(0, 2000) }); closeModal(); toast('จดโน้ตแล้ว');
    } }, 'บันทึกโน้ต'),
    isDirty: () => !!ta.value.trim(), onClose: () => rec?.abort(),
  });
  if (kind === 'voice') rec = startListening({ onText: v => { ta.value = v; }, onEnd: () => {} }); else setTimeout(() => ta.focus(), 320);
}

export function editTask(id) {
  const t = task(id); if (!t) return;
  const f = (tag, props, label) => { const el = h(tag, props); return [h('label.flabel', { for: props.id }, label), el]; };
  const [lt, title] = f('input.field', { id: 'e-title', value: t.title, maxlength: 200 }, 'ชื่องาน');
  const sub = h('select.field', { id: 'e-subj' }, subjOptions(t.subject_id));
  const type = h('select.field', { id: 'e-type' }, typeOptions(t.type));
  const date = h('input.field', { type: 'date', id: 'e-date', value: t.due_date || '' });
  const time = h('input.field', { type: 'time', id: 'e-time', value: t.due_time || '' });
  const place = h('input.field', { id: 'e-place', value: t.place || '', placeholder: 'เช่น ห้อง 412' });
  const est = h('input.field', { type: 'number', id: 'e-est', min: 5, step: 5, value: t.est_min ? String(t.est_min) : '', placeholder: 'ไม่ระบุ' });
  const desc = h('textarea.field.short', { id: 'e-desc', placeholder: 'รายละเอียดเพิ่มเติม' }); desc.value = t.description || '';
  const lab = (id2, txt, el) => h('div', h('label.flabel', { for: id2 }, txt), el);
  const notes = notesOf(id);
  openModal({
    title: 'แก้ไขงาน', isDirty: () => title.value.trim() !== t.title || desc.value !== (t.description || ''),
    body: h('div', lt, title, h('div.frow', lab('e-subj', 'วิชา', sub), lab('e-type', 'ประเภท', type)),
      h('div.frow', lab('e-date', 'วันส่ง / วันสอบ', date), lab('e-time', 'เวลา (ไม่ใส่ก็ได้)', time)),
      h('div.frow', lab('e-place', 'สถานที่', place), lab('e-est', 'ใช้เวลาประมาณ (นาที)', est)),
      lab('e-desc', 'รายละเอียด', desc),
      h('button.list-btn', { onclick: async () => { await app.store.patchTask(id, { pinned_at: t.pinned_at ? null : new Date().toISOString() }); closeModal(); toast(t.pinned_at ? 'เลิกปักหมุดแล้ว' : 'ปักไว้บนสุดแล้ว'); }, html: ic('pin') + `<span>${t.pinned_at ? 'เลิกปักหมุด' : 'ปักไว้บนสุดของงานแนะนำ'}</span>` }),
      notes.length ? h('div', h('label.flabel', `โน้ต ${notes.length} รายการ`), h('div.strip', notes.map(a => h('div.notewrap', miniOf(a),
        h('button.del', { 'aria-label': 'ลบโน้ตนี้', html: ic('trash'), onclick: async () => {
          if (!await confirmBox({ title: 'ลบโน้ตนี้?', ok: 'ลบ', danger: true })) return;
          await app.store.removeAttachment(a.id); closeModal(); editTask(id);
        } }))))) : ''),
    foot: [
      h('button.btn.danger', { onclick: async () => {
        if (!await confirmBox({ title: 'ลบงานนี้?', body: 'กู้คืนได้ทันทีจากปุ่ม "เลิกทำ" หลังลบ', ok: 'ลบงาน', danger: true })) return;
        await app.store.removeTask(id); closeModal(); toast('ลบงานแล้ว', { label: 'เลิกทำ', run: () => app.store.restoreTask(id) });
      } }, 'ลบ'),
      h('button.btn.primary', { onclick: async () => {
        if (!title.value.trim()) return toast('ต้องมีชื่องาน');
        await app.store.patchTask(id, { title: title.value.trim(), subject_id: sub.value || null, type: type.value, due_date: date.value || null, due_time: time.value || null, place: place.value.trim(), est_min: +est.value || null, description: desc.value.trim() });
        closeModal(); toast('บันทึกแล้ว');
      } }, 'บันทึก')],
  });
}

/** ภาพย่อโน้ตแบบ Canva: วาดโน้ตจริงขนาดเต็ม (กว้าง 300) แล้วย่อทั้งแผ่น */
const MINI_W = 300;
export function noteEl(a, i = 0) {
  const tilt = i % 2 ? 'tilt-r' : 'tilt-l';
  const d = new Date(a.created_at);
  const when = h('span.ntag', { html: ic(a.kind === 'text' ? 'text' : 'camera') },
    `${a.kind === 'text' ? 'จดเมื่อ' : 'ถ่ายเมื่อ'} ${d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);
  if (a.kind === 'image') {
    const src = urlOf(a);
    return h('div.nitem.photo.' + tilt, { style: { '--src': `url("${src}")` } },
      h('button.zoom', { 'aria-label': 'ดูรูปเต็มจอ', onclick: () => viewPhoto(src) }, h('img', { src, alt: 'รูปโน้ตของงาน', loading: 'lazy' })), when);
  }
  return h('div.nitem.sticky.' + tilt, a.text, when);
}
export function miniOf(a, w = 96, hgt = 128, cls = '') {
  const k = w / MINI_W;
  return h('div.mini' + cls, { style: { width: w + 'px', height: hgt + 'px' }, 'aria-hidden': 'true' },
    h('div.mini-in', { style: { width: MINI_W + 'px', height: Math.round(hgt / k) + 'px', transform: `scale(${k})` } }, noteEl(a)));
}
export function viewPhoto(src) {
  const box = h('div.viewer', { role: 'dialog', 'aria-label': 'รูปเต็มจอ', onclick: () => close() },
    h('img', { src, alt: 'รูปโน้ตของงาน' }), h('button.fab', { 'aria-label': 'ปิด', html: ic('close') }));
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { box.remove(); removeEventListener('keydown', onKey); };
  addEventListener('keydown', onKey);
  document.body.append(box);
}
