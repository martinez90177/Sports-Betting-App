import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [".loca.lt"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split the dependencies out of the app chunk. They don't change
        // between deploys but the app code changes on every push, so bundling
        // them together meant every deploy re-downloaded ~450kB of React and
        // recharts that the browser already had. Separate chunks keep their
        // content hashes stable, so returning visitors only fetch what
        // actually changed. Recharts is its own chunk because it's the
        // largest single dependency and the only one used on just the chart
        // pages.
        // Matching on the resolved module path rather than listing package
        // names: the bare-name form misses react/jsx-runtime and react-dom's
        // internals, which then get pulled back into the app chunk and
        // re-downloaded on every deploy -- the exact thing this is here to
        // prevent. recharts is tested first because it brings its own d3
        // dependencies, which belong with it and not in the generic vendor
        // chunk.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(recharts|d3-|victory|internmap|delaunator|robust-predicates)/.test(id)) return "charts";
          if (/node_modules\/(react|react-dom|scheduler|object-assign)(\/|$)/.test(id)) return "react";
          return "vendor";
        },
      },
    },
  },
});
