// ซิงก์ระหว่างเครื่อง — ใช้เซิร์ฟเวอร์ปลอมในหน่วยความจำที่ทำตัวเหมือน items + sync_push ใน supabase/migrations
// รัน: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryDB } from '../src/data/db.js';
import { createStore } from '../src/data/store.js';
import { createSync } from '../src/data/sync.js';

function fakeServer() {
  const rows = new Map(); // `${uid}|${kind}|${id}` → row
  const files = new Map();
  let seq = 0;
  return {
    rows, files,
    cloudFor(uid, email = uid + '@x.test') {
      let signedIn = true, offline = false;
      const chk = () => { if (offline) { const e = new Error('offline'); e.offline = true; throw e; } };
      return {
        user: () => signedIn ? { id: uid, email } : null,
        setOffline(v) { offline = v; },
        signOut() { signedIn = false; },
        async pull(after, limit) {
          chk();
          return [...rows.values()].filter(r => r.user_id === uid && r.seq > after).sort((a, b) => a.seq - b.seq).slice(0, limit)
            .map(r => structuredClone({ kind: r.kind, id: r.id, data: r.data, deleted: r.deleted, updated_at: r.updated_at, seq: r.seq }));
        },
        async push(items) {
          chk();
          let n = 0;
          for (const it of items) {
            const k = `${uid}|${it.kind}|${it.id}`, cur = rows.get(k);
            if (cur && Date.parse(cur.updated_at) > Date.parse(it.updated_at)) continue;
            rows.set(k, { user_id: uid, kind: it.kind, id: it.id, data: it.deleted ? null : JSON.parse(JSON.stringify(it.data)), deleted: !!it.deleted, updated_at: it.updated_at, seq: ++seq });
            n++;
          }
          return n;
        },
        async upload(id, blob) { chk(); files.set(`${uid}/${id}`, blob); },
        async download(id) { chk(); const b = files.get(`${uid}/${id}`); if (!b) throw new Error('404'); return b; },
        async removeFiles(ids) { chk(); ids.forEach(id => files.delete(`${uid}/${id}`)); },
        async uploadJSON(name, obj) { chk(); files.set(`${uid}/${name}`, JSON.stringify(obj)); },
        async downloadJSON(name) { chk(); const b = files.get(`${uid}/${name}`); if (!b) throw new Error('404'); return JSON.parse(b); },
      };
    },
  };
}

let clock = Date.parse('2026-11-24T10:00:00Z');
const now = () => new Date(clock += 1000);
const noTimers = { setTimeout: () => 0, clearTimeout: () => {} };

async function device(cloud) {
  const db = memoryDB();
  const sync = createSync({ db, cloud, now, timers: noTimers });
  const store = createStore(sync.trackedDB, { now });
  sync.attach(store);
  await store.load();
  return { db, sync, store, cloud };
}
const live = s => s.state.tasks.filter(t => !t.deleted_at).map(t => t.title).sort();

test('เครื่อง A เพิ่มงาน → เครื่อง B เห็น · วิชาตั้งต้นไม่ซ้ำ', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  await A.store.addTasks([{ title: 'การบ้านเลข', subject_name: 'คณิตศาสตร์' }]);
  await A.sync.syncNow();
  assert.equal(A.sync.status().state, 'idle');
  assert.equal(A.sync.status().pending, 0);

  const B = await device(srv.cloudFor('u1'));
  await B.sync.syncNow();
  assert.deepEqual(live(B.store), ['การบ้านเลข']);
  // B สร้างวิชาตั้งต้น 8 วิชาเองตอนเปิดครั้งแรก → ต้องเหลือชุดเดียวกับ A
  assert.equal(B.store.state.subjects.length, 8);
  assert.deepEqual(B.store.state.subjects.map(s => s.id).sort(), A.store.state.subjects.map(s => s.id).sort());
  const t = B.store.state.tasks[0];
  assert.equal(B.store.state.subjects.find(s => s.id === t.subject_id).name, 'คณิตศาสตร์');
});

