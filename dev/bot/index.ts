import { HyperionClient } from "@hyperion";
import { Events } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !applicationId || !guildId) {
    throw new Error(
        "Set DISCORD_TOKEN, DISCORD_APPLICATION_ID, and DISCORD_DEV_GUILD_ID before starting the development bot.",
    );
}

const bot = await HyperionClient.create({
    name: "HyperionDev",
    root: new URL("./", import.meta.url),
    discord: {
        intents: ["Guilds"],
    },
    description: "Developer bot for the Hyperion framework",
    ownerIds: [],
    commands: {
        applicationId,
        token,
        guildIds: [guildId],
    },
});

bot.once(Events.ClientReady, client => {
    console.info(`${bot.name} is ready as ${client.user.username}.`);
});

await bot.login(token);
