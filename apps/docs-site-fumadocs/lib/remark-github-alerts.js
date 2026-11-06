// Turn GitHub alert blockquotes (`> [!WARNING]`) into Fumadocs callouts, so the
// guide's Markdown renders as an alert on GitHub and as a callout on the site.
const types = {
    NOTE: { type: "info", title: "Note" },
    TIP: { type: "idea", title: "Tip" },
    IMPORTANT: { type: "info", title: "Important" },
    WARNING: { type: "warning", title: "Watch out" },
    CAUTION: { type: "error", title: "Caution" },
};
const marker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n?/;

const attribute = (name, value) => ({ type: "mdxJsxAttribute", name, value });

const convert = node => {
    const [first] = node.children;
    const text = first?.type === "paragraph" ? first.children[0] : undefined;
    const found = text?.type === "text" ? text.value.match(marker) : null;

    if (!found) return;

    const { type, title } = types[found[1]];

    text.value = text.value.slice(found[0].length);

    if (!text.value) {
        first.children.shift();
    }

    if (first.children.length === 0) {
        node.children.shift();
    }

    Object.assign(node, {
        type: "mdxJsxFlowElement",
        name: "Callout",
        attributes: [attribute("type", type), attribute("title", title)],
    });
};

const walk = node => {
    if (node.type === "blockquote") {
        convert(node);
    }

    for (const child of node.children ?? []) {
        walk(child);
    }
};

export const remarkGithubAlerts = () => tree => walk(tree);
