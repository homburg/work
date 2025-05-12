import { ExpoConfig, ConfigContext } from "expo/config";

// eslint-disable-next-line import/no-default-export
export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, bundleId }: { name: string; bundleId: string } =
    process.env.APP_VARIANT !== "development"
      ? {
          name: "catch-up",
          bundleId: "dev.homburg.app.catch_up",
        }
      : {
          name: "🏗️ catch-up",
          bundleId: "dev.homburg.app.catch_up.dev",
        };

  return {
    ...config,
    name,
    slug: "catch-up",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "catch-up",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    runtimeVersion: {
      policy: "fingerprint",
    },
    ios: {
      bundleIdentifier: bundleId,
      supportsTablet: true,
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      softwareKeyboardLayoutMode: "pan",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "expo-dev-client",
        {
          addGeneratedScheme: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  };
};
