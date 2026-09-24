import type { NextConfig } from "next";

// Hostname derivado da env (não hardcoded): cada deployment aponta para um Supabase.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  // Postgres local de desenvolvimento (WASM): não empacotar, carregar do node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Upload de fotos pelo painel (limite do bucket: 5 MB).
    serverActions: { bodySizeLimit: "6mb" },
  },
  // A rota antiga /servicos virou /tratamentos.
  async redirects() {
    return [
      { source: "/servicos", destination: "/tratamentos", permanent: true },
      { source: "/servicos/:slug", destination: "/tratamentos/:slug", permanent: true },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
