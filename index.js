const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

// 1. Инициализация Discord бота
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2. Инициализация Express для вебхуков Testomat.io
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // ID канала для уведомлений тестов
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

client.once('ready', () => {
    console.log(`Бот авторизован как ${client.user.tag}`);
});

// Обработка сообщений в Discord (общение с Gemini)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Бот отвечает, если его упомянули или если сообщение в ЛС
    if (message.mentions.has(client.user) || message.channel.type === 1) {
        const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
        if (!prompt) return;

        try {
            // Используем стабильную бесплатную модель gemini-1.5-flash
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            const data = await response.json();
            
            // Если Google вернул ошибку, пишем её в чат для отладки
            if (data.error) {
                console.error('Ошибка от API Gemini:', data.error);
                await message.channel.send(`Ошибка API Gemini: ${data.error.message || 'Неизвестная ошибка'}`);
                return;
            }

            const reply = data.candidates && 
                          data.candidates[0] && 
                          data.candidates[0].content && 
                          data.candidates[0].content.parts[0].text
                ? data.candidates[0].content.parts[0].text
                : 'Ошибка получения ответа от Gemini.';

            // Отправка сообщения прямо в канал
            await message.channel.send(reply);
        } catch (error) {
            console.error('Ошибка сети или кода:', error);
            await message.channel.send('Произошла ошибка при обращении к нейросети.');
        }
    }
});

// Эндпоинт для приема вебхуков от Testomat.io
app.post('/webhook/testomat', async (req, res) => {
    try {
        const testData = req.body;
        const channel = await client.channels.fetch(CHANNEL_ID);
        
        if (channel) {
            const status = testData.status || 'обновление';
            const text = `📊 **Testomat.io отчет:** Статус прогона — **${status}**\nПроект: ${testData.project || 'Не указан'}`;
            await channel.send(text);
        }
        
        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Ошибка обработки вебхука Testomat:', error);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    res.send('Bot is running and alive!');
});

// Запуск сервера и бота
app.listen(PORT, () => {
    console.log(`Сервер вебхуков запущен на порту ${PORT}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
