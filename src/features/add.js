// แผ่นเพิ่มงาน: พิมพ์ (หลายบรรทัด = หลายงาน) · พูด · แนบรูป · ถ่ายรูป · ฟอร์มทีละช่อง · วันสอบ
// ทุกทางที่ระบบ "ตีความ" ข้อความเอง ต้องผ่านหน้าตรวจสอบก่อนบันทึกเสมอ (สเปก 3.1)
import { h, ICON, toast } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { draftsFromText } from '../domain/parse.js';
import { TYPES, newId } from '../domain/tasks.js';
import { toYMD } from '../domain/dates.js';
import { startListening, speechSupported } from './voice.js';
import { pickImage, prepareImage } from './images.js';

let store;
export function initAdd(s) { store = s; }

const subjectsForParse = () => store.state.subjects.filter(s => !s.hidden);

/** เปิดแผ่นเพิ่มงาน · mode: menu | type | speak | attach | camera | form | exam | paste */
export function openAdd(mode = 'menu', preset = {}) {
  const sh = openSheet({ title: 'เพิ่มงาน', state: mode === 'menu' ? 'compact' : 'expanded' });
  const go = { menu, type: typeView, speak, attach: () => imageFlow(false), camera: () => imageFlow(true), form: () => review([blank(preset)], { manual: true }), exam: () => review([blank({ ...preset, type: 'exam' })], { manual: true }), paste };
  (go[mode] || menu)();

  function menu() {
    sh.setTitle('เพิ่มงาน'); sh.setState('compact'); sh.setDirty(() => false);
    const main = [
      ['speak', 'mic', 'พูด', 'บอกงานด้วยเสียง'], ['attach', 'image', 'แนบรูป', 'จากอัลบั้ม/แชท'],
      ['type', 'pen', 'พิมพ์', 'หลายบรรทัด = หลายงาน'], ['camera', 'camera', 'ถ่ายรูป', 'กระดาน · ใบงาน'],
    ];
    sh.setBody(
      h('div.qgrid', main.map(([k, ic, b, s]) => h('button.qbtn', { onclick: () => go[k]() }, h('span.ic', { html: ICON[ic] }), h('b', b), h('small', s)))),
      h('div.opts',
        h('button', { onclick: paste }, h('span', { html: ICON.paste }), h('span', 'วางข้อความจากครู', h('small', 'ก๊อปจากไลน์/แชทแล้ววาง'))),
        h('button', { onclick: () => go.form() }, h('span', { html: ICON.form }), h('span', 'พิมพ์เองทีละช่อง', h('small', 'กรอกวิชา ชื่องาน วันส่งเอง'))),
        h('button', { onclick: () => go.exam() }, h('span', { html: ICON.exam }), h('span', 'เพิ่มวันสอบ', h('small', 'วิชา หัวข้อ วัน เวลา ห้องสอบ'))),
        h('button', { disabled: true, 'aria-disabled': 'true' }, h('span', { html: ICON.spark }), h('span', 'ผู้ช่วย AI', h('small', 'ยังไม่เปิดใช้ในรุ่นนี้'))),
      ));
    sh.setFoot();
  }

  // ---------- พิมพ์ ----------
  function typeView(initial = '') {
    sh.setTitle('พิมพ์งาน'); sh.setState('expanded');
    const ta = h('textarea.in', { id: 'add-text', rows: 6, placeholder: 'เช่น คณิตทำแบบฝึกหัดหน้า 20 ส่งวันศุกร์\nอังกฤษ ท่องศัพท์วันพุธ', 'aria-label': 'ข้อความงาน' });
    ta.value = initial;
    sh.setDirty(() => ta.value.trim().length > 0);
    const next = h('button.btn.blue.block', { onclick: () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      let drafts;
      try { drafts = draftsFromText(text, { subjects: subjectsForParse() }); }
      catch { drafts = [blank({ title: text.split('\n')[0] })]; toast('ตัวแกะข้อความไม่พร้อม — กรอกเองได้เลย'); }
      review(drafts, { back: () => typeView(text) });
    } }, 'ตรวจสอบก่อนบันทึก');
    sh.setBody(
      h('label.f', { for: 'add-text' }, 'พิมพ์งาน 1 บรรทัดต่อ 1 งาน'),
      ta,
      h('p.hint', 'บอกวิชา งาน และวันส่งในประโยคเดียวได้เลย ระบบจะแยกให้แล้วให้ตรวจก่อนบันทึก'),
    );
    sh.setFoot(next);
    setTimeout(() => ta.focus(), 280);
  }

  async function paste() {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { /* ไม่ให้สิทธิ์ก็พิมพ์/วางเองได้ */ }
    typeView(text);
    if (!text) toast('กดค้างในช่องแล้วเลือก "วาง" ได้เลย');
  }

  // ---------- พูด ----------
  function speak() {
    sh.setTitle('พูดงาน'); sh.setState('compact'); sh.setDirty(() => false);
    if (!speechSupported()) {
      sh.setBody(h('div.empty', h('b', 'เบราว์เซอร์นี้ยังฟังเสียงไม่ได้'), 'พิมพ์แทนได้เลย ข้อความจะถูกแยกเป็นงานให้เหมือนกัน'));
      sh.setFoot(h('button.btn.blue.block', { onclick: () => typeView() }, 'พิมพ์แทน'));
      return;
    }
    const live = h('p', { 'aria-live': 'polite', style: { minHeight: '48px', textAlign: 'center', color: 'var(--text-2)' } }, 'กำลังฟัง… พูดได้เลย');
    const stopBtn = h('button.btn.blue.block', 'หยุดฟัง');
    sh.setBody(h('div.listening', h('div.pulse', { html: ICON.mic }), live),
      h('p.hint', { style: { textAlign: 'center' } }, 'ใช้ระบบฟังเสียงของเบราว์เซอร์ · SABAii ไม่เก็บไฟล์เสียง'));
    sh.setFoot(stopBtn);
    let finalText = '';
    const session = startListening({
      onText: (txt, isFinal) => { live.textContent = txt; if (isFinal) finalText = txt; },
      onEnd: (txt, err) => {
        const text = (txt || finalText).trim();
        if (err) {
          const why = err === 'not-allowed' ? 'ไม่ได้อนุญาตไมโครโฟน' : err === 'no-speech' ? 'ไม่ได้ยินเสียง' : err === 'network' ? 'ต่ออินเทอร์เน็ตไม่ได้' : 'ฟังไม่สำเร็จ';
          sh.setBody(h('div.empty', h('b', why), 'พิมพ์แทนได้เลย หรือลองพูดอีกครั้ง'));
          sh.setFoot(h('div.row', h('button.btn', { onclick: speak }, 'ลองอีกครั้ง'), h('button.btn.blue', { onclick: () => typeView(text) }, 'พิมพ์แทน')));
          return;
        }
        typeView(text); // ให้แก้ข้อความที่ฟังผิดได้ก่อนแยกเป็นงาน
      },
    });
    stopBtn.onclick = () => session.stop();
    sh.onClose(() => session.abort());
  }

  // ---------- รูป ----------
  async function imageFlow(camera) {
    sh.setTitle(camera ? 'ถ่ายรูป' : 'แนบรูป'); sh.setState('compact');
    const pickBtn = h('button.btn.blue.block', camera ? 'เปิดกล้อง' : 'เลือกรูปจากเครื่อง');
    const altBtn = camera && h('button.btn.block', { style: { marginTop: '8px' } }, 'เลือกรูปจากเครื่องแทน');
    const run = async (useCamera) => {
      let file;
      try { file = await pickImage({ camera: useCamera }); } catch { return; }
      if (!file) return;
      let img;
      try { img = await prepareImage(file); }
      catch (e) { toast(e.message || 'เปิดรูปนี้ไม่ได้'); return; }
      imageReview(img);
    };
    pickBtn.onclick = () => run(camera);
    if (altBtn) altBtn.onclick = () => run(false);
    sh.setBody(h('div.empty', h('b', camera ? 'ถ่ายใบงานหรือกระดาน' : 'เลือกรูปใบงาน/แชทจากครู'), 'รูปจะติดไปกับงานเป็นโน้ต · รองรับ JPEG PNG WebP'));
    sh.setFoot(h('div', pickBtn, altBtn));
  }

  function imageReview(img) {
    sh.setTitle('งานจากรูป'); sh.setState('expanded');
    let rotation = 0;
    const pv = h('img.preview', { src: img.url, alt: 'รูปที่เลือก' });
    const ta = h('textarea.in', { rows: 3, id: 'img-text', placeholder: 'เช่น ฟิสิกส์ แบบฝึกบท 3 ส่งพรุ่งนี้ 8 โมง' });
    sh.setDirty(() => true);
    const rotate = h('button.btn', { onclick: () => { rotation = (rotation + 90) % 360; pv.style.transform = `rotate(${rotation}deg)`; } }, 'หมุนรูป');
    sh.setBody(pv, h('div.row', { style: { marginTop: '8px' } }, rotate),
      h('label.f', { for: 'img-text' }, 'งานในรูปนี้คืออะไร'), ta,
      h('p.hint', 'การอ่านตัวหนังสือจากรูปอัตโนมัติ (OCR) ยังไม่เปิดในรุ่นนี้ — พิมพ์สั้น ๆ แล้วระบบจะแยกวิชาและวันส่งให้'));
    sh.setFoot(h('button.btn.blue.block', { onclick: async () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); toast('พิมพ์ชื่องานสั้น ๆ ก่อน'); return; }
      const blob = rotation ? await img.rotated(rotation) : img.blob;
      let drafts;
      try { drafts = draftsFromText(text, { subjects: subjectsForParse() }).slice(0, 1); } catch { drafts = [blank({ title: text })]; }
      review(drafts, { image: { blob, size: blob.size, mime_type: blob.type }, back: () => imageReview(img) });
    } }, 'ตรวจสอบก่อนบันทึก'));
  }

  // ---------- หน้าตรวจสอบ ----------
  function review(drafts, { back, image, manual } = {}) {
    drafts = drafts.map(d => ({ ...d, draft_key: d.draft_key || newId('d') }));
    sh.setTitle(manual ? (drafts[0].type === 'exam' ? 'เพิ่มวันสอบ' : 'เพิ่มงาน') : `ตรวจสอบ ${drafts.length} งาน`);
    sh.setState('expanded');
    sh.setDirty(() => drafts.length > 0);
    const holder = h('div');
    const saveBtn = h('button.btn.green.block');
    const render = () => {
      holder.replaceChildren(...drafts.map((d, i) => draftEditor(d, i, drafts.length > 1 ? () => { drafts.splice(i, 1); render(); } : null)));
      saveBtn.textContent = drafts.length > 1 ? `บันทึก ${drafts.length} งาน` : 'บันทึกงาน';
      saveBtn.disabled = !drafts.length;
    };
    render();
    saveBtn.onclick = async () => {
      const bad = drafts.findIndex(d => !String(d.title || '').trim());
      if (bad >= 0) { toast('งานที่ ' + (bad + 1) + ' ยังไม่มีชื่อ'); holder.querySelectorAll('input[name=title]')[bad]?.focus(); return; }
      saveBtn.disabled = true;
      try {
        const saved = await store.addTasks(drafts.map(clean));
        if (image && saved[0]) await store.addAttachment(saved[0].id, { kind: 'image', ...image });
        sh.setDirty(() => false); sh.close();
        toast(saved.length > 1 ? `บันทึกแล้ว ${saved.length} งาน` : 'บันทึกแล้ว');
      } catch (e) {
        saveBtn.disabled = false;
        toast('บันทึกไม่สำเร็จ: ' + (e.message || 'ลองอีกครั้ง'));
      }
    };
    sh.setBody(
      !manual && h('p.hint', 'ระบบแยกให้จากข้อความ ช่องสีส้มคือส่วนที่ระบบไม่แน่ใจ แก้ได้ก่อนบันทึก'),
      holder,
      back && h('button.btn.ghost.block', { style: { marginTop: '12px' }, onclick: back }, 'กลับไปแก้ข้อความ'),
    );
    sh.setFoot(saveBtn);
  }
}

