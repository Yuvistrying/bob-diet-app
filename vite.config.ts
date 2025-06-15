import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    port: 5174,
    host: true, // This allows external connections
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    },
    allowedHosts: [
      'localhost',
      '.loca.lt'
    ]
  },
});
