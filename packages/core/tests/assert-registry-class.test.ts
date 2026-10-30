import assert from "node:assert/strict";
import { test } from "node:test";
import { assertRegistryClass } from "../src/util/index.ts";

abstract class Handler {
    protected constructor() {}
    abstract run(): string;
}

test("narrows unknown exports to constructors without instantiating during validation", () => {
    let constructions = 0;
    class ConcreteHandler extends Handler {
        constructor() {
            super();
            constructions += 1;
        }

        run() {
            return "Ready";
        }
    }
    class InheritedHandler extends ConcreteHandler {}

    for (const handler of [ConcreteHandler, InheritedHandler]) {
        const defaultExport: unknown = handler;
        const before = constructions;

        assertRegistryClass(defaultExport, Handler);

        assert.equal(constructions, before);
        const instance = new defaultExport();
        assert.equal(instance.run(), "Ready");
        assert.equal(constructions, before + 1);
    }
});

test("rejects missing exports, instances, unrelated classes, factories, and the base class", () => {
    class Unrelated {}
    for (const defaultExport of [
        undefined,
        null,
        42,
        "Handler",
        {},
        new Unrelated(),
        Unrelated,
        () => new Unrelated(),
        Handler,
    ]) {
        assert.throws(() => assertRegistryClass(defaultExport, Handler), {
            name: "TypeError",
            message: "Expected a default-exported class extending Handler.",
        });
    }
});
