// ซิงก์ข้อมูลในเครื่อง ⇄ บัญชี — เครื่องเป็นตัวหลักเสมอ (ใช้ออฟไลน์ได้เต็มที่) คลาวด์เป็นสำเนาที่ทุกเครื่องเห็นตรงกัน
//
// 1) ทุกครั้งที่แอปเขียน/ลบ งาน วิชา โน้ต/รูป หรือค่าตั้ง → จดชื่อแถวลงคิว outbox (แม้ยังไม่เข้าสู่ระบบ — เข้าเมื่อไหร่ส่งขึ้นทีเดียว)
// 2) ซิงก์ = ดึงแถวที่เปลี่ยนจากคลาวด์ (seq > ที่เคยดึง) → ส่งคิวขึ้นไป
// 3) แก้ชนกัน: ใครแก้ทีหลังชนะ (เทียบเวลาที่แก้ของแถวนั้น) · ลบ = ส่ง "ลบแล้ว" ขึ้นไปให้เครื่องอื่นลบตาม
// 4) รูปอัปขึ้น Storage ก่อนส่งแถว · เครื่องอื่นดาวน์โหลดตามทีหลัง (has_blob)
//    หน้าสมุด: แถวมีแค่หัวหน้า (เล่ม ลำดับ กระดาษ) · เนื้อหา = ไฟล์ page-<id>.json · รูปในหน้า = ไฟล์รูปแยกตาม id รูป
//    เครื่องอื่นได้หัวก่อน (need_body) แล้วโหลดเนื้อหาตาม · แก้หน้าในเครื่องเมื่อไหร่ = เนื้อหาในเครื่องชนะ
// 5) วิชาชื่อซ้ำกัน (เครื่องใหม่สร้างวิชาตั้งต้นเอง) → รวมเหลืออันเดียว ทุกเครื่องเลือกอันเดียวกัน (id น้อยสุด)
import { DEFAULT_SUBJECTS } from './store.js';

export const KIND = { tasks: 'task', subjects: 'subject', attachments: 'attachment', prefs: 'pref', books: 'book', pages: 'page' };
const BODY = ['strokes', 'texts', 'imgs', 'shapes', 'lines'];
const bodyFile = id => `page-${id}.json`;
const TABLE = Object.fromEntries(Object.entries(KIND).map(([t, k]) => [k, t]));
/** ค่าตั้งที่เป็นของเครื่องนี้เท่านั้น ไม่ส่งขึ้นบัญชี */
export const LOCAL_PREFS = new Set(['seeded']);
const PAGE = 500, BATCH = 200;
const pick = (o, keys) => o ? Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]])) : {};
const DEFAULT_NAMES = new Set(DEFAULT_SUBJECTS.map(([n]) => n));
/** เทียบ JSON แบบไม่สนลำดับคีย์ (Postgres jsonb เรียงคีย์ใหม่) */
const stable = v => v && typeof v === 'object' && !Array.isArray(v)
  ? '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  : Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : JSON.stringify(v ?? null);

