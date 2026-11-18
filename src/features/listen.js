// ปุ่ม "พูด" — 2 โหมด
//   ฉันพูดเอง      : พูดสั้น ๆ ทีละงาน (เหมือนเดิม) · หลายบรรทัด = หลายงาน
//   ครูกำลังสั่งงาน : ฟังยาว ๆ ท้ายคาบ · เบราว์เซอร์หยุดเองตอนเงียบ → ฟังต่อให้จนกว่าจะกดหยุด
//                    แยกงานด้วย tasksFromSpeech · ทุกงานเก็บประโยคที่ครูพูดจริงเป็นโน้ต
// ไม่เก็บไฟล์เสียง — Web Speech ของเบราว์เซอร์ถอดเสียงให้ (บน Chrome ส่งเสียงไปถอดที่เซิร์ฟเวอร์ของผู้ผลิตเบราว์เซอร์)
import { h, toast, openModal, closeModal, badge } from '../ui/kit.js';
import { draftsFromText } from '../domain/parse.js';
import { tasksFromSpeech } from '../domain/speech.js';
import { newId } from '../domain/tasks.js';
import { startListening } from './voice.js';
import { app, S, subj } from './shared.js';
import { subjChips, dayChips, dueText, sane, voiceUnavailable } from './add.js';

