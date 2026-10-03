const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('YOUR_TELEGRAM_BOT_TOKEN');
const PARTNER_API_URL = 'https://1win-partners-api.com/v1/';
const API_KEY = 'YOUR_AFFILIATE_API_KEY';

// Хранилище сессий пользователей { lang, id, access }
const userSessions = new Map();

// Тексты бота
const botTexts = {
  ru: {
    welcome: "Зарегистрируйтесь по нашей ссылке и введите ваш Player ID на 1win:\n\nhttps://1win.com/?open=register&p=YOUR_PROMO",
    checking: "Проверяем ваш ID и наличие депозита от $20...",
    notRegistered: "❌ ID не найден в нашей системе. Убедитесь, что зарегистрировались по нашей ссылке.",
    lowDeposit: (dep) => `⚠ Ваш депозит $${dep}. Для доступа требуется минимальный депозит от $20.`,
    success: "✅ Проверка прошла успешно! Доступ к сигналам разрешен.",
    btnApp: "🚀 Открыть Сигналы App"
  },
  en: {
    welcome: "Register using our link and enter your 1win Player ID:\n\nhttps://1win.com/?open=register&p=YOUR_PROMO",
    checking: "Checking your ID and minimum $20 deposit...",
    notRegistered: "❌ ID not found in our affiliate system. Make sure you registered via our link.",
    lowDeposit: (dep) => `⚠ Your deposit is $${dep}. Minimum required deposit is $20.`,
    success: "✅ Verification successful! Signal access granted.",
    btnApp: "🚀 Open Signals App"
  }
};

// 1. Старт бота - выбор языка
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

// Обработка выбора языка
bot.action('set_lang_ru', (ctx) => handleLangSelect(ctx, 'ru'));
bot.action('set_lang_en', (ctx) => handleLangSelect(ctx, 'en'));

function handleLangSelect(ctx, lang) {
  const userId = ctx.from.id;
  userSessions.set(userId, { lang: lang, access: false });

  ctx.answerCbQuery();
  ctx.reply(botTexts[lang].welcome);
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
      const response = await axios.get(`${PARTNER_API_URL}player-info`, {
        params: { api_key: API_KEY, player_id: inputId }
      });

      const { isRegistered, totalDeposit } = response.data;

      if (!isRegistered) {
        return ctx.reply(txt.notRegistered);
      }

      if (totalDeposit < 20) {
        return ctx.reply(txt.lowDeposit(totalDeposit));
      }

      user.access = true;
      userSessions.set(userId, user);

      // Передаем выбранный язык как параметр запуска WebApp
      const webAppUrl = `https://your-domain.com/webapp?lang=${user.lang}`;

      return ctx.reply(
        txt.success,
        Markup.inlineKeyboard([
          [Markup.button.webApp(txt.btnApp, webAppUrl)]
        ])
      );

    } catch (error) {
      console.error(error);
      ctx.reply(user.lang === 'ru' ? 'Ошибка API. Попробуйте позже.' : 'API Error. Try again later.');
    }
  }
});

bot.launch();