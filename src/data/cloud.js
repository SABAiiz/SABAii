// คุยกับหลังบ้าน (Supabase โปรเจกต์ "sabaii") ด้วย fetch ล้วน — ไม่มีไลบรารี ไม่มีขั้นตอน build
// บัญชี: อีเมล → รหัส 6 หลัก (หรือกดลิงก์ในอีเมล) · ข้อมูล: ตาราง items + ฟังก์ชัน sync_push · รูป: Storage "attachments"
export const SUPABASE_URL = 'https://mojdvfzalfemenpxsoub.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_fEGsNd2FTZw-7mLK90Nlhg_rmulCvqC'; // คีย์สาธารณะ (ใส่ในแอปได้) — สิทธิ์จริงคุมด้วย RLS
const AUTH_KEY = 'sabaii-auth';
const BUCKET = 'attachments';

/** ข้อผิดพลาดที่บอกผู้ใช้ได้ตรง ๆ · offline = ไม่มีเน็ต/ต่อเซิร์ฟเวอร์ไม่ได้ */
export class CloudError extends Error {
  constructor(message, { status = 0, code = '', offline = false } = {}) { super(message); this.status = status; this.code = code; this.offline = offline; }
}

const THAI = {
  otp_expired: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว ขอรหัสใหม่ได้เลย',
  over_email_send_rate_limit: 'ขอรหัสถี่เกินไป รอสักครู่แล้วลองใหม่',
  over_request_rate_limit: 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่',
  email_address_invalid: 'อีเมลนี้ใช้ไม่ได้ ตรวจตัวสะกดอีกครั้ง',
  validation_failed: 'อีเมลไม่ถูกต้อง',
  signup_disabled: 'ตอนนี้ยังเปิดรับสมัครบัญชีใหม่ไม่ได้',
  email_address_not_authorized: 'ระบบส่งอีเมลยังไม่เปิดให้อีเมลนี้ (ผู้ดูแลต้องตั้งค่าเซิร์ฟเวอร์ส่งอีเมลก่อน)',
};

function memoryStorage() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
function safeStorage() { try { const s = globalThis.localStorage; s.getItem('x'); return s; } catch { return memoryStorage(); } }

