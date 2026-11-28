// บัญชีและซิงก์ (หน้า "ฉัน") — เข้าสู่ระบบด้วย Google → กลับมาที่แอป → ซิงก์ · ไม่ล็อกอินก็ใช้ได้ครบเหมือนเดิม (ข้อมูลอยู่ในเครื่อง)
import { h, ic, put, toast, openModal, closeModal, confirmBox } from '../ui/kit.js';
import { app } from './shared.js';

const hhmm = iso => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/** ข้อความสั้นของสถานะ — ใช้ทั้งในแถวหน้าฉันและในกล่องบัญชี */
export function syncLabel(st = app.sync?.status()) {
  if (!app.cloud?.user()) return 'ยังไม่เข้าสู่ระบบ';
  if (!st) return '';
  if (st.state === 'syncing') return 'กำลังซิงก์…';
  if (st.state === 'offline') return st.pending ? `ออฟไลน์ · รอส่ง ${st.pending}` : 'ออฟไลน์';
  if (st.state === 'error') return 'ซิงก์ไม่สำเร็จ';
  if (st.state === 'signedout') return 'ต้องเข้าสู่ระบบใหม่';
  return st.last ? `ซิงก์แล้ว ${hhmm(st.last)}` : 'ซิงก์แล้ว';
}

export function openAccount() { app.cloud.user() ? accountModal() : signInModal(); }

const G_LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

/** กลับมาที่หน้าเดิมของแอป (ไม่เอา ?/# ไปด้วย) — ต้องอยู่ในรายการ Redirect URLs ของ Supabase */
export const returnUrl = () => location.origin + location.pathname;

function signInModal() {
  const err = h('p.ferr', { role: 'alert' });
  const go = h('button.gbtn', { id: 'acc-google', type: 'button' }, h('span', { html: G_LOGO }), h('b', 'เข้าสู่ระบบด้วย Google'));
  go.onclick = async () => {
    err.textContent = ''; go.disabled = true; go.lastChild.textContent = 'กำลังไปที่ Google…';
    if (!navigator.onLine) { err.textContent = 'ต้องต่อเน็ตก่อนจึงจะเข้าสู่ระบบได้'; go.disabled = false; go.lastChild.textContent = 'เข้าสู่ระบบด้วย Google'; return; }
    try { location.assign(await app.cloud.googleUrl(returnUrl())); }
    catch (e) { err.textContent = e.message; go.disabled = false; go.lastChild.textContent = 'เข้าสู่ระบบด้วย Google'; }
  };
  openModal({ title: 'เข้าสู่ระบบ', isDirty: () => false, body: h('div',
    h('p', 'เข้าสู่ระบบแล้วงานและสมุดจะไม่หายเมื่อเปลี่ยนเครื่อง และเปิดได้ทุกเครื่อง'),
    go, err,
    h('p.muted.accnote', 'งานที่มีในเครื่องนี้จะขึ้นบัญชีไปด้วย · ไม่เข้าสู่ระบบก็ใช้ได้ครบเหมือนเดิม ข้อมูลอยู่ในเครื่อง')) });
}

/** หลังเข้าสู่ระบบ: เครื่องนี้เคยเป็นของบัญชีอื่น → ล้างเครื่องก่อน (ไม่ให้งานของคนอื่นปนเข้าบัญชีนี้) · ไม่งั้นซิงก์เลย */
export async function afterSignIn(u) {
  if (await app.sync.ownerConflict(u.id)) {
    const ok = await confirmBox({ title: 'เครื่องนี้มีงานของบัญชีอื่น', body: `ต้องล้างงานในเครื่องก่อนจึงจะใช้บัญชี ${u.email || u.name} ได้ (งานของบัญชีเดิมยังอยู่ในบัญชีนั้น)`, ok: 'ล้างแล้วใช้บัญชีนี้', danger: true });
    if (!ok) { await app.cloud.signOut(); return; }
    await wipeDevice();
    return;
  }
  toast(`เข้าสู่ระบบแล้ว · กำลังซิงก์งาน`);
  await app.sync.syncNow();
  const st = app.sync.status();
  toast(st.state === 'idle' ? 'ซิงก์งานเรียบร้อย' : st.error || syncLabel(st));
}

