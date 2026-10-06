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

test("MockChrome Test Harness Verification (100% Coverage)", async (t) => {
  const { MockChrome } = require("./mock_chrome");
  const mock = new MockChrome();

  await t.test("runtime.sendMessage handles sync, async, and unhandled messages", async () => {
    // 1. Unhandled message
    let unhandledRes = null;
    await mock.runtime.sendMessage({ type: "UNKNOWN" }, (res) => { unhandledRes = res; });
    assert.strictEqual(unhandledRes, undefined);

    // 2. Synchronous listener response
    mock.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "SYNC") {
        sendResponse({ status: "sync_ok" });
        return false;
      }
    });
    let syncRes = null;
    await mock.runtime.sendMessage({ type: "SYNC" }, (res) => { syncRes = res; });
    assert.deepStrictEqual(syncRes, { status: "sync_ok" });

    // 3. Asynchronous listener response (returns true)
    mock.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "ASYNC") {
        sendResponse({ status: "async_ok" });
        return true;
      }
    });
    let asyncRes = null;
    await mock.runtime.sendMessage({ type: "ASYNC" }, (res) => { asyncRes = res; });
    assert.deepStrictEqual(asyncRes, { status: "async_ok" });
  });

  await t.test("tabs methods: query, create, update, reload, sendMessage", async () => {
    const tab1 = await mock.tabs.create({ url: "https://ask.dell.com/chat/1", active: true });
    assert.strictEqual(tab1.id, 101);
    assert.strictEqual(tab1.active, true);

    const tab2 = await mock.tabs.create({ url: "https://github.com/pull/1", active: false });
    assert.strictEqual(tab2.active, false);

    // tabs.query filtering
    const matching = await mock.tabs.query({ url: "https://ask.dell.com/*" });
    assert.strictEqual(matching.length, 1);
    assert.strictEqual(matching[0].id, tab1.id);

    const activeTabs = await mock.tabs.query({ active: true });
    assert.strictEqual(activeTabs.length, 1);
    assert.strictEqual(activeTabs[0].id, tab1.id);

    // tabs.update
    const updated = await mock.tabs.update(tab1.id, { title: "Updated Title" });
    assert.strictEqual(updated.title, "Updated Title");

    // tabs.reload
    await mock.tabs.reload(tab1.id);
    assert.strictEqual(tab1.status, "complete");

    // tabs.sendMessage to tab without handler returns default { success: true }
    const defaultResp = await mock.tabs.sendMessage(tab1.id, { ping: true });
    assert.deepStrictEqual(defaultResp, { success: true });

    // tabs.sendMessage with handler
    tab1.messageHandler = (msg) => ({ echo: msg.ping });
    const handledResp = await mock.tabs.sendMessage(tab1.id, { ping: "pong" });
    assert.deepStrictEqual(handledResp, { echo: "pong" });

    // tabs.sendMessage to nonexistent tab rejects
    await assert.rejects(async () => {
      await mock.tabs.sendMessage(999, { ping: true });
    }, /Could not establish connection to tab 999/);
  });

  await t.test("storage.local: get, set, remove, clear", async () => {
    await mock.storage.local.set({ key1: "val1", key2: "val2", key3: "val3" });

    // String key
    const resString = await mock.storage.local.get("key1");
    assert.strictEqual(resString.key1, "val1");

    // Array of keys
    const resArr = await mock.storage.local.get(["key1", "key2"]);
    assert.deepStrictEqual(resArr, { key1: "val1", key2: "val2" });

    // Null/undefined keys (all storage)
    const resAll = await mock.storage.local.get(null);
    assert.strictEqual(resAll.key3, "val3");

    // Remove single and array
    await mock.storage.local.remove("key1");
    assert.strictEqual(mock.storageData.key1, undefined);

    await mock.storage.local.remove(["key2"]);
    assert.strictEqual(mock.storageData.key2, undefined);

    // Clear
    await mock.storage.local.clear();
    assert.deepStrictEqual(mock.storageData, {});
  });

  await t.test("windows, contextMenus, sidePanel, action, scripting, reset", async () => {
    // windows.update
    const win = await mock.windows.update(10, { focused: true });
    assert.strictEqual(win.id, 10);
    assert.strictEqual(win.focused, true);

    // contextMenus.create
    mock.contextMenus.create({ id: "test-menu", title: "Test Menu" });
    assert.strictEqual(mock.contextMenusCreated.length, 1);

    // sidePanel
    await mock.sidePanel.open({ windowId: 1 });
    await mock.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

    // scripting.executeScript success and error
    const scriptRes = await mock.scripting.executeScript({
      target: { tabId: 1 },
      func: () => "script_result"
    });
    assert.deepStrictEqual(scriptRes, [{ result: "script_result" }]);

    await assert.rejects(async () => {
      await mock.scripting.executeScript({
        target: { tabId: 1 },
        func: () => { throw new Error("Script execution failed"); }
      });
    }, /Script execution failed/);

    // reset
    mock.reset();
    assert.strictEqual(mock.tabsList.length, 0);
    assert.strictEqual(mock.contextMenusCreated.length, 0);
  });
});

