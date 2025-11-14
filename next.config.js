/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Mark ExcelJS and xlsx-populate as external for client-side bundling
    // These are Node.js-only libraries and should not be bundled for the client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
      
      // Exclude server-only modules from client bundle
      // Use a function to check module path
      const originalExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : []),
        (context, request, callback) => {
          // Normalize the request path
          const normalizedRequest = request?.replace(/\\/g, '/');
          
          // Exclude Node.js-only libraries
          if (
            request === 'exceljs' ||
            request === 'xlsx-populate' ||
            request === 'mailparser' ||
            request === 'cheerio' ||
            request?.startsWith('exceljs/') ||
            request?.startsWith('xlsx-populate/') ||
            request?.startsWith('mailparser/') ||
            request?.startsWith('cheerio/')
          ) {
            return callback(null, `commonjs ${request}`);
          }
          
          // Exclude server-side lib modules (check various path formats)
          if (
            normalizedRequest?.includes('/lib/emlParser') ||
            normalizedRequest?.includes('/lib/tableExtractor') ||
            normalizedRequest?.includes('/lib/spreadsheetGenerator') ||
            normalizedRequest?.includes('/lib/filenameGenerator') ||
            normalizedRequest?.includes('/lib/cellFormatter') ||
            normalizedRequest?.includes('/lib/xlsxPopulateFormatter') ||
            normalizedRequest?.includes('lib\\emlParser') ||
            normalizedRequest?.includes('lib\\tableExtractor') ||
            normalizedRequest?.includes('lib\\spreadsheetGenerator') ||
            normalizedRequest?.includes('lib\\filenameGenerator') ||
            normalizedRequest?.includes('lib\\cellFormatter') ||
            normalizedRequest?.includes('lib\\xlsxPopulateFormatter')
          ) {
            return callback(null, `commonjs ${request}`);
          }
          
          // Continue with normal resolution
          callback();
        },
      ];
    }
    return config;
  },
}

module.exports = nextConfig