function accountModal() {
  const u = app.cloud.user();
  const line = h('p.accsync', { 'aria-live': 'polite' });
  const paint = st => put(line, h('span.dot.' + (st.state === 'idle' ? 'ok' : st.state === 'syncing' ? 'busy' : 'warn')), syncLabel(st),
    st.error && st.state !== 'idle' ? h('small', st.error) : '');
  const off = app.sync.onStatus(paint);
  paint(app.sync.status());

  openModal({ title: 'บัญชีและซิงก์', onClose: off, body: h('div',
    h('div.accuser', avatarEl(u), h('div', h('b', u.name || u.email), u.name ? h('small', u.email) : '', h('small', 'งานและสมุดซิงก์ทุกเครื่องที่เข้าบัญชีนี้'))),
    line,
    h('button.btn.ghost.full', { id: 'acc-sync', onclick: () => app.sync.syncNow() }, h('span', { html: ic('cloud') }), ' ซิงก์ตอนนี้'),
    h('div.mlist',
      h('button.list-btn', { id: 'acc-out', onclick: signOut }, h('span.mi', { html: ic('logout') }), h('span.lk', 'ออกจากระบบ', h('small', 'งานในเครื่องนี้จะถูกล้าง · ยังอยู่ในบัญชี'))),
      h('button.list-btn.dangertext', { id: 'acc-del', onclick: deleteAccount }, h('span.mi', { html: ic('trash') }), h('span.lk', 'ลบบัญชี', h('small', 'ลบบัญชี งาน และรูปบนคลาวด์ถาวร'))))) });
}

/** รูปโปรไฟล์ Google · โหลดไม่ได้ (ออฟไลน์) → ตัวอักษรแรก */
export function avatarEl(u, cls = 'span.avatar') {
  const el = h(cls, (u?.name || u?.email || '?').slice(0, 1).toUpperCase());
  if (u?.avatar) { const img = h('img', { src: u.avatar, alt: '', referrerpolicy: 'no-referrer' }); img.onerror = () => img.remove(); el.append(img); }
  return el;
}

async function signOut() {
  await app.sync.syncNow();
  const pending = await app.sync.pendingCount();
  const ok = await confirmBox({ title: 'ออกจากระบบ?',
    body: pending ? `ยังมี ${pending} รายการที่ยังไม่ได้ขึ้นบัญชี (ไม่มีเน็ต?) ถ้าออกตอนนี้รายการเหล่านี้จะหาย` : 'งานทั้งหมดอยู่ในบัญชีแล้ว · เครื่องนี้จะถูกล้าง เข้าสู่ระบบอีกครั้งงานจะกลับมา',
    ok: 'ออกจากระบบ', danger: !!pending });
  if (!ok) return;
  await app.cloud.signOut();
  await wipeDevice();
}

async function deleteAccount() {
  const ok = await confirmBox({ title: 'ลบบัญชีถาวร?', body: 'บัญชี งาน วิชา โน้ต และรูปทั้งหมดบนคลาวด์จะถูกลบ กู้คืนไม่ได้ · งานในเครื่องนี้จะถูกล้างด้วย', ok: 'ลบบัญชีถาวร', danger: true });
  if (!ok) return;
  try { await app.cloud.deleteAccount(); }
  catch (e) { toast(e.offline ? 'ต้องต่อเน็ตก่อนจึงจะลบบัญชีได้' : `ลบบัญชีไม่สำเร็จ: ${e.message}`); return; }
  await wipeDevice();
}

/** ล้างข้อมูลในเครื่องทั้งหมดแล้วเปิดแอปใหม่ (บัญชีบนคลาวด์ไม่ถูกแตะ) */
async function wipeDevice() {
  closeModal();
  await new Promise(res => { const r = indexedDB.deleteDatabase('sabaii'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  location.hash = '#/me';
  location.reload();
}