export function createSync({ db, cloud, now = () => new Date(), debounceMs = 1500, timers = globalThis }) {
  let store = null;
  let running = null, again = false, timer = null;
  const status = { state: cloud.user() ? 'idle' : 'signedout', last: null, error: '', pending: 0 };
  const listeners = new Set();
  const setStatus = patch => { Object.assign(status, patch); listeners.forEach(fn => fn({ ...status })); };
  const iso = () => now().toISOString();

  async function mark(kind, id) {
    await db.put('outbox', { key: `${kind}:${id}`, kind, id, at: iso() });
    if (cloud.user()) schedule();
  }
  /** ห่อที่เก็บข้อมูลให้ store ใช้: เขียน/ลบแถวไหน → เข้าคิวส่งเอง (ไม่ต้องแก้โค้ดจออื่นเลย) */
  const trackedDB = {
    kind: db.kind,
    all: s => db.all(s),
    async put(s, v) {
      const r = await db.put(s, v);
      const k = KIND[s], id = s === 'prefs' ? v.key : v.id;
      if (k && !(s === 'prefs' && LOCAL_PREFS.has(id))) await mark(k, id);
      return r;
    },
    async del(s, id) {
      await db.del(s, id);
      if (KIND[s] && !(s === 'prefs' && LOCAL_PREFS.has(id))) await mark(KIND[s], id);
    },
  };

  const meta = async k => (await db.all('meta')).find(m => m.key === k)?.value;
  const setMeta = (k, value) => db.put('meta', { key: k, value });

  function localValue(kind, id) {
    const s = store.state;
    if (kind === 'pref') return id in s.prefs ? { key: id, value: s.prefs[id] } : null;
    return s[TABLE[kind]].find(x => x.id === id) || null;
  }
  /** แถวที่ส่งขึ้นคลาวด์: รูปไม่ไปกับแถว (ไปทาง Storage) แค่บอกว่ามีรูป */
  function wire(kind, v) {
    if (kind === 'page') {
      const { strokes, texts, imgs, shapes, lines, need_body, ...head } = v;
      return { ...head, has_body: true };
    }
    if (kind !== 'attachment') return v;
    const { blob, ...rest } = v;
    return { ...rest, has_blob: !!blob || !!v.has_blob };
  }

  // ---------- ดึง ----------
  async function pull() {
    const uid = cloud.user().id, curKey = `cursor:${uid}`;
    let cursor = (await meta(curKey)) || 0;
    const first = !cursor;
    const outbox = new Map((await db.all('outbox')).map(o => [o.key, o]));
    const remoteSubjects = new Set();
    for (;;) {
      const rows = await cloud.pull(cursor, PAGE);
      const changes = [];
      for (const r of rows) {
        cursor = Math.max(cursor, Number(r.seq));
        const table = TABLE[r.kind];
        if (!table) continue;
        if (r.kind === 'subject' && !r.deleted) remoteSubjects.add(r.id);
        if (r.kind === 'pref' && LOCAL_PREFS.has(r.id)) continue;
        const key = `${r.kind}:${r.id}`, pending = outbox.get(key);
        if (pending) {
          if (Date.parse(pending.at) > Date.parse(r.updated_at)) continue; // ในเครื่องแก้ทีหลัง → เครื่องชนะ จะส่งขึ้นไปทับ
          await db.del('outbox', key); outbox.delete(key);
        }
        if (r.deleted) {
          if (!localValue(r.kind, r.id)) continue;
          await db.del(table, r.id);
          changes.push({ store: table, key: r.id, value: null });
          continue;
        }
        let v = r.data;
        if (!v) continue;
        const mineNow = localValue(r.kind, r.id);
        if (mineNow && stable(wire(r.kind, mineNow)) === stable(v)) continue; // แถวที่เครื่องนี้เพิ่งส่งขึ้นไปเอง
        if (r.kind === 'attachment') {
          const mine = localValue('attachment', r.id);
          v = { ...v, blob: mine?.blob || null }; // รูปที่มีอยู่แล้วในเครื่องไม่ต้องโหลดใหม่
        }
        if (r.kind === 'page') {
          // หัวหน้ามาก่อน · เนื้อหาเดิมในเครื่องยังแสดงไปก่อน จนโหลดของใหม่เสร็จ (fetchBodies)
          const { has_body, ...head } = v;
          v = { strokes: [], texts: [], imgs: [], shapes: [], lines: [], ...pick(mineNow, BODY), ...head, need_body: !!has_body };
        }
        await db.put(table, v);
        changes.push({ store: table, key: r.kind === 'pref' ? r.id : v.id, value: v });
      }
      store.applyRemote(changes);
      await setMeta(curKey, cursor);
      if (rows.length < PAGE) break;
    }
    if (first) await dropUnusedDefaults(remoteSubjects);
    await mergeSameNameSubjects();
  }

  /** เครื่องใหม่เข้าบัญชีที่มีวิชาอยู่แล้ว: วิชาตั้งต้นที่เครื่องสร้างเองและยังไม่มีงานใช้ ทิ้งไป (ไม่ส่งขึ้น ไม่ทับวิชาในบัญชี) */
  async function dropUnusedDefaults(remoteSubjects) {
    if (!remoteSubjects.size) return;
    const used = new Set(store.state.tasks.map(t => t.subject_id));
    const changes = [];
    for (const s of [...store.state.subjects]) {
      if (remoteSubjects.has(s.id) || used.has(s.id) || !DEFAULT_NAMES.has(s.name)) continue;
      await db.del('subjects', s.id); await db.del('outbox', `subject:${s.id}`);
      changes.push({ store: 'subjects', key: s.id, value: null });
    }
    store.applyRemote(changes);
  }
  /** วิชาชื่อเดียวกันหลายอัน → เก็บ id น้อยสุด ย้ายงานไปอันนั้น ลบที่เหลือ (ส่งขึ้นคลาวด์ตามปกติ) */
  async function mergeSameNameSubjects() {
    const byName = new Map();
    for (const s of store.state.subjects) {
      const n = String(s.name).trim();
      byName.set(n, [...(byName.get(n) || []), s]);
    }
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      const [keep, ...drop] = [...group].sort((a, b) => a.id.localeCompare(b.id));
      for (const d of drop) {
        for (const t of store.state.tasks.filter(t => t.subject_id === d.id)) await store.patchTask(t.id, { subject_id: keep.id });
        await store.deleteSubject(d.id);
      }
    }
  }

  /** เครื่องนี้เข้าสู่ระบบครั้งแรก: งานที่มีก่อนรุ่นที่มีบัญชี (ยังไม่เคยเข้าคิว) → เข้าคิวทั้งหมด ขึ้นบัญชีไปด้วย */
  async function queueEverything() {
    const have = new Set((await db.all('outbox')).map(o => o.key));
    for (const [table, kind] of Object.entries(KIND)) {
      for (const v of await db.all(table)) {
        const id = table === 'prefs' ? v.key : v.id;
        if (table === 'prefs' && LOCAL_PREFS.has(id)) continue;
        if (have.has(`${kind}:${id}`)) continue;
        await db.put('outbox', { key: `${kind}:${id}`, kind, id, at: v.updated_at || v.created_at || iso() });
      }
    }
  }

  // ---------- ส่ง ----------
  async function push() {
    for (;;) {
      const entries = (await db.all('outbox')).sort((a, b) => a.at.localeCompare(b.at)).slice(0, BATCH);
      if (!entries.length) return;
      const items = [], gone = [];
      for (const e of entries) {
        const v = localValue(e.kind, e.id);
        if (!v) { items.push({ kind: e.kind, id: e.id, deleted: true, data: null, updated_at: e.at }); if (e.kind === 'attachment') gone.push(e.id); if (e.kind === 'page') gone.push(bodyFile(e.id)); continue; }
        if (e.kind === 'attachment' && v.blob) await cloud.upload(v.id, v.blob);
        if (e.kind === 'page' && !v.need_body) await uploadPage(v); // ยังโหลดเนื้อหาไม่เสร็จ = ส่งแค่หัว ไม่เอาหน้าว่างไปทับไฟล์
        items.push({ kind: e.kind, id: e.id, deleted: false, data: wire(e.kind, v), updated_at: e.at });
      }
      await cloud.push(items);
      if (gone.length) { try { await cloud.removeFiles(gone); } catch {} } // รูปค้างบนคลาวด์ไม่ทำให้ข้อมูลผิด ลบไม่ได้ก็ข้าม
      // แก้ซ้ำระหว่างส่ง (at เปลี่ยน) → เก็บไว้ส่งรอบหน้า
      const now = new Map((await db.all('outbox')).map(o => [o.key, o]));
      for (const e of entries) if (now.get(e.key)?.at === e.at) await db.del('outbox', e.key);
      if (entries.length < BATCH) return;
    }
  }

  /** รูปในหน้าที่อัปไปแล้ว (id รูปไม่เปลี่ยนเมื่อย้าย/ย่อ — อัปครั้งเดียวพอ) */
  async function uploaded() { return new Set((await meta(`files:${cloud.user().id}`)) || []); }
  async function uploadPage(p) {
    const done = await uploaded();
    let added = false;
    for (const i of p.imgs || []) if (i.blob && !done.has(i.id)) { await cloud.upload(i.id, i.blob); done.add(i.id); added = true; }
    if (added) await setMeta(`files:${cloud.user().id}`, [...done]);
    await cloud.uploadJSON(bodyFile(p.id), { strokes: p.strokes || [], texts: p.texts || [], imgs: (p.imgs || []).map(({ blob, ...i }) => i), shapes: p.shapes || [], lines: p.lines || [] });
  }
  /** หน้าที่เครื่องอื่นเขียนไว้ → โหลดเนื้อหา + รูปในหน้า (ล้มก็ลองใหม่รอบหน้า · ผู้ใช้แก้หน้าระหว่างโหลด = ของในเครื่องชนะ) */
  async function fetchBodies() {
    for (const p of store.state.pages.filter(p => p.need_body)) {
      let body;
      try { body = await cloud.downloadJSON(bodyFile(p.id)); } catch (e) { if (e.offline) throw e; continue; }
      const mine = new Map((p.imgs || []).filter(i => i.blob).map(i => [i.id, i.blob]));
      const imgs = [];
      for (const i of body.imgs || []) {
        let blob = mine.get(i.id) || null;
        if (!blob) { try { blob = await cloud.download(i.id); } catch (e) { if (e.offline) throw e; } }
        imgs.push({ ...i, blob });
      }
      const cur = store.state.pages.find(x => x.id === p.id);
      if (!cur?.need_body) continue; // ผู้ใช้เขียนหน้านี้ระหว่างโหลด → ของในเครื่องชนะ
      const v = { ...cur, strokes: body.strokes || [], texts: body.texts || [], imgs, shapes: body.shapes || [], lines: body.lines || [] };
      delete v.need_body;
      await db.put('pages', v);
      store.applyRemote([{ store: 'pages', key: v.id, value: v }]);
    }
  }

  /** รูปที่เครื่องอื่นแนบไว้ แต่เครื่องนี้ยังไม่มีไฟล์ → โหลดมาเก็บ (ล้มก็ลองใหม่รอบหน้า) */
  async function fetchBlobs() {
    for (const a of store.state.attachments.filter(a => a.has_blob && !a.blob)) {
      let blob;
      try { blob = await cloud.download(a.id); } catch (e) { if (e.offline) throw e; continue; }
      const cur = store.state.attachments.find(x => x.id === a.id);
      if (!cur) continue;
      const v = { ...cur, blob };
      await db.put('attachments', v);
      store.applyRemote([{ store: 'attachments', key: v.id, value: v }]);
    }
  }

  async function run() {
    const u = cloud.user();
    if (!u) { setStatus({ state: 'signedout' }); return; }
    setStatus({ state: 'syncing', error: '' });
    try {
      if (!(await meta('owner'))) await queueEverything();
      await setMeta('owner', u.id);
      await pull();
      await push();
      await fetchBodies();
      await fetchBlobs();
      await push(); // หน้าที่เพิ่งได้เนื้อหาครบแล้วและถูกแก้ระหว่างรอ
      setStatus({ state: 'idle', last: iso(), pending: (await db.all('outbox')).length });
    } catch (e) {
      const pending = (await db.all('outbox')).length;
      if (!cloud.user()) setStatus({ state: 'signedout', pending, error: 'หมดเวลาเข้าสู่ระบบ เข้าใหม่อีกครั้ง' });
      else setStatus({ state: e.offline ? 'offline' : 'error', error: e.message || String(e), pending });
    }
  }

  /** ซิงก์ตอนนี้ · ถ้ากำลังซิงก์อยู่ รอบนี้จบแล้วจะซิงก์ต่ออีกรอบ (ไม่ซ้อนกัน) */
  function syncNow() {
    if (timer) { timers.clearTimeout(timer); timer = null; }
    if (running) { again = true; return running; }
    running = (async () => {
      do { again = false; await run(); } while (again && cloud.user());
      running = null;
    })();
    return running;
  }
  function schedule() {
    if (timer) timers.clearTimeout(timer);
    timer = timers.setTimeout(() => { timer = null; syncNow(); }, debounceMs);
  }

  return {
    trackedDB, syncNow, schedule,
    attach(s) { store = s; },
    status: () => ({ ...status }),
    onStatus: fn => (listeners.add(fn), () => listeners.delete(fn)),
    pendingCount: async () => (await db.all('outbox')).length,
    /** เครื่องนี้เคยผูกกับบัญชีอื่นมาก่อน? (ต้องล้างเครื่องก่อน ไม่ให้งานของคนอื่นปนเข้าบัญชีนี้) */
    async ownerConflict(uid) { const o = await meta('owner'); return !!o && o !== uid; },
  };
}
