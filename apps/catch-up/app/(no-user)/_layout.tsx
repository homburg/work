import { Stack } from "expo-router";

export default function NoUserLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    ></Stack>
  );
}
