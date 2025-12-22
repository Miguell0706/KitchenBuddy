import { Redirect } from "expo-router";

export default function Index() {
  // pick your default tab route
  return <Redirect href="/(tabs)/pantry" />;
  // or: "/(tabs)/scan"
}
