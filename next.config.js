/** @type {import('next').NextConfig} */
const nextConfig = {
    // Tell Next.js not to bundle these native Node modules through webpack.
    // They ship pre-built .node binaries and must be required at runtime by Node directly.
    serverExternalPackages: ['sharp', '@napi-rs/canvas'],
};

export default nextConfig;
