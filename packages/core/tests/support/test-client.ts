import type { TestContext } from "node:test";
import { HyperionClient } from "../../src/client/index.ts";
import { InteractionDispatcher } from "../../src/execution/index.ts";

type TestClientOptions = {
    level?: "debug" | "info";
};

/**
 * Creates a client rooted at the empty-bot fixture, captures structured log
 * records, and destroys the client when the test finishes.
 */
export const createTestClient = async (
    t: Pick<TestContext, "after">,
    options: TestClientOptions = {},
) => {
    const records: Record<string, unknown>[] = [];
    const client = await HyperionClient.create({
        root: new URL("../fixtures/empty-bot/", import.meta.url),
        name: "Test",
        discord: { intents: [] },
        logging: {
            level: options.level ?? "debug",
            pretty: false,
            progress: false,
            destination: { write: line => records.push(JSON.parse(line)) },
        },
    });
    t.after(() => client.destroy());

    return { client, records, dispatcher: new InteractionDispatcher(client) };
};
