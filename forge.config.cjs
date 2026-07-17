module.exports = {
  packagerConfig: {
    asar: true,
    // Keep only runtime dependencies in the packaged app. This avoids copying
    // the Forge toolchain and its native build dependencies into the asar.
    prune: true,
    // The Electron archive is cached locally on the build machine. Do not
    // make packaging depend on a second network request for SHASUMS256.txt.
    download: {
      unsafelyDisableChecksums: true
    },
    ignore: [
      /^\/.env(?:\..*)?$/,
      /^\/.git(?:\/|$)/,
      /^\/.idea(?:\/|$)/,
      /^\/.runtime(?:\/|$)/,
      /^\/.superpowers(?:\/|$)/,
      /^\/docs(?:\/|$)/,
      /^\/tests(?:\/|$)/,
      /^\/scripts(?:\/|$)/
    ]
  },
  // The runtime dependency graph is JavaScript-only. Avoid Electron Forge's
  // native rebuild walk over the full pnpm symlink tree during packaging.
  rebuildConfig: {
    types: []
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32']
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32']
    }
  ]
};
