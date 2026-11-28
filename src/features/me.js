// หน้า "ฉัน" (0.9 · ยกระดับ 26 พ.ย.) — หัววงรุ้ง + ชื่อไล่สี + วันต่อเนื่อง · การ์ดกรมท่า (วง 7 วัน · กราฟ · ค้าง/ใกล้ส่ง/ถึงสอบ แตะได้)
//   · ตั้งค่า (ไอคอนสี · สลับโหมดปุ่มพูดในแถว) · ข้อมูลของฉัน · "เร็ว ๆ นี้" เป็นการ์ดเล็ก · ท้ายหน้า = รุ่น + เกี่ยวกับ
import { h, ic, put, toast, openModal, closeModal, confirmBox, onBack, pushBack, dropBack } from '../ui/kit.js';
import { toYMD, fromYMD, addDaysYMD, daysBetween, DOW_SHORT } from '../domain/dates.js';
import { summary, isLive, nextExam, streakOf } from '../domain/tasks.js';
import { SUBJECT_COLORS } from '../data/store.js';
import { app, S, subj, today } from './shared.js';
import { MODES, listenMode } from './listen.js';
import { NOTE_STYLES, noteStyle, styleName, stylePreview } from './notestyle.js';
import { openOnboarding } from './onboard.js';
import { openAccount, syncLabel, avatarEl } from './account.js';

/** แอปใช้ธีมสว่างอย่างเดียว — ค่าธีมเก่าที่เคยเลือกไว้ไม่มีผลแล้ว */
export function applyTheme() { document.documentElement.dataset.theme = 'light'; }

// สีไอคอนแต่ละแถว (พื้นอ่อน + ไอคอนเข้ม) — ชุดเดียวกับปุ่มสติกเกอร์ในหน้าโน้ต
const TINT = { blue: ['#E7F0FE', '#0A6CF1'], pink: ['#FCE8F1', '#C2255C'], green: ['#E3F6EC', '#1E8A52'], yellow: ['#FFF4D1', '#B07800'],
  purple: ['#F0EAFE', '#6B35C2'], teal: ['#E0F5F5', '#0E7C86'], slate: ['#EEF1F6', '#3B4A6B'] };

