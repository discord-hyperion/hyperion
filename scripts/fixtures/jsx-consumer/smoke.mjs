import assert from "node:assert/strict";
import { EmbedBuilder, ModalBuilder } from "@discordjs/builders";
import { Bold, Embed, Modal, renderEmbed, renderModal } from "@hyperion/jsx";
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

const modalView = jsx(Modal, {
    customId: "standalone.modal",
    title: "Standalone modal",
    children: jsx(Modal.Label, {
        text: "Name",
        children: jsx(Modal.TextInput, { customId: "name" }),
    }),
});
const modal = renderModal(modalView);
assert.ok(modal instanceof ModalBuilder);
assert.equal(modal.toJSON().custom_id, "standalone.modal");
const secondModal = renderModal(jsxDEV(Fragment, { children: modalView }));
assert.notEqual(secondModal, modal);
assert.notEqual(secondModal.components[0], modal.components[0]);
console.log(
    "PASS standalone modal renderer, native identity and fresh nested builders",
);
