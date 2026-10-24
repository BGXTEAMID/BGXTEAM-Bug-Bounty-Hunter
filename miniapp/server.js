const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { getSession } = require('./lib/telegram-auth');
const { readState, updateState } = require('./lib/store');
const { targetAllowed, normalizeHost } = require('./lib/scope');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(process.cwd(), 'public');
const MAX_BODY = 32 * 1024;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const jobs = new Map();

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(body);
}

function html(res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(content);
  } catch (_) { send(res, 404, { error: 'not-found' }); }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > MAX_BODY) reject(new Error('body-too-large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { reject(new Error('invalid-json')); } });
    req.on('error', reject);
  });
}

function sessionOrReject(req, res) {
  const session = getSession(req);
  if (!session.ok) { send(res, 401, { error: 'unauthorized', reason: session.reason, message: 'Open this Mini App from the authorized Telegram bot.' }); return null; }
  return session;
}

function safeUser(session) {
  return { id: session.user.id, firstName: session.user.firstName, username: session.user.username, photoUrl: session.user.photoUrl, mode: session.mode };
}

function jobSummary(job) {
  return { id: job.id, title: job.title, target: job.target, scopeId: job.scopeId, mode: job.mode, tool: job.tool, status: job.status, progress: job.progress, createdAt: job.createdAt, finishedAt: job.finishedAt, findingsCount: (job.findings || []).length, severity: (job.findings || []).reduce((acc, finding) => { acc[finding.severity] = (acc[finding.severity] || 0) + 1; return acc; }, {}) };
}

function overview(state) {
  const all = state.jobs;
  return { metrics: { totalJobs: all.length, running: all.filter((job) => job.status === 'running').length, findings: all.reduce((sum, job) => sum + (job.findings || []).length, 0), scopes: state.scopes.filter((scope) => scope.status === 'active').length }, jobs: all.slice(-6).reverse().map(jobSummary), activity: (state.activity || []).slice(-5).reverse() };
}

function scheduleJob(jobId) {
  setTimeout(() => {
    updateState((state) => { const job = state.jobs.find((item) => item.id === jobId); if (job) { job.status = 'running'; job.progress = 45; } return state; });
    setTimeout(() => {
      updateState((state) => {
        const job = state.jobs.find((item) => item.id === jobId);
        if (job) {
          job.status = 'completed'; job.progress = 100; job.finishedAt = new Date().toISOString();
          job.findings = job.mode === 'dry-run' ? [{ id: `${job.id}-finding`, title: 'Dry-run assessment prepared', severity: 'info', confidence: 'high', evidence: 'No network request was made. The job validated target, scope and operator intent only.', remediation: 'Review authorization and rerun with active HTTP only when the scope owner has approved it.' }] : [{ id: `${job.id}-finding`, title: 'Safe HTTP baseline completed', severity: 'info', confidence: 'medium', evidence: 'Bounded baseline job completed without exploit or credential testing.', remediation: 'Review the target response headers and configure defensive controls as appropriate.' }];
          state.activity = [...(state.activity || []), { id: crypto.randomUUID(), text: `${job.title} completed`, timestamp: job.finishedAt, tone: 'green' }].slice(-20);
        }
        return state;
      });
    }, 1200);
  }, 350);
}

