// ============================================================
// tests/background.test.js
// Complete Unit & Integration Tests for background.js
// ============================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { MockChrome } = require("./mock_chrome");

function loadBackgroundWorker(mockChrome) {
  let bgCode = fs.readFileSync(path.resolve(__dirname, "../background.js"), "utf-8");
  bgCode += `
    ;Object.assign(this, {
      checkAskDellConnection,
      updateConnectionStatus,
      openOrFocusAskDellTab,
      extractPageContent,
      get askDellConnection() { return askDellConnection; }
    });
  `;

  const sandbox = {
    chrome: mockChrome,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    setInterval: () => {},
    clearInterval: () => {},
    setTimeout: (fn, ms) => fn(),
    Date: Date,
    Array: Array,
    Object: Object,
    String: String,
    RegExp: RegExp,
    Promise: Promise
  };
  vm.createContext(sandbox);
  vm.runInContext(bgCode, sandbox);
  return sandbox;
}

test("Background Service Worker Suite", async (t) => {
  let mock;
  let bg;

  t.beforeEach(() => {
    mock = new MockChrome();
    bg = loadBackgroundWorker(mock);
  });

  await t.test("1. Installation initializes default settings & context menus", async () => {
    assert.strictEqual(mock.installedListeners.length, 1);
    mock.installedListeners[0]();

    // Context menus created
    assert.strictEqual(mock.contextMenusCreated.length, 3);
    assert.strictEqual(mock.contextMenusCreated[0].id, "askdell-analyze-selection");
    assert.strictEqual(mock.contextMenusCreated[1].id, "askdell-explain-selection");
    assert.strictEqual(mock.contextMenusCreated[2].id, "askdell-analyze-page");

    // Storage initialized
    assert.strictEqual(mock.storageData.settings.model, "claude-opus-4-6");
    assert.strictEqual(mock.storageData.settings.includePageContent, true);
    assert.strictEqual(mock.storageData.settings.autoWebSearch, true);
    assert.strictEqual(mock.storageData.settings.maxContentLength, 100000);
  });

  await t.test("2. Context Menu selection and page actions", async () => {
    const clickListener = mock.contextMenuListeners[0];
    assert.ok(clickListener, "Context menu click listener must be registered");

    // Analyze selection
    await clickListener({ menuItemId: "askdell-analyze-selection", selectionText: "const x = 42;" }, { id: 1, title: "Doc", url: "https://code.com" });
    assert.strictEqual(mock.storageData.pendingAction.type, "ANALYZE_SELECTION");
    assert.strictEqual(mock.storageData.pendingAction.text, "const x = 42;");

    // Explain selection
    await clickListener({ menuItemId: "askdell-explain-selection", selectionText: "function test() {}" }, { id: 1, title: "Doc", url: "https://code.com" });
    assert.strictEqual(mock.storageData.pendingAction.type, "EXPLAIN_SELECTION");
    assert.strictEqual(mock.storageData.pendingAction.text, "function test() {}");
  });

  await t.test("3. Background Connection Checking: No tab open -> not_open", async () => {
    mock.tabsList = [];
    const conn = await bg.checkAskDellConnection(true);
    assert.strictEqual(conn.status, "not_open");
    assert.strictEqual(conn.tabId, null);
  });

  await t.test("4. Background Connection Checking: Authenticated tab -> connected", async () => {
    mock.tabsList = [
      {
        id: 101,
        url: "https://ask.dell.com/c/123",
        status: "complete",
        messageHandler: (msg) => {
          if (msg.type === "ASKDELL_CHECK_AUTH") {
            return { authenticated: true, status: 200 };
          }
        }
      }
    ];

    const conn = await bg.checkAskDellConnection(true);
    assert.strictEqual(conn.status, "connected");
    assert.strictEqual(conn.tabId, 101);
  });

  await t.test("5. Background Connection Checking: Unauthenticated tab -> unauthenticated", async () => {
    mock.tabsList = [
      {
        id: 102,
        url: "https://ask.dell.com/auth",
        status: "complete",
        messageHandler: (msg) => {
          if (msg.type === "ASKDELL_CHECK_AUTH") {
            return { authenticated: false, status: 401 };
          }
        }
      }
    ];

    const conn = await bg.checkAskDellConnection(true);
    assert.strictEqual(conn.status, "unauthenticated");
    assert.strictEqual(conn.tabId, 102);
  });

  await t.test("6. Tabs onUpdated and onRemoved triggers checkAskDellConnection", async () => {
    mock.tabsList = [
      {
        id: 103,
        url: "https://ask.dell.com",
        status: "complete",
        messageHandler: () => ({ authenticated: true })
      }
    ];

    // Trigger tab complete
    mock.tabUpdatedListeners[0](103, { status: "complete" }, mock.tabsList[0]);
    await bg.checkAskDellConnection(true);

    assert.strictEqual(bg.askDellConnection.status, "connected");

    // Trigger tab removal
    mock.tabsList = [];
    mock.tabRemovedListeners[0](103);
    await bg.checkAskDellConnection(true);

    assert.strictEqual(bg.askDellConnection.status, "not_open");
  });

  await t.test("7. Message Handler: GET_ASKDELL_CONNECTION and CHECK_ASKDELL_CONNECTION", async () => {
    const listener = mock.messageListeners[0];
    assert.ok(listener, "Message listener must be registered");

    // GET
    let getResp;
    await new Promise((resolve) => {
      listener({ type: "GET_ASKDELL_CONNECTION" }, {}, (res) => {
        getResp = res;
        resolve();
      });
    });
    assert.ok(getResp && getResp.status, "Must return connection status");

    // CHECK
    let checkResp;
    await new Promise((resolve) => {
      listener({ type: "CHECK_ASKDELL_CONNECTION" }, {}, (res) => {
        checkResp = res;
        resolve();
      });
    });
    assert.ok(checkResp && checkResp.status, "Must return fresh connection status");
  });

  await t.test("8. Message Handler: OPEN_OR_FOCUS_ASKDELL (Creates or Focuses)", async () => {
    const listener = mock.messageListeners[0];

    // Case A: No existing tab -> creates new tab
    mock.tabsList = [];
    let openResp;
    await new Promise((resolve) => {
      listener({ type: "OPEN_OR_FOCUS_ASKDELL" }, {}, (res) => {
        openResp = res;
        resolve();
      });
    });

    assert.ok(openResp.success, "Should succeed in creating tab");
    assert.strictEqual(openResp.created, true);
    assert.strictEqual(mock.tabsList.length, 1);
    assert.ok(mock.tabsList[0].url.includes("ask.dell.com"));

    // Case B: Existing tab -> focuses existing tab
    let focusResp;
    await new Promise((resolve) => {
      listener({ type: "OPEN_OR_FOCUS_ASKDELL" }, {}, (res) => {
        focusResp = res;
        resolve();
      });
    });

    assert.ok(focusResp && focusResp.success, "Should succeed in focusing tab");
    assert.strictEqual(focusResp.focused, true);
    assert.strictEqual(mock.tabsList.length, 1, "Should not create duplicate tab");
  });

  await t.test("9. Message Handler: REFRESH_ASKDELL_TAB", async () => {
    const listener = mock.messageListeners[0];
    mock.tabsList = [{ id: 201, url: "https://ask.dell.com", status: "complete" }];

    let reloadResp;
    await new Promise((resolve) => {
      listener({ type: "REFRESH_ASKDELL_TAB" }, {}, (res) => {
        reloadResp = res;
        resolve();
      });
    });

    assert.ok(reloadResp && reloadResp.success);
    assert.strictEqual(reloadResp.tabId, 201);
  });

  await t.test("10. Message Handler: EXTRACT_TAB_CONTENT blocks browser internal pages", async () => {
    const listener = mock.messageListeners[0];

    // Restricted page
    mock.tabsList = [{ id: 301, url: "chrome://settings", active: true }];
    let respRestricted;
    await new Promise((resolve) => {
      listener({ type: "EXTRACT_TAB_CONTENT" }, {}, (res) => {
        respRestricted = res;
        resolve();
      });
    });

    assert.ok(respRestricted.error, "Should return error for internal page");
    assert.ok(respRestricted.error.includes("Cannot extract content from internal browser pages"));
  });

  await t.test("11. Content Extraction Function: GitHub PR", () => {
    const fnCode = bg.extractPageContent.toString();
    const sandbox = vm.createContext({
      window: {
        location: {
          href: "https://github.com/dell/repo/pull/42",
          hostname: "github.com"
        }
      },
      document: {
        title: "Feature PR #42",
        querySelector: (sel) => {
          if (sel.includes("js-issue-title")) return { innerText: "Add AI Assistant Support (#42)" };
          if (sel.includes("comment-body")) return { innerText: "Implements Claude Opus bridge integration" };
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel.includes("file-header")) return [{ getAttribute: () => "src/bridge.js" }];
          if (sel.includes("diff-table")) return [{ innerText: "+ function newFeature() {}" }];
          if (sel.includes("timeline-comment")) return [{ innerText: "LGTM from reviewer" }];
          return [];
        }
      },
      Boolean: Boolean,
      Array: Array,
      Set: Set
    });

    const result = vm.runInContext(`(${fnCode})()`, sandbox);
    assert.strictEqual(result.platform, "github");
    assert.strictEqual(result.type, "pull_request");
    assert.strictEqual(result.title, "Add AI Assistant Support (#42)");
    assert.ok(result.diff.includes("+ function newFeature()"));
    assert.strictEqual(result.files.length, 1);
    assert.strictEqual(result.files[0], "src/bridge.js");
    assert.ok(result.comments.includes("LGTM"));
  });

  await t.test("12. Content Extraction Function: Jira Ticket", () => {
    const fnCode = bg.extractPageContent.toString();
    const sandbox = vm.createContext({
      window: {
        location: {
          href: "https://jira.dell.com/browse/DEV-501",
          hostname: "jira.dell.com"
        }
      },
      document: {
        title: "DEV-501: Authentication Pipeline",
        querySelector: (sel) => {
          if (sel.includes("summary-val")) return { innerText: "Fix Enterprise OAuth Session Expiration" };
          if (sel.includes("description-val")) return { innerText: "Cookie session requires periodic keep-alive." };
          return null;
        },
        querySelectorAll: () => []
      },
      Boolean: Boolean,
      Array: Array,
      Set: Set
    });

    const result = vm.runInContext(`(${fnCode})()`, sandbox);
    assert.strictEqual(result.platform, "jira");
    assert.strictEqual(result.type, "ticket");
    assert.strictEqual(result.title, "Fix Enterprise OAuth Session Expiration");
    assert.ok(result.body.includes("periodic keep-alive"));
  });

  await t.test("13. Content Extraction Function: AskDell Shared Session URL", () => {
    const fnCode = bg.extractPageContent.toString();
    const sandbox = vm.createContext({
      window: {
        location: {
          href: "https://ask.dell.com/s/a53a9dc8-5b8a-45b6-918b-c1806ca01386",
          hostname: "ask.dell.com"
        }
      },
      document: { title: "Shared AskDell Chat" },
      Boolean: Boolean,
      Array: Array
    });

    const result = vm.runInContext(`(${fnCode})()`, sandbox);
    assert.strictEqual(result.platform, "askdell");
    assert.strictEqual(result.type, "shared_chat");
    assert.strictEqual(result.shareId, "a53a9dc8-5b8a-45b6-918b-c1806ca01386");
  });
});