function blank(p = {}) {
  return { title: p.title || '', subject_id: p.subject_id || null, subject_name: '', type: p.type || 'homework', due_date: p.due_date || null, due_time: null, flags: {} };
}
function clean(d) {
  const { flags, raw, ...rest } = d;
  return rest;
}

/** ฟอร์มแก้ร่าง 1 ชิ้น — ใช้ทั้งหน้าตรวจสอบและหน้าแก้ไขงาน */
export function draftEditor(d, i, onRemove, subjects = store.state.subjects) {
  const f = d.flags || {};
  const id = k => `d${i}-${k}`;
  const set = (k, v) => { d[k] = v; };
  const live = subjects.filter(s => !s.hidden || s.id === d.subject_id);

  const subjSel = h('select.in', { id: id('subj'), class: f.noSubject ? 'warn' : '', onchange: e => {
    const v = e.target.value;
    if (v.startsWith('new:')) { set('subject_id', null); set('subject_name', v.slice(4)); }
    else { set('subject_id', v || null); set('subject_name', ''); }
  } },
    h('option', { value: '' }, 'ไม่ระบุวิชา'),
    live.map(s => h('option', { value: s.id, selected: s.id === d.subject_id }, s.name)),
    !d.subject_id && d.subject_name && h('option', { value: 'new:' + d.subject_name, selected: true }, `+ วิชาใหม่: ${d.subject_name}`));

  const typeSeg = h('div.seg', { role: 'group', 'aria-label': 'ประเภท' }, Object.entries({ homework: 'การบ้าน', exam: 'สอบ', project: 'งานกลุ่ม', activity: 'กิจกรรม' }).map(([k, label]) =>
    h('button', { type: 'button', 'aria-pressed': String(d.type === k), onclick: e => {
      set('type', k);
      e.currentTarget.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      examBox.hidden = k !== 'exam';
      dateLbl.textContent = k === 'exam' ? 'วันสอบ' : 'วันส่ง';
      timeLbl.textContent = k === 'exam' ? 'เวลาเริ่ม' : 'เวลา';
    } }, label)));

  const date = h('input.in', { type: 'date', id: id('date'), value: d.due_date || '', class: (f.noDate || f.dateFuzzy) ? 'warn' : '', onchange: e => set('due_date', e.target.value || null) });
  const time = h('input.in', { type: 'time', id: id('time'), value: d.due_time || '', onchange: e => set('due_time', e.target.value || null) });
  const dateLbl = h('label.f', { for: id('date') }, d.type === 'exam' ? 'วันสอบ' : 'วันส่ง');
  const timeLbl = h('label.f', { for: id('time') }, d.type === 'exam' ? 'เวลาเริ่ม' : 'เวลา');
  const examBox = h('div', { hidden: d.type !== 'exam' },
    h('div.two', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
      h('div', h('label.f', { for: id('end') }, 'เวลาสิ้นสุด (ถ้ารู้)'), h('input.in', { type: 'time', id: id('end'), value: d.end_time || '', onchange: e => set('end_time', e.target.value || null) })),
      h('div', h('label.f', { for: id('place') }, 'ห้องสอบ (ถ้ารู้)'), h('input.in', { id: id('place'), value: d.place || '', onchange: e => set('place', e.target.value) }))));

  return h('div.draft',
    h('div.dh', h('b', onRemove ? `งานที่ ${i + 1}` : ''), onRemove && h('button.btn.danger', { style: { height: '36px', padding: '0 10px' }, onclick: onRemove }, 'ลบออก')),
    h('label.f', { for: id('title') }, d.type === 'exam' ? 'หัวข้อสอบ' : 'ชื่องาน'),
    h('input.in', { id: id('title'), name: 'title', value: d.title || '', maxlength: 200, oninput: e => set('title', e.target.value) }),
    h('label.f', { for: id('subj') }, 'วิชา'), subjSel,
    f.noSubject && h('p.hint.warn', 'ไม่เจอชื่อวิชาในข้อความ'),
    h('label.f', 'ประเภท'), typeSeg,
    h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
      h('div', dateLbl, date), h('div', timeLbl, time)),
    f.noDate ? h('p.hint.warn', 'ไม่เจอวันที่ในข้อความ — ใส่เองหรือเว้นไว้ก็ได้')
      : f.dateFuzzy ? h('p.hint.warn', 'ระบบไม่แน่ใจวันที่ ตรวจอีกที')
      : f.noTime ? h('p.hint', 'ไม่ได้ระบุเวลา — ระบบจะไม่เดาเวลาให้') : null,
    examBox,
    h('label.f', { for: id('desc') }, 'รายละเอียด (ไม่ใส่ก็ได้)'),
    h('textarea.in', { id: id('desc'), rows: 2, style: { minHeight: '64px' }, oninput: e => set('description', e.target.value) }, d.description || ''),
  );
}
export { TYPES, toYMD };
