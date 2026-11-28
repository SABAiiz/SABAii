// คุยกับหลังบ้าน (Supabase โปรเจกต์ "sabaii") ด้วย fetch ล้วน — ไม่มีไลบรารี ไม่มีขั้นตอน build
// บัญชี: โปรไฟล์ในตาราง profiles (สร้างเองตอนสมัคร) · เข้าสู่ระบบด้วย Google / Facebook / Apple (OAuth + PKCE) หรืออีเมล (รหัส 6 หลักทางอีเมล) · ข้อมูล: ตาราง items + ฟังก์ชัน sync_push · รูป + เนื้อหาหน้าสมุด: Storage "attachments"
export const SUPABASE_URL = 'https://mojdvfzalfemenpxsoub.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_fEGsNd2FTZw-7mLK90Nlhg_rmulCvqC'; // คีย์สาธารณะ (ใส่ในแอปได้) — สิทธิ์จริงคุมด้วย RLS
const AUTH_KEY = 'sabaii-auth', PKCE_KEY = 'sabaii-pkce';
const BUCKET = 'attachments';

/** ข้อผิดพลาดที่บอกผู้ใช้ได้ตรง ๆ · offline = ไม่มีเน็ต/ต่อเซิร์ฟเวอร์ไม่ได้ */
export class CloudError extends Error {
  constructor(message, { status = 0, code = '', offline = false } = {}) { super(message); this.status = status; this.code = code; this.offline = offline; }
}

const THAI = {
  access_denied: 'ยกเลิกการเข้าสู่ระบบแล้ว',
  bad_code_verifier: 'ลิงก์เข้าสู่ระบบหมดอายุ ลองกดเข้าสู่ระบบอีกครั้ง',
  flow_state_not_found: 'ลิงก์เข้าสู่ระบบหมดอายุ ลองกดเข้าสู่ระบบอีกครั้ง',
  flow_state_expired: 'ลิงก์เข้าสู่ระบบหมดอายุ ลองกดเข้าสู่ระบบอีกครั้ง',
  provider_disabled: 'ยังเปิดวิธีเข้าสู่ระบบนี้ไม่ได้ (ผู้ดูแลต้องตั้งค่าในเซิร์ฟเวอร์ก่อน)',
  validation_failed: 'ยังเปิดวิธีเข้าสู่ระบบนี้ไม่ได้ (ผู้ดูแลต้องตั้งค่าในเซิร์ฟเวอร์ก่อน)',
  otp_expired: 'รหัสหมดอายุหรือไม่ถูกต้อง ลองขอรหัสใหม่',
  email_address_invalid: 'อีเมลนี้ใช้ไม่ได้ ตรวจตัวสะกดอีกครั้ง',
  email_provider_disabled: 'ยังเปิดเข้าสู่ระบบด้วยอีเมลไม่ได้ (ผู้ดูแลต้องตั้งค่าในเซิร์ฟเวอร์ก่อน)',
  over_email_send_rate_limit: 'ขอรหัสบ่อยเกินไป รอสักครู่แล้วลองใหม่',
  signup_disabled: 'ตอนนี้ยังเปิดรับสมัครบัญชีใหม่ไม่ได้',
  over_request_rate_limit: 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่',
};

