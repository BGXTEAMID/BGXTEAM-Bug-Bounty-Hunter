const { URL } = require('node:url');

function normalizeHost(host) {
  return String(host || '').trim().replace(/\.$/, '').toLowerCase();
}

function targetAllowed(target, scope) {
  let parsed;
  try { parsed = new URL(target); } catch (_) { return { ok: false, reason: 'invalid-url' }; }
  const host = normalizeHost(parsed.hostname);
  const schemes = scope.schemes || ['https'];
  const ports = scope.ports || [443];
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  const hosts = (scope.targets || []).map(normalizeHost);
  const hostMatch = hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  if (!hostMatch) return { ok: false, reason: 'host-outside-scope' };
  if (!schemes.includes(parsed.protocol.replace(':', ''))) return { ok: false, reason: 'scheme-not-allowed' };
  if (!ports.includes(port)) return { ok: false, reason: 'port-not-allowed' };
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials-in-url-not-allowed' };
  return { ok: true, host, port };
}

module.exports = { normalizeHost, targetAllowed };
