const crypto = require('node:crypto');

function parseInitData(raw) {
  const params = new URLSearchParams(raw || '');
  const values = {};
  for (const [key, value] of params.entries()) values[key] = value;
  return { params, values };
}

function validateTelegramInitData(raw, botToken, maxAgeSeconds = 86400) {
  if (!raw || !botToken) return { ok: false, reason: 'missing-telegram-init-data' };
  const { params, values } = parseInitData(raw);
  const receivedHash = values.hash;
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return { ok: false, reason: 'invalid-telegram-hash' };
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(expected, 'hex'))) return { ok: false, reason: 'telegram-hash-mismatch' };
  const authDate = Number(values.auth_date || 0);
  if (!Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > maxAgeSeconds) return { ok: false, reason: 'telegram-init-data-expired' };
  let user = {};
  try { user = values.user ? JSON.parse(values.user) : {}; } catch (_) { return { ok: false, reason: 'invalid-telegram-user' }; }
  return { ok: true, mode: 'telegram', user: { id: user.id, firstName: user.first_name || 'Telegram user', username: user.username || '', photoUrl: user.photo_url || '' } };
}

function getSession(req) {
  if (String(process.env.DEV_PREVIEW).toLowerCase() === 'true') {
    return { ok: true, mode: 'preview', user: { id: 0, firstName: 'Preview operator', username: 'local_preview', photoUrl: '' } };
  }
  return validateTelegramInitData(req.headers['x-telegram-init-data'] || '', process.env.TELEGRAM_BOT_TOKEN || '');
}

module.exports = { parseInitData, validateTelegramInitData, getSession };
