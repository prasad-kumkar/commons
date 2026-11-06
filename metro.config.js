const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Per Privy's Expo guide: some deps ship package exports Metro can't resolve.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'isows' || moduleName.startsWith('zustand')) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }
  if (moduleName === 'jose') {
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ['browser'] },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
