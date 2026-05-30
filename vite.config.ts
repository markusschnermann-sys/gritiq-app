import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * PERF-P2: Inline critical-path CSS using Critters.
 * Runs after the bundle is written; transforms dist/public/index.html in-place.
 * This eliminates the render-blocking <link rel="stylesheet"> on initial load.
 */
function crittersCriticalCss(): Plugin {
  return {
    name: 'critters-critical-css',
    apply: 'build',
    async closeBundle() {
      try {
        // Dynamic import avoids type-checking issues with the CJS/ESM dual package
        const { default: Critters } = await import('critters');
        const outDir = path.resolve(import.meta.dirname, 'dist/public');
        const critters = new Critters({
          path: outDir,
          publicPath: './',
          // Keep <link> for browsers without JS (graceful degradation)
          preload: 'swap',
          // Don't remove unused keyframes — animations may be class-toggled
          pruneSource: false,
          // Merge media queries to reduce inlined CSS size
          mergeStylesheets: true,
          // Compress inlined CSS (remove whitespace)
          compress: true,
        });
        const htmlPath = path.join(outDir, 'index.html');
        const html = await fs.readFile(htmlPath, 'utf-8');
        const processed = await critters.process(html);
        await fs.writeFile(htmlPath, processed);
        console.log('[critters] Critical CSS inlined into index.html');
      } catch (e) {
        // Non-fatal — log and continue so the build still succeeds
        console.warn('[critters] Skipped:', e instanceof Error ? e.message : e);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), crittersCriticalCss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // P5: Split vendor code into separate cacheable chunks
        // IMPORTANT: No catch-all vendor chunk — circular deps break React initialisation.
        // Only split well-isolated packages with no React peer dependencies.
        manualChunks(id) {
          // PERF-P2: Radix UI into a single stable chunk.
          // Splitting into core/lazy causes circular chunk warnings because Radix
          // primitives have bidirectional dependencies. A single chunk avoids the
          // warning and still separates Radix from the main app bundle for long-TTL caching.
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix';
          }
          // Lucide icons — large icon tree, only used for rendering
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
