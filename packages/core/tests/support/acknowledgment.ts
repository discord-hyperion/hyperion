import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";

export type Phase = "new" | "defer-update" | "defer-reply" | "replied";

export const phases: readonly Phase[] = [
    "new",
    "defer-update",
    "defer-reply",
    "replied",
];

type Spy = { mock: { calls: { arguments: unknown[] }[]; callCount(): number } };
type Fixture = { reply: Spy; editReply: Spy; followUp: Spy };

/** Failures reply to the interaction differently depending on how it was acknowledged. */
export const failureResponse = (fixture: Fixture, phase: Phase) =>
    phase === "new"
        ? fixture.reply
        : phase === "defer-reply"
          ? fixture.editReply
          : fixture.followUp;

/**
 * Asserts the one private failure reply for an acknowledgment phase: ephemeral
 * unless the deferred reply is already ephemeral, and never overwriting a
 * deferred update.
 */
export const assertPrivateFailure = (
    fixture: Fixture,
    phase: Phase,
    content: string,
) => {
    const response = failureResponse(fixture, phase);

    assert.equal(response.mock.callCount(), 1, phase);
    assert.deepEqual(
        response.mock.calls[0]?.arguments[0],
        {
            content,
            ...(phase === "defer-reply"
                ? {}
                : { flags: MessageFlags.Ephemeral }),
        },
        phase,
    );
    if (phase === "defer-update") {
        assert.equal(fixture.editReply.mock.callCount(), 0, phase);
    }
};
