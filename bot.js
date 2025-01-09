require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// Настройки
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Генерация уникального PIN-кода
const generatePincode = async () => {
  let pincode;
  let isUnique = false;

  while (!isUnique) {
    pincode = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabase.from('heal').select('pincode').eq('pincode', pincode);
    if (data.length === 0) {
      isUnique = true;
    }
  }
  return pincode;
};

// Обработка сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) {
    bot.sendMessage(chatId, 'Пожалуйста, отправьте свой вопрос в текстовом виде.');
    return;
  }

  try {
    const pincode = await generatePincode();

    // Сохранение вопроса в таблицу Supabase
    const { error } = await supabase.from('heal').insert([
      {
        text: text,
        email: null, // Почта не запрашивается в Telegram
        pincode: pincode,
      },
    ]);

    if (error) {
      console.error('Ошибка при сохранении в Supabase:', error.message);
      bot.sendMessage(chatId, 'Произошла ошибка при отправке вашего вопроса. Попробуйте позже.');
      return;
    }

    // Отправка PIN-кода пользователю
    bot.sendMessage(chatId, `Ваш вопрос был успешно отправлен! Ваш PIN-код: ${pincode}`);
    bot.sendMessage(chatId, `Вы можете узнать ответ на странице: https://canfly.org/i/heal/${pincode}`);
  } catch (err) {
    console.error('Ошибка при обработке сообщения:', err.message);
    bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте снова.');
  }
});

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `Добро пожаловать! Этот бот позволяет отправить анонимный вопрос нашим специалистам.\n\nВы так же можете написать свой вопрос анонимно на сайте https://canfly.org/i/heal \n\nПросто напишите ваш вопрос в одном сообщении, и мы отправим его в нашу систему.\n\nПосле отправки вы получите PIN-код, с которым сможете проверить ответ на странице спустя несколько дней: https://canfly.org/i/heal/<PIN-код>\n\n`
  );
});