export const MODES = { self: 'ฉันพูดเอง', teacher: 'ครูกำลังสั่งงาน' };
export const listenMode = () => (S().prefs.listen_mode === 'teacher' ? 'teacher' : 'self');
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'start-failed', 'language-not-supported']);
const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export function listenTask() {
  let mode = listenMode();
  const ta = h('textarea.field.quick', { id: 'add-text', 'aria-label': 'ข้อความที่ได้ยิน · แก้ได้' });
  const segBox = h('div.seg.lmode', { role: 'group', 'aria-label': 'ใครพูด' });
  const status = h('div.lstatus', { 'aria-live': 'polite' });
  const toggleBtn = h('button.btn.ghost.lbtn', { type: 'button', id: 'listen-toggle', onclick: () => (listening ? stop() : listen()) });
  const preview = h('div.qpreview', { 'aria-live': 'polite' });
  const saveBtn = h('button.btn.primary', { id: 'add-save', onclick: () => save() }, 'บันทึก');
  const key = newId('d');
  const ov = { subject_id: undefined, due_date: undefined }; // ฉันพูดเอง: ชิปที่แตะเอง (งานเดียว)
  let classSubj = null;     // ครูพูด: วิชาของคาบนี้ ใช้กับทุกงาน
  const off = new Set();    // ครูพูด: งานที่ติ๊กออก (จำด้วยประโยคดิบ)
  let rec = null, listening = false, userStop = false, prefix = '', startedAt = 0, tick = null, saving = false, restarts = 0;

  function current() {
    const opts = { now: new Date(), subjects: S().subjects };
    if (mode === 'teacher') return tasksFromSpeech(ta.value, opts).map(d => ({ ...d, subject_id: classSubj || d.subject_id }));
    const ds = draftsFromText(ta.value, opts);
    return ds.map(d => (ds.length === 1 ? { ...d,
      subject_id: ov.subject_id !== undefined ? ov.subject_id : d.subject_id,
      due_date: ov.due_date !== undefined ? ov.due_date : d.due_date } : d));
  }
  const chosen = list => (mode === 'teacher' ? list.filter(d => !off.has(d.raw)) : list).filter(d => d.title);

  function paintStatus() {
    status.replaceChildren(listening ? h('i.ldot') : '', listening ? `กำลังฟัง ${mmss(Date.now() - startedAt)}` : 'หยุดฟังแล้ว');
    toggleBtn.textContent = listening ? 'หยุดฟัง' : 'ฟังต่อ';
  }
  function paint() {
    segBox.replaceChildren(...Object.entries(MODES).map(([k, v]) => h('button', { type: 'button', 'aria-pressed': String(k === mode), onclick: () => {
      if (k === mode) return;
      mode = k; off.clear(); app.store.setPref('listen_mode', k, false); paint();
      if (k === 'teacher' && !listening && !saving) listen();
    } }, v)));
    ta.rows = mode === 'teacher' ? 4 : 2;
    ta.placeholder = mode === 'teacher' ? 'เปิดไว้ตอนครูสั่งงาน ข้อความจะขึ้นตรงนี้ · แก้ได้' : 'พูดชื่องาน วิชา และวันส่ง เช่น "คณิต ใบงาน 7 ส่งศุกร์"';
    const list = current();
    if (mode === 'teacher') {
      preview.replaceChildren(
        h('div.lsec', list.length ? `ได้ ${list.length} งาน` : ta.value.trim() ? 'ยังไม่เจองาน — รอครูพูดต่อ หรือแก้ข้อความด้านบน' : 'ยังไม่ได้ยินงาน'),
        ...list.map(d => h('label.qrow.lrow' + (off.has(d.raw) ? '.off' : ''),
          h('input', { type: 'checkbox', checked: !off.has(d.raw), 'aria-label': `เก็บงาน ${d.title}`, onchange: e => { e.target.checked ? off.delete(d.raw) : off.add(d.raw); paint(); } }),
          badge(subj(d.subject_id)),
          h('div', h('b', d.title), h('small', dueText(d)), h('span.lquote', `ครูพูด: “${d.raw}”`)))),
        list.length ? h('div.lsec', 'วิชาของคาบนี้') : '',
        list.length ? subjChips(classSubj, id => { classSubj = id; paint(); }) : '');
    } else {
      preview.replaceChildren(...list.map(d => h('div.qrow', badge(subj(d.subject_id)), h('div', h('b', d.title), h('small', dueText(d))))));
      if (list.length === 1) preview.append(
        subjChips(list[0].subject_id, id => { ov.subject_id = id; paint(); }),
        dayChips(list[0].due_date, d => { ov.due_date = d; paint(); }));
    }
    const n = chosen(list).length;
    saveBtn.disabled = !n;
    saveBtn.textContent = n > 1 ? `บันทึก ${n} งาน` : 'บันทึก';
  }

  function listen() {
    userStop = false; listening = true; prefix = ta.value.trim();
    if (!startedAt) startedAt = Date.now();
    clearInterval(tick); tick = setInterval(paintStatus, 1000);
    rec = startListening({
      onText: t => { ta.value = (prefix ? prefix + ' ' : '') + t; paint(); },
      onEnd: (t, err) => {
        rec = null;
        if (userStop || saving) return;
        if (err && FATAL.has(err) && !ta.value.trim()) {
          listening = false; clearInterval(tick); closeModal(true);
          return voiceUnavailable(err === 'not-allowed' ? 'ไม่ได้อนุญาตให้ใช้ไมโครโฟน' : 'เครื่องนี้ฟังไม่ได้ ลองใหม่หรือพิมพ์แทน');
        }
        // ครูพูด: เบราว์เซอร์หยุดเองเมื่อเงียบ → ฟังต่อ (กันวนไม่รู้จบด้วยเพดาน)
        if (mode === 'teacher' && !(err && FATAL.has(err)) && restarts < 60) { restarts++; return listen(); }
        if (mode === 'self' && err && !ta.value.trim()) { listening = false; clearInterval(tick); closeModal(true); return voiceUnavailable('ฟังไม่ได้ยิน ลองใหม่หรือพิมพ์แทน'); }
        listening = false; clearInterval(tick); paintStatus();
      },
    });
    paintStatus();
  }
  function stop() { userStop = true; listening = false; clearInterval(tick); rec?.stop(); paintStatus(); }

  async function save() {
    const list = chosen(current());
    const items = list.map((d, i) => ({ title: d.title, subject_id: d.subject_id || null, type: d.type || 'homework',
      due_date: sane(d.due_date), due_time: d.due_time || null, source: mode === 'teacher' ? 'teacher' : 'voice', draft_key: `${key}-${i}` }));
    if (!items.length || saving) return;
    saving = true; saveBtn.disabled = true; stop();
    try {
      const saved = await app.store.addTasks(items);
      if (mode === 'teacher') {
        const when = new Date().toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        for (const t of saved) {
          const d = list[items.findIndex(x => x.draft_key === t.draft_key)];
          if (d?.raw) await app.store.addAttachment(t.id, { kind: 'text', text: `ครูพูด · ${when}\n“${d.raw.slice(0, 1800)}”` });
        }
      }
      closeModal(true);
      toast(`บันทึก ${saved.length} งานแล้ว`, saved[0] ? { label: 'ดูโน้ต', run: () => app.openNotes(saved[0].id) } : null);
    } catch (e) { saving = false; saveBtn.disabled = false; toast(e.message || 'บันทึกไม่สำเร็จ'); }
  }

  ta.addEventListener('input', () => { if (!listening) prefix = ta.value.trim(); paint(); });
  openModal({
    title: 'พูดงาน',
    body: h('div', segBox, h('div.lbar', status, toggleBtn), ta, preview,
      h('p.lnote', 'ไม่เก็บไฟล์เสียง · เบราว์เซอร์ถอดเสียงให้ (ต้องต่อเน็ต)')),
    foot: saveBtn,
    isDirty: () => !saving && !!ta.value.trim(),
    onClose: () => { userStop = true; listening = false; clearInterval(tick); rec?.abort(); },
  });
  paint();
  listen();
}