export function meView(root) {
  const s = S(), td = today(), sum = summary(s.tasks, td);
  const name = s.prefs.display_name || '';
  const hasSamples = s.tasks.some(t => t.source === 'sample');
  const exam = nextExam(s.tasks.filter(isLive), td);

  const days = Array.from({ length: 7 }, (_, i) => addDaysYMD(td, i - 6));
  const doneBy = Object.fromEntries(days.map(d => [d, 0])), doneDays = new Set();
  for (const t of s.tasks) if (isLive(t) && t.status === 'done' && t.completed_at) { const d = toYMD(new Date(t.completed_at)); doneDays.add(d); if (d in doneBy) doneBy[d]++; }
  const week = Object.values(doneBy).reduce((a, b) => a + b, 0), max = Math.max(3, ...Object.values(doneBy)); // 1 งานไม่เต็มแท่ง
  const streak = streakOf(doneDays, td);
  const row = (icon, tint, label, value, onclick, { sub, extra } = {}) => h('button.list-btn', { onclick },
    h('span.mi', { style: { '--mb': TINT[tint][0], '--mc': TINT[tint][1] }, html: ic(icon) }), h('span.lk', label, sub ? h('small', sub) : ''), value != null ? h('span.lv', value) : '', extra || '', h('span.chev', { html: ic('right') }));
  const left = week + sum.open, pct = left ? week / left : 0, C = 2 * Math.PI * 36;
  const nSubj = s.subjects.filter(x => !x.hidden).length;
  const ringOn = h('span.rs', { html: `<svg viewBox="0 0 84 84"><defs><linearGradient id="me-rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9CC3FF"/><stop offset="1" stop-color="#4C8DFF"/></linearGradient></defs><circle cx="42" cy="42" r="36"/><circle class="on" cx="42" cy="42" r="36" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>` });
  requestAnimationFrame(() => requestAnimationFrame(() => ringOn.querySelector('.on')?.setAttribute('stroke-dashoffset', (C * (1 - pct)).toFixed(1)))); // วงค่อย ๆ เต็ม
  const mode = listenMode();
  const setMode = m => async e => { e.stopPropagation(); if (m === listenMode()) return; await app.store.setPref('listen_mode', m); toast(`ปุ่มพูดจะเริ่มที่ "${MODES[m]}"`); };
  const soon = (icon, label, onclick) => h('button.soon-tile', { onclick }, h('span.si', { html: ic(icon) }), h('b', label), h('small', 'ยังไม่เปิด'));
  const examSubj = exam && subj(exam.subject_id);

  put(root,
    // หัว: วงรุ้ง + ชื่อไล่สี (ชุดเดียวกับหน้าแรก) · ไฟต่อเนื่อง
    h('section.mehero',
      h('button.mavatar', { onclick: editName, 'aria-label': name ? 'แก้ชื่อ' : 'ตั้งชื่อ' }, h('span', (name || 'ฉ').slice(0, 1)), h('i', { html: ic('edit') })),
      h('div.mh-t',
        h('button.mh-name' + (name ? '' : '.unset'), { onclick: editName }, name || 'ตั้งชื่อเล่น'),
        h('small', `${nSubj} วิชา · ทำเสร็จแล้ว ${sum.done} งาน`),
        h('span.streak' + (streak ? '' : '.zero'), { html: ic('flame') }, streak ? `ทำต่อเนื่อง ${streak} วัน` : 'ทำงานเสร็จสัก 1 งาน เริ่มนับวันแรก'))),
    // การ์ดกรมท่าใบเดียว: ความคืบหน้า 7 วัน · กราฟ · ตัวเลขจากงานจริง (แตะตัวเลขไปหน้างาน)
    h('section.mecard', { 'aria-label': 'สรุปงาน' },
      h('div.mc-top',
        h('div.ring', { role: 'img', 'aria-label': `ทำเสร็จ ${week} จาก ${left} งาน` }, ringOn, h('b', `${week}/${left}`)),
        h('div', h('small', '7 วันนี้'), h('strong', week ? `ทำเสร็จ ${week} งาน` : 'ยังไม่มีงานเสร็จ', h('br'), h('span.mc-left', sum.open ? `เหลืออีก ${sum.open}` : 'ไม่มีงานค้าง')))),
      h('div.week', { role: 'img', 'aria-label': `งานที่ทำเสร็จ 7 วันล่าสุด รวม ${week} งาน` }, days.map((d, k) => {
        const n = doneBy[d];
        return h('div.wcol' + (d === td ? '.today' : ''), { style: { '--k': k } },
          h('div.wbar', n ? h('i', { style: { height: `${Math.max(16, n / max * 100)}%` } }, h('em', String(n))) : h('i.none')),
          h('span', d === td ? 'วันนี้' : DOW_SHORT[fromYMD(d).getDay()].replace('.', '')));
      })),
      h('div.stats',
        h('button.stat', { onclick: () => { location.hash = '#/tasks'; } }, h('b', String(sum.open)), h('small', 'งานค้าง')),
        h('button.stat', { onclick: () => { location.hash = '#/tasks'; } }, h('b', String(sum.soon)), h('small', 'ใกล้ส่ง')),
        h('button.stat.r', { onclick: () => (exam ? app.openNotes(exam.id) : (location.hash = '#/tasks')) },
          h('b', exam ? String(Math.max(0, daysBetween(td, exam.due_date))) : '—'), h('small', exam ? `วันถึงสอบ${examSubj.id ? ' ' + examSubj.name.replace(/^ภาษา/, '') : ''}` : 'ยังไม่มีสอบ')))),
    h('h2.msec', 'บัญชี'),
    h('div.mlist', accountRow(row)),
    h('h2.msec', 'ตั้งค่า'),
    h('div.mlist',
      row('layout', 'blue', 'หน้าโน้ตงาน', styleName(noteStyle()), stylePicker, { extra: h('img.mthumb', { src: stylePreview(noteStyle()), alt: '' }) }),
      // โหมดปุ่มพูด: สลับในแถวเลย ไม่ต้องเปิดกล่อง
      h('div.list-btn.mrow-seg', { role: 'group', 'aria-label': 'ปุ่มพูด เริ่มที่' },
        h('span.mi', { style: { '--mb': TINT.pink[0], '--mc': TINT.pink[1] }, html: ic('mic') }), h('span.lk', 'ปุ่มพูด เริ่มที่'),
        h('span.mseg', ['self', 'teacher'].map(m => h('button', { 'aria-pressed': String(m === mode), 'aria-label': MODES[m], onclick: setMode(m) }, m === 'self' ? 'พูดเอง' : 'ฟังครู')))),
      row('book', 'green', 'วิชาของฉัน', `${nSubj} วิชา`, subjectsModal),
      row('spark', 'yellow', 'งานตัวอย่าง', hasSamples ? 'ลบออก' : 'ลองใส่', toggleSamples),
      row('reset', 'purple', 'ตอบแบบสอบถามเริ่มต้นใหม่', null, () => openOnboarding({ redo: true }))),
    h('h2.msec', 'ข้อมูลของฉัน'),
    h('div.mlist',
      row('save', 'teal', 'สำรองข้อมูล', 'ไฟล์ JSON', exportData),
      row('restore', 'teal', 'กู้คืนจากไฟล์สำรอง', null, restoreModal),
      row('lock', 'slate', 'ข้อมูลและความเป็นส่วนตัว', app.cloud?.user() ? 'เครื่อง + บัญชี' : s.dbKind === 'indexeddb' ? 'เก็บในเครื่อง' : 'ชั่วคราว', privacyModal)),
    // แบบสอบถาม "เสียงนักเรียน" (/study/) — เปิดเต็มจอในแอป ตอบเสร็จการ์ดเปลี่ยนเป็นขอบคุณ
    h('h2.msec', 'ช่วยเราหน่อย'),
    h('button.studycard' + (s.prefs.study_done ? '.done' : ''), { onclick: s.prefs.study_done ? shareStudy : openStudy },
      h('span.sc-i', { html: ic(s.prefs.study_done ? 'check' : 'edit') }),
      h('span.sc-t', h('b', s.prefs.study_done ? 'ตอบแล้ว ขอบคุณมาก' : 'เล่าให้เราฟังหน่อย งานเยอะตรงไหน'),
        h('small', s.prefs.study_done ? 'ส่งลิงก์ให้เพื่อนในห้องช่วยตอบด้วยนะ' : '14 ข้อ ประมาณ 3 นาที ไม่ต้องใส่ชื่อ · ใช้ปรับ SABAii ให้ตรงกับนักเรียนจริง')),
      h('span.sc-go', s.prefs.study_done ? 'ส่งต่อ' : 'เริ่มตอบ')),
    // ยังไม่เปิด: การ์ดเล็ก 3 ใบ จาง ๆ
    h('h2.msec.msoon', 'เร็ว ๆ นี้'),
    h('div.soon-grid',
      soon('link', 'Google Classroom', () => notYet('Google Classroom', 'งานที่ครูโพสต์ใน Classroom จะเข้ามาในงานของคุณเอง และติ๊กเสร็จให้เมื่อส่งใน Classroom แล้ว')),
      soon('users', 'ห้องเรียน', () => notYet('ห้องเรียน', 'เพื่อนคนเดียวจดงาน ทั้งห้องได้งานครบ · ครูเลื่อนส่ง แก้ที่เดียวทุกคนได้')),
      soon('bell', 'การแจ้งเตือน', () => openModal({ title: 'การแจ้งเตือน', body: h('p', 'รุ่นนี้ยังแจ้งเตือนตอนปิดแอปไม่ได้ ดูงานด่วนได้ที่หน้าแรก งานใกล้ส่งเป็นตัวสีแดง') }))),
    h('button.mfoot', { onclick: aboutModal, 'aria-label': 'เกี่ยวกับ SABAii.com' }, h('span', h('b', 'SABAii.com'), ` · รุ่น ${globalThis.SABAII_VERSION || ''}`), h('small', { html: ic('lock') + (app.cloud?.user() ? 'งานอยู่ในเครื่องนี้ + บัญชีของคุณ' : 'งานทั้งหมดอยู่ในเครื่องนี้เท่านั้น') })),
  );
}

