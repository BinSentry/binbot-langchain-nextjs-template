// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// })
// module.exports = withBundleAnalyzer({})

module.exports = {
  webpack: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, child_process: false, path: false };
    return config;
  },
};