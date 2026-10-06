"use client";

import { useState } from "react";
import { usePrivy, useSignMessage, useWallets } from "@privy-io/react-auth";
import OneSignal from "react-onesignal";
import { api } from "@/lib/api";
import { canonicalMessage } from "@/lib/signing";

export function FanActions({ handle }: { handle: string }) {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signFor(action: string, extra: string, ts: number) {
    const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    const msg = canonicalMessage(action, [wallet.address, extra], ts);
    const { signature } = await signMessage({ message: msg }, { address: wallet.address });
    return { wallet_address: wallet.address.toLowerCase(), signature, timestamp: ts };
  }

  async function subscribe() {
    setBusy(true);
    try {
      if (!authenticated) {
        login();
        return;
      }
      const ts = Math.floor(Date.now() / 1000);
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      const subMsg = canonicalMessage("subscribe", [handle, wallet.address], ts);
      const { signature } = await signMessage({ message: subMsg }, { address: wallet.address });
      await api("/subscribe", {
        method: "POST",
        body: { channel_handle: handle, wallet_address: wallet.address.toLowerCase(), signature, timestamp: ts },
      });
      setState("Subscribed! Turning on notifications…");
      await OneSignal.init({ appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID! });
      await OneSignal.Slidedown.promptPush();
      const deviceId: string | undefined = OneSignal.User.onesignalId;
      if (deviceId) {
        const ts2 = Math.floor(Date.now() / 1000);
        const body = await signFor("device", deviceId, ts2);
        await api("/devices", { method: "POST", body: { token: deviceId, platform: "web", ...body } });
        setState("You're in — push enabled.");
      } else {
        setState("Subscribed (push permission not granted).");
      }
    } catch (e) {
      setState(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const ts = Math.floor(Date.now() / 1000);
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      const msg = canonicalMessage("unsubscribe", [handle, wallet.address], ts);
      const { signature } = await signMessage({ message: msg }, { address: wallet.address });
      await api("/unsubscribe", {
        method: "POST",
        body: { channel_handle: handle, wallet_address: wallet.address.toLowerCase(), signature, timestamp: ts },
      });
      setState("Unsubscribed.");
    } catch (e) {
      setState(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={subscribe}
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {authenticated ? "Follow for live alerts" : "Sign in to subscribe"}
      </button>
      {authenticated && (
        <button
          onClick={unsubscribe}
          disabled={busy}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          Unsubscribe
        </button>
      )}
      {state && <p className="text-sm text-muted-foreground">{state}</p>}
    </div>
  );
}