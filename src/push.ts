/**
 * Push notifications: register this device's Expo push token with Orvyn after sign-in, and open
 * the right screen when a notification is tapped (its data.path).
 */
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let registered: string | null = null;

export async function registerForPush() {
  if (!Device.isDevice) return null; // simulators can't receive pushes
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Orvyn", importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] no EAS projectId in app.json (extra.eas.projectId): notifications are off");
    return null;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api("/api/devices", { body: { token, platform: Platform.OS === "android" ? "android" : "ios" } });
  registered = token;
  return token;
}

export async function unregisterPush() {
  if (!registered) return;
  await api("/api/devices", { method: "DELETE", body: { token: registered } }).catch(() => undefined);
  registered = null;
}