/** แถวบัญชี: ยังไม่เข้า = ปุ่มชวนเข้าสู่ระบบด้วย Google · เข้าแล้ว = รูป + อีเมล + สถานะซิงก์ */
function accountRow(row) {
  const u = app.cloud?.user();
  if (!u) return row('cloud', 'blue', 'เข้าสู่ระบบด้วย Google', null, openAccount, { sub: 'งานและสมุดไม่หายเมื่อเปลี่ยนเครื่อง' });
  const st = h('span.lv', { id: 'me-sync' }, syncLabel());
  return h('button.list-btn', { onclick: openAccount },
    avatarEl(u, 'span.mi.accpic'), h('span.lk', u.name || 'บัญชีและซิงก์', h('small', u.email)), st, h('span.chev', { html: ic('right') }));
}

/* ---------- แบบสอบถาม "เสียงนักเรียน" แบบเต็มจอ (iframe ของ /study/ — ต้องออนไลน์) ---------- */
let studyEl = null;
function closeStudy(fromPop = false) {
  if (!studyEl) return;
  const el = studyEl; studyEl = null;
  if (!fromPop) dropBack('study');
  el.classList.remove('show'); setTimeout(() => el.remove(), 250);
}
onBack(() => { if (!studyEl) return false; closeStudy(true); return true; });
window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.data?.type !== 'sabaii-study') return;
  if (e.data.done && !S().prefs.study_done) app.store.setPref('study_done', true);
  if (e.data.close) { closeStudy(); toast('ขอบคุณที่ช่วยตอบ'); }
});
function openStudy() {
  if (!navigator.onLine) { toast('ต้องต่ออินเทอร์เน็ตก่อน แบบสอบถามถึงจะเปิดได้'); return; }
  if (studyEl) return;
  const src = new URL('/study/?src=app&embed=1', location.origin).href;
  studyEl = h('section.studysheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'แบบสอบถาม เสียงนักเรียน' },
    h('div.ss-head', h('b', 'เสียงนักเรียน'), h('button.iconbtn', { 'aria-label': 'ปิด', onclick: () => closeStudy(), html: ic('close') })),
    h('iframe', { src, title: 'แบบสอบถาม เสียงนักเรียน' }));
  document.body.append(studyEl);
  requestAnimationFrame(() => studyEl?.classList.add('show'));
  pushBack({ study: 1 });
}

