require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fetch = globalThis.fetch;
const cheerio = require('cheerio');
const cron = require('node-cron');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

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

let webcamUrl;

async function fetchInfo() {
    try {
        const response = await fetch("https://www.san-isidro.net/actual/estado");
        const body = await response.text();
        let $ = cheerio.load(body);

        const stationStatus = $("td:contains('Estación')").next().text().trim() === "Abierta" ? "✅ Aberta" : "❌ Fechada";
        const openTrails = $("td:contains('Pistas')").next().text().replace(/\s+/g, ' ').trim();
        const snowQualityOriginal = $("td:contains('Calidad nieve')").next().text().trim();
        const snowQuality = snowQualityTranslation[snowQualityOriginal] || snowQualityOriginal;
        const snowDepth = $("td:contains('Espesor')").next().text().trim();

        const response2 = await fetch("https://www.san-isidro.net/actual/webcams");
        const body2 = await response2.text();
        $ = cheerio.load(body2);

        const iframeSrc = $("iframe").attr("data-src");

        const response3 = await fetch(iframeSrc, { redirect: 'follow' });
        webcamUrl = response3.url;

        const message = `🏔️ **Estação**: ${stationStatus}
🏂 **Pistas Abertas**: ${openTrails}
❄️ **Qualidade da neve**: ${snowQuality}
📏 **Espessura da neve**: ${snowDepth}`;

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('toggleWebcam')
                    .setLabel('Webcam')
                    .setStyle(ButtonStyle.Primary)
            );

        return { content: message, components: [row] };

    } catch (error) {
        console.error("Error fetching the information:", error);
        return "❌ Erro ao buscar informações do site.";
    }
}

let scheduledChannels = [];

cron.schedule("0 12 * * *", async () => {
    scheduledChannels.forEach(async channel => {
        const info = await fetchInfo();
        channel.send(info + '\n||@everyone||');
    });
});

client.once("ready", async () => {
    console.log(`✅ Bot connected as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    const commands = [
        new SlashCommandBuilder()
            .setName('snow')
            .setDescription('Get the current snow information'),
        new SlashCommandBuilder()
            .setName('dailysnow')
            .setDescription('Get the snow information daily'),
        new SlashCommandBuilder()
            .setName('canceldailysnow')
            .setDescription('Cancel the daily snow information')
    ];

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const { commandName } = interaction;

        if (commandName === 'snow') {
            await interaction.deferReply();
            const info = await fetchInfo();
            await interaction.editReply(info);
        } else if (commandName === 'dailysnow') {
            await interaction.deferReply();
            const channelHasScheduled = scheduledChannels.some(channel => channel.id === interaction.channel.id);
            if (channelHasScheduled) {
                return await interaction.editReply('❌ Informações diárias de neve já estão ativadas.');
            }
            scheduledChannels.push(interaction.channel);
            await interaction.editReply('✅ Informações diárias de neve ativadas.');
        } else if (commandName === 'canceldailysnow') {
            await interaction.deferReply();
            const channelHasScheduled = scheduledChannels.some(channel => channel.id === interaction.channel.id);
            if (!channelHasScheduled) {
                return await interaction.editReply('❌ Informações diárias de neve não estão ativadas.');
            }
            scheduledChannels = scheduledChannels.filter(channel => channel.id !== interaction.channel.id);
            await interaction.editReply('✅ Informações diárias de neve desativadas.');
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'toggleWebcam') {
            const message = interaction.message.content;
            const button = interaction.component;
            const newLabel = button.label === 'Webcam' ? 'Esconder' : 'Webcam';
            const newButton = new ButtonBuilder()
                .setCustomId('toggleWebcam')
                .setLabel(newLabel)
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(newButton);

            if (button.label === 'Webcam') {
                await interaction.update({ content: `${message}\n📺 [**Webcam**](${webcamUrl})`, components: [row] });
            } else {
                await interaction.update({ content: message.replace(/\n📺 \[\*\*Webcam\*\*\]\(.*\)/, ''), components: [row] });
            }
        }
    }
});

client.login(TOKEN);