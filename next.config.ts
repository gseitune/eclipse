import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.3"],
  // No revelar el framework en cada respuesta.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Evita que el navegador adivine el tipo de archivo.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Solo se puede embeber desde el mismo origen: el panel previsualiza
          // la home en un iframe propio, así que SAMEORIGIN lo permite.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // No filtrar la URL completa a sitios externos.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La app no usa cámara, micrófono ni ubicación.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
