"use client";
import { RootProvider } from "fumadocs-ui/provider/next";
import StaticSearchDialog from "@/components/search";

export function Provider({ children }) {
    return (
        <RootProvider search={{ SearchDialog: StaticSearchDialog }}>
            {children}
        </RootProvider>
    );
}