test('แก้ชนกัน: ใครแก้ทีหลังชนะ · ลบแล้วเครื่องอื่นลบตาม', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  const [t] = await A.store.addTasks([{ title: 'รายงาน' }]);
  await A.sync.syncNow();
  const B = await device(srv.cloudFor('u1'));
  await B.sync.syncNow();

  await A.store.patchTask(t.id, { title: 'รายงาน (A)' });
  await B.store.patchTask(t.id, { title: 'รายงาน (B ทีหลัง)' });
  await A.sync.syncNow(); await B.sync.syncNow(); await A.sync.syncNow();
  assert.equal(A.store.state.tasks.find(x => x.id === t.id).title, 'รายงาน (B ทีหลัง)');
  assert.equal(B.store.state.tasks.find(x => x.id === t.id).title, 'รายงาน (B ทีหลัง)');

  await A.store.purgeTask(t.id);
  await A.sync.syncNow(); await B.sync.syncNow();
  assert.equal(B.store.state.tasks.some(x => x.id === t.id), false);
});

test('ออฟไลน์: งานค้างในคิว ไม่หาย · ต่อเน็ตแล้วส่งครบ', async () => {
  const srv = fakeServer();
  const cloud = srv.cloudFor('u1');
  const A = await device(cloud);
  cloud.setOffline(true);
  await A.store.addTasks([{ title: 'งาน 1' }, { title: 'งาน 2' }]);
  await A.sync.syncNow();
  assert.equal(A.sync.status().state, 'offline');
  assert.ok(A.sync.status().pending >= 2);
  cloud.setOffline(false);
  await A.sync.syncNow();
  assert.equal(A.sync.status().pending, 0);
  assert.equal([...srv.rows.values()].filter(r => r.kind === 'task').length, 2);
});

test('รูปแนบ: อัปขึ้น Storage แล้วเครื่องอื่นโหลดตาม · แถวไม่มีไฟล์รูปติดไป', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  const [t] = await A.store.addTasks([{ title: 'จดกระดาน' }]);
  const blob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
  const a = await A.store.addAttachment(t.id, { kind: 'image', blob, size: blob.size, mime_type: 'image/jpeg' });
  await A.sync.syncNow();
  const row = srv.rows.get(`u1|attachment|${a.id}`);
  assert.equal(row.data.has_blob, true);
  assert.equal('blob' in row.data, false);
  assert.ok(srv.files.has(`u1/${a.id}`));

  const B = await device(srv.cloudFor('u1'));
  await B.sync.syncNow();
  const got = B.store.state.attachments.find(x => x.id === a.id);
  assert.equal(await got.blob.text(), 'jpeg-bytes');

  await B.store.removeAttachment(a.id);
  await B.sync.syncNow();
  assert.equal(srv.files.has(`u1/${a.id}`), false);
  await A.sync.syncNow();
  assert.equal(A.store.state.attachments.some(x => x.id === a.id), false);
});

test('ค่าตั้งซิงก์ (ชื่อ) แต่ "seeded" เป็นของเครื่องเท่านั้น', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  await A.store.setPref('display_name', 'มายด์');
  await A.sync.syncNow();
  assert.equal(srv.rows.has('u1|pref|seeded'), false);
  const B = await device(srv.cloudFor('u1'));
  await B.sync.syncNow();
  assert.equal(B.store.state.prefs.display_name, 'มายด์');
});

test('บัญชีคนอื่นไม่เห็นข้อมูลกัน · เครื่องที่เคยผูกบัญชีอื่นถูกจับได้', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  await A.store.addTasks([{ title: 'ของ u1' }]);
  await A.sync.syncNow();
  const C = await device(srv.cloudFor('u2'));
  await C.sync.syncNow();
  assert.deepEqual(live(C.store), []);
  assert.equal(await A.sync.ownerConflict('u2'), true);
  assert.equal(await A.sync.ownerConflict('u1'), false);
});

test('ซิงก์ซ้ำไม่ทำให้จอวาดใหม่เมื่อไม่มีอะไรเปลี่ยน', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  await A.store.addTasks([{ title: 'x' }]);
  await A.sync.syncNow();
  let emits = 0;
  A.store.subscribe(() => emits++);
  await A.sync.syncNow();
  assert.equal(emits, 0);
});

