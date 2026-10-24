const fs = require('node:fs');
const path = require('node:path');

const dataFile = path.resolve(process.env.DATA_FILE || path.join(process.cwd(), 'data', 'miniapp.json'));
const initialState = {
  schemaVersion: 1,
  scopes: [
    { id: 'scope-demo', name: 'Demo authorized scope', targets: ['example.com'], schemes: ['https'], ports: [443], status: 'active', owner: 'BGXTEAMID' }
  ],
  jobs: [
    { id: 'job-demo-01', title: 'Baseline headers review', target: 'https://example.com', scopeId: 'scope-demo', mode: 'dry-run', tool: 'Safe HTTP baseline', status: 'completed', progress: 100, createdAt: new Date(Date.now() - 3600000).toISOString(), finishedAt: new Date(Date.now() - 3540000).toISOString(), findings: [{ id: 'finding-demo-01', title: 'Dry-run assessment ready', severity: 'info', confidence: 'high', evidence: 'No network request was made in preview mode.', remediation: 'Review scope, then explicitly authorize an active assessment when appropriate.' }] }
  ],
  activity: [{ id: 'activity-01', text: 'Preview workspace initialized', timestamp: new Date().toISOString(), tone: 'cyan' }]
};

function ensureDir() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true, mode: 0o700 });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readState() {
  ensureDir();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (parsed && parsed.schemaVersion === 1) return parsed;
  } catch (_) {}
  writeState(initialState);
  return clone(initialState);
}

function writeState(state) {
  ensureDir();
  const temporary = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, dataFile);
}

function updateState(mutator) {
  const state = readState();
  const result = mutator(state) || state;
  writeState(result);
  return result;
}

module.exports = { dataFile, readState, writeState, updateState, clone };
