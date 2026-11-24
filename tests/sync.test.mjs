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
