"use client";
import { useStaticSearch } from "fumadocs-core/search/client";
import {
    SearchDialog,
    SearchDialogClose,
    SearchDialogContent,
    SearchDialogHeader,
    SearchDialogIcon,
    SearchDialogInput,
    SearchDialogList,
    SearchDialogOverlay,
} from "fumadocs-ui/components/dialog/search";

export default function StaticSearchDialog(props) {
    // Next's basePath isn't applied to this fetch, so pass it explicitly. The
    // export writes the index as a file, so the URL has no trailing slash.
    const search = useStaticSearch({
        from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/search`,
    });

    return (
        <SearchDialog {...search} {...props}>
            <SearchDialogOverlay />
            <SearchDialogContent>
                <SearchDialogHeader>
                    <SearchDialogIcon />
                    <SearchDialogInput />
                    <SearchDialogClose />
                </SearchDialogHeader>
                <SearchDialogList />
            </SearchDialogContent>
        </SearchDialog>
    );
}
