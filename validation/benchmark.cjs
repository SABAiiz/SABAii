const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROUNDS = 20;
const MODES = ['cold', 'warm', 'slow', 'offline', 'large'];
const VARIANTS = ['before', 'after'];
const START_METRICS = ['readyMs', 'fcpMs', 'lcpMs', 'cls', 'pageTransferBytes'];
const FEATURES = {
  tasks: { hash: '#/tasks', ready: '#page .cal', nav: 'tasks' },
  notebook: { hash: '#/notebook', ready: '#page #nb-q', nav: 'notebook' },
  me: { hash: '#/me', ready: '#page .stats', nav: 'me' },
  subject: { hash: '#/subject/perf-subject', ready: '#page .sv-hero' },
  book: { hash: '#/book/perf-book', ready: '#page .bk-thumb[data-id] canvas' },
};
const READY_TILE = '.pane-home .tiles button.tile';
const VISIBLE = { width: 390, height: 844, deviceScaleFactor: 2 };
const SLOW = { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 94_000 };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
};
const SESSION = {
  access_token: 'FIXTURE', refresh_token: 'FIXTURE', expires_at: 4102444800000,
  user: { id: 'perf-fixture', name: 'Performance fixture', email: 'perf@example.test', avatar: '' },
};

async function serve(root) {
  let disconnected = false;
  const server = http.createServer(async (req, res) => {
    if (disconnected) {
      req.socket.destroy();
      return;
    }
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/__fixture') {
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        return res.end('<!doctype html><meta charset=utf-8><title>Fixture</title>');
      }
      if (!url.pathname.startsWith('/app/')) return res.writeHead(404).end();
      const name = decodeURIComponent(url.pathname.slice('/app/'.length)) || 'index.html';
      const file = path.resolve(root, name);
      if (!file.startsWith(root + path.sep)) return res.writeHead(404).end();

      const data = await fsp.readFile(file);
      const etag = '"' + createHash('sha256').update(data).digest('hex') + '"';
      const cacheControl = /\.[0-9a-f]{10}\.webp$/.test(file)
        ? 'public,max-age=31536000,immutable' : 'no-cache';
      if (req.headers['if-none-match'] === etag) {
        return res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl }).end();
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Content-Length': data.length,
        ETag: etag, 'Cache-Control': cacheControl,
      });
      res.end(data);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    server, origin: 'http://127.0.0.1:' + server.address().port,
    setDisconnected(value) { disconnected = value; },
  };
}

// This code runs in every document, before app modules or service workers for the page.
function installObservers({ session, readyTile }) {
  localStorage.setItem('sabaii-auth', JSON.stringify(session));
  if (!location.pathname.startsWith('/app/')) return;
  // A fetch stub preserves Chromium's HTTP cache, which Playwright routing disables.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (resource, options) => {
    const url = new URL(resource instanceof Request ? resource.url : resource, location.href);
    if (!url.hostname.endsWith('.supabase.co')) return realFetch(resource, options);
    if (!navigator.onLine) throw new TypeError('Offline fixture');
    const body = url.pathname === '/rest/v1/items' ? [] : url.pathname.endsWith('/sync_push') ? 0 : {};
    return Response.json(body);
  };
  const metrics = window.sabaiiMetrics = { readyMs: null, fcpMs: null, lcpMs: null, cls: null };
  const supported = new Set(PerformanceObserver.supportedEntryTypes);
  function observe(type, record) {
    if (supported.has(type)) {
      new PerformanceObserver(list => list.getEntries().forEach(record)).observe({ type, buffered: true });
    }
  }
  observe('paint', entry => {
    if (entry.name === 'first-contentful-paint') metrics.fcpMs = entry.startTime;
  });
  observe('largest-contentful-paint', entry => { metrics.lcpMs = entry.startTime; });
  metrics.cls = supported.has('layout-shift') ? 0 : null;
  let firstShift = -Infinity, lastShift = -Infinity, windowSum = 0;
  observe('layout-shift', entry => {
    if (entry.hadRecentInput) return;
    if (entry.startTime - lastShift >= 1000 || entry.startTime - firstShift >= 5000) {
      firstShift = entry.startTime;
      windowSum = 0;
    }
    lastShift = entry.startTime;
    windowSum += entry.value;
    metrics.cls = Math.max(metrics.cls, windowSum);
  });
  function checkReady() {
    if (window.__sabaii && !document.documentElement.classList.contains('booting') &&
        !document.querySelector('#onboard') && document.querySelector(readyTile)?.getClientRects().length) {
      requestAnimationFrame(() => { metrics.readyMs = performance.now(); });
    } else requestAnimationFrame(checkReady);
  }
  requestAnimationFrame(checkReady);
}

