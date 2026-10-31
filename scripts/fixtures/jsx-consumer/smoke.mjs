import assert from "node:assert/strict";
import { EmbedBuilder } from "@discordjs/builders";
import { Bold, Embed, renderEmbed } from "@hyperion/jsx";
import { jsxDEV } from "@hyperion/jsx/jsx-dev-runtime";
import { Fragment, jsx, jsxs } from "@hyperion/jsx/jsx-runtime";

const view = jsxs(Embed, {
    children: [
        jsx(Embed.Title, { children: "Standalone" }),
        jsx(Embed.Description, { children: jsx(Bold, { children: "Hello" }) }),
    ],
});
const result = renderEmbed(view);
assert.ok(result instanceof EmbedBuilder);
assert.equal(result.toJSON().description, "**Hello**");
assert.equal(
    renderEmbed(jsxDEV(Fragment, { children: view })).toJSON().title,
    "Standalone",
);
assert.throws(() => import.meta.resolve("@hyperion/core"), {
    code: "ERR_MODULE_NOT_FOUND",
});
console.log(
    "PASS standalone JSX production/development runtimes, native identity and no core dependency",
);
