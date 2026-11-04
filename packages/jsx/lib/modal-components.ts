import type { FileUploadBuilder, TextInputBuilder } from "@discordjs/builders";
import { type Child, primitive } from "./runtime.ts";

type Children = { children?: Child };
type InputStyle = Parameters<TextInputBuilder["setStyle"]>[0];

export const Modal = Object.assign(
    primitive<Children & { customId: string; title: string }>("Modal", [
        "children",
        "customId",
        "title",
    ]),
    {
        Label: primitive<Children & { text: string; description?: string }>(
            "Modal.Label",
            ["children", "text", "description"],
        ),
        TextInput: primitive<{
            customId: string;
            style?: "short" | "paragraph" | InputStyle;
            required?: boolean;
            placeholder?: string;
            value?: string;
            minLength?: number;
            maxLength?: number;
        }>("Modal.TextInput", [
            "customId",
            "style",
            "required",
            "placeholder",
            "value",
            "minLength",
            "maxLength",
        ]),
        TextDisplay: primitive<Children>("Modal.TextDisplay", ["children"]),
        FileUpload: primitive<{
            customId: string;
            minValues?: number | undefined;
            maxValues?: number | undefined;
            required?: boolean | undefined;
            fileTypes?:
                | readonly Exclude<
                      Parameters<FileUploadBuilder["addFileTypes"]>[0],
                      readonly unknown[]
                  >[]
                | undefined;
        }>("Modal.FileUpload", [
            "customId",
            "minValues",
            "maxValues",
            "required",
            "fileTypes",
        ]),
    },
);