async function seed(page, origin, { large, feature }) {
  await page.goto(origin + '/__fixture');
  await page.evaluate(async ({ large, feature, owner }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('sabaii', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ['tasks', 'subjects', 'attachments', 'prefs', 'books', 'pages', 'outbox', 'meta']) {
          const keyPath = ['prefs', 'outbox', 'meta'].includes(name) ? 'key' : 'id';
          const store = db.createObjectStore(name, { keyPath });
          if (name === 'tasks') {
            store.createIndex('due_date', 'due_date');
            store.createIndex('subject_id', 'subject_id');
          }
          if (name === 'attachments') store.createIndex('task_id', 'task_id');
          if (name === 'pages') store.createIndex('book_id', 'book_id');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      // A dedicated request URL keeps app assets out of the HTTP cache for a cold trial.
      let photo = null;
      if (large) {
        const response = await fetch('/app/assets/landing/photos/notes.jpg?fixture-seed=1', { cache: 'no-store' });
        if (!response.ok) throw new Error('Large fixture image HTTP ' + response.status);
        photo = await response.blob();
        if (!photo.size) throw new Error('Large fixture image is empty');
      }
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['prefs', 'tasks', 'attachments', 'subjects', 'books', 'pages', 'meta'], 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        tx.objectStore('prefs').put({ key: 'onboarded', value: true });
        tx.objectStore('meta').put({ key: 'owner', value: owner });
        if (feature) {
          const date = '2026-11-28T00:00:00Z';
          tx.objectStore('subjects').put({
            id: 'perf-subject', name: 'ชีววิทยา', aliases: [], color: '#69778F',
            hidden: false, order: 0, created_at: date,
          });
          tx.objectStore('books').put({
            id: 'perf-book', title: 'Performance notebook', color: '#69778F',
            paper: 'lined', subject_id: null, created_at: date, updated_at: date, last_page: 'perf-page',
          });
          tx.objectStore('pages').put({
            id: 'perf-page', book_id: 'perf-book', order: 0, paper: 'lined',
            strokes: [], texts: [], imgs: [], created_at: date, updated_at: date,
          });
        }
        if (large) {
          const tasks = tx.objectStore('tasks'), notes = tx.objectStore('attachments');
          const date = '2026-11-28T00:00:00Z';
          for (let i = 0; i < 2000; i++) {
            const id = 'perf-task-' + String(i).padStart(5, '0');
            tasks.put({ id, title: 'การบ้าน ' + i, status: 'todo', type: 'homework',
              created_at: date, updated_at: date });
            for (let j = 0; j < 3; j++) {
              const image = i < 25 && j === 0;
              notes.put({ id: id + ':' + j, task_id: id, created_at: date,
                kind: image ? 'image' : 'text', text: 'จดจากกระดาน', blob: image ? photo : null });
            }
          }
        }
      });
    } finally { db.close(); }
  }, { large, feature, owner: SESSION.user.id });
}

async function throttle(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW);
}

async function waitReady(page) {
  await page.waitForFunction(() => window.sabaiiMetrics?.readyMs > 0);
}

