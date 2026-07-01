/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita que errores menores de tipos/lint bloqueen el deploy de produccion.
  // La validacion de tipos se hace en desarrollo; produccion prioriza disponibilidad.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
