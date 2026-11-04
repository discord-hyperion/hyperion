// A plain static server for the exported site, like a simple host: no redirects,
// no rewrites. Serves DIST under SITE_BASE.
//   DIST=out SITE_BASE=/discord-hyperion PORT=4331 node scripts/serve.mjs
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(site, process.env.DIST ?? "out");
const base = (process.env.SITE_BASE ?? "/discord-hyperion").replace(/\/$/, "");
const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
};

export const serve = (port = 0) => {
    const server = createServer((request, response) => {
        const url = decodeURIComponent((request.url ?? "/").split("?")[0]);

        if (base && url !== `${base}/` && !url.startsWith(`${base}/`)) {
            response.writeHead(404).end("outside base");

            return;
        }

        const relative = url.slice(base.length);
        const candidate = path.join(dist, relative);
        const file = relative.endsWith("/")
            ? path.join(candidate, "index.html")
            : candidate;

        if (
            !file.startsWith(dist) ||
            !existsSync(file) ||
            statSync(file).isDirectory()
        ) {
            const notFound = path.join(dist, "404.html");

            response.writeHead(404, { "content-type": types[".html"] });
            response.end(
                existsSync(notFound) ? readFileSync(notFound) : "not found",
            );

            return;
        }

        response.writeHead(200, {
            "content-type":
                types[path.extname(file)] ?? "application/octet-stream",
        });
        response.end(readFileSync(file));
    });

    return new Promise(resolve =>
        server.listen(port, "127.0.0.1", () => resolve(server)),
    );
};

if (import.meta.url === `file://${process.argv[1]}`) {
    const server = await serve(Number(process.env.PORT ?? 4331));

    console.log(
        `Serving ${dist} at http://127.0.0.1:${server.address().port}${base}/`,
    );
}
