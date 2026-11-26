import { Redirect } from "expo-router";

/** orvyn://auth (the browser sign-in hand-back) is read by the sign-in flow itself; land home. */
export default function AuthReturn() {
  return <Redirect href="/" />;
}