async function startup(context, page, host, mode) {
  const url = host.origin + '/app/#/home';
  if (['warm', 'offline', 'large'].includes(mode)) {
    await page.goto(url);
    await waitReady(page);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    if (mode === 'offline') {
      // Both variants get one online load under the active service worker before disconnecting.
      // The baseline adds some runtime modules to the cache on first controlled access.
      await page.reload({ waitUntil: 'load' });
      await waitReady(page);
      // Close access to the origin even if Chromium reports an online interface.
      await context.setOffline(true);
      host.setDisconnected(true);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
  } else {
    if (mode === 'slow') await throttle(context, page);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await waitReady(page);
  await page.waitForLoadState('load');
  // A fixed post-readiness window captures startup paint/layout before interaction.
  await page.waitForTimeout(1250);
  const metrics = await page.evaluate(() => {
    const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return {
      ...window.sabaiiMetrics,
      pageTransferBytes: entries.reduce((total, entry) => total + entry.transferSize, 0),
      online: navigator.onLine,
      cachedWorker: Boolean(navigator.serviceWorker.controller),
      tasks: window.__sabaii.state.tasks.length,
      attachments: window.__sabaii.state.attachments.length,
    };
  });
  if (mode === 'offline') {
    assert.equal(metrics.cachedWorker, true);
    await page.locator('#nav a[data-r="notebook"]').tap();
    await page.locator(FEATURES.notebook.ready).waitFor();
  }
  if (mode === 'large') {
    assert.equal(metrics.tasks, 2000);
    assert.equal(metrics.attachments, 6000);
  }
  return metrics;
}

async function firstOpen(context, page, origin, name) {
  await throttle(context, page);
  await page.goto(origin + '/app/#/home', { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const feature = FEATURES[name];
  await page.evaluate(({ hash, nav }) => {
    if (nav) {
      document.querySelector('#nav a[data-r="' + nav + '"]').addEventListener(
        'click', () => { window.sabaiiOpenStart = performance.now(); }, { capture: true, once: true },
      );
    } else {
      window.sabaiiOpenStart = performance.now();
      location.hash = hash;
    }
  }, feature);
  if (feature.nav) await page.locator('#nav a[data-r="' + feature.nav + '"]').tap();
  await page.waitForFunction(({ hash, ready }) => location.hash === hash &&
    window.sabaiiOpenStart > 0 && document.querySelector(ready)?.getClientRects().length, feature);
  const readyMs = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() =>
    resolve(performance.now() - window.sabaiiOpenStart),
  )));
  return { readyMs };
}

function captureErrors(page, origin, errors) {
  page.on('pageerror', error => errors.push({ kind: 'pageerror', text: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') errors.push({ kind: 'console', text: message.text() });
  });
  page.on('requestfailed', req => {
    errors.push({ kind: 'requestfailed', url: req.url(), text: req.failure()?.errorText });
  });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(origin + '/app/')) {
      errors.push({ kind: 'http', url: response.url(), status: response.status() });
    }
  });
}

async function runTrial(browser, host, type, condition, variant, round) {
  const feature = type === 'feature';
  const row = { type, condition, variant, round, metrics: null, errors: [] };
  let context;
  try {
    context = await browser.newContext({
      viewport: { width: VISIBLE.width, height: VISIBLE.height }, deviceScaleFactor: VISIBLE.deviceScaleFactor,
      isMobile: true, hasTouch: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok',
      serviceWorkers: feature ? 'block' : 'allow',
    });
    context.setDefaultTimeout(10000);
    await context.addInitScript(installObservers, { session: SESSION, readyTile: READY_TILE });
    const page = await context.newPage();
    captureErrors(page, host.origin, row.errors);
    await seed(page, host.origin, { large: !feature && condition === 'large', feature });
    row.metrics = feature
      ? await firstOpen(context, page, host.origin, condition)
      : await startup(context, page, host, condition);
  } catch (error) {
    row.errors.push({ kind: 'trial', text: error.stack || error.message });
  } finally {
    host.setDisconnected(false);
    if (context) {
      try { await context.close(); }
      catch (error) { row.errors.push({ kind: 'trial', text: 'Context close: ' + error.message }); }
    }
  }
  row.ok = Boolean(row.metrics) && !row.errors.some(e => ['pageerror', 'http', 'trial'].includes(e.kind));
  return row;
}

function describe(rows, metric) {
  const values = rows.filter(row => row.ok).map(row => row.metrics[metric]).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return { count: 0, median: null, p95: null };
  const center = Math.floor(values.length / 2);
  return {
    count: values.length,
    median: values.length % 2 ? values[center] : (values[center - 1] + values[center]) / 2,
    p95: values[Math.ceil(0.95 * values.length) - 1],
  };
}

function compare(report, rows, type, conditions, metrics) {
  return Object.fromEntries(conditions.map(condition => {
    const variants = Object.fromEntries(VARIANTS.map(variant => {
      const group = rows.filter(row => row.type === type && row.condition === condition && row.variant === variant);
      const distributions = Object.fromEntries(metrics.map(metric => [metric, describe(group, metric)]));
      if (group.length !== ROUNDS || group.some(row => !row.ok) ||
          Object.values(distributions).some(data => data.count < ROUNDS)) report.complete = false;
      return [variant, { attempts: group.length, successful: group.filter(row => row.ok).length,
        events: group.reduce((sum, row) => sum + row.errors.length, 0), metrics: distributions }];
    }));
    return [condition, variants];
  }));
}

