// Expo's defaults handle this pnpm monorepo (watch folders and node_modules resolution).
// The app can also be installed on its own (npm install in apps/mobile, e.g. to try the demo):
// then the workspace's root node_modules doesn't exist, and Metro must not watch or resolve it.
const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const exists = (dir) => fs.existsSync(dir);
const rootModules = path.resolve(__dirname, "../../node_modules");
if (!exists(rootModules)) {
  config.watchFolders = [__dirname];
  config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
}

// Privy's Expo setup: a few of its dependencies declare package exports that resolve wrongly in React
// Native. `jose` would resolve to its Node build (zlib, crypto); `isows` and `zustand@4` to builds
// that don't run here.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "isows" || moduleName.startsWith("zustand")) {
    return context.resolveRequest({ ...context, unstable_enablePackageExports: false }, moduleName, platform);
  }
  if (moduleName === "jose") {
    return context.resolveRequest({ ...context, unstable_conditionNames: ["browser"] }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
