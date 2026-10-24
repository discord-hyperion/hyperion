import { HyperionClient } from "@hyperion";

await HyperionClient.create({
    name: "HyperionDev",
    root: new URL("./", import.meta.url),
    discord: {
        intents: ["Guilds", "GuildMessages", "MessageContent"],
    },
    description: "Developer bot for the Hyperion framework",
    ownerIds: [],
});
