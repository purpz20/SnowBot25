require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fetch = globalThis.fetch;
const cheerio = require('cheerio');
const cron = require('node-cron');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const snowQualityTranslation = {
    "Polvo": "Pó",
    "Dura": "Dura",
    "Primavera": "Primavera",
    "Húmeda": "húmida",
    "Costra": "Crosta",
    "Helada": "Congelada"
};

async function fetchInfo() {
    try {
        const response = await fetch("https://www.san-isidro.net/actual/estado");
        const body = await response.text();
        const $ = cheerio.load(body);

        const stationStatus = $("td:contains('Estación')").next().text().trim() === "Abierta" ? "✅ Aberta" : "❌ Fechada";
        const openTrails = $("td:contains('Pistas')").next().text().replace(/\s+/g, ' ').trim();
        const snowQualityOriginal = $("td:contains('Calidad nieve')").next().text().trim();
        const snowQuality = snowQualityTranslation[snowQualityOriginal] || snowQualityOriginal;
        const snowDepth = $("td:contains('Espesor')").next().text().trim();

        return `🏔️ **Estação**: ${stationStatus}
🏂 **Pistas Abertas**: ${openTrails}
❄️ **Qualidade da neve**: ${snowQuality}
📏 **Espessura da neve**: ${snowDepth}`

    } catch (error) {
        console.error("Erro ao buscar informações:", error);
        return "❌ Erro ao buscar informações do site.";
    }
}

cron.schedule("0 12 * * *", async () => {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
        const info = await fetchInfo();
        channel.send(info);
    }
});

client.once("ready", async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    const commands = [
        {
            name: 'snow',
            description: 'Get the current snow information'
        }
    ];

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'snow') {
        await interaction.deferReply();
        const info = await fetchInfo();
        await interaction.editReply(info);
    }
});

client.login(TOKEN);