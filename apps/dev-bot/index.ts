import { HyperionClient } from "@hyperion/core";

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
    commands: {
        applicationId,
        token,
        guildIds: [guildId],
    },
});

await bot.login(token);
