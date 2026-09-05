const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

process.on('unhandledRejection', error => {
    console.error('❌ Необработанная ошибка промиса:', error);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PORT = process.env.PORT || 3000;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TOKEN = process.env.DISCORD_BOT_TOKEN ? process.env.DISCORD_BOT_TOKEN.trim() : '';

client.once('ready', () => {
    console.log(`🤖 Бот успешно авторизован как ${client.user.tag}!`);
});

client.on('error', error => {
    console.error('❌ Ошибка клиента Discord:', error);
});

// Обработка сообщений для Gemini
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.mentions.has(client.user) || message.channel.type === 1) {
        const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
        if (!prompt) return;

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error('Ошибка от API Gemini:', data.error);
                await message.channel.send(`Ошибка API Gemini: ${data.error.message || 'Неизвестная ошибка'}`);
                return;
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Ошибка получения ответа от Gemini.';
            await message.channel.send(reply);
        } catch (error) {
            console.error('Ошибка сети или кода:', error);
            await message.channel.send('Произошла ошибка при обращении к нейросети.');
        }
    }
});

// Вебхук для Testomat.io
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

app.listen(PORT, () => {
    console.log(`🌐 Сервер вебхуков запущен на порту ${PORT}`);
});

if (!TOKEN) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Переменная DISCORD_BOT_TOKEN не задана на Render!');
} else {
    client.login(TOKEN)
        .then(() => console.log('🔑 Авторизация в Discord прошла успешно!'))
        .catch(err => console.error('❌ Ошибка входа в Discord:', err));
}