function shareStudy() {
  const url = new URL('/study/', location.origin).href;
  const msg = 'ช่วยตอบแบบสอบถามสั้น ๆ (3 นาที) เรื่องงานเยอะ ลืมส่ง จดไม่ทัน หน่อยนะ ไม่ต้องใส่ชื่อ\n' + url;
  openModal({ title: 'ชวนเพื่อนตอบ', body: h('div',
    h('p.muted', 'ยิ่งเพื่อนตอบเยอะ แอปยิ่งตรงกับที่นักเรียนต้องการ'),
    h('p', h('b', url)),
    h('div.study-share',
      h('a.btn.primary', { href: 'https://line.me/R/share?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, 'ส่งทาง LINE'),
      h('button.btn.ghost', { onclick: async () => { try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch { toast('คัดลอกไม่ได้ กดค้างที่ลิงก์แทน'); } } }, 'คัดลอกลิงก์'),
      h('button.btn.ghost', { onclick: () => { closeModal(); openStudy(); } }, 'ตอบอีกครั้ง'))) });
}

function aboutModal() {
  openModal({ title: 'เกี่ยวกับ SABAii.com', body: h('div',
    h('p', 'แอปจัดการงานเรียน: เพิ่มงานง่าย รู้ว่าต้องทำอะไร และไม่พลาดกำหนดส่ง'),
    h('p.muted', `รุ่น ${globalThis.SABAII_VERSION || ''} · รุ่นทดลอง · เข้าสู่ระบบด้วย Google และซิงก์ได้แล้ว · ยังไม่มีการอ่านรูปอัตโนมัติ และการแจ้งเตือนตอนปิดแอป`)) });
}
function stylePicker() {
  const cur = noteStyle();
  openModal({ title: 'หน้าโน้ตงาน', label: 'เลือกหน้าตาหน้าโน้ตงาน', body: h('div',
    h('p.muted', 'ทุกแบบใช้งานเหมือนกัน ต่างกันที่หน้าตา · ดูได้ตอนดึงหน้าแรกลง'),
    h('div.stylegrid', NOTE_STYLES.map(st => h('button.stylepick', { 'aria-pressed': String(st.id === cur), onclick: async () => {
      await app.store.setPref('note_style', st.id); closeModal(); toast(`เปลี่ยนเป็นแบบ "${st.name}" แล้ว`);
    } }, h('img', { src: stylePreview(st.id), alt: '', loading: 'lazy' }), h('b', st.name))))) });
}
function notYet(name, what) {
  openModal({ title: name, body: h('div', h('p', what), h('p.muted', 'ยังไม่เปิดในรุ่นนี้ — ต้องมีบัญชีและเซิร์ฟเวอร์ก่อน ตอนนี้งานทั้งหมดอยู่ในเครื่องนี้เท่านั้น')) });
}
function editName() {
  const inp = h('input.field', { id: 'me-name', value: S().prefs.display_name || '', maxlength: 40, 'aria-label': 'ชื่อที่แสดง', placeholder: 'ชื่อเล่น' });
  openModal({ title: 'ชื่อที่แสดง', body: h('div', inp, h('p.muted', 'ไม่ต้องใส่ชื่อจริง ไม่ต้องบอกโรงเรียน')),
    foot: h('button.btn.primary', { onclick: async () => { await app.store.setPref('display_name', inp.value.trim()); closeModal(); } }, 'บันทึก') });
  setTimeout(() => inp.focus(), 300);
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
    ...(app.cloud?.user() ? [
      h('p', `งาน วิชา รูป โน้ต และสมุดเก็บในเครื่องนี้ และซิงก์ขึ้นบัญชี ${app.cloud.user().email} (เซิร์ฟเวอร์ในสิงคโปร์ · เห็นได้เฉพาะเจ้าของบัญชี)`),
      h('p.muted', 'ปุ่มด้านล่างล้างเฉพาะเครื่องนี้ งานในบัญชียังอยู่ · ลบบัญชีถาวรได้ที่แถวบัญชีด้านบนของหน้าฉัน'),
    ] : [
      h('p', 'งาน วิชา รูป โน้ต และสมุดทั้งหมดเก็บอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น ยังไม่มีการส่งขึ้นเซิร์ฟเวอร์ (จนกว่าจะเข้าสู่ระบบ)'),
      h('p.muted', 'ถ้าล้างข้อมูลเบราว์เซอร์หรือลบแอป ข้อมูลจะหาย — เข้าสู่ระบบด้วย Google หรือสำรองเป็นไฟล์ไว้ก่อน'),
    ]),
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
