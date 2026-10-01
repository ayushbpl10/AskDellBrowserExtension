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
      return null;
    }
    querySelectorAll(sel) {
      return [];
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    remove() {}
  }

  // Pre-seed elements mapped by ID
  const elementMap = {
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
    "toast-notification": new MockElement("div")
  };

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
        return null;
      },
      querySelectorAll: (sel) => [],
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
        writeText: (t) => Promise.resolve()
      }
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
      handleJoinSession
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
      version: "2.2.1",
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
});
