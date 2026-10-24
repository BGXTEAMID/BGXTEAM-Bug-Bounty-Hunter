const fs = require('node:fs');
const path = require('node:path');

const dataFile = path.resolve(process.env.DATA_FILE || path.join(process.cwd(), 'data', 'miniapp.json'));
const previewMode = process.env.DEV_PREVIEW === 'true';
const initialState = {
  schemaVersion: 2,
  environment: previewMode ? 'preview' : 'production',
  scopes: previewMode ? [{ id: 'scope-preview', name: 'Preview authorized scope', targets: ['example.com'], schemes: ['https'], ports: [443], status: 'active', owner: 'preview-operator' }] : [],
  jobs: [],
  activity: previewMode ? [{ id: 'activity-preview', text: 'Preview workspace initialized', timestamp: new Date().toISOString(), tone: 'cyan' }] : []
};

function ensureDir() { fs.mkdirSync(path.dirname(dataFile), { recursive: true, mode: 0o700 }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readState() {
  ensureDir();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (parsed && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2)) return parsed;
  } catch (_) {}
  writeState(initialState);
  return clone(initialState);
}
function writeState(state) { ensureDir(); const temporary = `${dataFile}.${process.pid}.tmp`; fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 }); fs.renameSync(temporary, dataFile); }
function updateState(mutator) { const state = readState(); const result = mutator(state) || state; writeState(result); return result; }
module.exports = { dataFile, readState, writeState, updateState, clone };
