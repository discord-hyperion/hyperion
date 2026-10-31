import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { EmbedBuilder } from "@discordjs/builders";
import { Bold, Embed, renderEmbed } from "../lib/index.ts";

const iterations = 5_000;
const rounds = 7;
const fields = Array.from({ length: 5 }, (_, index) => ({
    name: `Field ${index}`,
    value: String(index),
}));
const tree = () => (
    <Embed color={0x57f287}>
        <Embed.Title>Benchmark</Embed.Title>
        <Embed.Description>
            <Bold>Hello</Bold>
        </Embed.Description>
        {fields.map(field => (
            <Embed.Field key={field.name} name={field.name}>
                {field.value}
            </Embed.Field>
        ))}
    </Embed>
);
const native = () =>
    new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("Benchmark")
        .setDescription("**Hello**")
        .addFields(fields);
const view = tree();

assert.deepEqual(renderEmbed(view).toJSON(), native().toJSON());

const measure = (label: string, operation: () => unknown) => {
    for (let index = 0; index < 1_000; index++) {
        operation();
    }

    const samples = [];

    for (let round = 0; round < rounds; round++) {
        const start = performance.now();

        for (let index = 0; index < iterations; index++) {
            operation();
        }

        samples.push(((performance.now() - start) * 1_000) / iterations);
    }

    samples.sort((left, right) => left - right);
    console.log(
        `${label}: median ${samples[Math.floor(samples.length / 2)]?.toFixed(2)} us/op; range ${samples[0]?.toFixed(2)}–${samples.at(-1)?.toFixed(2)}`,
    );
};

console.log(
    `Node ${process.version}; ${rounds} rounds × ${iterations} iterations; five fields; equivalent native output verified`,
);
measure("JSX tree creation", tree);
measure("Native construction (no serialization)", native);
measure("Native construction + validation", () => native().toJSON());
measure("JSX render + validation (reused tree)", () => renderEmbed(view));
measure("JSX tree + render + validation", () => renderEmbed(tree()));
const builder = native();
measure("Native validation only", () => builder.toJSON());
