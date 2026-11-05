import type {
    ChannelSelectMenuBuilder,
    MentionableSelectMenuBuilder,
    RoleSelectMenuBuilder,
    UserSelectMenuBuilder,
} from "@discordjs/builders";
import { JSXRenderError } from "./error.ts";
import { buildSelect } from "./render-select.ts";
import { type Child, expand } from "./runtime.ts";
import { validateComponent } from "./validate-component.ts";

type EntitySelectBuilders = {
    UserSelect: UserSelectMenuBuilder;
    RoleSelect: RoleSelectMenuBuilder;
    MentionableSelect: MentionableSelectMenuBuilder;
    ChannelSelect: ChannelSelectMenuBuilder;
};

const renderer =
    <Name extends keyof EntitySelectBuilders>(name: Name) =>
    (view: Child): EntitySelectBuilders[Name] => {
        const roots = expand(view, "root");
        const root = roots[0];

        if (
            roots.length !== 1 ||
            !root ||
            typeof root !== "object" ||
            root.name !== name
        ) {
            throw new JSXRenderError("root", `Expected exactly one ${name}.`);
        }

        const builder = buildSelect(
            { ...root, path: name },
            "message",
        ) as EntitySelectBuilders[Name];
        validateComponent(builder, name);

        return builder;
    };

/** Render one native user-select builder for existing interaction handlers. */
export const renderUserSelect = renderer("UserSelect");

/** Render one native role-select builder for existing interaction handlers. */
export const renderRoleSelect = renderer("RoleSelect");

/** Render one native mentionable-select builder for existing interaction handlers. */
export const renderMentionableSelect = renderer("MentionableSelect");

/** Render one native channel-select builder for existing interaction handlers. */
export const renderChannelSelect = renderer("ChannelSelect");