const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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
  const user = () => session?.user ? { ...session.user } : null;
  /** ชื่อ/รูปจากผู้ให้บริการ (user_metadata) — เก็บแค่ที่ใช้แสดง */
  const person = u => u ? { id: u.id, email: u.email || '', name: u.user_metadata?.full_name || u.user_metadata?.name || '', avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || '' } : null;
  const fromAuth = j => ({
    access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: j.expires_at ? j.expires_at * 1000 : now() + (Number(j.expires_in) || 3600) * 1000,
    user: j.user ? person(j.user) : session?.user || null,
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

    /** ขั้น 1: ไปหน้าเลือกบัญชีของ Google / Facebook / Apple · PKCE — เก็บรหัสลับไว้ในเครื่อง ส่งไปแค่ค่าแฮช (ใครดักลิงก์กลับได้ก็ใช้แทนไม่ได้) */
    async oauthUrl(provider, returnTo) {
      const verifier = b64url(randomBytes(48));
      try { storage.setItem(PKCE_KEY, verifier); } catch {}
      // crypto.subtle มีเฉพาะหน้า https/localhost — เปิดผ่าน http (ลองในวง LAN) ใช้แบบ plain แทน
      const sha = globalThis.crypto?.subtle;
      const challenge = sha ? b64url(new Uint8Array(await sha.digest('SHA-256', new TextEncoder().encode(verifier)))) : verifier;
      const q = new URLSearchParams({ provider, redirect_to: returnTo, code_challenge: challenge, code_challenge_method: sha ? 's256' : 'plain' });
      return `${url}/auth/v1/authorize?${q}`;
    },
    googleUrl(returnTo) { return this.oauthUrl('google', returnTo); },
    /** อีเมล: ขอรหัส 6 หลัก (บัญชีใหม่สร้างให้เอง) → ผู้ใช้กรอกรหัสที่ได้ทางอีเมล — ไม่ต้องออกจากแอป ไม่ต้องตั้งรหัสผ่าน */
    async sendEmailCode(email) {
      await raw('/auth/v1/otp', { method: 'POST', body: { email: String(email).trim(), create_user: true } });
    },
    async verifyEmailCode(email, code) {
      const r = await raw('/auth/v1/verify', { method: 'POST', body: { type: 'email', email: String(email).trim(), token: String(code).replace(/\D/g, '') } });
      save(fromAuth(await r.json()));
    },
    /** ขั้น 2: ผู้ให้บริการส่งกลับมาที่แอปพร้อม ?code=… → แลกเป็นการเข้าสู่ระบบ · คืน true ถ้าเป็นลิงก์กลับจากการเข้าสู่ระบบ
        ยกเลิก/ล้ม → ?error=…&error_description=… (บางครั้งมาทาง #) */
    async finishRedirect(search, hash = '') {
      const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
      const hq = new URLSearchParams(String(hash || '').replace(/^#\/?/, ''));
      const err = q.get('error') || hq.get('error');
      if (err) {
        const code = q.get('error_code') || hq.get('error_code') || err;
        throw new CloudError(THAI[code] || THAI[err] || q.get('error_description') || hq.get('error_description') || 'เข้าสู่ระบบไม่สำเร็จ', { code });
      }
      const code = q.get('code');
      if (!code) return false;
      let verifier = null;
      try { verifier = storage.getItem(PKCE_KEY); storage.removeItem(PKCE_KEY); } catch {}
      if (!verifier) throw new CloudError('ลิงก์เข้าสู่ระบบนี้ไม่ได้เริ่มจากเครื่องนี้ ลองกดเข้าสู่ระบบอีกครั้ง');
      const r = await raw('/auth/v1/token?grant_type=pkce', { method: 'POST', body: { auth_code: code, code_verifier: verifier } });
      save(fromAuth(await r.json()));
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
    /** เนื้อหาหน้าสมุด (เส้น ข้อความ ตำแหน่งรูป) เป็นไฟล์ JSON — ใหญ่เกินเก็บในแถว */
    async uploadJSON(name, obj) { await this.upload(name, new Blob([JSON.stringify(obj)], { type: 'application/json' })); },
    async downloadJSON(name) { return JSON.parse(await (await this.download(name)).text()); },
    async removeFiles(ids) {
      if (!ids.length) return;
      await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: ids.map(id => `${user().id}/${id}`) } });
    },
    /** โปรไฟล์บนเซิร์ฟเวอร์ (ตาราง profiles — สร้างเองตอนสมัคร) · null = ยังไม่มี (บัญชีเพิ่งสร้างกำลังเขียน) */
    async profile() {
      const r = await api(`/rest/v1/profiles?select=*&id=eq.${encodeURIComponent(user()?.id || '')}`);
      return (await r.json())[0] || null;
    },
    /** แก้ได้แค่: display_name avatar_url locale timezone onboarded_at terms_version terms_accepted_at (role แก้ไม่ได้) */
    async updateProfile(patch) {
      const ok = ['display_name', 'avatar_url', 'locale', 'timezone', 'onboarded_at', 'terms_version', 'terms_accepted_at'];
      const body = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => ok.includes(k)));
      if (!Object.keys(body).length) return this.profile();
      const r = await api(`/rest/v1/profiles?id=eq.${encodeURIComponent(user()?.id || '')}`, { method: 'PATCH', body, headers: { Prefer: 'return=representation' } });
      return (await r.json())[0] || null;
    },
    /** เปิดแอป = ยังใช้อยู่ (เซิร์ฟเวอร์เขียนจริงอย่างมาก 1 ครั้ง / 10 นาที) · ล้มก็ไม่เป็นไร */
    async touch() { try { await api('/rest/v1/rpc/touch_last_seen', { method: 'POST', body: {} }); } catch {} },
    /** ประวัติบัญชีล่าสุด (สมัคร · เข้าสู่ระบบ · ผูกวิธีเข้าใหม่) */
    async accountEvents(limit = 20) {
      const r = await api(`/rest/v1/account_events?select=type,provider,created_at&order=created_at.desc&limit=${Number(limit) || 20}`);
      return r.json();
    },
    /** ลบบัญชีถาวร: รูปทั้งหมด → แถวทั้งหมด + บัญชี (ฝั่งเซิร์ฟเวอร์) → ออกจากระบบ · reason = เหตุผล (ไม่ใส่ก็ได้ เก็บแบบไม่ระบุตัวตน) */
    async deleteAccount(reason = '') {
      const uid = user()?.id;
      if (!uid) throw new CloudError('ยังไม่ได้เข้าสู่ระบบ', { status: 401 });
      for (;;) {
        const r = await api(`/storage/v1/object/list/${BUCKET}`, { method: 'POST', body: { prefix: uid + '/', limit: 1000, offset: 0 } });
        const files = (await r.json()).filter(f => f.name);
        if (!files.length) break;
        await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: files.map(f => `${uid}/${f.name}`) } });
        if (files.length < 1000) break;
      }
      await api('/rest/v1/rpc/delete_my_account', { method: 'POST', body: reason ? { p_reason: String(reason).slice(0, 500) } : {} });
      save(null);
    },
  };
}
