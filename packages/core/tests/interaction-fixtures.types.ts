import {
    Collection,
    ComponentType,
    type RoleSelectMenuInteraction,
    type UserSelectMenuInteraction,
} from "discord.js";
import {
    createButtonInteraction,
    createSelectInteraction,
} from "../../../tests/fixtures/interactions.ts";

const user = createSelectInteraction(ComponentType.UserSelect, {
    users: new Collection([
        ["selected", { id: "selected", username: "Selected" }],
    ]),
});
const interaction: UserSelectMenuInteraction = user.interaction;
void interaction;

// @ts-expect-error The selected component type determines the interaction type.
const role: RoleSelectMenuInteraction = user.interaction;
void role;

// @ts-expect-error User selects cannot be configured with resolved roles.
createSelectInteraction(ComponentType.UserSelect, { roles: new Collection() });

// @ts-expect-error Select values are string identifiers.
createSelectInteraction(ComponentType.StringSelect, { values: [123] });

// @ts-expect-error Arbitrary predicate overrides are not part of the factory input.
createButtonInteraction({ isButton: () => false });
