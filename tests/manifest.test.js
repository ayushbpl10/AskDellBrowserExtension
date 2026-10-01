// ============================================================
// tests/manifest.test.js
// Validates Manifest V3 specifications, permissions, icons & structure
// ============================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const manifestPath = path.join(ROOT_DIR, "manifest.json");

test("Manifest V3 Specification and Integrity", async (t) => {
  assert.ok(fs.existsSync(manifestPath), "manifest.json must exist in root");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  await t.test("Manifest Version is V3", () => {
    assert.strictEqual(manifest.manifest_version, 3, "Manifest version must be 3");
  });

  await t.test("Required Metadata Fields", () => {
    assert.ok(manifest.name && manifest.name.includes("AskDell"), "Extension name must include AskDell");
    assert.ok(manifest.version, "Extension must define a version");
    assert.ok(manifest.description, "Extension must have a descriptive summary");
  });

  await t.test("Permissions and Host Permissions", () => {
    const requiredPermissions = ["sidePanel", "storage", "tabs", "scripting", "contextMenus"];
    for (const perm of requiredPermissions) {
      assert.ok(manifest.permissions.includes(perm), `Permissions must include ${perm}`);
    }

    assert.ok(Array.isArray(manifest.host_permissions), "host_permissions must be an array");
    assert.ok(manifest.host_permissions.includes("https://ask.dell.com/*"), "host_permissions must include ask.dell.com");
  });

  await t.test("Background Service Worker and Side Panel", () => {
    assert.strictEqual(manifest.background.service_worker, "background.js", "Background worker must be background.js");
    assert.ok(fs.existsSync(path.join(ROOT_DIR, manifest.background.service_worker)), "background.js file must exist");

    assert.strictEqual(manifest.side_panel.default_path, "sidepanel.html", "Side panel path must be sidepanel.html");
    assert.ok(fs.existsSync(path.join(ROOT_DIR, manifest.side_panel.default_path)), "sidepanel.html file must exist");
  });

  await t.test("Content Script Mapping", () => {
    assert.ok(Array.isArray(manifest.content_scripts), "content_scripts must be an array");
    assert.strictEqual(manifest.content_scripts.length, 1, "Exactly one content script bundle configured");

    const bridge = manifest.content_scripts[0];
    assert.ok(bridge.matches.includes("https://ask.dell.com/*"), "Must match https://ask.dell.com/*");
    assert.ok(bridge.js.includes("askdell-bridge.js"), "Content script must include askdell-bridge.js");
    assert.ok(fs.existsSync(path.join(ROOT_DIR, "askdell-bridge.js")), "askdell-bridge.js file must exist");
  });

  await t.test("Icon Assets Existence", () => {
    const iconSizes = ["16", "48", "128"];
    for (const size of iconSizes) {
      const relPath = manifest.icons[size];
      assert.ok(relPath, `manifest.icons must define size ${size}`);
      const fullPath = path.join(ROOT_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `Icon file must exist: ${relPath}`);
    }
  });
});
