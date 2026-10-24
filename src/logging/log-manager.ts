import ora, { type Ora } from "ora";
import pino, {
    type DestinationStream,
    type LevelWithSilent,
    type Logger,
} from "pino";
import pretty from "pino-pretty";

export interface LoggingOptions {
    level?: LevelWithSilent;
    /** Defaults to coloured output in interactive terminals, JSON elsewhere. */
    pretty?: boolean;
    /** Startup spinners are only shown in interactive terminals outside CI. */
    progress?: boolean;
    /** Override the output stream, for example for tests or log collection. */
    destination?: DestinationStream;
}

export class LogManager {
    public readonly logger: Logger;
    private readonly progressEnabled: boolean;
    private spinner: Ora | undefined;

    public constructor(name: string, options: LoggingOptions | false = {}) {
        const config = options === false ? {} : options;
        const interactive = process.stderr.isTTY && !process.env.CI;

        this.progressEnabled =
            options !== false &&
            config.level !== "silent" &&
            config.progress !== false &&
            interactive &&
            !config.destination;

        const destination = config.destination ?? process.stderr;
        const format =
            (config.pretty ?? interactive)
                ? pretty.prettyFactory({ colorize: interactive })
                : undefined;

        this.logger = pino(
            {
                name,
                enabled: options !== false,
                level: config.level ?? "info",
                serializers: { err: serializeError },
                redact: {
                    paths: [
                        "token",
                        "password",
                        "authorization",
                        "secret",
                        "*.token",
                        "*.password",
                        "*.authorization",
                        "*.secret",
                    ],
                    censor: "[REDACTED]",
                },
            },
            {
                write: message => {
                    const spinning = this.spinner?.isSpinning;
                    if (spinning) this.spinner?.clear();

                    destination.write(format ? format(message) : message);

                    if (spinning) this.spinner?.render();
                },
            },
        );
    }

    public async step<T>(
        label: string,
        event: string,
        task: () => Promise<T>,
    ): Promise<T> {
        const started = performance.now();
        this.logger.info({ event: `${event}.started` }, label);

        const spinner =
            this.progressEnabled && !this.spinner
                ? ora({
                      text: label,
                      stream: process.stderr,
                      discardStdin: false,
                  }).start()
                : undefined;

        if (spinner) this.spinner = spinner;

        try {
            const result = await task();
            spinner?.stop();

            this.logger.info(
                {
                    event: `${event}.completed`,
                    durationMs: Math.round(performance.now() - started),
                },
                `${label}: completed`,
            );
            return result;
        } catch (err) {
            spinner?.stop();

            this.logger.error(
                {
                    event: `${event}.failed`,
                    durationMs: Math.round(performance.now() - started),
                    err,
                },
                `${label}: failed`,
            );
            throw err;
        } finally {
            spinner?.stop();

            if (this.spinner === spinner) this.spinner = undefined;
        }
    }
}

// Keep useful diagnostics without copying request bodies or credential-bearing
// properties that some third-party Error subclasses attach to their instances.
const serializeError = (error: unknown, depth = 0): Record<string, unknown> => {
    if (!(error instanceof Error)) {
        return { type: typeof error, message: String(error) };
    }

    return {
        type: error.name,
        message: error.message,
        stack: error.stack,
        ...(error.cause !== undefined && depth < 3
            ? { cause: serializeError(error.cause, depth + 1) }
            : {}),
    };
};
