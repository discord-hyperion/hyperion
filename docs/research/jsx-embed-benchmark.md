# JSX embed benchmark

Measured on 2026-10-31 using Node 24.20.0, TypeScript 7.0.2, tsx 4.23.15, and
`@discordjs/builders@2.0.0-dev.1792497873-5050a3b54` and
`@discordjs/formatters@1.0.0-dev.1792497873-5050a3b54` on the development machine.
These figures were refreshed after adopting the formatter helpers.
Run `pnpm --filter @hyperion/jsx benchmark` to repeat the measurement.

The fixture creates one embed with a plain title, a bold description, color, and
five mapped fields. It asserts equality with native builder JSON before timing.
Each operation warms up for 1,000 iterations, then runs seven rounds of 5,000
iterations. Figures are medians and observed ranges in microseconds per operation.

| Operation                                    | Median |     Range |
| -------------------------------------------- | -----: | --------: |
| JSX tree creation                            |   0.56 | 0.51–1.96 |
| Native construction, without serialization   |   2.65 | 2.59–2.75 |
| Native construction and validation           |   6.51 | 6.36–6.63 |
| JSX rendering and validation, reused tree    |   8.73 | 8.66–8.96 |
| JSX tree creation, rendering, and validation |   9.49 | 9.47–9.71 |
| Native validation alone                      |   3.80 | 3.69–4.04 |

For this fixture, complete JSX authoring/rendering costs about 3.0 additional
microseconds per embed, or 1.46 times the native construction/validation median.
The explicit renderer always validates, so its measured phase includes native
validation. The separate native-validation measurement helps interpret that cost;
it is not a precise subtraction model for renderer overhead.

These warm local measurements are evidence of this workload's overhead, not a
speed advantage or a performance guarantee. They do not establish cold-import,
memory/allocation, network, or Discord client rendering performance. JSX transform
startup is excluded. Different text escaping, component nesting, field counts,
runtime versions, and machine load can change the results. Repeat before making
broader performance claims.
