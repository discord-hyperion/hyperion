import defaultMdxComponents from "fumadocs-ui/mdx";

export const getMDXComponents = components => ({
    ...defaultMdxComponents,
    ...components,
});
