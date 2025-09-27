/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Suppress hydration warnings in development
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  compiler: {
    styledComponents: true,
  },

  webpack: (config, { isServer }) => {
    // Set target for better async support
    if (!isServer) {
      config.target = ['web', 'es2020'];
    }

    // Add support for WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true,
    };

    // Add better async function support
    config.output = {
      ...config.output,
      environment: {
        asyncFunction: true,  // Enable async function support
        bigIntLiteral: true,
        dynamicImport: true,
        module: true,
        arrowFunction: true,
        const: true,
        destructuring: true,
        forOf: true,
      },
    };

    // Add rule for WebAssembly files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Add rule for WASM imports with default export
    config.module.rules.push({
      test: /tfhe_bg\.wasm$/,
      type: 'asset/resource',
    });

    // Resolve Node.js modules for CoFHE.js compatibility
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        // Node.js modules that need to be polyfilled or disabled for browser
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        buffer: false,
        path: false,
        os: false,
        util: false,
        url: false,
        assert: false,
        child_process: false,
        worker_threads: false,
        // CoFHE.js and TFHE specific modules
        'node:crypto': false,
        'node:fs': false,
        'node:path': false,
        'node:os': false,
        'node:url': false,
        'node:buffer': false,
        'node:util': false,
        'node:stream': false,
      },
      alias: {
        ...config.resolve?.alias,
        // Add alias for wbg module if needed
        wbg: false,
        // Map node: scheme imports to regular modules (then fallback to false)
        'node:crypto': false,
        'node:fs': false,
        'node:path': false,
        'node:os': false,
        'node:url': false,
        'node:buffer': false,
        'node:util': false,
        'node:stream': false,
        'node:net': false,
        'node:tls': false,
        'node:assert': false,
      },
    };

    // Add webpack plugin to handle node: scheme URIs
    config.plugins = config.plugins || [];
    config.plugins.push(
      new (class NodeSchemeResolver {
        apply(compiler) {
          compiler.hooks.normalModuleFactory.tap('NodeSchemeResolver', (nmf) => {
            nmf.hooks.beforeResolve.tap('NodeSchemeResolver', (resolveData) => {
              if (resolveData.request && resolveData.request.startsWith('node:')) {
                // Extract module name from node: scheme
                const moduleName = resolveData.request.slice(5); // Remove 'node:' prefix

                // Map to regular module name (will be handled by fallbacks)
                resolveData.request = moduleName;
              }
            });
          });
        }
      })()
    );

    // Suppress specific webpack warnings
    config.plugins.push(
      new (require('webpack').ContextReplacementPlugin)(
        /wasm-polyfill/,
        false
      )
    );

    // Add warning ignore patterns - must be a function for webpack 5
    config.ignoreWarnings = [
      (warning) => {
        // Ignore critical dependency warnings from wasm-polyfill
        if (warning.message && warning.message.includes('Critical dependency') &&
            warning.message.includes('wasm-polyfill')) {
          return true;
        }
        // Ignore async/await warnings from fhenixjs WASM modules
        if (warning.message && warning.message.includes('async/await') &&
            warning.message.includes('asyncWebAssembly')) {
          return true;
        }
        return false;
      }
    ];

    // Handle cofhejs and tfhe modules specially for browser environment
    if (!isServer) {
      // Ensure CoFHE.js and related modules are bundled properly
      config.externals = {
        ...config.externals,
        // Don't externalize WASM modules - let webpack handle them
      };

      // Note: Removed babel-loader rule as it's not needed
      // The webpack fallbacks should handle Node.js module resolution

      // Suppress HMR warnings in development
      if (process.env.NODE_ENV === 'development') {
        config.infrastructureLogging = {
          level: 'error', // Only show errors, not warnings
        };

        // Suppress React hydration warnings
        config.resolve.alias = {
          ...config.resolve.alias,
          'react-dom$': 'react-dom/profiling',
          'scheduler/tracing': 'scheduler/tracing-profiling',
        };
      }
    }

    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placeholder.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;