import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// La app se sirve desde /anotador/ cuando va dentro de la imagen de Argilla,
// así las llamadas a la API van al mismo origen. En desarrollo, Vite redirige /api
// al servidor local de Argilla (por defecto http://127.0.0.1:6900).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const target = env.ARGILLA_PROXY_TARGET || "http://127.0.0.1:6900";
  return {
    base: "/anotador/",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { "/api": { target, changeOrigin: true } },
    },
  };
});
