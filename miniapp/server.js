const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { getSession } = require('./lib/telegram-auth');
const { readState, updateState } = require('./lib/store');
const { targetAllowed, normalizeHost } = require('./lib/scope');
const { TOOL_CATALOG, runTool } = require('./lib/tools');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(process.cwd(), 'public');
const MAX_BODY = 32 * 1024;
const MAX_ACTIVE_JOBS = 2;
const ACTIVE_COOLDOWN_MS = 15000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const activeTimestamps = new Map();

function securityHeaders(contentType, cacheControl = 'no-store') { return { 'content-type': contentType, 'cache-control': cacheControl, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'content-security-policy': "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data: https:; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" }; }
function send(res, status, payload, headers = {}) { const body = typeof payload === 'string' ? payload : JSON.stringify(payload); res.writeHead(status, { ...securityHeaders('application/json; charset=utf-8'), ...headers }); res.end(body); }
function html(res, filePath) { try { const content = fs.readFileSync(filePath); res.writeHead(200, securityHeaders(MIME[path.extname(filePath)] || 'application/octet-stream', 'no-cache')); res.end(content); } catch (_) { send(res, 404, { error: 'not-found' }); } }
function parseBody(req) { return new Promise((resolve, reject) => { let raw = ''; let rejected = false; req.on('data', (chunk) => { if (rejected) return; raw += chunk; if (raw.length > MAX_BODY) { rejected = true; reject(new Error('body-too-large')); req.destroy(); } }); req.on('end', () => { if (rejected) return; try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { reject(new Error('invalid-json')); } }); req.on('error', reject); }); }
function sessionOrReject(req, res) { const session = getSession(req); if (!session.ok) { send(res, 401, { error: 'unauthorized', reason: session.reason, message: 'Open this Mini App from the authorized Telegram bot.' }); return null; } return session; }
function safeUser(session) { return { id: session.user.id, firstName: session.user.firstName, username: session.user.username, photoUrl: session.user.photoUrl, mode: session.mode }; }
function jobSummary(job) { return { id: job.id, title: job.title, target: job.target, scopeId: job.scopeId, mode: job.mode, tool: job.tool, status: job.status, progress: job.progress, createdAt: job.createdAt, finishedAt: job.finishedAt, findingsCount: (job.findings || []).length, severity: (job.findings || []).reduce((acc, finding) => { acc[finding.severity] = (acc[finding.severity] || 0) + 1; return acc; }, {}) }; }
function overview(state) { const all = state.jobs; return { metrics: { totalJobs: all.length, running: all.filter((job) => job.status === 'running').length, findings: all.reduce((sum, job) => sum + (job.findings || []).length, 0), scopes: state.scopes.filter((scope) => scope.status === 'active').length }, jobs: all.slice(-6).reverse().map(jobSummary), activity: (state.activity || []).slice(-5).reverse() }; }
function addActivity(text, tone = 'cyan') { updateState((state) => { state.activity = [...(state.activity || []), { id: crypto.randomUUID(), text, timestamp: new Date().toISOString(), tone }].slice(-20); return state; }); }
function runningCount() { return readState().jobs.filter((job) => job.status === 'running').length; }
async function executeJob(jobId) { updateState((state) => { const job = state.jobs.find((item) => item.id === jobId); if (job) { job.status = 'running'; job.progress = 35; job.startedAt = new Date().toISOString(); } return state; }); const state = readState(); const job = state.jobs.find((item) => item.id === jobId); const scope = state.scopes.find((item) => item.id === job?.scopeId); try { const result = await runTool({ toolId: job.toolId, target: job.target, scope, mode: job.mode }); updateState((current) => { const item = current.jobs.find((entry) => entry.id === jobId); if (item) { item.status = 'completed'; item.progress = 100; item.finishedAt = new Date().toISOString(); item.findings = result.findings; item.networkUsed = result.networkUsed; item.metadata = result.metadata; } return current; }); addActivity(`${job.title} completed with ${result.findings.length} finding(s)`, 'green'); } catch (error) { updateState((current) => { const item = current.jobs.find((entry) => entry.id === jobId); if (item) { item.status = 'failed'; item.progress = 100; item.finishedAt = new Date().toISOString(); item.error = error.message; item.findings = [{ id: `${jobId}-error`, title: 'Tool execution stopped safely', severity: 'info', confidence: 'high', state: 'Needs Review', evidence: error.message, remediation: 'Review scope, DNS resolution, HTTPS, authorization, and tool policy before retrying.' }]; } return current; }); addActivity(`${job?.title || jobId} stopped safely`, 'amber'); } }
function queueJob(jobId) { setTimeout(() => executeJob(jobId).catch((error) => console.error('job', error)), 120); }

