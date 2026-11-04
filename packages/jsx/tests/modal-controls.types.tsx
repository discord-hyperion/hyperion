import {
    ActionRow,
    ChannelSelect,
    MentionableSelect,
    Modal,
    RoleSelect,
    UserSelect,
} from "../lib/index.ts";

void (
    <ActionRow>
        <UserSelect customId="a" defaultUsers={["1"]} />
        <RoleSelect customId="b" defaultRoles={["2"]} />
        <MentionableSelect
            customId="c"
            defaultUsers={["3"]}
            defaultRoles={["4"]}
        />
        <ChannelSelect customId="d" channelTypes={[0, 2]} />
    </ActionRow>
);
void (
    <Modal.FileUpload customId="files" fileTypes={["image", "audio", ".pdf"]} />
);

// @ts-expect-error Defaults are ID strings.
void (<UserSelect customId="a" defaultUsers={[1]} />);
// @ts-expect-error A role select has no user defaults.
void (<RoleSelect customId="b" defaultUsers={["1"]} />);
// @ts-expect-error Entity selects take no option children.
void (<UserSelect customId="a">x</UserSelect>);
// @ts-expect-error File types are image, video, audio, or a dot extension.
void (<Modal.FileUpload customId="files" fileTypes={["pdf"]} />);
// @ts-expect-error File uploads need a custom ID.
void (<Modal.FileUpload />);
