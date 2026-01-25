/**
 * Theia Webpack Configuration
 *
 * Extends the default @theia/cli webpack config with TMNL-specific customizations.
 * Most configuration is handled by @theia/cli, this file is for overrides only.
 */

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const configs = require('./gen-webpack.config.js');

/**
 * Customize the frontend config
 */
module.exports = configs.map((config, index) => {
  // Main bundle config (first one)
  if (index === 0) {
    // Add index.html to copy patterns
    const copyPlugin = config.plugins.find(p => p.constructor.name === 'CopyPlugin');
    if (copyPlugin) {
      copyPlugin.patterns.push({
        from: path.resolve(__dirname, 'src-gen/frontend/index.html'),
      });
    }
  }

  // Add path aliases for VANTA theme
  if (config.resolve) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@vanta': path.resolve(__dirname, 'src/browser/vanta-theme'),
    };
  }

  return config;
});
