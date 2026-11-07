import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { ComponentType } from "discord.js";
import {
    buttonKind,
    componentKinds,
    selectMenuKind,
} from "./support/component-kinds.ts";
import { createHandlerRoot } from "./support/temp-root.ts";

const withoutTemplateId = (source: string, id: string) =>
    source.replace(`.setCustomId(${JSON.stringify(id)})`, "");

/** Swap the template for the exact custom ID it carried. */
const withoutTemplate = (source: string) =>
    source.replace(
        /builder: [\s\S]*?\.setCustomId\(("[^"]*")\)[\s\S]*?, \.\.\.\{/,
        "customId: $1, ...{",
    );

/** Change the template's custom ID after the handler is defined. */
const withChangedTemplate = (source: string) =>
    `${source.replace("export default define", "const handler = define")}
    handler.builder.setCustomId("other");
    export default handler;`;

for (const kind of componentKinds) {
    describe(`${kind.noun} templates`, () => {
        test("the template's custom ID is the handler's, and build() copies it", async t => {
            const { root, directory } = await createHandlerRoot(
                t,
                "hyperion-templates-",
                kind.folder,
            );

            await writeFile(
                path.join(directory, "handler.mjs"),
                kind.source("templated"),
            );

            const registry = new kind.Registry();
            await registry.load(root);

            const first = registry.build("templated");
            const second = registry.build("templated");

            assert.equal(first.toJSON().custom_id, "templated");
            assert.notEqual(first, second);
            assert.notEqual(first, registry.get("templated")?.builder);
            assert.equal(registry.get("templated")?.customId, "templated");
        });

        test("a handler without a template loads, but build() throws", async t => {
            const { root, directory } = await createHandlerRoot(
                t,
                "hyperion-templates-",
                kind.folder,
            );

            await writeFile(
                path.join(directory, "handler.mjs"),
                withoutTemplate(kind.source("bare")),
            );

            const registry = new kind.Registry();
            await registry.load(root);

            assert.equal(registry.get("bare")?.builder, undefined);
            assert.throws(() => registry.build("bare"), /has no template/);
            assert.throws(
                () => registry.build("missing"),
                new RegExp(`No ${kind.noun} handler is loaded`),
            );
        });

        test("a template changed after it's defined must keep the handler's ID", async t => {
            const { root, directory } = await createHandlerRoot(
                t,
                "hyperion-templates-",
                kind.folder,
            );

            await writeFile(
                path.join(directory, "handler.mjs"),
                withChangedTemplate(kind.source("declared")),
            );

            await assert.rejects(new kind.Registry().load(root), error => {
                assert.ok(error instanceof Error);
                assert.match(
                    String(error.cause),
                    /template custom ID must match its handler's custom ID/,
                );

                return true;
            });
        });

        for (const [name, source, error] of [
            [
                "a template without a custom ID",
                withoutTemplateId(kind.source("unnamed"), "unnamed"),
                /require a customId, params, or a template with a custom ID/,
            ],
            [
                "a customId beside a template",
                kind
                    .source("both")
                    .replace(/(define\w+\(\{)/, '$1 customId: "both",'),
                /with a template take its custom ID; remove customId/,
            ],
        ] as const) {
            test(`${name} fails to load`, async t => {
                const { root, directory } = await createHandlerRoot(
                    t,
                    "hyperion-templates-",
                    kind.folder,
                );

                await writeFile(path.join(directory, "handler.mjs"), source);

                await assert.rejects(new kind.Registry().load(root), cause => {
                    assert.ok(cause instanceof Error);
                    assert.match(String(cause.cause), error);

                    return true;
                });
            });
        }
    });
}

test("a select template must match the declared componentType", async t => {
    const { root, directory } = await createHandlerRoot(
        t,
        "hyperion-templates-",
        "select-menus",
    );

    await writeFile(
        path.join(directory, "handler.mjs"),
        selectMenuKind
            .source("typed")
            .replace(
                `componentType: ${ComponentType.StringSelect}`,
                `componentType: ${ComponentType.UserSelect}`,
            ),
    );

    await assert.rejects(new selectMenuKind.Registry().load(root), error => {
        assert.ok(error instanceof Error);
        assert.match(String(error.cause), /template type must match/);

        return true;
    });
});

test("literal custom IDs must be non-empty and at most 100 characters", async t => {
    for (const id of ["", "x".repeat(101)]) {
        const { root, directory } = await createHandlerRoot(
            t,
            "hyperion-templates-",
            "buttons",
        );

        await writeFile(
            path.join(directory, "handler.mjs"),
            withoutTemplate(buttonKind.source(id)),
        );

        await assert.rejects(
            new buttonKind.Registry().load(root),
            /Failed to load button/,
        );
    }
});
