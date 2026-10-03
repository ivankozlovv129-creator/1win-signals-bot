const http = require('http');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// 1. HTTP-сервер для прохождения проверки портов на Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Telegram Bot is active!\n');
}).listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// 2. Считывание переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.API_URL;
const WEBAPP_URL = process.env.WEBAPP_URL;

// Ваша реферальная ссылка на 1win
const REGISTRATION_URL = 'https://lkgp.pro/c20ece'; // Замените YOUR_PROMO на ваш промокод

if (!BOT_TOKEN) {
  console.error("ОШИБКА: Переменная BOT_TOKEN не задана!");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const userSessions = new Map();

// Текстовые шаблоны
const botTexts = {
  ru: {
    welcome: "Зарегистрируйтесь по нашей ссылке и получите доступ к сигналам.\n\n📥 **Следующий шаг:** После регистрации внесите депозит от $20 и отправьте сюда ваш **Player ID** с сайта 1win для проверки:",
    btnRegister: "🔥 Погнали 🔥",
    checking: "Проверяем ваш ID и наличие депозита от $20...",
    notRegistered: "❌ ID не найден. Убедитесь, что зарегистрировались по нашей ссылке и внесли депозит от $20.",
    lowDeposit: (dep) => `⚠ Ваш депозит составляет $${dep}. Для доступа требуется минимальный депозит от $20.`,
    success: "✅ Проверка прошла успешно! Доступ к сигналам разрешен.",
    btnApp: "🚀 Открыть Сигналы App"
  },
  en: {
    welcome: "Register using our link to get access to signals.\n\n📥 **Next step:** After registering, make a deposit of $20+ and send your 1win **Player ID** here for verification:",
    btnRegister: "🔥 Let's Go 🔥",
    checking: "Checking your ID and minimum $20 deposit...",
    notRegistered: "❌ ID not found. Make sure you registered via our link and made a deposit.",
    lowDeposit: (dep) => `⚠ Your deposit is $${dep}. Minimum required deposit is $20.`,
    success: "✅ Verification successful! Signal access granted.",
    btnApp: "🚀 Open Signals App"
  }
};

// 1. Старт - выбор языка
bot.start((ctx) => {
  ctx.reply(
    "Choose your language / Выберите язык:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("🇷🇺 Русский", "set_lang_ru"),
        Markup.button.callback("🇬🇧 English", "set_lang_en")
      ]
    ])
  );
});

bot.action('set_lang_ru', (ctx) => handleLangSelect(ctx, 'ru'));
bot.action('set_lang_en', (ctx) => handleLangSelect(ctx, 'en'));

function handleLangSelect(ctx, lang) {
  const userId = ctx.from.id;
  userSessions.set(userId, { lang: lang, access: false });

  ctx.answerCbQuery();

  const txt = botTexts[lang];

  // Отправляем сообщение с описанием и кнопкой-ссылкой
  ctx.reply(
    txt.welcome,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url(txt.btnRegister, REGISTRATION_URL)]
      ])
    }
  );
}

// 2. Обработка ввода Player ID
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const user = userSessions.get(userId) || { lang: 'ru', access: false };
  const inputId = ctx.message.text.trim();

  if (/^\d+$/.test(inputId)) {
    const txt = botTexts[user.lang];
    ctx.reply(txt.checking);

    try {
      const baseUrl = API_URL ? API_URL.replace(/\/$/, '') : 'http://localhost:8000';
      const response = await axios.get(`${baseUrl}/api/check-user`, {
        params: { player_id: inputId }
      });

      const { is_registered, total_deposit } = response.data;

      if (!is_registered) {
        return ctx.reply(txt.notRegistered);
      }

      if (total_deposit < 20) {
        return ctx.reply(txt.lowDeposit(total_deposit));
      }

      user.access = true;
      userSessions.set(userId, user);

      const appUrl = WEBAPP_URL ? WEBAPP_URL.replace(/\/$/, '') : 'http://localhost:3000';
      const fullWebAppUrl = `${appUrl}?lang=${user.lang}`;

      return ctx.reply(
        txt.success,
        Markup.inlineKeyboard([
          [Markup.button.webApp(txt.btnApp, fullWebAppUrl)]
        ])
      );

    } catch (error) {
      console.error("Ошибка API:", error.message);
      ctx.reply(
        user.lang === 'ru' 
          ? 'Ошибка соединения с сервером проверки. Попробуйте позже.' 
          : 'Server verification error. Please try again later.'
      );
    }
  }
});

bot.launch().then(() => {
  console.log("Бот успешно запущен!");
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