export function createCloud({ url = SUPABASE_URL, key = SUPABASE_KEY, storage = safeStorage(), fetchFn = (...a) => globalThis.fetch(...a), now = () => Date.now() } = {}) {
  const listeners = new Set();
  let session = null;
  try { session = JSON.parse(storage.getItem(AUTH_KEY) || 'null'); } catch { session = null; }
  let refreshing = null;

  const save = s => {
    session = s;
    try { s ? storage.setItem(AUTH_KEY, JSON.stringify(s)) : storage.removeItem(AUTH_KEY); } catch {}
    listeners.forEach(fn => fn(user()));
  };
  const user = () => session?.user ? { id: session.user.id, email: session.user.email } : null;
  const fromAuth = j => ({
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at ? j.expires_at * 1000 : now() + (Number(j.expires_in) || 3600) * 1000,
    user: j.user ? { id: j.user.id, email: j.user.email } : session?.user || null,
  });

  async function raw(path, { method = 'GET', body, headers = {}, token, json = true } = {}) {
    const h = { apikey: key, ...headers };
    if (token) h.Authorization = 'Bearer ' + token;
    if (body !== undefined && json) h['Content-Type'] = 'application/json';
    let r;
    try { r = await fetchFn(url + path, { method, headers: h, body: body === undefined ? undefined : json ? JSON.stringify(body) : body }); }
    catch { throw new CloudError('ต่อเซิร์ฟเวอร์ไม่ได้ — ไม่มีเน็ตหรือเน็ตช้า', { offline: true }); }
    if (r.ok) return r;
    let j = {};
    try { j = await r.json(); } catch {}
    const code = j.error_code || j.code || j.error || '';
    const msg = THAI[code] || (r.status === 429 ? THAI.over_request_rate_limit : j.msg || j.message || j.error_description || `เซิร์ฟเวอร์ตอบ ${r.status}`);
    throw new CloudError(msg, { status: r.status, code: String(code) });
  }

  async function refresh() {
    if (!session?.refresh_token) throw new CloudError('ยังไม่ได้เข้าสู่ระบบ', { status: 401 });
    refreshing ||= (async () => {
      try {
        const r = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
        save(fromAuth(await r.json()));
      } catch (e) {
        if (!e.offline && e.status >= 400 && e.status < 500) save(null); // refresh token ใช้ไม่ได้แล้ว = ต้องเข้าสู่ระบบใหม่
        throw e;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }
  async function token() {
    if (!session) throw new CloudError('ยังไม่ได้เข้าสู่ระบบ', { status: 401 });
    if (session.expires_at - now() < 60_000) await refresh();
    return session.access_token;
  }
  /** เรียก API ในนามผู้ใช้ · token หมดอายุกลางทาง → ต่ออายุแล้วลองอีกครั้งเดียว */
  async function api(path, opts = {}) {
    try { return await raw(path, { ...opts, token: await token() }); }
    catch (e) {
      if (e.status !== 401 || !session) throw e;
      await refresh();
      return raw(path, { ...opts, token: session.access_token });
    }
  }

  return {
    user, onChange: fn => (listeners.add(fn), () => listeners.delete(fn)),

    async sendCode(email) {
      const e = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new CloudError('อีเมลไม่ถูกต้อง');
      await raw('/auth/v1/otp', { method: 'POST', body: { email: e, create_user: true } });
      return e;
    },
    async verifyCode(email, code) {
      const token = String(code || '').replace(/\D/g, '');
      if (token.length < 6) throw new CloudError('ใส่รหัสให้ครบ');
      const r = await raw('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: String(email).trim().toLowerCase(), token } });
      save(fromAuth(await r.json()));
      return user();
    },
    /** กดลิงก์ในอีเมลแล้วกลับมาที่แอป: #access_token=…&refresh_token=… → เข้าสู่ระบบ · คืน true ถ้าเป็นลิงก์เข้าสู่ระบบ */
    async takeLinkSession(hash) {
      const p = new URLSearchParams(String(hash || '').replace(/^#\/?/, ''));
      if (p.get('error_description')) throw new CloudError(p.get('error_code') === 'otp_expired' ? THAI.otp_expired : p.get('error_description'));
      if (!p.get('access_token') || !p.get('refresh_token')) return false;
      const s = fromAuth({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: Number(p.get('expires_at')) || 0 });
      const r = await raw('/auth/v1/user', { token: s.access_token });
      const u = await r.json();
      save({ ...s, user: { id: u.id, email: u.email } });
      return true;
    },
    async signOut() {
      if (session) { try { await raw('/auth/v1/logout?scope=local', { method: 'POST', token: session.access_token }); } catch {} }
      save(null);
    },

    /** แถวที่เปลี่ยนหลัง seq ที่เคยดึง เรียงตาม seq */
    async pull(after = 0, limit = 500) {
      const r = await api(`/rest/v1/items?select=kind,id,data,deleted,updated_at,seq&seq=gt.${Number(after) || 0}&order=seq.asc&limit=${limit}`);
      return r.json();
    },
    async push(items) {
      const r = await api('/rest/v1/rpc/sync_push', { method: 'POST', body: { p_items: items } });
      return r.json();
    },

    filePath: id => `${user()?.id}/${id}`,
    async upload(id, blob) {
      await api(`/storage/v1/object/${BUCKET}/${user().id}/${encodeURIComponent(id)}`, { method: 'POST', body: blob, json: false, headers: { 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true', 'cache-control': '31536000' } });
    },
    async download(id) {
      const r = await api(`/storage/v1/object/authenticated/${BUCKET}/${user().id}/${encodeURIComponent(id)}`);
      return r.blob();
    },
    async removeFiles(ids) {
      if (!ids.length) return;
      await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: ids.map(id => `${user().id}/${id}`) } });
    },
    /** ลบบัญชีถาวร: รูปทั้งหมด → แถวทั้งหมด + บัญชี (ฝั่งเซิร์ฟเวอร์) → ออกจากระบบ */
    async deleteAccount() {
      const uid = user()?.id;
      if (!uid) throw new CloudError('ยังไม่ได้เข้าสู่ระบบ', { status: 401 });
      for (;;) {
        const r = await api(`/storage/v1/object/list/${BUCKET}`, { method: 'POST', body: { prefix: uid + '/', limit: 1000, offset: 0 } });
        const files = (await r.json()).filter(f => f.name);
        if (!files.length) break;
        await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: files.map(f => `${uid}/${f.name}`) } });
        if (files.length < 1000) break;
      }
      await api('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
      save(null);
    },
  };
}
