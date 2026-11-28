import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

const variants = process.argv.slice(2);
if (variants.length !== 2) throw new Error('Pass the baseline directory and the changed directory.');
const rounds = 20;
const tasks = Array.from({ length: 2000 }, (_, i) => ({ id: 't' + i, title: 'การบ้าน ' + i }));
const attachments = tasks.flatMap(t => Array.from({ length: 3 }, (_, i) => ({
  id: t.id + '-' + i, task_id: t.id, text: 'จดจากกระดาน', kind: 'text',
  created_at: '2026-11-28T00:00:0' + i + 'Z',
})));
const data = { tasks, attachments, subjects: [], books: [], pages: [], prefs: [{ key: 'seeded', value: true }] };
const percentile = (numbers, q) => [...numbers].sort((a, b) => a - b)[Math.ceil(numbers.length * q) - 1];
const latest = resolve(variants[1]);
const imagePaths = new Map(['board', 'chalk', 'notes', 'sticky'].map(n => [n, 'assets/landing/photos/' + n + '.jpg']));
const newArt = readFileSync(resolve(latest, 'src/ui/load-art.js'), 'utf8');
const fileFor = new Map([...newArt.matchAll(/"assets\/previews\/(\w+)\.[^"]+"/g)].map(m => [m[1], m[0].slice(1, -1)]));

function graph(root) {
  const files = new Set();
  function visit(file) {
    if (files.has(file)) return;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(/^import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/gm)) {
      visit(resolve(dirname(file), specifier));
    }
  }
  visit(resolve(root, 'src/main.js'));
  const data = [...files].map(f => readFileSync(f));
  return { modules: files.size, rawBytes: data.reduce((n, b) => n + b.length, 0),
    brotliBytes: data.reduce((n, b) => n + brotliCompressSync(b).length, 0),
    loadsSketch: [...files].some(f => /[\\/]sketch\.js$/.test(f)) };
}

const results = [];
for (const variant of variants) {
  const root = resolve(variant);
  const { createStore } = await import(pathToFileURL(resolve(root, 'src/data/store.js')));
  const { searchNotes } = await import(pathToFileURL(resolve(root, 'src/domain/notebook.js')));
  const store = createStore({ kind: 'benchmark', async all(name) { return data[name]; } });
  await store.load();
  const search = () => searchNotes('ไม่มีคำนี้ในสมุด', store.state.tasks, id =>
    store.attachmentsOf(id).sort((a, b) => a.created_at.localeCompare(b.created_at)));
  for (let i = 0; i < 10; i++) if (search().length !== 0) throw new Error('Unexpected search results');
  const samples = [];
  for (let i = 0; i < rounds; i++) {
    const started = performance.now();
    search();
    samples.push(performance.now() - started);
  }
  const bytes = names => names.reduce((total, name) =>
    total + statSync(resolve(root, root === latest ? fileFor.get(name) : imagePaths.get(name))).size, 0);
  results.push({
    variant, initialJS: graph(root), homePhotos: bytes(['board', 'chalk', 'notes']), loginPhotos: bytes(['board', 'notes', 'sticky']),
    notebookSearch: { tasks: tasks.length, attachments: attachments.length,
      medianMs: (percentile(samples, .5) + percentile(samples, .55)) / 2, p95Ms: percentile(samples, .95), samplesMs: samples },
  });
}
console.log(JSON.stringify({ node: process.version, results }, null, 2));
