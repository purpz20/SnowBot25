require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = globalThis.fetch;
const cheerio = require('cheerio');
const cron = require('node-cron');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages
    ]
});

async function fetchPistasInfo() {
    try {
        const response = await fetch("https://www.san-isidro.net/actual/estado");
        const body = await response.text();
        const $ = cheerio.load(body);

        const pistasInfo = $("td")
            .filter((i, el) => $(el).text().includes("de 35"))
            .text()
            .trim();

        const aa = $("td")
        .filter((i, el) => $(el).text().includes(" cm"))
        .text()
        .trim();

        if (pistasInfo) {
            return `🎿 **Estado das Pistas:** ${pistasInfo}\nNeve: ${aa}`;
        } else {
            return "❌ Não foi possível encontrar informações sobre as pistas.";
        }
    } catch (error) {
        console.error("Erro ao buscar informações:", error);
        return "❌ Erro ao buscar informações do site.";
    }
}

async function sendInfo() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
        const info = await fetchPistasInfo();
        channel.send(info);
    }
    console.log("📢 Informação enviada para o Discord!");
}

cron.schedule("0 12 * * *", async () => {
    sendInfo();
});

client.once("ready", async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.login(TOKEN);