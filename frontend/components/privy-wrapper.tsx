"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";

export function PrivyWrapper({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId || appId === "...") {
    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={appId} config={{ embeddedWallets: { ethereum: { createOnLogin: "all-users" } } }}>
      {children}
    </PrivyProvider>
  );
}