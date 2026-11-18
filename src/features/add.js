// เพิ่มงาน 4 แบบ (พิมพ์ · พูด · แนบรูป · ถ่ายรูป) → หน้าตรวจสอบ → บันทึก
// + เพิ่มโน้ตให้งาน · แก้ไขงาน · ดูรูปเต็มจอ
// กฎ: ไม่เดาเวลาเมื่อผู้ใช้ไม่ได้บอก (สเปก 3.1) · กดบันทึกซ้ำต้องไม่ได้งานซ้ำ · ข้อความที่พิมพ์ค้างต้องถามก่อนทิ้ง (สเปก 3)
import { h, ic, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { draftsFromText } from '../domain/parse.js';
import { TYPES, newId } from '../domain/tasks.js';
import { pickImage, prepareImage } from './images.js';
import { speechSupported, startListening } from './voice.js';
import { listenTask } from './listen.js';
import { app, S, subj, task, today, dueInfo, fullTitle, notesOf, urlOf, visibleSubjects } from './shared.js';
import { badge } from '../ui/kit.js';
import { addDaysYMD, fromYMD, relDay, DOW_SHORT } from '../domain/dates.js';

const typeOptions = sel => Object.entries(TYPES).map(([k, v]) => h('option', { value: k, selected: k === sel }, v));
const micBlock = msg => h('div', { style: { textAlign: 'center' } }, h('div.mic', { html: ic('mic') }), h('p.muted', msg));

async function getImage(camera) {
  const f = await pickImage({ camera });
  if (!f) return null;
  try { return await prepareImage(f); } catch (e) { toast(e.message); return null; }
}

/* ---------- ชิปเลือกเร็ว (แทนช่องกรอก) ---------- */
const nameShort = s => s.name.replace(/^ภาษา/, '');
/** ชิปวิชา: แตะเลือก · แตะซ้ำ = ไม่ระบุ */
export function subjChips(sel, onPick) {
  return h('div.qchips', { role: 'group', 'aria-label': 'วิชา' }, visibleSubjects().map(s =>
    h('button.qchip', { type: 'button', 'aria-pressed': String(s.id === sel), style: { '--c': s.color }, onclick: () => onPick(s.id === sel ? null : s.id) }, nameShort(s))));
}
/** ชิปวัน: วันนี้ · พรุ่งนี้ · 5 วันถัดไป · เลือกวัน (ปฏิทิน) · ไม่มีวันส่ง */
export function dayChips(sel, onPick) {
  const td = today(), days = Array.from({ length: 7 }, (_, i) => addDaysYMD(td, i));
  const label = (d, i) => i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : `${DOW_SHORT[fromYMD(d).getDay()]} ${fromYMD(d).getDate()}`;
  const other = sel && !days.includes(sel);
  const pick = h('input.qdate', { type: 'date', min: td, max: addDaysYMD(td, 365), value: other ? sel : '', 'aria-label': 'เลือกวันอื่น', onchange: e => { if (e.target.value) onPick(e.target.value); } });
  return h('div.qchips', { role: 'group', 'aria-label': 'วันส่ง' },
    days.map((d, i) => h('button.qchip', { type: 'button', 'aria-pressed': String(d === sel), onclick: () => onPick(d === sel ? null : d) }, label(d, i))),
    h('label.qchip.qpick', { 'aria-pressed': String(!!other) }, h('span', { html: ic('cal') }), other ? relDay(sel, td) : 'วันอื่น', pick));
}
export const dueText = d => {
  const t = { due_date: d.due_date, due_time: d.due_time, type: d.type };
  return d.due_date ? dueInfo(t).text : 'ไม่มีวันส่ง';
};
/** ปีแปลก ๆ (เช่นพิมพ์ปีผิดในช่องวันที่) ไม่รับ */
export const sane = ymd => !ymd || (ymd >= addDaysYMD(today(), -366) && ymd <= addDaysYMD(today(), 3 * 366)) ? ymd : null;

/** เพิ่มงานแบบเร็ว: พิมพ์ → เห็นผลทันที → แตะชิปแก้ → บันทึก (ไม่มีหน้าตรวจสอบแยก) · kind: text · photo · camera · voice (→ listen.js) */
export async function addTask(kind = 'text', preset = '') {
  if (kind === 'voice' && !speechSupported()) return voiceUnavailable('เครื่องนี้ใช้การพูดไม่ได้');
  if (kind === 'voice') return listenTask();
  let img = null;
  if (kind === 'photo' || kind === 'camera') { img = await getImage(kind === 'camera'); if (!img) return; }
  const ta = h('textarea.field.quick', { id: 'add-text', rows: 2, 'aria-label': 'งานที่ต้องทำ',
    placeholder: img ? 'งานในรูปคืออะไร? เช่น "ฟิสิกส์ แบบฝึก 4.1 ส่งศ."' : 'เช่น "คณิต ใบงาน 7 ส่งพน."' });
  ta.value = preset;
  const ov = { subject_id: undefined, due_date: undefined }; // ที่ผู้ใช้แตะชิปเลือกเอง (ใช้กับงานเดียว)
  const preview = h('div.qpreview', { 'aria-live': 'polite' });
  const key = newId('d');
  let drafts = [], saving = false;
  const saveBtn = h('button.btn.primary', { id: 'add-save', onclick: () => save() }, 'บันทึก');

  const current = () => drafts.map((d, i) => drafts.length === 1 ? { ...d,
    subject_id: ov.subject_id !== undefined ? ov.subject_id : d.subject_id,
    due_date: ov.due_date !== undefined ? ov.due_date : d.due_date } : d);
  function paint() {
    drafts = draftsFromText(ta.value, { now: new Date(), subjects: S().subjects });
    if (!drafts.length && img) drafts = [{ title: 'งานจากรูป', subject_id: null, type: 'homework', due_date: null, due_time: null }];
    const list = current();
    preview.replaceChildren(...list.map(d => h('div.qrow', badge(subj(d.subject_id)),
      h('div', h('b', d.title), h('small', dueText(d))))));
    if (list.length === 1) preview.append(
      subjChips(list[0].subject_id, id => { ov.subject_id = id; paint(); }),
      dayChips(list[0].due_date, d => { ov.due_date = d; paint(); }));
    saveBtn.disabled = !list.length;
    saveBtn.textContent = list.length > 1 ? `บันทึก ${list.length} งาน` : 'บันทึก';
  }
  async function save() {
    const items = current().filter(d => d.title).map((d, i) => ({ title: d.title, subject_id: d.subject_id || null, type: d.type || 'homework',
      due_date: sane(d.due_date), due_time: d.due_time || null, source: img ? 'photo' : 'text', draft_key: `${key}-${i}` }));
    if (!items.length || saving) return;
    saving = true; saveBtn.disabled = true;
    try {
      const saved = await app.store.addTasks(items);
      if (img && saved[0]) await app.store.addAttachment(saved[0].id, { kind: 'image', blob: img.blob, size: img.blob.size, mime_type: img.blob.type });
      closeModal();
      toast(`บันทึก ${saved.length} งานแล้ว`, saved[0] ? { label: 'ดูโน้ต', run: () => app.openNotes(saved[0].id) } : null);
    } catch (e) { saving = false; saveBtn.disabled = false; toast(e.message || 'บันทึกไม่สำเร็จ'); }
  }
  ta.addEventListener('input', paint);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } });
  openModal({
    title: img ? 'งานจากรูป' : 'พิมพ์งาน',
    body: h('div', img ? h('img.preview.small', { src: img.url, alt: 'รูปที่เลือก' }) : '', ta, preview),
    foot: saveBtn,
    isDirty: () => !saving && (!!ta.value.trim() || !!img),
  });
  paint();
  setTimeout(() => ta.focus(), 320);
}
export function voiceUnavailable(why) {
  openModal({ title: 'พูดงาน', body: h('div', h('p', why), h('p.muted', 'พิมพ์แทนได้ — ระบบแยกวิชาและวันส่งให้เหมือนกัน')),
    foot: h('button.btn.primary', { onclick: () => addTask('text') }, 'พิมพ์แทน') });
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

/** แก้ไขงาน: ชื่อ · วิชา · วัน · เวลา ก่อน — ที่เหลือพับไว้ใน "เพิ่มเติม" */
export function editTask(id) {
  const t = task(id); if (!t) return;
  const st = { subject_id: t.subject_id, due_date: t.due_date };
  const title = h('input.field', { id: 'e-title', value: t.title, maxlength: 200, 'aria-label': 'ชื่องาน' });
  const subjBox = h('div'), dayBox = h('div');
  const paintChips = () => {
    subjBox.replaceChildren(subjChips(st.subject_id, v => { st.subject_id = v; paintChips(); }));
    dayBox.replaceChildren(dayChips(st.due_date, v => { st.due_date = v; paintChips(); }));
  };
  paintChips();
  const time = h('input.field', { type: 'time', id: 'e-time', value: t.due_time || '' });
  const type = h('select.field', { id: 'e-type' }, typeOptions(t.type));
  const place = h('input.field', { id: 'e-place', value: t.place || '', placeholder: 'เช่น ห้อง 412' });
  const est = h('input.field', { type: 'number', id: 'e-est', min: 5, step: 5, value: t.est_min ? String(t.est_min) : '', placeholder: 'ไม่ระบุ' });
  const desc = h('textarea.field.short', { id: 'e-desc', placeholder: 'รายละเอียด' }); desc.value = t.description || '';
  const lab = (id2, txt, el) => h('div', h('label.flabel', { for: id2 }, txt), el);
  const notes = notesOf(id);
  openModal({
    title: 'แก้ไขงาน', isDirty: () => title.value.trim() !== t.title,
    body: h('div', title,
      h('div.flabel', 'วิชา'), subjBox,
      h('div.flabel', 'วันส่ง'), dayBox,
      lab('e-time', 'เวลา (ไม่ใส่ก็ได้)', time),
      h('details.more-fields', h('summary', 'เพิ่มเติม'),
        h('div.frow', lab('e-type', 'ประเภท', type), lab('e-place', 'สถานที่', place)),
        lab('e-est', 'ใช้เวลาประมาณ (นาที)', est), lab('e-desc', 'รายละเอียด', desc)),
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
        await app.store.patchTask(id, { title: title.value.trim(), subject_id: st.subject_id || null, type: type.value, due_date: sane(st.due_date), due_time: time.value || null, place: place.value.trim(), est_min: +est.value || null, description: desc.value.trim() });
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
