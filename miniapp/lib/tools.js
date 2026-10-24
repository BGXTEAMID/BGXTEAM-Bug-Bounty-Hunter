const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { URL } = require('node:url');
const { targetAllowed } = require('./scope');

const MAX_BODY = 256 * 1024;
const TIMEOUT_MS = 9000;
const USER_AGENT = 'BGXTEAM-Safe-Assessment/2.1';

const TOOL_CATALOG = [
  { id: 'offline-scope-audit', name: 'Offline Scope Audit', description: 'Validates target, URL policy, and authorization boundary without network access.', modes: ['dry-run'], risk: 'none' },
  { id: 'safe-http-baseline', name: 'Safe HTTP Baseline', description: 'Reads one bounded response and checks defensive headers/cookie flags.', modes: ['dry-run', 'active-http'], risk: 'low' }
];

function isPublicIp(address) {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))) return false;
    return true;
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value !== '::' && value !== '::1' && !value.startsWith('fc') && !value.startsWith('fd') && !value.startsWith('fe8') && !value.startsWith('fe9') && !value.startsWith('fea') && !value.startsWith('feb') && !value.startsWith('ff');
  }
  return false;
}

async function resolvePublic(host) {
  if (net.isIP(host)) {
    if (!isPublicIp(host)) throw new Error('resolved-ip-not-public');
    return [{ address: host, family: net.isIPv6(host) ? 6 : 4 }];
  }
  const answers = await dns.lookup(host, { all: true, verbatim: true });
  if (!answers.length || answers.some((answer) => !isPublicIp(answer.address))) throw new Error('dns-resolves-to-private-or-reserved-ip');
  return answers;
}

function pinnedRequest(target, addresses) {
  const parsed = new URL(target);
  if (parsed.protocol !== 'https:') throw new Error('https-required-for-active-http');
  const address = addresses[0];
  const transport = https;
  return new Promise((resolve, reject) => {
    const defaultPort = 443;
    const hostHeader = parsed.port && Number(parsed.port) !== defaultPort ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    const request = transport.request({
      protocol: 'https:', hostname: address.address, port: parsed.port || defaultPort,
      path: `${parsed.pathname || '/'}${parsed.search}`, method: 'GET',
      servername: parsed.hostname, rejectUnauthorized: true, timeout: TIMEOUT_MS,
      headers: { Host: hostHeader, 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*;q=0.1', Connection: 'close' },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family)
    }, (response) => {
      const chunks = []; let size = 0; let truncated = false;
      response.on('data', (chunk) => { if (size < MAX_BODY) { const remaining = MAX_BODY - size; chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining); } if (size >= MAX_BODY && chunk.length > 0) truncated = true; });
      response.on('end', () => resolve({ status: response.statusCode || 0, headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value || '')])), bodyBytes: size, truncated, redirect: (response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400 }));
    });
    request.on('timeout', () => request.destroy(new Error('request-timeout')));
    request.on('error', reject);
    request.end();
  });
}

function findingsForResponse(target, response) {
  const findings = [];
  const checks = [
    ['content-security-policy', 'Missing Content-Security-Policy', 'medium', 'Define a restrictive CSP appropriate to the application.'],
    ['strict-transport-security', 'Missing Strict-Transport-Security', 'low', 'Enable HSTS after confirming HTTPS is enforced safely.'],
    ['x-content-type-options', 'Missing X-Content-Type-Options', 'low', 'Set X-Content-Type-Options: nosniff.'],
    ['referrer-policy', 'Missing Referrer-Policy', 'low', 'Set a privacy-preserving Referrer-Policy.']
  ];
  for (const [header, title, severity, remediation] of checks) if (!response.headers[header]) findings.push({ title, target, category: 'security-headers', severity, confidence: 'high', state: 'Needs Review', evidence: `HTTP ${response.status}; response header absent`, remediation, scanner: 'safe-http-baseline' });
  const cookies = response.headers['set-cookie'] || '';
  if (cookies && !/\bsecure\b/i.test(cookies)) findings.push({ title: 'Cookie without Secure attribute', target, category: 'cookies', severity: 'medium', confidence: 'medium', state: 'Needs Review', evidence: 'Set-Cookie response lacks Secure', remediation: 'Mark sensitive cookies Secure over HTTPS.', scanner: 'safe-http-baseline' });
  if (cookies && !/\bhttponly\b/i.test(cookies)) findings.push({ title: 'Cookie without HttpOnly attribute', target, category: 'cookies', severity: 'medium', confidence: 'medium', state: 'Needs Review', evidence: 'Set-Cookie response lacks HttpOnly', remediation: 'Mark session cookies HttpOnly unless client-side access is required.', scanner: 'safe-http-baseline' });
  if (response.redirect) findings.push({ title: 'Redirect observed and not followed', target, category: 'transport', severity: 'info', confidence: 'high', state: 'Needs Review', evidence: `HTTP ${response.status}; redirect target was intentionally not requested`, remediation: 'Review redirect destinations and scope them separately before assessing.', scanner: 'safe-http-baseline' });
  return findings;
}

async function runTool({ toolId, target, scope, mode }) {
  const tool = TOOL_CATALOG.find((item) => item.id === toolId);
  if (!tool) throw new Error('unknown-tool');
  const allowed = targetAllowed(target, scope);
  if (!allowed.ok) throw new Error(`scope-denied:${allowed.reason}`);
  if (mode === 'dry-run') return { findings: [{ title: `${tool.name} dry-run validated`, target, category: 'workflow', severity: 'info', confidence: 'high', state: 'Needs Review', evidence: 'No network request was made; URL, scope, and tool policy passed.', remediation: 'Run active HTTP only after confirming written authorization.' }], networkUsed: false, metadata: { tool: tool.id, targetHost: allowed.host } };
  if (toolId !== 'safe-http-baseline') throw new Error('tool-mode-not-supported');
  const addresses = await resolvePublic(allowed.host);
  const response = await pinnedRequest(target, addresses);
  return { findings: findingsForResponse(target, response), networkUsed: true, metadata: { tool: tool.id, status: response.status, bodyBytes: response.bodyBytes, truncated: response.truncated, resolvedAddress: addresses[0].address, redirectFollowed: false } };
}

module.exports = { TOOL_CATALOG, isPublicIp, resolvePublic, runTool };