async function route(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`); const pathname = requestUrl.pathname;
  if (pathname === '/health') return send(res, 200, { ok: true, service: 'bgxmini', security: 'layered-guardrails', timestamp: new Date().toISOString() });
  if (pathname === '/manus-routes.json') return html(res, path.join(PUBLIC, 'manus-routes.json'));
  if (!pathname.startsWith('/api/')) { const requested = pathname === '/' ? '/index.html' : pathname; const file = path.resolve(PUBLIC, `.${requested}`); const insidePublic = file === PUBLIC || file.startsWith(`${PUBLIC}${path.sep}`); if (insidePublic && fs.existsSync(file) && fs.statSync(file).isFile()) return html(res, file); return html(res, path.join(PUBLIC, 'index.html')); }
  const session = sessionOrReject(req, res); if (!session) return; let state = readState();
  if (req.method === 'GET' && pathname === '/api/session') return send(res, 200, { session: safeUser(session), security: { scopeEnforced: true, defaultMode: 'dry-run', activeActions: 'explicit-only', dnsPrivateIpBlocked: true, redirectsFollowed: false, maxBodyBytes: 262144 } });
  if (req.method === 'GET' && pathname === '/api/overview') return send(res, 200, overview(state));
  if (req.method === 'GET' && pathname === '/api/tools') return send(res, 200, { tools: TOOL_CATALOG, guardrails: ['default-deny scope', 'Telegram HMAC session', 'HTTPS only for active HTTP', 'private/reserved IP rejection', 'redirects disabled', 'timeout and body caps', 'no exploit payloads'] });
  if (req.method === 'GET' && pathname === '/api/scopes') return send(res, 200, { scopes: state.scopes });
  if (req.method === 'GET' && pathname === '/api/jobs') return send(res, 200, { jobs: state.jobs.slice().reverse().map(jobSummary) });
  if (req.method === 'GET' && pathname.startsWith('/api/jobs/')) { const job = state.jobs.find((item) => item.id === pathname.split('/').pop()); return job ? send(res, 200, { job }) : send(res, 404, { error: 'job-not-found' }); }
  if (req.method === 'POST' && pathname === '/api/scopes') { const body = await parseBody(req); const targets = Array.isArray(body.targets) ? body.targets.map(normalizeHost).filter((target) => /^[a-z0-9.-]+$/i.test(target)).slice(0, 100) : []; if (!body.name || !targets.length) return send(res, 400, { error: 'scope-name-and-targets-required' }); const scope = { id: `scope-${crypto.randomUUID().slice(0, 8)}`, name: String(body.name).slice(0, 80), targets: [...new Set(targets)], schemes: ['https'], ports: [443], status: 'active', owner: session.user.username || String(session.user.id) }; updateState((current) => { current.scopes.push(scope); return current; }); addActivity(`Scope ${scope.name} added`, 'violet'); return send(res, 201, { scope }); }
  if (req.method === 'POST' && pathname === '/api/jobs') {
    const body = await parseBody(req); const scope = state.scopes.find((item) => item.id === body.scopeId && item.status === 'active'); if (!scope) return send(res, 400, { error: 'active-scope-required', message: 'Choose an active authorized scope.' });
    const target = String(body.target || '').trim(); const check = targetAllowed(target, scope); if (!check.ok) return send(res, 400, { error: 'target-outside-scope', reason: check.reason });
    const mode = body.mode === 'active-http' ? 'active-http' : 'dry-run'; const toolId = TOOL_CATALOG.some((tool) => tool.id === body.toolId) ? body.toolId : 'safe-http-baseline'; const tool = TOOL_CATALOG.find((item) => item.id === toolId); if (!tool.modes.includes(mode)) return send(res, 400, { error: 'tool-mode-not-supported' });
    if (mode === 'active-http' && session.mode !== 'telegram') return send(res, 403, { error: 'telegram-session-required-for-active-http' }); if (mode === 'active-http' && body.authorization !== true) return send(res, 400, { error: 'explicit-authorization-required', message: 'Active HTTP requires explicit authorization confirmation.' }); if (mode === 'active-http' && runningCount() >= MAX_ACTIVE_JOBS) return send(res, 429, { error: 'active-job-limit-reached' }); const previous = activeTimestamps.get(String(session.user.id)) || 0; if (mode === 'active-http' && Date.now() - previous < ACTIVE_COOLDOWN_MS) return send(res, 429, { error: 'active-cooldown', message: 'Wait before starting another active assessment.' });
    if (mode === 'active-http') activeTimestamps.set(String(session.user.id), Date.now()); const job = { id: `job-${crypto.randomUUID().slice(0, 8)}`, title: String(body.title || `${tool.name} assessment`).slice(0, 100), target, scopeId: scope.id, mode, tool: tool.name, toolId, status: 'queued', progress: 10, createdAt: new Date().toISOString(), finishedAt: null, findings: [], createdBy: session.user.id }; updateState((current) => { current.jobs.push(job); return current; }); addActivity(`${job.title} queued in ${job.mode}`, 'cyan'); queueJob(job.id); return send(res, 201, { job: jobSummary(job) });
  }
  send(res, 404, { error: 'api-route-not-found' });
}
const server = http.createServer((req, res) => { route(req, res).catch((error) => { console.error(error); send(res, error.message === 'body-too-large' ? 413 : 500, { error: error.message || 'internal-error' }); }); });
server.listen(PORT, '0.0.0.0', () => console.log(`BGXTEAM Mini App listening on 0.0.0.0:${PORT}`));
