// โปรไฟล์บนเซิร์ฟเวอร์ (ตาราง profiles) ตามค่าในเครื่อง — เครื่องยังเป็นตัวหลัก เซิร์ฟเวอร์รู้ไว้ทำสถิติ/แสดงชื่อ
//   เปิดแอป = touch (ยังใช้อยู่) · ชื่อเล่น · วันที่ทำแบบสอบถาม · เขตเวลาของเครื่อง
//   ส่งเฉพาะค่าที่เปลี่ยนจากครั้งก่อน (จำไว้ในเครื่องต่อบัญชี) · ล้ม/ออฟไลน์ = ข้าม รอบหน้าส่งใหม่เอง
const KEY = uid => `sabaii-profile-sent:${uid}`;

/** ค่าที่ควรอยู่บนเซิร์ฟเวอร์ จาก prefs ในเครื่อง · ชื่อว่าง = ไม่ส่ง (ไม่ลบชื่อจาก Google) */
export function profilePatch(prefs = {}, tz = '') {
  const p = {};
  const name = String(prefs.display_name || '').trim().slice(0, 60);
  if (name) p.display_name = name;
  if (prefs.onboarded_at) p.onboarded_at = prefs.onboarded_at;
  if (tz) p.timezone = tz;
  return p;
}

export function createProfileSync({ cloud, getPrefs, storage = globalThis.localStorage, tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } } }) {
  let timer = 0, running = null;
  const read = uid => { try { return JSON.parse(storage.getItem(KEY(uid)) || '{}'); } catch { return {}; } };
  const write = (uid, v) => { try { storage.setItem(KEY(uid), JSON.stringify(v)); } catch {} };

  async function push() {
    const uid = cloud.user()?.id;
    if (!uid) return;
    const want = profilePatch(getPrefs(), tz()), sent = read(uid);
    const diff = Object.fromEntries(Object.entries(want).filter(([k, v]) => sent[k] !== v));
    if (!Object.keys(diff).length) return;
    try { await cloud.updateProfile(diff); write(uid, { ...sent, ...diff }); } catch {}
  }
  const run = () => (running ||= push().finally(() => { running = null; }));

  return {
    /** เปิดแอป: touch + ส่งค่าที่ค้าง */
    async start() { if (!cloud.user()) return; await cloud.touch(); await run(); },
    /** prefs เปลี่ยน → ส่งภายใน 3 วินาที (รวบหลายครั้งเป็นครั้งเดียว) */
    changed() { clearTimeout(timer); timer = setTimeout(run, 3000); },
    flush: run,
  };
}
