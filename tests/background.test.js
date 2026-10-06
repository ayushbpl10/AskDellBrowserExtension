// ============================================================
// tests/background.test.js
// Complete Unit & Integration Tests for background.js (100% Coverage)
// ============================================================

const test = require("node:test");
const assert = require("node:assert");
const { MockChrome } = require("./mock_chrome");

let lastIntervalCallback = null;

function loadBackgroundWorker(mockChrome) {
  global.chrome = mockChrome;
  const origSetInterval = global.setInterval;
  const origSetTimeout = global.setTimeout;
  global.setInterval = (fn) => { lastIntervalCallback = fn; return { unref: () => {} }; };
  global.setTimeout = (fn) => { fn(); return 1; };
  delete require.cache[require.resolve("../background.js")];
  const bg = require("../background.js");
  global.setInterval = origSetInterval;
  global.setTimeout = origSetTimeout;
  return bg;
}

test("Background Service Worker Suite", async (t) => {
  let mock;
  let bg;

  t.beforeEach(() => {
    mock = new MockChrome();
    global.window = {
      location: { href: "https://code.com/view", hostname: "code.com" }
    };
    global.document = {
      title: "Page Title",
      querySelector: () => null,
      querySelectorAll: () => [],
      body: { innerText: "Sample body text" }
    };
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

  await t.test("2. Context Menu selection, page actions and fallback action click", async () => {
    const clickListener = mock.contextMenuListeners[0];
    assert.ok(clickListener, "Context menu click listener must be registered");

    // Analyze selection
    await clickListener({ menuItemId: "askdell-analyze-selection", selectionText: "const x = 42;" }, { id: 1, windowId: 10, title: "Doc", url: "https://code.com" });
    assert.strictEqual(mock.storageData.pendingAction.type, "ANALYZE_SELECTION");
    assert.strictEqual(mock.storageData.pendingAction.text, "const x = 42;");

    // Explain selection
    await clickListener({ menuItemId: "askdell-explain-selection", selectionText: "function test() {}" }, { id: 1, windowId: 10, title: "Doc", url: "https://code.com" });
    assert.strictEqual(mock.storageData.pendingAction.type, "EXPLAIN_SELECTION");
    assert.strictEqual(mock.storageData.pendingAction.text, "function test() {}");

    // Analyze page
    await clickListener({ menuItemId: "askdell-analyze-page" }, { id: 1, windowId: 10, title: "Page", url: "https://code.com" });
    assert.strictEqual(mock.storageData.pendingAction.type, "ANALYZE_PAGE");

    // Action icon clicked fallback
    const actionListener = mock.actionClickListeners[0];
    if (actionListener) {
      await actionListener({ windowId: 10 });
    }
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

  await t.test("5b. Background Connection Checking: Tab error -> unauthenticated", async () => {
    mock.tabsList = [
      {
        id: 103,
        url: "https://ask.dell.com/c/err",
        status: "complete",
        messageHandler: () => {
          throw new Error("Bridge communication error");
        }
      }
    ];

    const conn = await bg.checkAskDellConnection(true);
    assert.strictEqual(conn.status, "unauthenticated");
  });

  await t.test("6. Tabs onUpdated and onRemoved triggers checkAskDellConnection", async () => {
    mock.tabsList = [
      {
        id: 104,
        url: "https://ask.dell.com/chat",
        status: "complete",
        messageHandler: () => ({ authenticated: true })
      }
    ];

    await bg.checkAskDellConnection(true);
    assert.strictEqual(bg.askDellConnection.status, "connected");
    assert.strictEqual(bg.askDellConnection.tabId, 104);

    // onUpdated for askdell URL
    for (const listener of mock.tabUpdatedListeners) {
      await listener(104, { status: "complete" }, { url: "https://ask.dell.com/c/2" });
    }

    // onRemoved for active askdell tab
    mock.tabsList = [];
    for (const listener of mock.tabRemovedListeners) {
      await listener(104, {});
    }
    assert.strictEqual(bg.askDellConnection.status, "not_open");
  });

  await t.test("7. Message Handler: Connection query and session notification", async () => {
    const listener = mock.messageListeners[0];

    // GET_ASKDELL_CONNECTION
    let getResp;
    await new Promise((resolve) => {
      listener({ type: "GET_ASKDELL_CONNECTION" }, {}, (res) => { getResp = res; resolve(); });
    });
    assert.ok(getResp);

    // CHECK_ASKDELL_CONNECTION
    let checkResp;
    await new Promise((resolve) => {
      listener({ type: "CHECK_ASKDELL_CONNECTION" }, {}, (res) => { checkResp = res; resolve(); });
    });
    assert.ok(checkResp);

    // ASKDELL_SESSION_ACTIVE
    listener({ type: "ASKDELL_SESSION_ACTIVE" }, { tab: { id: 105, url: "https://ask.dell.com" } });
    assert.strictEqual(bg.askDellConnection.status, "connected");

    // ASKDELL_SESSION_EXPIRED
    listener({ type: "ASKDELL_SESSION_EXPIRED" }, { tab: { id: 105, url: "https://ask.dell.com" } });
    assert.strictEqual(bg.askDellConnection.status, "unauthenticated");
  });

  await t.test("8. Message Handler: OPEN_OR_FOCUS_ASKDELL (Creates or Focuses)", async () => {
    const listener = mock.messageListeners[0];

    // Case A: Create new tab
    mock.tabsList = [];
    let createResp;
    await new Promise((resolve) => {
      listener({ type: "OPEN_OR_FOCUS_ASKDELL" }, {}, (res) => { createResp = res; resolve(); });
    });
    assert.ok(createResp && createResp.tabId);

    // Case B: Focus existing tab
    let focusResp;
    await new Promise((resolve) => {
      listener({ type: "OPEN_OR_FOCUS_ASKDELL" }, {}, (res) => { focusResp = res; resolve(); });
    });
    assert.ok(focusResp && focusResp.tabId);
  });

  await t.test("9. Message Handler: REFRESH_ASKDELL_TAB, GET_ASKDELL_TAB, FETCH_MODELS", async () => {
    const listener = mock.messageListeners[0];

    // GET_ASKDELL_TAB when open
    mock.tabsList = [{ id: 201, url: "https://ask.dell.com/chat" }];
    let tabResp;
    await new Promise((resolve) => {
      listener({ type: "GET_ASKDELL_TAB" }, {}, (res) => { tabResp = res; resolve(); });
    });
    assert.strictEqual(tabResp.tabId, 201);

    // FETCH_MODELS when open
    let modelsResp;
    mock.tabsList[0].messageHandler = (msg) => {
      if (msg.type === "ASKDELL_GET_MODELS") return { models: [{ id: "claude-opus-4-6" }] };
    };
    await new Promise((resolve) => {
      listener({ type: "FETCH_MODELS" }, {}, (res) => { modelsResp = res; resolve(); });
    });
    assert.ok(modelsResp && modelsResp.models);

    // REFRESH_ASKDELL_TAB when tab open
    let reloadResp;
    await new Promise((resolve) => {
      listener({ type: "REFRESH_ASKDELL_TAB" }, {}, (res) => { reloadResp = res; resolve(); });
    });
    assert.ok(reloadResp && reloadResp.success);

    // REFRESH_ASKDELL_TAB when no tab open (creates one)
    mock.tabsList = [];
    let reloadCreateResp;
    await new Promise((resolve) => {
      listener({ type: "REFRESH_ASKDELL_TAB" }, {}, (res) => { reloadCreateResp = res; resolve(); });
    });
    assert.ok(reloadCreateResp && reloadCreateResp.success);
  });

  await t.test("10. Message Handler: EXTRACT_TAB_CONTENT blocks browser internal pages and extracts valid tabs", async () => {
    const listener = mock.messageListeners[0];

    // Restricted page
    mock.tabsList = [{ id: 301, url: "chrome://settings", active: true }];
    let respRestricted;
    await new Promise((resolve) => {
      listener({ type: "EXTRACT_TAB_CONTENT" }, {}, (res) => { respRestricted = res; resolve(); });
    });
    assert.ok(respRestricted.error.includes("Cannot extract content from internal browser pages"));

    // Valid tab
    mock.tabsList = [{ id: 302, url: "https://code.com/index.ts", active: true }];
    let respValid;
    await new Promise((resolve) => {
      listener({ type: "EXTRACT_TAB_CONTENT" }, {}, (res) => { respValid = res; resolve(); });
    });
    assert.ok(respValid && respValid.content);
  });

  await t.test("11. Content Extraction Function: GitHub PR", () => {
    global.window = {
      location: { href: "https://github.com/dell/repo/pull/42", hostname: "github.com" }
    };
    global.document = {
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
    };

    const result = bg.extractPageContent();
    assert.strictEqual(result.platform, "github");
    assert.strictEqual(result.type, "pull_request");
    assert.strictEqual(result.title, "Add AI Assistant Support (#42)");
    assert.ok(result.diff.includes("+ function newFeature()"));
    assert.strictEqual(result.files.length, 1);
    assert.strictEqual(result.files[0], "src/bridge.js");
    assert.ok(result.comments.includes("LGTM"));
  });

  await t.test("12. Content Extraction Function: GitHub Issue & Code File", () => {
    // 12a. GitHub Issue
    global.window = {
      location: { href: "https://github.com/dell/repo/issues/10", hostname: "github.com" }
    };
    global.document = {
      title: "Issue #10: Bug Report",
      querySelector: (sel) => {
        if (sel.includes("js-issue-title")) return { innerText: "Bug in connection timeout" };
        if (sel.includes("comment-body")) return { innerText: "Steps to reproduce..." };
        return null;
      },
      querySelectorAll: () => []
    };
    const issueResult = bg.extractPageContent();
    assert.strictEqual(issueResult.platform, "github");
    assert.strictEqual(issueResult.type, "issue");
    assert.strictEqual(issueResult.title, "Bug in connection timeout");

    // 12b. GitHub Code Blob
    global.window = {
      location: { href: "https://github.com/dell/repo/blob/main/src/index.ts", hostname: "github.com" }
    };
    global.document = {
      title: "src/index.ts",
      querySelector: (sel) => {
        if (sel.includes("blob-code-content") || sel.includes("highlight")) return { innerText: "export const version = '2.2.2';" };
        return null;
      },
      querySelectorAll: () => []
    };
    const codeResult = bg.extractPageContent();
    assert.strictEqual(codeResult.platform, "github");
    assert.strictEqual(codeResult.type, "source_code");
    assert.ok(codeResult.code.includes("2.2.2"));
  });

  await t.test("13. Content Extraction Function: GitLab MR & Azure DevOps PR", () => {
    // 13a. GitLab MR
    global.window = {
      location: { href: "https://gitlab.com/group/project/-/merge_requests/55", hostname: "gitlab.com" }
    };
    global.document = {
      title: "MR !55",
      querySelector: (sel) => {
        if (sel.includes("detail-page-header .title")) return { innerText: "Refactor storage layer (!55)" };
        if (sel.includes("description .md") || sel.includes("gl-markdown")) return { innerText: "Improves I/O concurrency" };
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes("file-title-name")) return [{ innerText: "src/storage.rs" }];
        if (sel.includes("diff-content")) return [{ innerText: "+ pub struct Storage;" }];
        return [];
      }
    };
    const gitlabResult = bg.extractPageContent();
    assert.strictEqual(gitlabResult.platform, "gitlab");
    assert.strictEqual(gitlabResult.type, "merge_request");
    assert.strictEqual(gitlabResult.title, "Refactor storage layer (!55)");
    assert.strictEqual(gitlabResult.files[0], "src/storage.rs");

    // 13b. Azure DevOps PR
    global.window = {
      location: { href: "https://dev.azure.com/org/proj/_git/repo/pullrequest/77", hostname: "dev.azure.com" }
    };
    global.document = {
      title: "ADO PR 77",
      querySelector: (sel) => {
        if (sel.includes("bolt-header-title") || sel.includes("vc-pullrequest-title") || sel.includes("repos-pr-title")) {
          return { innerText: "PR 77: Modernize build pipeline" };
        }
        if (sel.includes("vc-pullrequest-description") || sel.includes("bolt-card-content") || sel.includes("repos-pr-details-description")) {
          return { innerText: "Updates YAML steps" };
        }
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes("file-container") || sel.includes("file-path")) return [{ innerText: "azure-pipelines.yml" }];
        if (sel.includes("repos-summary-diff-container") || sel.includes("bolt-diff-line")) return [{ innerText: "+ vmImage: 'ubuntu-latest'" }];
        return [];
      }
    };
    const adoResult = bg.extractPageContent();
    assert.strictEqual(adoResult.platform, "azure_devops");
    assert.strictEqual(adoResult.type, "pull_request");
    assert.strictEqual(adoResult.title, "PR 77: Modernize build pipeline");
  });

  await t.test("14. Content Extraction Function: Jira Ticket, AskDell Shared URL & Generic Page", () => {
    // 14a. Jira Ticket
    global.window = {
      location: { href: "https://jira.dell.com/browse/DEV-501", hostname: "jira.dell.com" }
    };
    global.document = {
      title: "DEV-501: Authentication Pipeline",
      querySelector: (sel) => {
        if (sel.includes("#summary-val")) return { innerText: "Fix Enterprise OAuth Session Expiration" };
        if (sel.includes("#description-val")) return { innerText: "Cookie session requires periodic keep-alive." };
        return null;
      },
      querySelectorAll: () => []
    };
    const jiraResult = bg.extractPageContent();
    assert.strictEqual(jiraResult.platform, "jira");
    assert.strictEqual(jiraResult.type, "ticket");
    assert.strictEqual(jiraResult.title, "Fix Enterprise OAuth Session Expiration");

    // 14b. Bitbucket PR
    global.window = {
      location: { href: "https://bitbucket.org/team/repo/pull-requests/10", hostname: "bitbucket.org" }
    };
    global.document = {
      title: "BB PR 10",
      querySelector: (sel) => {
        if (sel.includes("[data-testid='pr-title']")) return { innerText: "BB PR 10 Title" };
        if (sel.includes(".wiki-content")) return { innerText: "BB PR Desc" };
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes(".filename")) return [{ innerText: "index.js" }];
        if (sel.includes(".udiff-line")) return [{ innerText: "+ console.log(1);" }];
        return [];
      }
    };
    const bbResult = bg.extractPageContent();
    assert.strictEqual(bbResult.platform, "bitbucket");
    assert.strictEqual(bbResult.type, "pull_request");
    assert.strictEqual(bbResult.title, "BB PR 10 Title");

    // 14c. Confluence Page
    global.window = {
      location: { href: "https://confluence.dell.com/pages/viewpage.action?pageId=123", hostname: "confluence.dell.com" }
    };
    global.document = {
      title: "Architecture Spec",
      querySelector: (sel) => {
        if (sel.includes("#title-text")) return { innerText: "Architecture Spec" };
        if (sel.includes("#main-content")) return { innerText: "Spec details and guidelines" };
        return null;
      },
      querySelectorAll: () => []
    };
    const confResult = bg.extractPageContent();
    assert.strictEqual(confResult.platform, "confluence");
    assert.strictEqual(confResult.type, "documentation");

    // 14d. ServiceNow Ticket
    global.window = {
      location: { href: "https://dell.service-now.com/nav_to.do?uri=incident.do?sys_id=123", hostname: "dell.service-now.com" }
    };
    global.document = {
      title: "INC0012345",
      querySelector: (sel) => {
        if (sel.includes(".navbar_ui_actions") || sel.includes("h1")) return { innerText: "INC0012345: Network latency" };
        return null;
      },
      querySelectorAll: () => [],
      body: { innerText: "ServiceNow incident body details" }
    };
    const snResult = bg.extractPageContent();
    assert.strictEqual(snResult.platform, "servicenow");
    assert.strictEqual(snResult.type, "ticket");

    // 14e. CI / Logs Container
    global.window = {
      location: { href: "https://jenkins.dell.com/job/build/42/console", hostname: "jenkins.dell.com" }
    };
    global.document = {
      title: "Build #42 Console Output",
      querySelector: (sel) => {
        if (sel.includes(".console-output")) return { innerText: "[INFO] BUILD SUCCESS\nTotal time: 42s" };
        return null;
      },
      querySelectorAll: () => []
    };
    const ciResult = bg.extractPageContent();
    assert.strictEqual(ciResult.platform, "ci_logs");
    assert.strictEqual(ciResult.type, "logs");
    assert.ok(ciResult.body.includes("BUILD SUCCESS"));

    // 14f. AskDell Shared Session URL
    global.window = {
      location: { href: "https://ask.dell.com/s/a53a9dc8-5b8a-45b6-918b-c1806ca01386", hostname: "ask.dell.com" }
    };
    global.document = { title: "Shared AskDell Chat", querySelector: () => null, querySelectorAll: () => [] };
    const askdellResult = bg.extractPageContent();
    assert.strictEqual(askdellResult.platform, "askdell");
    assert.strictEqual(askdellResult.type, "shared_chat");
    assert.strictEqual(askdellResult.shareId, "a53a9dc8-5b8a-45b6-918b-c1806ca01386");

    // 14g. Generic Webpage with Code & Tables
    global.window = {
      location: { href: "https://docs.enterprise.com/guide/caching", hostname: "docs.enterprise.com" }
    };
    global.document = {
      title: "Enterprise Cache Guide",
      querySelector: (sel) => {
        if (sel === "main, article, #content, .content") {
          return { innerText: "Caching architecture overview." };
        }
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes("pre") || sel.includes("code")) return [{ innerText: "const cache = new Redis();" }];
        if (sel.includes("table")) return [{ innerText: "Key | Value" }];
        return [];
      },
      body: { innerText: "Caching architecture overview." }
    };
    const genericResult = bg.extractPageContent();
    assert.strictEqual(genericResult.platform, "webpage");
    assert.ok(genericResult.code.includes("Redis"));
    assert.ok(genericResult.tables.includes("Key | Value"));
  });

  await t.test("15. Legacy model migration and sidePanel errors", async () => {
    // Legacy model migration
    mock.storageData.settings = { model: "claude-opus" };
    mock.installedListeners[0]();
    assert.strictEqual(mock.storageData.settings.model, "claude-opus-4-6");

    // Action click error handling
    mock.sidePanel.open = () => Promise.reject(new Error("Side panel open failed"));
    await mock.actionClickListeners[0]({ windowId: 100 });

    // Context menu sidePanel error handling
    const clickListener = mock.contextMenuListeners[0];
    await clickListener({ menuItemId: "askdell-analyze-selection", selectionText: "code" }, { windowId: 100 });

    // Context menu executeScript failure
    mock.scripting.executeScript = () => Promise.reject(new Error("Script injection failed"));
    await clickListener({ menuItemId: "askdell-analyze-page" }, { id: 101, windowId: 100 });
  });

  await t.test("16. Connection checking loading state and rejection errors", async () => {
    // Tab loading state
    mock.tabsList = [
      {
        id: 201,
        url: "https://ask.dell.com",
        status: "loading",
        messageHandler: () => { throw new Error("not ready yet"); }
      }
    ];
    bg.askDellConnection.status = "not_open";
    await bg.checkAskDellConnection(true);
    assert.strictEqual(bg.askDellConnection.status, "checking");

    // tabs.query rejection
    const origTabsQuery = mock.tabs.query;
    mock.tabs.query = () => Promise.reject(new Error("tabs query exploded"));
    await bg.checkAskDellConnection(true);
    mock.tabs.query = origTabsQuery;

    // Periodic interval trigger
    if (lastIntervalCallback) {
      lastIntervalCallback();
    }
  });

  await t.test("17. openOrFocusAskDellTab and Message Handler error branches", async () => {
    // openOrFocusAskDellTab error
    const origQuery = mock.tabs.query;
    mock.tabs.query = () => Promise.reject(new Error("query failed"));
    const failRes = await bg.openOrFocusAskDellTab();
    assert.strictEqual(failRes.error, "query failed");
    mock.tabs.query = origQuery;

    // FETCH_MODELS when no tab is open
    mock.tabsList = [];
    const listener = mock.messageListeners[0];
    let modelsRes;
    await new Promise((resolve) => {
      listener({ type: "FETCH_MODELS" }, {}, (r) => { modelsRes = r; resolve(); });
    });
    assert.strictEqual(modelsRes.error, "No ask.dell.com tab open");

    // REFRESH_ASKDELL_TAB error
    mock.tabs.query = () => Promise.reject(new Error("refresh query failed"));
    let refreshRes;
    await new Promise((resolve) => {
      listener({ type: "REFRESH_ASKDELL_TAB" }, {}, (r) => { refreshRes = r; resolve(); });
    });
    assert.strictEqual(refreshRes.error, "refresh query failed");
    mock.tabs.query = origQuery;
  });

  await t.test("18. EXTRACT_TAB_CONTENT edge cases: no active tab, empty result, execution throw", async () => {
    const listener = mock.messageListeners[0];

    // No active tab
    const origQuery = mock.tabs.query;
    mock.tabs.query = () => Promise.resolve([]);
    let noTabRes;
    await new Promise((resolve) => {
      listener({ type: "EXTRACT_TAB_CONTENT" }, {}, (r) => { noTabRes = r; resolve(); });
    });
    assert.strictEqual(noTabRes.error, "No active tab found");
    mock.tabs.query = origQuery;

    // Empty result from script execution
    mock.tabsList = [{ id: 301, active: true, url: "https://mywork.com/ticket" }];
    const origExec = mock.scripting.executeScript;
    mock.scripting.executeScript = () => Promise.resolve([{ result: null }]);
    let emptyRes;
    await new Promise((resolve) => {
      listener({ type: "EXTRACT_TAB_CONTENT" }, {}, (r) => { emptyRes = r; resolve(); });
    });
    assert.strictEqual(emptyRes.error, "Could not extract content from the active tab.");

    // Execution throw
    mock.scripting.executeScript = () => Promise.reject(new Error("CSP blocked injection"));
    let throwRes;
    await new Promise((resolve) => {
      listener({ type: "EXTRACT_TAB_CONTENT" }, {}, (r) => { throwRes = r; resolve(); });
    });
    assert.strictEqual(throwRes.error, "CSP blocked injection");
    mock.scripting.executeScript = origExec;
  });

  await t.test("19. extractPageContent GitHub PR fallback diff container", () => {
    global.window = {
      location: { href: "https://github.com/org/repo/pull/1", hostname: "github.com" }
    };
    global.document = {
      title: "Fallback PR Diff",
      querySelector: (sel) => {
        if (sel.includes(".repository-content")) return { innerText: "fallback diff content" };
        return null;
      },
      querySelectorAll: (sel) => []
    };
    const res = bg.extractPageContent();
    assert.strictEqual(res.platform, "github");
    assert.strictEqual(res.diff, "fallback diff content");
  });

  await t.test("20. setPanelBehavior catch block", () => {
    mock.sidePanel.setPanelBehavior = () => Promise.reject(new Error("Not implemented in this browser"));
    loadBackgroundWorker(mock);
  });
});
