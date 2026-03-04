const appJson = require("./app.json");

function hasPlugin(plugins, pluginName) {
  return plugins.some((entry) =>
    Array.isArray(entry) ? entry[0] === pluginName : entry === pluginName,
  );
}

function toGoogleRedirectScheme(clientId) {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId || typeof clientId !== "string") return "";
  const trimmed = clientId.trim();
  if (!trimmed.endsWith(suffix)) return "";
  const prefix = trimmed.slice(0, -suffix.length);
  return prefix ? `com.googleusercontent.apps.${prefix}` : "";
}

function hasIntentFilter(intentFilters, scheme, pathPrefix) {
  return intentFilters.some((filter) => {
    const dataEntries = Array.isArray(filter?.data) ? filter.data : [];
    return dataEntries.some((entry) => {
      const sameScheme = entry?.scheme === scheme;
      const samePathPrefix = pathPrefix ? entry?.pathPrefix === pathPrefix : true;
      return sameScheme && samePathPrefix;
    });
  });
}

module.exports = () => {
  const baseExpoConfig = appJson.expo || {};
  const plugins = Array.isArray(baseExpoConfig.plugins) ? [...baseExpoConfig.plugins] : [];
  const androidConfig = { ...(baseExpoConfig.android || {}) };
  const intentFilters = Array.isArray(androidConfig.intentFilters) ? [...androidConfig.intentFilters] : [];

  if (!hasPlugin(plugins, "@react-native-google-signin/google-signin")) {
    plugins.push("@react-native-google-signin/google-signin");
  }

  if (!hasIntentFilter(intentFilters, "muse")) {
    intentFilters.push({
      action: "VIEW",
      category: ["BROWSABLE", "DEFAULT"],
      data: [{ scheme: "muse" }],
    });
  }

  const googleAndroidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.GOOGLE_ANDROID_CLIENT_ID || "";
  const googleRedirectScheme = toGoogleRedirectScheme(googleAndroidClientId);

  if (googleRedirectScheme && !hasIntentFilter(intentFilters, googleRedirectScheme, "/oauth2redirect")) {
    intentFilters.push({
      action: "VIEW",
      category: ["BROWSABLE", "DEFAULT"],
      data: [
        {
          scheme: googleRedirectScheme,
          pathPrefix: "/oauth2redirect",
        },
      ],
    });
  }

  return {
    ...baseExpoConfig,
    plugins,
    android: {
      ...androidConfig,
      intentFilters,
    },
  };
};
