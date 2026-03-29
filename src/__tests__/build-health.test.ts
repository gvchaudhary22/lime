/**
 * Build Health Tests
 * Verifies that Next.js build output contains all critical assets.
 * Catches stale/corrupted .next cache issues before they hit the browser.
 *
 * Run after build: npm run build && npm test
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");
const NEXT_DIR = path.join(ROOT, ".next");
const STATIC_DIR = path.join(NEXT_DIR, "static");
const BUILD_MANIFEST = path.join(NEXT_DIR, "build-manifest.json");
const PAGES_MANIFEST = path.join(NEXT_DIR, "server", "pages-manifest.json");
const APP_PATHS_MANIFEST = path.join(
  NEXT_DIR,
  "server",
  "app-paths-manifest.json"
);

describe("Build Health", () => {
  it("should have .next build directory", () => {
    if (!existsSync(NEXT_DIR)) {
      throw new Error(
        ".next directory missing — run `npm run build` first. " +
          "This causes 404 errors for all static assets (layout.css, page.js, etc.)"
      );
    }
  });

  it("should have build-manifest.json with valid content", () => {
    if (!existsSync(BUILD_MANIFEST)) {
      throw new Error(
        "build-manifest.json missing — build output is corrupted. " +
          "Fix: rm -rf .next && npm run build"
      );
    }
    const manifest = JSON.parse(readFileSync(BUILD_MANIFEST, "utf-8"));
    expect(manifest).toHaveProperty("pages");
  });

  it("should have app-paths-manifest.json for App Router routes", () => {
    if (!existsSync(APP_PATHS_MANIFEST)) {
      throw new Error(
        "app-paths-manifest.json missing — App Router build is corrupted. " +
          "Fix: rm -rf .next && npm run build"
      );
    }
    const manifest = JSON.parse(readFileSync(APP_PATHS_MANIFEST, "utf-8"));
    const routes = Object.keys(manifest);
    expect(routes.length).toBeGreaterThan(0);
  });

  it("should have static chunks directory with JS and CSS files", () => {
    if (!existsSync(STATIC_DIR)) {
      throw new Error(
        ".next/static directory missing — this causes 404 for layout.css, page.js, main-app.js. " +
          "Fix: rm -rf .next && npm run build"
      );
    }

    const findFiles = (dir: string, ext: string): string[] => {
      const results: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...findFiles(fullPath, ext));
        } else if (entry.name.endsWith(ext)) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const jsFiles = findFiles(STATIC_DIR, ".js");
    const cssFiles = findFiles(STATIC_DIR, ".css");

    if (jsFiles.length === 0) {
      throw new Error(
        "No .js files in .next/static — browser will get 404 for page.js, main-app.js. " +
          "Fix: rm -rf .next && npm run build"
      );
    }
    if (cssFiles.length === 0) {
      throw new Error(
        "No .css files in .next/static — browser will get 404 for layout.css. " +
          "Fix: rm -rf .next && npm run build"
      );
    }
  });

  it("should have all critical app routes in build output", () => {
    if (!existsSync(APP_PATHS_MANIFEST)) return;

    const manifest = JSON.parse(readFileSync(APP_PATHS_MANIFEST, "utf-8"));
    const routes = Object.keys(manifest);

    const criticalRoutes = [
      "/page",           // Home / sign-in
      "/chat/page",      // Chat dashboard
      "/not-found",      // 404 page
    ];

    const missingRoutes = criticalRoutes.filter(
      (route) => !routes.some((r) => r.includes(route))
    );

    if (missingRoutes.length > 0) {
      throw new Error(
        `Critical routes missing from build: ${missingRoutes.join(", ")}. ` +
          "These pages will 404 in production. Fix: check for build errors and rebuild."
      );
    }
  });

  it("should have consistent build ID across manifest files", () => {
    const buildIdPath = path.join(NEXT_DIR, "BUILD_ID");
    if (!existsSync(buildIdPath)) {
      throw new Error(
        "BUILD_ID file missing — build output is incomplete. " +
          "Fix: rm -rf .next && npm run build"
      );
    }

    const buildId = readFileSync(buildIdPath, "utf-8").trim();
    expect(buildId.length).toBeGreaterThan(0);

    // Verify static chunks reference this build ID
    const buildIdDir = path.join(STATIC_DIR, buildId);
    if (!existsSync(buildIdDir)) {
      throw new Error(
        `Static assets for build ID "${buildId}" missing — ` +
          "browser will request old chunk hashes that no longer exist, causing 404s. " +
          "Fix: rm -rf .next && npm run build"
      );
    }
  });
});
