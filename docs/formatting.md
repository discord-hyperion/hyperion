# Formatting

This guide covers aspects of code formatting that Biome or other linters do not dictate. AI-generated code tends to be messy for efficiency, but human readability should still be a factor to consider. When generating code, follow these guidelines.

## General

### Inline operations

When using inline operations, only certain keywords apply:
```ts
// never do this for `for` and `while` loops
for (const x of y) x.exec();
// instead, always use brackets
for (const x of y) {
    x.exec();
}

// `if` is fine; `return`, `break`, and `continue` too
if (x) return y;
if (x) y = "3";
if (x) continue;
if (x) break;

// `throw` is an exception; never inline
if (x) {
    throw error;
}
```

### Assignments

Differentiate between the types of assignments:
```ts
// group literals and properties together
const x = 0;
const y = 3;
let z = foo.bar;

// group values returned from functions together
const x = getX();
const y = getY();
// group y and z if z is based on y
const z = y.z;

// do not group these together; note the `await`
let x = 0;

const y = await something();
// group y and z if z is based on awaited y
const z = y.foo;

this.w = x;

// if the async function is large (>= 4 lines), line break above and below
const x = await bigFunction({
    foo: true,
    bar: false,
    baz: 100,
});

const y = await anotherBigOne({
    foo: false,
    bar: true,
    baz: 1,
});

const z = y.w;
```
Also group inline code together:
```ts
if (!x) return;
if (!y) return;
```

### Function tails

```ts
// if the function returns something, try to insert a line break before it
const x = () => {
    let y = 0;

    y += 2;
    y += 5;
    y += 10;

    y -= await z();

    return y;
}
```

### Code blocks

Always add a linebreak between keywords and their code blocks. Notice the linebreak between the two `for` loops below:
```ts
for (const x of y) {
    //
}

for (const x of y) {
    //
}

if (y === z) {
    //
}
```

Except if a keyword is nested directly after another:
```ts
try {
    for (const x of y) {
        //
    }

    if (y === z) return;
} 
catch (e) {
    if (e) {
        //
    }
}
```

This also applies to different unrelated keywords/operators. Take note of the deliberate spacing:
```ts
private enqueue(event: EventName, args: unknown[]) {
    if (this.stopping) return Promise.resolve();

    const entries =
        this.definitions.get(event)?.filter(entry => !entry.consumed) ?? [];

    if (entries.length === 0) return Promise.resolve();

    let queue = this.queues.get(event);

    if (!queue) {
        queue = {
            active: undefined,
            waiting: [],
            running: false,
            abandoned: false,
            idle: Promise.resolve(),
        };
        
        this.queues.set(event, queue);
    }
    if (queue.running && queue.waiting.length >= this.maxPendingPerEvent) {
        this.client.logger.warn(
            {
                event: "event.queue.full",
                eventName: event,
                queueCount: queue.waiting.length,
            },
            "Discarded newest event occurrence",
        );
        
        return Promise.resolve();
    }

    for (const entry of entries) {
        if (entry.handler.once) entry.consumed = true;
    }

    return new Promise<void>(complete => {
        const occurrence = { entries, args, complete };

        if (queue.running) {
            queue.waiting.push(occurrence);
        } else {
            queue.running = true;
            queue.active = occurrence;
            // Publish the drain promise before invoking any application code.
            queue.idle = Promise.resolve().then(() =>
                this.drain(event, queue),
            );
        }
    });
}

```
