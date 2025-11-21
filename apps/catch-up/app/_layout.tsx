import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { PostHogProvider } from "posthog-react-native";

import { useColorScheme } from "@/hooks/useColorScheme";
import {
  KeyboardContext,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/tanstack-query";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider
        apiKey="phc_PKxJ2Nf13djGbAlHaeEGTZYmBIwrDgkhPKxrWtXX1SG"
        options={{
          host: "https://eu.i.posthog.com",
          enableSessionReplay: true,
        }}
        autocapture
      >
        <KeyboardProvider statusBarTranslucent>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack>
              <Stack.Screen name="(no-user)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </KeyboardProvider>
      </PostHogProvider>
    </QueryClientProvider>
  );
}
