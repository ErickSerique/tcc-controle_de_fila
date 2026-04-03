import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redireciona chamadas REST ao servidor Node
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Proxy WebSocket para Socket.io
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
