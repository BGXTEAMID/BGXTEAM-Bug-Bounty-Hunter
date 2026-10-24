"""Optional Telegram entrypoint. Core modules work without aiogram installed."""
import asyncio, logging
from core.config import Config
from core.demo import run_demo

async def main():
    cfg = Config.from_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not cfg.token: raise SystemExit("TELEGRAM_BOT_TOKEN is missing; copy .env.example to .env and configure environment variables")
    if not cfg.allowed_ids: raise SystemExit("ALLOWED_TELEGRAM_IDS is empty/invalid; production bot refuses to start")
    try: from aiogram import Bot, Dispatcher, F
    except ImportError as exc: raise SystemExit("Optional dependency missing: install with pip install '.[bot]'") from exc
    from aiogram.filters import Command
    from aiogram.types import Message
    bot, dp = Bot(cfg.token), Dispatcher()
    @dp.message(Command("start", "help", "menu"))
    async def start(message: Message):
        if message.from_user is None or not cfg.authorized(message.from_user.id): return await message.answer("Akses ditolak.")
        await message.answer("<b>BGXTEAM BUG BOUNTY HUNTER</b>\nCore aman aktif. /doctor /tools /demo /privacy\nScan produksi default-deny; scope dan persetujuan eksplisit wajib.", parse_mode="HTML")
    @dp.message(Command("id"))
    async def user_id(message: Message):
        if message.from_user and cfg.authorized(message.from_user.id): await message.answer(f"Telegram ID: {message.from_user.id}")
    @dp.message(Command("privacy"))
    async def privacy(message: Message):
        if message.from_user and cfg.authorized(message.from_user.id): await message.answer("Data disimpan lokal. Jangan kirim token, cookie, password, atau hash sensitif ke chat.")
    @dp.message(Command("demo", "demo_run"))
    async def demo(message: Message):
        if not message.from_user or not cfg.authorized(message.from_user.id): return await message.answer("Akses ditolak.")
        from reports.generate import markdown_report
        await message.answer(markdown_report(run_demo())[:4000])
    @dp.message(Command("doctor", "environment", "capabilities", "resource", "disk", "tools", "tool_matrix", "status", "health", "about", "version"))
    async def doctor(message: Message):
        if not message.from_user or not cfg.authorized(message.from_user.id): return await message.answer("Akses ditolak.")
        import platform, shutil
        await message.answer(f"Python: {platform.python_version()}\nOS: {platform.system()} {platform.machine()}\nData dir: {cfg.data_dir}\nFree bytes: {shutil.disk_usage(cfg.data_dir.parent if cfg.data_dir.parent.exists() else '.').free}\nProduction scanning: {'configured' if cfg.production_scanning_enabled else 'DENIED'}\nExternal active scanners: disabled by default")
    await dp.start_polling(bot)
if __name__ == "__main__": asyncio.run(main())
