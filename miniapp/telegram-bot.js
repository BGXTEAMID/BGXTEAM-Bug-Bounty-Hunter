const API = 'https://api.telegram.org/bot';
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const miniAppUrl = process.env.MINI_APP_URL || '';
let offset = 0;

async function telegram(method, payload) {
  const response = await fetch(`${API}${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || `Telegram ${method} failed`);
  return result.result;
}

function keyboard() {
  return { inline_keyboard: [[{ text: 'Open Cybersecurity Command Center', web_app: { url: miniAppUrl } }]] };
}

async function handle(update) {
  const message = update.message;
  if (!message || !message.chat) return;
  const text = String(message.text || '').trim().toLowerCase();
  if (text === '/start' || text === '/app') {
    await telegram('sendMessage', { chat_id: message.chat.id, text: 'BGXTEAM Cybersecurity Command Center\n\nGunakan Mini App hanya untuk assessment yang sudah diotorisasi. Scope wajib dan mode dry-run menjadi default.', reply_markup: keyboard() });
  } else if (text === '/help') {
    await telegram('sendMessage', { chat_id: message.chat.id, text: 'Perintah tersedia:\n/start atau /app — buka Mini App\n/help — tampilkan panduan\n\nGuardrail: default-deny scope, tidak ada exploit/brute force/credential attack.' });
  }
}

async function main() {
  if (!token || !miniAppUrl) throw new Error('TELEGRAM_BOT_TOKEN and MINI_APP_URL are required');
  await telegram('setMyCommands', { commands: [{ command: 'start', description: 'Open the Cybersecurity Command Center' }, { command: 'app', description: 'Open the Mini App' }, { command: 'help', description: 'Show safety guidance' }] });
  console.log('BGXTEAM Telegram bot polling started');
  while (true) {
    try {
      const updates = await telegram('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const update of updates) { offset = update.update_id + 1; await handle(update); }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });
module.exports = { keyboard };