function markdown(report) {
  const lines = ['## Browser metrics', '', 'Sample counts appear in parentheses. Times are ms.', '',
    '| Condition | Metric | Before Median / P95 | After Median / P95 |', '| --- | --- | ---: | ---: |'];
  const cell = ({ count, median, p95 }) => count ? median.toFixed(3) + ' / ' + p95.toFixed(3) + ' (' + count + ')' : '— (0)';
  for (const [type, conditions] of Object.entries({ startup: report.startup, firstOpen: report.firstOpen })) {
    for (const [condition, group] of Object.entries(conditions)) {
      for (const [metric, before] of Object.entries(group.before.metrics)) {
        lines.push('| ' + type + ' / ' + condition + ' | ' + metric + ' | ' + cell(before) + ' | ' +
          cell(group.after.metrics[metric]) + ' |');
      }
    }
  }
  for (const flag of report.firstOpenReview) lines.push('', '- Review ' + flag.feature + ' ' + flag.metric +
    ' increase: ' + flag.increaseMs.toFixed(1) + ' ms (' + (flag.fraction * 100).toFixed(1) + '%).');
  if (report.fatal) lines.push('', 'Browser run stopped. See benchmark-errors.json.');
  return lines.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 3, 'Pass before app root, after app root, and artifact directory');
  const [before, after, artifacts] = args.map(arg => path.resolve(arg));
  fs.mkdirSync(artifacts, { recursive: true });
  const samplesFile = path.join(artifacts, 'benchmark-samples.jsonl');
  fs.writeFileSync(samplesFile, '');
  const hosts = [], rows = [];
  const scope = process.env.SABAII_VALIDATION_SCOPE || 'all';
  const featureName = scope.replace(/^navigation-/, '');
  const navigationScope = scope.startsWith('navigation-') && Object.hasOwn(FEATURES, featureName);
  assert.ok(scope === 'all' || scope === 'startup' || navigationScope, 'Unknown benchmark scope: ' + scope);
  const startupModes = scope === 'all' || scope === 'startup' ? MODES : [];
  const featureNames = scope === 'all' ? Object.keys(FEATURES) : navigationScope ? [featureName] : [];
  const report = {
    rounds: ROUNDS, node: process.version, os: os.platform() + ' ' + os.release(), cpu: os.cpus()[0]?.model,
    viewport: VISIBLE, throttle: SLOW, startupObservationMsAfterReadyAndLoad: 1250,
    large: { tasks: 2000, attachments: 6000, imageAttachments: 25 },
    complete: true, fatal: null, firstOpenReview: [], scope,
    offlineMethod: 'Online reload under the service worker, then Chromium offline context and disconnected origin',
  };
  let browser;
  try {
    for (const root of [before, after]) {
      await fsp.access(path.join(root, 'index.html'));
      hosts.push(await serve(root));
    }
    browser = await chromium.launch({
      channel: process.env.SABAII_BROWSER_CHANNEL || undefined,
      args: ['--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND'],
    });
    report.chromium = browser.version();
    for (const [type, conditions] of [['startup', startupModes], ['feature', featureNames]]) {
      for (const condition of conditions) {
        for (let round = 1; round <= ROUNDS; round++) {
          // Alternate ordering without running competing browser contexts in parallel.
          for (const i of round % 2 ? [0, 1] : [1, 0]) {
            const row = await runTrial(browser, hosts[i], type, condition, VARIANTS[i], round);
            fs.appendFileSync(samplesFile, JSON.stringify(row) + '\n');
            rows.push(row);
          }
        }
        console.log(type + ' ' + condition + ': ' + ROUNDS + ' attempts per variant');
      }
    }
  } catch (error) {
    report.fatal = error.stack || error.message;
    report.complete = false;
    console.error(report.fatal);
  } finally {
    await browser?.close().catch(error => {
      report.fatal ||= error.stack || error.message;
      report.complete = false;
    });
    await Promise.all(hosts.map(({ server }) => new Promise(resolve => server.close(resolve))));
    report.startup = compare(report, rows, 'startup', startupModes, START_METRICS);
    report.firstOpen = compare(report, rows, 'feature', featureNames, ['readyMs']);
    for (const [feature, group] of Object.entries(report.firstOpen)) {
      const before = group.before.metrics.readyMs, after = group.after.metrics.readyMs;
      if (before.count !== ROUNDS || after.count !== ROUNDS) continue;
      for (const metric of ['median', 'p95']) {
        const increaseMs = after[metric] - before[metric];
        const fraction = increaseMs / before[metric];
        if (increaseMs >= 100 && fraction >= 0.20) report.firstOpenReview.push({ feature, metric, increaseMs, fraction });
      }
    }
    const errors = rows.filter(row => row.errors.length).map(({ metrics, ...row }) => row);
    fs.writeFileSync(path.join(artifacts, 'benchmark-errors.json'), JSON.stringify({ fatal: report.fatal, trials: errors }, null, 2));
    fs.writeFileSync(path.join(artifacts, 'benchmark-summary.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(artifacts, 'benchmark-summary.md'), markdown(report));
  }
  if (!report.complete) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
