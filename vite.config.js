import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` is plain Vite, which does not serve the Vercel functions in
// api/ -- so a page that depends on one could only be tried on production.
// This runs the listed ones in the dev server. It is an allowlist on purpose:
// the others spend paid API credits (odds, news) and stay unreachable locally,
// exactly as before.
const DEV_API = new Set(["nfl-allowed"]);
function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const m = url.pathname.match(/^\/api\/([\w-]+)$/);
        if (!m || !DEV_API.has(m[1])) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
          const shim = {
            setHeader: (k, v) => res.setHeader(k, v),
            status(code) { res.statusCode = code; return shim; },
            json(body) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); },
          };
          await mod.default({ query: Object.fromEntries(url.searchParams) }, shim);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
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
