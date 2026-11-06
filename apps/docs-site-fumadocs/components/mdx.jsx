import { File, Files, Folder } from "fumadocs-ui/components/files";
import defaultMdxComponents from "fumadocs-ui/mdx";

export const getMDXComponents = components => ({
    ...defaultMdxComponents,
    File,
    Files,
    Folder,
    ...components,
});
