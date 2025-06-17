import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    port: 5174,
    host: true, // This allows external connections
    hmr: process.env.LOCALTUNNEL ? {
      clientPort: 443,
      protocol: 'wss'
    } : {
      port: 5174
    },
    allowedHosts: [
      'localhost',
      '.loca.lt'
    ]
  },
});
