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
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

client.once('ready', () => {
    console.log(`Бот авторизован как ${client.user.tag}`);
});

// Обработка сообщений в Discord (общение с DeepSeek)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Бот отвечает, если его упомянули или если сообщение в ЛС
    if (message.mentions.has(client.user) || message.channel.type === 1) {
        const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
        if (!prompt) return;

        try {
            await message.channel.sendTyping();
            
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{ role: "user", content: prompt }]
                })
            });

            const data = await response.json();
            const reply = data.choices && data.choices[0].message.content 
                ? data.choices[0].message.content 
                : 'Ошибка получения ответа от DeepSeek.';

            await message.reply(reply);
        } catch (error) {
            console.error('Ошибка DeepSeek API:', error);
            await message.reply('Произошла ошибка при обращении к нейросети.');
        }
    }
});

// Эндпоинт для приема вебхуков от Testomat.io
app.post('/webhook/testomat', async (req, res) => {
    try {
        const testData = req.body;
        const channel = await client.channels.fetch(CHANNEL_ID);
        
        if (channel) {
            // Формируем красивое сообщение о прогоне тестов
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
