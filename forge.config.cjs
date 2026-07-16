module.exports = {
  packagerConfig: {
    asar: true,
    // The project uses pnpm's symlinked node_modules layout; Forge's default
    // dependency pruner cannot walk that layout reliably.
    prune: false,
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
