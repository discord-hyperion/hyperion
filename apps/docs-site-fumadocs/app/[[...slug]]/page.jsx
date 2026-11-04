import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { editUrl, repoIsPublic } from "@/lib/shared";
import { source } from "@/lib/source";

export const dynamicParams = false;

export default async function Page(props) {
    const { slug } = await props.params;
    const page = source.getPage(slug);

    if (!page) {
        notFound();
    }

    const MDX = page.data.body;

    return (
        <DocsPage toc={page.data.toc} full={page.data.full}>
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
            <DocsBody>
                {/* Relative .md links between guide pages resolve to page URLs. */}
                <MDX
                    components={getMDXComponents({
                        a: createRelativeLink(source, page),
                    })}
                />
            </DocsBody>
            {repoIsPublic && (
                <a
                    href={editUrl(page.path)}
                    className="text-sm text-fd-muted-foreground underline"
                >
                    Edit page
                </a>
            )}
        </DocsPage>
    );
}

export async function generateStaticParams() {
    return source.generateParams();
}

export async function generateMetadata(props) {
    const { slug } = await props.params;
    const page = source.getPage(slug);

    if (!page) {
        notFound();
    }

    return { title: page.data.title, description: page.data.description };
}
