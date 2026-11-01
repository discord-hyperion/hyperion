import { ActionRow, Button } from "@hyperion/jsx";

export const JsxControls = ({ disabled = false }: { disabled?: boolean }) => (
    <>
        <ActionRow>
            <Button
                customId="jsx.refresh"
                style="primary"
                disabled={disabled}
                emoji={{ name: "🔄" }}
            >
                Refresh JSX demo
            </Button>
        </ActionRow>
        <ActionRow>
            <Button url="https://github.com/favylicious/discord-hyperion">
                View Hyperion
            </Button>
        </ActionRow>
    </>
);
