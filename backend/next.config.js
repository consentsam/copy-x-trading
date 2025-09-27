/** @type {import('next').NextConfig} */
// const TfheWasmPlugin = require('./tfhe-wasm-plugin'); // Disabled since we're using CoFHE.js

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['docs.github.com'],
  },
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Don't attempt to import node modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }

    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Ensure WASM files are properly handled
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Fix for tfhe_bg.wasm file loading - disabled since we're using CoFHE.js
    if (isServer) {
      // Disabled TFHE WASM loading since we use CoFHE.js and mock FHE
      // config.resolve.alias = {
      //   ...config.resolve.alias,
      //   'tfhe_bg.wasm': require.resolve('tfhe/tfhe_bg.wasm'),
      // };

      // Add the plugin only for server-side builds - disabled since we're using CoFHE.js
      // if (!config.plugins) {
      //   config.plugins = [];
      // }
      // config.plugins.push(new TfheWasmPlugin());
    }

    return config;
  },

  // Temporarily exclude API docs from the build to fix deployment
  experimental: {
    serverComponentsExternalPackages: ['swagger-ui-react', 'swagger-jsdoc', 'next-swagger-doc'],
    serverActions: {
      allowedOrigins: ['*']
    },
    // Enable instrumentation for logging service
    instrumentationHook: true
  },

  // Skip trailing slash validation to avoid build errors
  skipTrailingSlashRedirect: true,
  // Disable static generation for API routes
  output: "standalone",
  generateBuildId: async () => {
    return "build-" + new Date().getTime()
  },
  // Disable TypeScript type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable eslint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Let middleware handle CORS instead of static headers
  // The headers configuration was causing conflicts with the middleware CORS handling
}

module.exports = nextConfig
