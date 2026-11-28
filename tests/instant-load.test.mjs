import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { memoryDB } from '../src/data/db.js';
import { createStore } from '../src/data/store.js';

test('attachment lookup follows new notes, remote changes and deletion', async () => {
  const store = createStore(memoryDB());
  await store.load();
  const [task] = await store.addTasks([{ title: 'Study sheet' }]);
  assert.deepEqual(store.attachmentsOf(task.id), []);
  const note = await store.addAttachment(task.id, { kind: 'text', text: 'Old' });
  assert.equal(store.attachmentsOf(task.id)[0].text, 'Old');
  store.applyRemote([{ store: 'attachments', key: note.id, value: { ...note, text: 'Remote' } }]);
  assert.equal(store.attachmentsOf(task.id)[0].text, 'Remote');
  await store.removeAttachment(note.id);
  assert.deepEqual(store.attachmentsOf(task.id), []);
});

test('quota pressure discards the optional thumbnail before retrying original save', async () => {
  const db = memoryDB();
  const put = db.put;
  db.put = (name, data) => {
    if (name === 'attachments' && data.thumbnail) throw new DOMException('Storage full', 'QuotaExceededError');
    return put(name, data);
  };
  const store = createStore(db);
  await store.load();
  const attachment = await store.addAttachment('test-task', {
    kind: 'image', blob: new Blob(['original']), thumbnail: new Blob(['small']),
  });
  assert.equal(attachment.thumbnail, undefined);
  assert.equal(await (await db.all('attachments'))[0].blob.text(), 'original');
});

test('only explicit shell paths and versioned public images are handled by the worker', async () => {
  const base = 'https://example.test/app/';
  const listeners = {};
  const stored = new Map();
  let online = true, added = 0, fetched = 0;
  const cache = {
    async addAll(requests) {
      for (const request of requests) {
        assert.equal(request.credentials, 'omit');
        stored.set(request.url, new Response(request.url));
        added++;
      }
    },
    async match(url) { return stored.get(url)?.clone(); },
  };
  const code = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  runInNewContext(code, {
    URL, Response, Request,
    self: {
      location: { href: base + 'sw.js' },
      addEventListener: (name, listener) => { listeners[name] = listener; },
      skipWaiting: async () => {},
    },
    caches: { open: async () => cache },
    fetch: async () => {
      fetched++;
      if (!online) throw new Error('offline');
      return new Response('network');
    },
  });
  let installed;
  listeners.install({ waitUntil: value => { installed = value; } });
  await installed;
  assert.equal(added, stored.size);
  assert.equal(stored.has(base), false);
  const publicImage = [...stored.keys()].find(key => key.includes('/assets/previews/'));
  assert.ok(publicImage);
  const visit = (url, options) => {
    let response;
    listeners.fetch({ request: { url, method: 'GET', headers: new Headers(), ...options },
      respondWith: value => { response = value; } });
    return response;
  };
  assert.equal(await (await visit(publicImage)).text(), publicImage);
  assert.equal(fetched, 0);
  assert.equal(visit(base + 'api/user/photos'), undefined);
  assert.equal(visit(base + 'assets/previews/arbitrary.jpg'), undefined);
  assert.equal(visit(base + 'src/main.js', { headers: new Headers({ Authorization: 'fixture' }) }), undefined);
  assert.equal(await (await visit(base + '?code=fixture', { mode: 'navigate' })).text(), 'network');
  online = false;
  assert.equal(await (await visit(base + '?code=fixture', { mode: 'navigate' })).text(), base + 'index.html');
  assert.equal(await (await visit(base + 'src/main.js')).text(), base + 'src/main.js');
  assert.equal(stored.has(base + '?code=fixture'), false);
});
