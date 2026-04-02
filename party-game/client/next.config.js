/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy API and socket requests to the backend server
  async rewrites() {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${serverUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${serverUrl}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
