import { ExpoConfig, ConfigContext } from "expo/config";
import { Effect, Config, ConfigError, Schema, Redacted } from "effect";

// eslint-disable-next-line import/no-default-export
export default (context: ConfigContext): ExpoConfig => {
  return Effect.runSync(configEffect(context));
};

enum AppEnv {
  DEVELOPMENT = "development",
  PRODUCTION = "production",
}

const embraceConfigEffect = Effect.gen(function* () {
  const [apiToken, appIdAndroid, appIdIOS] = yield* Config.nested(
    Config.all([
      Config.redacted("API_TOKEN"),
      Config.string("APP_ID_ANDROID"),
      Config.string("APP_ID_IOS"),
    ]),
    "EMBRACE",
  );

  return {
    apiToken,
    appIdAndroid,
    appIdIOS,
  };
});

const appEnvConfig = Schema.Config("APP_ENV", Schema.Enums(AppEnv)).pipe(
  Config.withDefault(AppEnv.PRODUCTION),
);

const configEffect: (
  context: ConfigContext,
) => Effect.Effect<ExpoConfig, ConfigError.ConfigError> = Effect.fn(
  function* (context) {
    const appEnv = yield* appEnvConfig;
    const embraceConfig = yield* embraceConfigEffect;

    const {
      name,
      iosBundleId,
      androidPackageName,
    }: { name: string; iosBundleId: string; androidPackageName: string } =
      appEnv !== "development"
        ? {
            name: "catch-up",
            iosBundleId: "dev.homburg.app.catchup",
            androidPackageName: "dev.homburg.app.catchup",
          }
        : {
            name: "🏗️ catch-up",
            iosBundleId: "dev.homburg.app.catchup.dev",
            androidPackageName: "dev.homburg.app.catchup.dev",
          };

    const config = {
      appEnv,
      expo: {
        name,
        iosBundleId,
        androidPackageName,
      },
      embrace: embraceConfig,
    };

    yield* Effect.log("config").pipe(
      Effect.annotateLogs(flattenConfig(config)),
    );

    return {
      ...context.config,
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
        bundleIdentifier: config.expo.iosBundleId,
        supportsTablet: true,
      },
      android: {
        package: config.expo.androidPackageName,
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
        "expo-font",
        "expo-localization",
        "expo-web-browser",
        "expo-router",
        [
          "expo-build-properties",
          {
            android: {
              buildArchs: ["arm64-v8a"],
              minSdkVersion: 26,
            },
          },
        ],
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
        [
          "@embrace-io/react-native/lib/app.plugin.js",
          {
            androidAppId: config.embrace.appIdAndroid,
            iOSAppId: config.embrace.appIdIOS,
            apiToken: Redacted.value(config.embrace.apiToken),
          },
        ],
      ],
      experiments: {
        typedRoutes: true,
      },
    };
  },
);

function flattenConfig(
  config: Record<string, any>,
  prefix = "",
  result: Record<string, any> = {},
): Record<string, any> {
  for (const key in config) {
    const value = config[key];

    if (
      typeof value === "object" &&
      value !== null &&
      !Redacted.isRedacted(value)
    ) {
      flattenConfig(value, `${prefix}${key}.`, result);
    } else {
      result[`${prefix}${key}`] = String(value);
    }
  }

  return result;
}
