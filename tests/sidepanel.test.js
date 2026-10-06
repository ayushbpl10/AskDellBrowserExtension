// ============================================================
// tests/sidepanel.test.js
// Comprehensive Unit & Functional Verification for sidepanel.js
// ============================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { MockChrome } = require("./mock_chrome");

function loadSidepanelContext(mockChrome, initialHtml = "") {
  let sidepanelJs = fs.readFileSync(path.resolve(__dirname, "../sidepanel.js"), "utf-8");

  // DOM Mock Element Factory
  class MockElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.style = {};
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c)
      };
      this.attributes = {};
      this.listeners = {};
      this.children = [];
      this.value = "";
      this.dataset = {};
      this._textContent = "";
      this._innerHTML = "";
    }

    get className() {
      return Array.from(this.classList.classes).join(" ");
    }
    set className(val) {
      this.classList.classes = new Set((val || "").split(" ").filter(Boolean));
    }

    get textContent() {
      return this._textContent;
    }
    set textContent(val) {
      this._textContent = String(val);
      this._innerHTML = String(val);
    }

    get innerHTML() {
      return this._innerHTML;
    }
    set innerHTML(val) {
      this._innerHTML = String(val);
      this._textContent = String(val).replace(/<[^>]+>/g, "");
      this.children = [];
    }

    getAttribute(name) {
      return this.attributes[name] || null;
    }
    setAttribute(name, val) {
      this.attributes[name] = String(val);
    }
    removeAttribute(name) {
      delete this.attributes[name];
    }

    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    }

    dispatchEvent(evt) {
      const list = this.listeners[evt.type] || [];
      for (const fn of list) fn(evt);
    }

    querySelector(sel) {
      for (const child of this.children) {
        if (sel.startsWith(".") && child.classList.contains(sel.slice(1))) return child;
        if (sel.startsWith("#") && child.id === sel.slice(1)) return child;
        const found = child.querySelector?.(sel);
        if (found) return found;
      }
      const el = new MockElement("div");
      if (sel.startsWith(".")) el.className = sel.slice(1);
      return el;
    }
    querySelectorAll(sel) {
      return [];
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      return child;
    }
    click() {
      this.dispatchEvent({ type: "click" });
    }
    focus() {}
    blur() {}
    scrollIntoView() {}
    remove() {}
  }

  // Pre-seed elements mapped by ID
  const elementMap = {
    "btn-send": new MockElement("button"),
    "btn-stop": new MockElement("button"),
    "streaming-controls": new MockElement("div"),
    "connection-status-dot": new MockElement("span"),
    "auth-banner": new MockElement("div"),
    "auth-banner-badge": new MockElement("div"),
    "auth-banner-icon": new MockElement("span"),
    "auth-banner-text": new MockElement("div"),
    "auth-banner-subtext": new MockElement("div"),
    "btn-open-askdell": new MockElement("button"),
    "btn-open-askdell-label": new MockElement("span"),
    "btn-retry-auth": new MockElement("button"),
    "btn-retry-icon": new MockElement("svg"),
    "btn-retry-auth-label": new MockElement("span"),
    "btn-demo-mode": new MockElement("button"),
    "btn-demo-mode-label": new MockElement("span"),
    "model-selector": new MockElement("select"),
    "model-info": new MockElement("span"),
    "detected-platform-badge": new MockElement("span"),
    "detected-title": new MockElement("span"),
    "context-size-badge": new MockElement("span"),
    "shared-session-badge": new MockElement("span"),
    "prompt-input": new MockElement("textarea"),
    "char-counter": new MockElement("span"),
    "messages": new MockElement("div"),
    "welcome-card": new MockElement("div"),
    "history-panel": new MockElement("div"),
    "settings-panel": new MockElement("div"),
    "share-panel": new MockElement("div"),
    "share-link-input": new MockElement("input"),
    "share-status-pill": new MockElement("span"),
    "btn-generate-share": new MockElement("button"),
    "join-session-input": new MockElement("input"),
    "btn-join-session": new MockElement("button"),
    "share-feedback": new MockElement("div"),
    "toast-notification": new MockElement("div"),
    "token-meter-badge": new MockElement("span"),
    "custom-actions-container": new MockElement("div"),
    "btn-add-custom-action": new MockElement("button"),
    "btn-export-menu": new MockElement("button"),
    "export-panel": new MockElement("div"),
    "custom-action-panel": new MockElement("div"),
    "setting-noise-filter": new MockElement("input"),
    "custom-actions-list": new MockElement("div"),
    "custom-actions-count": new MockElement("span"),
    "custom-action-title": new MockElement("input"),
    "custom-action-emoji": new MockElement("input"),
    "custom-action-prompt": new MockElement("textarea"),
    "btn-save-custom-action": new MockElement("button"),
    "btn-download-md": new MockElement("button"),
    "btn-copy-pr-comment": new MockElement("button"),
    "btn-copy-jira-comment": new MockElement("button"),
    "btn-arena": new MockElement("button"),
    "btn-close-arena": new MockElement("button"),
    "btn-run-arena": new MockElement("button"),
    "arena-panel": new MockElement("div"),
    "arena-model-a": new MockElement("select"),
    "arena-model-b": new MockElement("select"),
    "arena-prompt-input": new MockElement("textarea"),
    "btn-open-test-builder": new MockElement("button"),
    "btn-close-test-synthesizer": new MockElement("button"),
    "btn-run-test-synthesizer": new MockElement("button"),
    "test-synthesizer-panel": new MockElement("div"),
    "test-strat-boundary": new MockElement("input"),
    "test-strat-mocks": new MockElement("input"),
    "test-strat-table": new MockElement("input"),
    "test-strat-errors": new MockElement("input"),
    "test-custom-notes": new MockElement("textarea"),
    "btn-cmd-palette": new MockElement("button"),
    "btn-close-cmd-palette": new MockElement("button"),
    "command-palette": new MockElement("div"),
    "cmd-palette-input": new MockElement("input"),
    "cmd-palette-list": new MockElement("div")
  };

  elementMap["arena-model-a"].value = "claude-opus-4-6";
  elementMap["arena-model-b"].value = "gemini-3.8-flash";
  elementMap["arena-prompt-input"].value = "Full PR Review: evaluate architecture, correctness, logic flaws, and optimizations.";
  elementMap["test-strat-boundary"].checked = true;
  elementMap["test-strat-mocks"].checked = true;
  elementMap["test-strat-table"].checked = true;
  elementMap["test-strat-errors"].checked = true;
  elementMap["test-synthesizer-panel"].style.display = "none";
  elementMap["arena-panel"].style.display = "none";
  elementMap["command-palette"].style.display = "none";

  const sandbox = {
    chrome: mockChrome,
    document: {
      documentElement: new MockElement("html"),
      body: new MockElement("body"),
      title: "AskDell Dev Assistant",
      getElementById: (id) => elementMap[id] || null,
      querySelector: (sel) => {
        if (sel.startsWith("#")) return elementMap[sel.slice(1)] || null;
        if (sel === ".auth-card-secondary-row") return new MockElement("div");
        if (sel.includes("test-framework")) {
          const el = new MockElement("input");
          el.value = "Jest / Vitest";
          return el;
        }
        return new MockElement("div");
      },
      querySelectorAll: (sel) => {
        if (sel === ".cmd-palette-item") {
          return elementMap["cmd-palette-list"]?.children || [];
        }
        return [];
      },
      createElement: (tag) => new MockElement(tag),
      addEventListener: () => {}
    },
    window: {
      location: { href: "chrome-extension://id/sidepanel.html" },
      matchMedia: () => ({ matches: false }),
      scrollTo: () => {}
    },
    navigator: {
      clipboard: {
        lastCopied: "",
        writeText: (t) => {
          sandbox.navigator.clipboard.lastCopied = t;
          return Promise.resolve();
        }
      }
    },
    URL: {
      createObjectURL: () => "blob:mock-url-" + Date.now(),
      revokeObjectURL: () => {}
    },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    Event: class { constructor(type) { this.type = type; } },
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    Blob: Blob,
    Response: Response,
    Uint8Array: Uint8Array,
    setTimeout: (fn, ms) => fn(),
    setInterval: () => {},
    clearInterval: () => {},
    CompressionStream: typeof CompressionStream !== "undefined" ? CompressionStream : undefined,
    DecompressionStream: typeof DecompressionStream !== "undefined" ? DecompressionStream : undefined,
    elementMap
  };

  sidepanelJs += `
    ;Object.assign(this, {
      state,
      MODEL_META,
      MODEL_CONTEXT_WINDOWS,
      DEFAULT_CUSTOM_ACTIONS,
      NOISY_FILE_EXTENSIONS,
      getModelMetadata,
      escapeHtml,
      renderMarkdown,
      renderMarkdownTables,
      formatTabContent,
      applyConnectionState,
      initConnectionMonitoring,
      findAskDellTab,
      refreshAskDellStatus,
      generateDemoResponse,
      compressSessionToHash,
      decompressSessionFromHash,
      handleJoinSession,
      isNoisyFile,
      sanitizeDiffNoise,
      estimateTokens,
      updateTokenMeter,
      loadCustomActions,
      renderCustomActions,
      saveCustomAction,
      deleteCustomAction,
      downloadMarkdownReport,
      copyAsPRComment,
      copyAsJiraComment,
      closeAllDrawers,
      loadSessionFromPackage,
      formatPrSuggestion,
      trimCiLogs,
      initCommandPalette,
      toggleCommandPalette,
      openCommandPalette,
      closeCommandPalette,
      renderFilteredCommands,
      executeCommandPaletteItem,
      toggleTestSynthesizerDrawer,
      handleRunTestSynthesizer,
      toggleArenaDrawer,
      handleRunArena,
      COMMAND_CATALOG,
      executeQuickAction
    });
  `;

  vm.createContext(sandbox);
  vm.runInContext(sidepanelJs, sandbox);
  return sandbox;
}

