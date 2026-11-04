import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Provider } from "@/components/provider";
import { repo } from "@/lib/shared";
import { source } from "@/lib/source";
import "./global.css";

export const metadata = {
    title: { default: "Hyperion", template: "%s | Hyperion" },
    description: "A framework for building discord.js v15 bots.",
};

export default function Layout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="flex min-h-screen flex-col">
                <Provider>
                    <DocsLayout
                        tree={source.getPageTree()}
                        nav={{ title: "Hyperion" }}
                        githubUrl={repo}
                    >
                        {children}
                    </DocsLayout>
                </Provider>
            </body>
        </html>
    );
}