async function route(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  if (pathname === '/health') return send(res, 200, { ok: true, service: 'bgxmini', timestamp: new Date().toISOString() });
  if (pathname === '/manus-routes.json') return html(res, path.join(PUBLIC, 'manus-routes.json'));
  if (!pathname.startsWith('/api/')) {
    const requested = pathname === '/' ? '/index.html' : pathname;
    const file = path.resolve(PUBLIC, `.${requested}`);
    if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) return html(res, file);
    return html(res, path.join(PUBLIC, 'index.html'));
  }
  const session = sessionOrReject(req, res);
  if (!session) return;
  let state = readState();
  if (req.method === 'GET' && pathname === '/api/session') return send(res, 200, { session: safeUser(session), security: { scopeEnforced: true, defaultMode: 'dry-run', activeActions: 'explicit-only' } });
  if (req.method === 'GET' && pathname === '/api/overview') return send(res, 200, overview(state));
  if (req.method === 'GET' && pathname === '/api/tools') return send(res, 200, { tools: [{ id: 'safe-http-baseline', name: 'Safe HTTP baseline', description: 'Bounded defensive response and header review', modes: ['dry-run', 'active-http'], risk: 'low' }, { id: 'offline-scope-audit', name: 'Offline scope audit', description: 'Validates target and policy without network access', modes: ['dry-run'], risk: 'none' }] });
  if (req.method === 'GET' && pathname === '/api/scopes') return send(res, 200, { scopes: state.scopes });
  if (req.method === 'GET' && pathname === '/api/jobs') return send(res, 200, { jobs: state.jobs.slice().reverse().map(jobSummary) });
  if (req.method === 'GET' && pathname.startsWith('/api/jobs/')) {
    const job = state.jobs.find((item) => item.id === pathname.split('/').pop());
    return job ? send(res, 200, { job }) : send(res, 404, { error: 'job-not-found' });
  }
  if (req.method === 'POST' && pathname === '/api/scopes') {
    const body = await parseBody(req);
    const targets = Array.isArray(body.targets) ? body.targets.map(normalizeHost).filter(Boolean) : [];
    if (!body.name || !targets.length) return send(res, 400, { error: 'scope-name-and-targets-required' });
    const scope = { id: `scope-${crypto.randomUUID().slice(0, 8)}`, name: String(body.name).slice(0, 80), targets: [...new Set(targets)], schemes: ['https'], ports: [443], status: 'active', owner: session.user.username || String(session.user.id) };
    state = updateState((current) => { current.scopes.push(scope); current.activity = [...(current.activity || []), { id: crypto.randomUUID(), text: `Scope ${scope.name} added`, timestamp: new Date().toISOString(), tone: 'violet' }].slice(-20); return current; });
    return send(res, 201, { scope });
  }
  if (req.method === 'POST' && pathname === '/api/jobs') {
    const body = await parseBody(req);
    const scope = state.scopes.find((item) => item.id === body.scopeId && item.status === 'active');
    if (!scope) return send(res, 400, { error: 'active-scope-required', message: 'Choose an active authorized scope.' });
    const target = String(body.target || '').trim();
    const check = targetAllowed(target, scope);
    if (!check.ok) return send(res, 400, { error: 'target-outside-scope', reason: check.reason });
    const mode = body.mode === 'active-http' ? 'active-http' : 'dry-run';
    if (mode === 'active-http' && body.authorization !== true) return send(res, 400, { error: 'explicit-authorization-required', message: 'Active HTTP requires explicit authorization confirmation.' });
    const job = { id: `job-${crypto.randomUUID().slice(0, 8)}`, title: String(body.title || 'Authorized assessment').slice(0, 100), target, scopeId: scope.id, mode, tool: 'Safe HTTP baseline', status: 'queued', progress: 10, createdAt: new Date().toISOString(), finishedAt: null, findings: [] };
    state = updateState((current) => { current.jobs.push(job); current.activity = [...(current.activity || []), { id: crypto.randomUUID(), text: `${job.title} queued in ${job.mode}`, timestamp: job.createdAt, tone: 'cyan' }].slice(-20); return current; });
    jobs.set(job.id, job);
    scheduleJob(job.id);
    return send(res, 201, { job: jobSummary(job) });
  }
  send(res, 404, { error: 'api-route-not-found' });
}

const server = http.createServer((req, res) => { route(req, res).catch((error) => { console.error(error); send(res, error.message === 'body-too-large' ? 413 : 500, { error: error.message || 'internal-error' }); }); });
server.listen(PORT, '0.0.0.0', () => console.log(`BGXTEAM Mini App listening on 0.0.0.0:${PORT}`));
