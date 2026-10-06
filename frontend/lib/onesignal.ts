import OneSignal from "react-onesignal";

export function initOneSignal() {
  if (typeof window !== "undefined") {
    OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
      allowLocalhostAsSecureOrigin: true,
    });
  }
}

export async function promptPush() {
  if (typeof window !== "undefined") {
    await OneSignal.Slidedown.promptPush();
    return OneSignal.User.onesignalId;
  }
  return undefined;
}