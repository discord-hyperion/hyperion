import { ActionRow, Button } from "@hyperion-js/jsx";

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
            <Button url="https://github.com/discord-hyperion/hyperion">
                View Hyperion
            </Button>
        </ActionRow>
    </>
);