test("Sidepanel Module Suite", async (t) => {
  let mock;
  let sp;

  t.beforeEach(() => {
    mock = new MockChrome();
    sp = loadSidepanelContext(mock);
  });

  await t.test("1. Model Registry and getModelMetadata returns valid configs", () => {
    assert.ok(sp.MODEL_META["claude-opus-4-6"]);
    assert.strictEqual(sp.MODEL_META["claude-opus-4-6"].provider, "anthropic");
    assert.strictEqual(sp.MODEL_META["claude-opus-4-6"].color, "claude");

    assert.ok(sp.MODEL_META["gemini-3.8-flash"]);
    assert.strictEqual(sp.MODEL_META["gemini-3.8-flash"].provider, "gcp");
    assert.strictEqual(sp.MODEL_META["gemini-3.8-flash"].color, "gemini");

    // Dynamic model metadata lookup
    const claudeMeta = sp.getModelMetadata("claude-custom-1");
    assert.strictEqual(claudeMeta.color, "claude");

    const geminiMeta = sp.getModelMetadata("gemini-pro-vision");
    assert.strictEqual(geminiMeta.color, "gemini");
  });

  await t.test("2. escapeHtml handles strings and guards null/undefined", () => {
    assert.strictEqual(sp.escapeHtml(""), "");
    assert.strictEqual(sp.escapeHtml(null), "");
    assert.strictEqual(sp.escapeHtml(undefined), "");
    assert.strictEqual(sp.escapeHtml("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    assert.strictEqual(sp.escapeHtml('foo & "bar"'), "foo &amp; &quot;bar&quot;");
  });

  await t.test("3. renderMarkdown: Code blocks with copy button & diff lines", () => {
    const md = "```diff\n+ added line\n- removed line\n@@ header @@\n```";
    const html = sp.renderMarkdown(md);

    assert.ok(html.includes('class="code-block-container"'));
    assert.ok(html.includes('diff-add'));
    assert.ok(html.includes("+ added line"));
    assert.ok(html.includes('diff-del'));
    assert.ok(html.includes("- removed line"));
  });

  await t.test("4. renderMarkdown: Reasoning and Thinking blocks", () => {
    // Closed <think> block
    const thinkMd = "<think>Step 1: Check inputs.</think>\nResult is valid.";
    const thinkHtml = sp.renderMarkdown(thinkMd);
    assert.ok(thinkHtml.includes('class="reasoning-block"'));
    assert.ok(thinkHtml.includes("Step 1: Check inputs."));
    assert.ok(thinkHtml.includes("Result is valid."));

    // <details type="thought"> block
    const detailsMd = '<details type="thought">\n<summary>Thinking Process</summary>\nReasoning notes.\n</details>\nFinal answer.';
    const detailsHtml = sp.renderMarkdown(detailsMd);
    assert.ok(detailsHtml.includes('class="reasoning-block"'));
    assert.ok(detailsHtml.includes("Reasoning notes."));
    assert.ok(detailsHtml.includes("Final answer."));
  });

  await t.test("5. renderMarkdown: Tables, Headers, Bold, Lists", () => {
    const md = "### Header 3\n\n| Item | Value |\n|---|---|\n| Model | Claude |\n\n- Bullet 1\n- Bullet 2\n\n**Bold Text**";
    const html = sp.renderMarkdown(md);

    assert.ok(html.includes("<h3>Header 3</h3>"));
    assert.ok(html.includes("<table>"));
    assert.ok(html.includes("<th>Item</th>"));
    assert.ok(html.includes("<td>Claude</td>"));
    assert.ok(html.includes("<ul>"));
    assert.ok(html.includes("<li>Bullet 1</li>"));
    assert.ok(html.includes("<strong>Bold Text</strong>"));
  });

  await t.test("6. formatTabContent: Null safety and formatted output", () => {
    assert.strictEqual(sp.formatTabContent(null), "");
    assert.strictEqual(sp.formatTabContent(undefined), "");

    const content = {
      platform: "github",
      type: "pull_request",
      title: "PR #123: Update Pipeline",
      url: "https://github.com/repo/pull/123",
      diff: "+ const timeout = 5000;",
      files: ["index.js", "package.json"]
    };

    const formatted = sp.formatTabContent(content);
    assert.ok(formatted.includes("Platform: github"));
    assert.ok(formatted.includes("Title: PR #123: Update Pipeline"));
    assert.ok(formatted.includes("Files (2):"));
    assert.ok(formatted.includes("+ const timeout = 5000;"));
  });

  await t.test("7. applyConnectionState UI transitions", () => {
    const dot = sp.elementMap["connection-status-dot"];
    const banner = sp.elementMap["auth-banner"];
    const openBtnLabel = sp.elementMap["btn-open-askdell-label"];

    // Case A: connected
    sp.applyConnectionState({ status: "connected" });
    assert.strictEqual(dot.className, "status-dot dot-connected");
    assert.strictEqual(banner.style.display, "none");

    // Case B: unauthenticated -> asks user to sign in
    sp.applyConnectionState({ status: "unauthenticated" });
    assert.strictEqual(dot.className, "status-dot dot-warning");
    assert.strictEqual(banner.className, "auth-card auth-card-unauth");
    assert.strictEqual(banner.style.display, "flex");
    assert.ok(openBtnLabel.textContent.includes("Sign In"));

    // Case C: not_open -> asks user to open session
    sp.applyConnectionState({ status: "not_open" });
    assert.strictEqual(dot.className, "status-dot dot-offline");
    assert.strictEqual(banner.className, "auth-card auth-card-warning");
    assert.strictEqual(banner.style.display, "flex");
    assert.ok(openBtnLabel.textContent.includes("Open AskDell Session"));

    // Case D: demoMode active
    sp.state.demoMode = true;
    sp.applyConnectionState({});
    assert.strictEqual(dot.className, "status-dot dot-demo");
    assert.strictEqual(banner.className, "auth-card auth-card-demo");
  });

  await t.test("8. generateDemoResponse: Covers all 12 Developer Actions", () => {
    const actions = [
      "full-review", "security", "performance", "clean-code",
      "summarize", "explain", "debug", "test-cases",
      "document", "refactor", "architecture", "api-review"
    ];

    const context = { platform: "github", title: "AuthManager.ts", diff: "+ auth()" };

    for (const action of actions) {
      const prompt = `Action test: ${action}`;
      const response = sp.generateDemoResponse(prompt, context, "claude-opus-4-6");
      assert.ok(response && response.length > 50, `Response for ${action} must be substantial`);
      assert.ok(response.includes("```") || response.includes("###"), `Response for ${action} must contain formatted sections`);
    }
  });

  await t.test("9. Session Sharing: compressSessionToHash and decompressSessionFromHash", async () => {
    const pkg = {
      type: "ASKDELL_SHARED_SESSION",
      version: "2.2.2",
      shareId: "AD-TEST-99",
      title: "Shared Test",
      messages: [{ role: "user", content: "Test question" }]
    };

    const token = await sp.compressSessionToHash(pkg);
    assert.ok(token && typeof token === "string");

    const decoded = await sp.decompressSessionFromHash(token);
    assert.deepStrictEqual(decoded.shareId, pkg.shareId);
    assert.strictEqual(decoded.messages[0].content, "Test question");
  });

  await t.test("9b. Joining a shared session auto-closes settings panel & overlay drawers and reveals messages", async () => {
    // Open settings drawer and share drawer
    sp.elementMap["settings-panel"].style.display = "flex";
    sp.elementMap["share-panel"].style.display = "flex";
    sp.elementMap["history-panel"].style.display = "flex";

    const pkg = {
      type: "ASKDELL_SHARED_SESSION",
      version: "2.2.2",
      shareId: "AD-PR-404",
      title: "PR Architecture Review",
      messages: [
        { role: "user", author: "Lead Architect", content: "Is the new caching tier idempotent?" },
        { role: "assistant", author: "Claude Opus 4.6", content: "Yes, cache operations use hash keys with atomic set-nx." }
      ]
    };

    await sp.handleJoinSession(JSON.stringify(pkg));

    // Verify settings panel and all overlay panels are auto-closed
    assert.strictEqual(sp.elementMap["settings-panel"].style.display, "none", "Settings panel must auto close on join");
    assert.strictEqual(sp.elementMap["share-panel"].style.display, "none", "Share panel must auto close on join");
    assert.strictEqual(sp.elementMap["history-panel"].style.display, "none", "History panel must auto close on join");

    // Verify state and chats are visible to user
    assert.strictEqual(sp.state.isShared, true);
    assert.strictEqual(sp.state.shareId, "AD-PR-404");
    assert.strictEqual(sp.state.messages.length, 2);
    assert.strictEqual(sp.state.messages[0].content, "Is the new caching tier idempotent?");
    assert.strictEqual(sp.state.messages[1].content, "Yes, cache operations use hash keys with atomic set-nx.");

    // Verify shared badge is active
    assert.strictEqual(sp.elementMap["shared-session-badge"].style.display, "inline-flex");
    assert.ok(sp.elementMap["shared-session-badge"].textContent.includes("AD-PR-404"));
  });

  await t.test("10. Smart Noise Filter: isNoisyFile and sanitizeDiffNoise", () => {
    // Check known noisy patterns
    assert.strictEqual(sp.isNoisyFile("package-lock.json"), true);
    assert.strictEqual(sp.isNoisyFile("yarn.lock"), true);
    assert.strictEqual(sp.isNoisyFile("pnpm-lock.yaml"), true);
    assert.strictEqual(sp.isNoisyFile("dist/bundle.min.js"), true);
    assert.strictEqual(sp.isNoisyFile("app.chunk.js"), true);
    assert.strictEqual(sp.isNoisyFile("source.map"), true);
    assert.strictEqual(sp.isNoisyFile("src/services/api.ts"), false);
    assert.strictEqual(sp.isNoisyFile("components/Header.jsx"), false);

    // Diff noise sanitization
    const noisyDiff = [
      "diff --git a/package-lock.json b/package-lock.json",
      "index 1111111..2222222 100644",
      "--- a/package-lock.json",
      "+++ b/package-lock.json",
      "@@ -1,5 +1,5 @@",
      '+   "integrity": "sha512-..."',
      "diff --git a/src/index.ts b/src/index.ts",
      "index 3333333..4444444 100644",
      "--- a/src/index.ts",
      "+++ b/src/index.ts",
      "@@ -1,3 +1,3 @@",
      "+ console.log('clean code');"
    ].join("\n");

    const cleaned = sp.sanitizeDiffNoise(noisyDiff);
    assert.ok(!cleaned.includes("package-lock.json"));
    assert.ok(cleaned.includes("src/index.ts"));
    assert.ok(cleaned.includes("console.log('clean code')"));
    assert.ok(cleaned.includes("[ℹ️ Smart Noise Filter: Omitted 1 generated / lockfile diff section(s)"));

    // formatTabContent integration
    sp.state.settings = sp.state.settings || {};
    sp.state.settings.smartNoiseFilter = true;
    const tabWithLockfiles = {
      platform: "github",
      title: "Dependency upgrade PR",
      files: ["src/index.ts", "package-lock.json", "yarn.lock"],
      diff: noisyDiff
    };
    const formattedWithFilter = sp.formatTabContent(tabWithLockfiles);
    assert.ok(formattedWithFilter.includes("- src/index.ts"));
    assert.ok(formattedWithFilter.includes("2 lockfiles/assets omitted by Noise Filter"));

    // Disabled noise filter
    sp.state.settings.smartNoiseFilter = false;
    const formattedWithoutFilter = sp.formatTabContent(tabWithLockfiles);
    assert.ok(formattedWithoutFilter.includes("- package-lock.json"));
    assert.ok(formattedWithoutFilter.includes("- yarn.lock"));
  });

  await t.test("11. Token & Context Window Meter: estimateTokens & updateTokenMeter", () => {
    // Token estimator calculation (~3.8 chars per token)
    assert.strictEqual(sp.estimateTokens(""), 0);
    assert.strictEqual(sp.estimateTokens(null), 0);
    assert.strictEqual(sp.estimateTokens("hello world"), 3);
    assert.strictEqual(sp.estimateTokens("a".repeat(380)), 100);

    // Context meter badge transitions
    const badge = sp.elementMap["token-meter-badge"];
    sp.state.currentModel = "claude-opus-4-6"; // 200,000 max context

    // Normal usage (< 50%)
    sp.state.messages = [{ role: "user", content: "Short query test" }];
    sp.elementMap["prompt-input"].value = "";
    sp.updateTokenMeter();
    assert.strictEqual(badge.classList.contains("token-warn"), false);
    assert.strictEqual(badge.classList.contains("token-danger"), false);
    assert.ok(badge.textContent.includes("tok"));

    // Warning usage (>= 50%, < 80%) -> 110,000 tokens ~ 418,000 chars
    sp.state.messages = [{ role: "user", content: "a".repeat(420000) }];
    sp.updateTokenMeter();
    assert.strictEqual(badge.classList.contains("token-warn"), true);
    assert.strictEqual(badge.classList.contains("token-danger"), false);

    // Danger usage (>= 80%) -> 170,000 tokens ~ 650,000 chars
    sp.state.messages = [{ role: "user", content: "a".repeat(650000) }];
    sp.updateTokenMeter();
    assert.strictEqual(badge.classList.contains("token-danger"), true);
  });

  await t.test("12. Custom Actions: load, render, save and delete", async () => {
    assert.ok(Array.isArray(sp.DEFAULT_CUSTOM_ACTIONS));
    assert.strictEqual(sp.DEFAULT_CUSTOM_ACTIONS.length, 2);

    // Load defaults when chrome.storage is empty
    await sp.loadCustomActions();
    assert.strictEqual(sp.state.customActions.length, 2);

    const container = sp.elementMap["custom-actions-container"];
    assert.strictEqual(container.children.length, 2);

    // Save a new custom action
    sp.saveCustomAction("SQL Injection Audit", "💉", "Perform deep AST inspection for unsafe raw SQL queries");
    assert.strictEqual(sp.state.customActions.length, 3);
    const addedAction = sp.state.customActions.find(a => a.title === "SQL Injection Audit");
    assert.ok(addedAction);
    assert.strictEqual(addedAction.emoji, "💉");
    assert.strictEqual(container.children.length, 3);

    // Delete custom action
    sp.deleteCustomAction(addedAction.id);
    assert.strictEqual(sp.state.customActions.length, 2);
    assert.strictEqual(container.children.length, 2);
  });

  await t.test("13. Export & Reporting Suite: Markdown, PR Comment and Jira Format", async () => {
    // Guard against empty conversation
    sp.state.messages = [];
    sp.downloadMarkdownReport();
    sp.copyAsPRComment();
    sp.copyAsJiraComment();
    assert.strictEqual(sp.navigator.clipboard.lastCopied, "");

    // Populate conversation
    sp.state.currentModel = "claude-opus-4-6";
    sp.state.pageContext = {
      title: "PR #42: Security Fixes",
      url: "https://github.com/org/repo/pull/42",
      files: ["auth.ts", "token.ts"]
    };
    sp.state.messages = [
      { role: "user", content: "Review this authentication module", timestamp: 1700000000 },
      { role: "assistant", author: "Claude 4.6 Opus", content: "### Findings\n1. No vulnerabilities detected.\n2. Ensure token expiration is enforced.", timestamp: 1700000005 }
    ];

    // 1. Download Markdown report
    sp.downloadMarkdownReport();
    const toast = sp.elementMap["toast-notification"];
    assert.ok(toast.textContent.includes("downloaded"));

    // 2. Copy as GitHub/GitLab PR Comment
    sp.copyAsPRComment();
    assert.ok(sp.navigator.clipboard.lastCopied.includes("## 🔍 AskDell AI Code Review"));
    assert.ok(sp.navigator.clipboard.lastCopied.includes("No vulnerabilities detected."));
    assert.ok(sp.navigator.clipboard.lastCopied.includes("Claude Opus 4.6"));

    // 3. Copy as Jira Issue Comment
    sp.copyAsJiraComment();
    assert.ok(sp.navigator.clipboard.lastCopied.includes("h2. AskDell Code Review — PR #42: Security Fixes"));
    assert.ok(sp.navigator.clipboard.lastCopied.includes("h3. Summary of Findings"));
    assert.ok(sp.navigator.clipboard.lastCopied.includes("Ensure token expiration is enforced."));
  });

  await t.test("14. PR Suggestion Generator: formatPrSuggestion formats clean and diff-style code into inline suggestion blocks", () => {
    // 1. Pure code input
    const cleanCode = "const timeout = 5000;\nreturn timeout;";
    const suggestion1 = sp.formatPrSuggestion(cleanCode);
    assert.strictEqual(suggestion1, "```suggestion\nconst timeout = 5000;\nreturn timeout;\n```");

    // 2. Diff-style additions (stripping leading '+')
    const diffAdditions = "+ const port = process.env.PORT || 8080;\n+ server.listen(port);";
    const suggestion2 = sp.formatPrSuggestion(diffAdditions);
    assert.strictEqual(suggestion2, "```suggestion\nconst port = process.env.PORT || 8080;\nserver.listen(port);\n```");

    // 3. Null / empty safety
    assert.strictEqual(sp.formatPrSuggestion(""), "```suggestion\n```");
    assert.strictEqual(sp.formatPrSuggestion(null), "```suggestion\n```");
    assert.strictEqual(sp.formatPrSuggestion(undefined), "```suggestion\n```");

    // 4. Code block embedding verified in renderMarkdown
    const rendered = sp.renderMarkdown("```typescript\nconst a = 1;\n```");
    assert.ok(rendered.includes('class="code-suggestion-btn"'));
    assert.ok(rendered.includes("💡 Suggestion"));
  });

  await t.test("15. CI/CD Log Trimmer & Failure Diagnoser: trimCiLogs isolates stack traces and failure signatures", () => {
    // 1. Short logs are passed through untouched (<= 40 lines)
    const shortLogs = "Building project...\nCompiled successfully.\nAll 12 tests passed.";
    assert.strictEqual(sp.trimCiLogs(shortLogs), shortLogs);

    // 2. Long logs with failure patterns are trimmed to isolate error frame
    const failureLogLines = [];
    for (let i = 0; i < 60; i++) failureLogLines.push(`[info] setup step ${i}...`);
    failureLogLines.push("FAIL src/auth/token.spec.ts");
    failureLogLines.push("AssertionError: expected status 200 to equal 401");
    failureLogLines.push("    at verifyAuth (src/auth/token.ts:55:12)");
    failureLogLines.push("    at runTest (src/auth/token.spec.ts:102:18)");
    for (let i = 0; i < 40; i++) failureLogLines.push(`[debug] teardown task ${i}...`);

    const trimmed = sp.trimCiLogs(failureLogLines.join("\n"));
    assert.ok(trimmed.includes("[🔍 CI Log Trimmer: Isolated failure sections"));
    assert.ok(trimmed.includes("FAIL src/auth/token.spec.ts"));
    assert.ok(trimmed.includes("AssertionError: expected status 200 to equal 401"));
    assert.ok(!trimmed.includes("[info] setup step 1...")); // non-error noise trimmed

    // 3. Long logs without explicit pattern fallback to head & tail
    const genericLongLines = Array.from({ length: 80 }, (_, i) => `Log entry line ${i}`);
    const genericTrimmed = sp.trimCiLogs(genericLongLines.join("\n"));
    assert.ok(genericTrimmed.includes("[... non-error setup logs truncated ...]"));
    assert.ok(genericTrimmed.includes("Log entry line 0"));
    assert.ok(genericTrimmed.includes("Log entry line 79"));

    // 4. Null safety
    assert.strictEqual(sp.trimCiLogs(""), "");
    assert.strictEqual(sp.trimCiLogs(null), "");
  });

  await t.test("16. Command Palette (Ctrl+K): Catalog filtering, model switching, and action execution", () => {
    // 1. Catalog integrity
    assert.ok(Array.isArray(sp.COMMAND_CATALOG));
    assert.ok(sp.COMMAND_CATALOG.length >= 20);

    const fullReviewCmd = sp.COMMAND_CATALOG.find(c => c.id === "action-full-review");
    assert.ok(fullReviewCmd);
    assert.strictEqual(fullReviewCmd.category, "Action");

    const modelCmd = sp.COMMAND_CATALOG.find(c => c.id === "model-gemini-flash");
    assert.ok(modelCmd);
    assert.strictEqual(modelCmd.category, "Model");

    // 2. Open and Close Palette
    const palette = sp.elementMap["command-palette"];
    sp.closeCommandPalette();
    assert.strictEqual(palette.style.display, "none");

    sp.openCommandPalette();
    assert.strictEqual(palette.style.display, "flex");

    // 3. Filtering commands
    sp.renderFilteredCommands("arena");
    const list = sp.elementMap["cmd-palette-list"];
    assert.strictEqual(list.children.length, 1);
    assert.ok(list.children[0].innerHTML.includes("Model Review Arena"));

    // 4. Empty filter state
    sp.renderFilteredCommands("unknown-command-404");
    assert.ok(list.innerHTML.includes("No matching commands found"));

    // 5. Execute command item
    let executed = false;
    sp.executeCommandPaletteItem({ action: () => { executed = true; } });
    assert.strictEqual(executed, true);
    assert.strictEqual(palette.style.display, "none", "Executing command should close palette");
  });

  await t.test("17. Framework Test Suite Synthesizer: Builds targeted test suite prompts across frameworks and strategies", () => {
    const panel = sp.elementMap["test-synthesizer-panel"];
    
    // 1. Toggle drawer
    panel.style.display = "none";
    sp.toggleTestSynthesizerDrawer();
    assert.strictEqual(panel.style.display, "flex");

    // Ensure all other drawers are closed
    assert.strictEqual(sp.elementMap["settings-panel"].style.display, "none");
    assert.strictEqual(sp.elementMap["history-panel"].style.display, "none");

    // 2. Handle Run Test Synthesizer
    sp.state.demoMode = true;
    sp.state.connection = { status: "connected" };
    sp.state.messages = [];
    sp.elementMap["test-custom-notes"].value = "Mock AuthService and TokenRepository.";

    sp.handleRunTestSynthesizer();

    // Drawer auto-closes
    assert.strictEqual(panel.style.display, "none");

    // Formulates rich prompt
    assert.strictEqual(sp.state.messages.length, 1);
    const promptMsg = sp.state.messages[0].content;
    assert.ok(promptMsg.includes("Jest / Vitest"));
    assert.ok(promptMsg.includes("Boundary & Edge Limits"));
    assert.ok(promptMsg.includes("Mock External APIs & DB"));
    assert.ok(promptMsg.includes("Mock AuthService and TokenRepository."));
  });

  await t.test("18. Multi-Model Review Arena: Dual A/B compare rendering, model validation, and responses", async () => {
    const arenaPanel = sp.elementMap["arena-panel"];
    
    // 1. Toggle drawer
    arenaPanel.style.display = "none";
    sp.toggleArenaDrawer();
    assert.strictEqual(arenaPanel.style.display, "flex");

    // 2. Guard: Prevent running identical models
    sp.elementMap["arena-model-a"].value = "claude-opus-4-6";
    sp.elementMap["arena-model-b"].value = "claude-opus-4-6";
    const toast = sp.elementMap["toast-notification"];
    await sp.handleRunArena();
    assert.ok(toast.textContent.includes("two different models"));

    // 3. Run with different models in demo mode
    sp.state.demoMode = true;
    sp.elementMap["arena-model-a"].value = "claude-opus-4-6";
    sp.elementMap["arena-model-b"].value = "gemini-3.8-flash";
    sp.elementMap["arena-prompt-input"].value = "Full PR Review: evaluate architecture, correctness, logic flaws, and optimizations.";
    sp.state.messages = [];

    await sp.handleRunArena();

    // Arena panel auto-closes
    assert.strictEqual(arenaPanel.style.display, "none");

    // State messages populated with user prompt + Model A + Model B responses
    assert.strictEqual(sp.state.messages.length, 3);
    assert.strictEqual(sp.state.messages[0].role, "user");
    assert.strictEqual(sp.state.messages[1].role, "assistant");
    assert.ok(sp.state.messages[1].author.includes("Claude Opus 4.6"));
    assert.strictEqual(sp.state.messages[2].role, "assistant");
    assert.ok(sp.state.messages[2].author.includes("Gemini 3.8 Flash"));

    // Messages container has arena wrapper with split container
    const messagesEl = sp.elementMap["messages"];
    const arenaWrapper = messagesEl.children.find(c => c.classList.contains("arena-wrapper"));
    assert.ok(arenaWrapper, "Messages must contain arena-wrapper element");
  });
});

