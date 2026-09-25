"use client";

import { createContext, useContext } from "react";
import { en, type Messages } from "@/lib/i18n";

const LocaleContext = createContext<Messages>(en);

export function LocaleProvider({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={messages}>{children}</LocaleContext.Provider>
  );
}

export function useMessages(): Messages {
  return useContext(LocaleContext);
}
