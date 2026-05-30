import express from 'express';
import type { Express } from 'express';
import compression from 'compression';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // P1: Gzip compression for all text responses (JS, CSS, HTML, JSON)
  app.use(compression());

  app.use(express.static(distPath, {
    // P1: Long-lived cache for Vite content-hashed assets; short for SW + HTML
    setHeaders(res, filePath) {
      // Vite hashes asset filenames (e.g. index-BX5vqc49.js, index-Bmh21937.css)
      // Hash is 8 alphanumeric chars — use a broad pattern to match all variants
      if (/[-_][A-Za-z0-9]{8}\.(js|css)$/.test(path.basename(filePath))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('sw.js')) {
        // SW must never be cached long-term — browsers check it on every load
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      } else if (/\.(woff2?|ttf|otf|eot)$/.test(filePath)) {
        // PERF-P1: Fonts are immutable — 1-year TTL (was 24h, causing unnecessary re-downloads)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/\.(png|svg|webp|jpg|jpeg|gif|ico|avif)$/.test(filePath)) {
        // PERF-P1: Images — 1-year TTL (icons/logos don't change without filename change)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      // Add full CSP on HTML entry point
      if (filePath.endsWith('index.html')) {
        res.setHeader(
          'Content-Security-Policy',
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",    // 'unsafe-inline' required for Vite runtime
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' https://api.openai.com https://api.stripe.com https://js.stripe.com",
            "img-src 'self' data:",
            "frame-src https://js.stripe.com",      // Stripe payment element
            "frame-ancestors 'none'",
          ].join('; ')
        );
      }
    },
  }));

  // Fall through to index.html for client-side hash routing
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
