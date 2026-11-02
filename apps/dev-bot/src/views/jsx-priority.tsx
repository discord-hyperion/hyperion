import { StringSelect } from "@hyperion/jsx";

export const JsxPriority = ({
    current = "low",
    disabled = false,
}: {
    current?: string;
    disabled?: boolean;
}) => (
    <StringSelect
        customId="jsx.priority"
        placeholder="Choose priority"
        minValues={0}
        maxValues={1}
        disabled={disabled}
    >
        <StringSelect.Option
            label="Low"
            value="low"
            description="Can wait"
            default={current === "low"}
            emoji={{ name: "🟢" }}
        />
        <StringSelect.Option
            label="High"
            value="high"
            description="Needs attention"
            default={current === "high"}
            emoji={{ name: "🔴" }}
        />
    </StringSelect>
);