test('สมุดจด: เล่ม + หน้า (เส้น ข้อความ รูปในหน้า) ไปอีกเครื่อง · เนื้อหาไม่อยู่ในแถว · ลบหน้าแล้วไฟล์หาย', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  const b = await A.store.addBook({ title: 'สมุดคณิต' });
  const p0 = A.store.pagesOf(b.id)[0];
  const photo = new Blob(['png-bytes'], { type: 'image/png' });
  await A.store.savePage({ ...p0, strokes: [{ id: 's1', t: 'pen', c: '#000', w: 6, p: [1, 2, 0.5, 3, 4, 0.5] }], texts: [{ id: 't1', x: 1, y: 1, w: 100, s: 30, c: '#000', v: 'สมการ' }],
    imgs: [{ id: 'i1', x: 0, y: 0, w: 10, h: 10, blob: photo }] });
  await A.sync.syncNow();
  assert.equal(A.sync.status().state, 'idle', A.sync.status().error);
  const row = srv.rows.get(`u1|page|${p0.id}`);
  assert.equal(row.data.has_body, true);
  assert.equal('strokes' in row.data, false);
  assert.ok(srv.files.has(`u1/page-${p0.id}.json`) && srv.files.has('u1/i1'));

  const B = await device(srv.cloudFor('u1'));
  await B.sync.syncNow();
  assert.deepEqual(B.store.state.books.map(x => x.title), ['สมุดคณิต']);
  const got = B.store.state.pages.find(x => x.id === p0.id);
  assert.equal(got.need_body, undefined);
  assert.equal(got.strokes.length, 1);
  assert.equal(got.texts[0].v, 'สมการ');
  assert.equal(await got.imgs[0].blob.text(), 'png-bytes');

  // B เขียนต่อ → A ได้ของใหม่ · รูปเดิมไม่อัปซ้ำ
  srv.files.delete('u1/i1');
  await B.store.savePage({ ...got, strokes: [...got.strokes, { id: 's2', t: 'pen', c: '#000', w: 6, p: [5, 5, 0.5] }] });
  await B.sync.syncNow();
  await A.sync.syncNow();
  assert.equal(A.store.state.pages.find(x => x.id === p0.id).strokes.length, 2);
  assert.equal(await A.store.state.pages.find(x => x.id === p0.id).imgs[0].blob.text(), 'png-bytes');

  await A.store.deleteBook(b.id);
  await A.sync.syncNow(); await B.sync.syncNow();
  assert.equal(B.store.state.books.length, 0);
  assert.equal(B.store.state.pages.length, 0);
  assert.equal(srv.files.has(`u1/page-${p0.id}.json`), false);
});

test('หน้าที่ยังโหลดเนื้อหาไม่เสร็จ: ย้ายลำดับไม่เอาหน้าว่างไปทับ · เขียนเองระหว่างรอ = ของในเครื่องชนะ', async () => {
  const srv = fakeServer();
  const A = await device(srv.cloudFor('u1'));
  const b = await A.store.addBook({ title: 'สมุด' });
  const p0 = A.store.pagesOf(b.id)[0];
  await A.store.savePage({ ...p0, strokes: [{ id: 's1', t: 'pen', c: '#000', w: 6, p: [1, 1, 1] }] });
  await A.sync.syncNow();
  const bc = srv.cloudFor('u1'); const B = await device(bc);
  const realDl = bc.downloadJSON; bc.downloadJSON = async () => { throw new Error('500'); }; // เนื้อหาโหลดไม่ได้ชั่วคราว
  await B.sync.syncNow();
  assert.equal(B.store.state.pages.find(x => x.id === p0.id).need_body, true);
  await B.sync.syncNow();
  assert.equal(JSON.parse(srv.files.get(`u1/page-${p0.id}.json`)).strokes.length, 1); // ไม่โดนทับด้วยหน้าว่าง
  bc.downloadJSON = realDl;
  await B.sync.syncNow();
  assert.equal(B.store.state.pages.find(x => x.id === p0.id).strokes.length, 1);
});

test('ข้อมูลที่มีก่อนรุ่นที่มีบัญชี (ไม่เคยเข้าคิว) ขึ้นบัญชีตอนเข้าสู่ระบบครั้งแรก', async () => {
  const srv = fakeServer();
  const db = memoryDB();
  const old = createStore(db, { now }); await old.load(); // แอปรุ่นเก่า: เขียนตรง ไม่มีคิว
  await old.addTasks([{ title: 'งานเก่า', subject_name: 'เคมี' }]);
  await old.addBook({ title: 'สมุดเก่า' });
  const sync = createSync({ db, cloud: srv.cloudFor('u1'), now, timers: noTimers });
  const store = createStore(sync.trackedDB, { now }); sync.attach(store); await store.load();
  await sync.syncNow();
  const kinds = [...srv.rows.values()].map(r => r.kind + ':' + (r.data?.title || r.data?.name || r.id));
  assert.ok(kinds.includes('task:งานเก่า') && kinds.includes('book:สมุดเก่า') && kinds.some(k => k === 'subject:เคมี'), kinds.join(' '));
  assert.ok(kinds.some(k => k.startsWith('page:')));
  assert.equal(srv.rows.has('u1|pref|seeded'), false);
});
