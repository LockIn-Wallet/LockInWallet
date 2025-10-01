const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add polyfills for Node.js core modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert'),
        zlib: require.resolve('browserify-zlib'),
        util: require.resolve('util'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process'),
        vm: require.resolve('vm-browserify'),
      };

      // Add plugins for global polyfills
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process',
        }),
      ];

      // Suppress source map warnings from node_modules
      webpackConfig.ignoreWarnings = [
        // Ignore source map warnings from specific packages
        /Failed to parse source map from.*node_modules.*@reown.*appkit/,
        /Failed to parse source map from.*node_modules.*superstruct/,
        // General source map warnings from node_modules
        /Failed to parse source map from.*node_modules/,
      ];

      // Disable source map processing for node_modules to improve performance
      if (webpackConfig.module && webpackConfig.module.rules) {
        webpackConfig.module.rules.push({
          test: /\.js$/,
          enforce: 'pre',
          include: /node_modules/,
          use: {
            loader: 'source-map-loader',
            options: {
              filterSourceMappingUrl: () => false, // Disable source map processing for node_modules
            },
          },
        });
      }

      return webpackConfig;
    },
  },
};