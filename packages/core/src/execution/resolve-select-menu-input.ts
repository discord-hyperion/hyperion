import type {
    SelectMenuContext,
    SelectMenuHandler,
    SelectMenuInputDefinition,
    SelectMenuType,
} from "../components/select-menu.ts";
import { resolveInput } from "./resolve-input.ts";

type AnySelectContext = SelectMenuContext<{ componentType: SelectMenuType }>;

/** The schema reads a copy of the selected values: strings, or entity IDs. */
export const resolveSelectMenuInput = async (
    selectMenu: SelectMenuHandler<{ componentType: SelectMenuType }>,
    ctx: AnySelectContext,
) => {
    if (!selectMenu.input) return undefined;

    // Registries erase each handler's context type; the dispatcher only routes
    // an interaction to a handler of its own component type.
    return resolveInput(
        selectMenu.input as SelectMenuInputDefinition<SelectMenuType>,
        ctx,
        () => [...ctx.interaction.values],
    );
};
