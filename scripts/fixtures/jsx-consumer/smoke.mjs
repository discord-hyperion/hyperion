import assert from "node:assert/strict";
import {
    ActionRowBuilder,
    CustomIdButtonBuilder,
    EmbedBuilder,
    ModalBuilder,
    StringSelectMenuBuilder,
} from "@discordjs/builders";
import {
    ActionRow,
    Bold,
    Button,
    Embed,
    Modal,
    renderButton,
    renderComponents,
    renderEmbed,
    renderModal,
    renderStringSelect,
    StringSelect,
} from "@hyperion/jsx";
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

const buttonView = jsx(Button, {
    customId: "standalone.refresh",
    style: "primary",
    children: "Refresh",
});
const button = renderButton(buttonView);
assert.ok(button instanceof CustomIdButtonBuilder);
const rowsView = jsx(ActionRow, { children: buttonView });
const rows = renderComponents(rowsView);
assert.ok(rows[0] instanceof ActionRowBuilder);
assert.ok(rows[0].components[0] instanceof CustomIdButtonBuilder);
const devRows = renderComponents(jsxDEV(Fragment, { children: rowsView }));
assert.notEqual(rows[0], devRows[0]);
assert.notEqual(rows[0].components[0], devRows[0].components[0]);
assert.deepEqual(renderComponents(null), []);
console.log(
    "PASS standalone button/row renderers, runtime exports and native identity",
);

const selectView = jsx(StringSelect, {
    customId: "standalone.priority",
    minValues: 0,
    disabled: false,
    children: jsx(StringSelect.Option, {
        label: "Low",
        value: "low",
        default: false,
    }),
});
const select = renderStringSelect(selectView);
assert.ok(select instanceof StringSelectMenuBuilder);
assert.equal(select.toJSON().options[0].default, false);
const selectRows = renderComponents(jsx(ActionRow, { children: selectView }));
assert.ok(selectRows[0].components[0] instanceof StringSelectMenuBuilder);
const devSelect = renderStringSelect(
    jsxDEV(Fragment, { children: selectView }),
);
assert.notEqual(select, devSelect);
assert.notEqual(select.options[0], devSelect.options[0]);
console.log(
    "PASS standalone string selects, native identity and automatic runtimes",
);
