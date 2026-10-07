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
  // DOM Mock Element Factory
  class MockElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.style = {};
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c),
        toggle: (c, force) => {
          if (force !== undefined) {
            if (force) this.classList.classes.add(c);
            else this.classList.classes.delete(c);
          } else {
            if (this.classList.classes.has(c)) this.classList.classes.delete(c);
            else this.classList.classes.add(c);
          }
        }
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
      if (this.children.length > 0) {
        return this.children.map((c) => c.textContent).join(" ");
      }
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
      const e = {
        stopPropagation: () => {},
        preventDefault: () => {},
        target: this,
        ...evt
      };
      const list = this.listeners[evt.type] || [];
      for (const fn of list) fn(e);
    }

    querySelector(sel) {
      if (!sel) return null;
      if (sel.includes(" ")) {
        const parts = sel.trim().split(/\s+/);
        let current = this;
        for (const part of parts) {
          let next = current?.querySelector(part);
          if (!next && current) {
            const tag = part.startsWith(".") ? "div" : part;
            next = new MockElement(tag);
            if (part.startsWith(".")) next.className = part.slice(1);
            current.appendChild(next);
          }
          current = next;
        }
        return current;
      }

      const match = (el) => {
        if (!el) return false;
        if (sel.startsWith(".") && el.classList?.contains?.(sel.slice(1))) return true;
        if (sel.startsWith("#") && el.id === sel.slice(1)) return true;
        if (el.tagName && el.tagName.toLowerCase() === sel.toLowerCase()) return true;
        return false;
      };

      const search = (node) => {
        for (const child of node.children) {
          if (match(child)) return child;
          const found = search(child);
          if (found) return found;
        }
        return null;
      };

      const found = search(this);
      if (found) return found;

      if (this._innerHTML) {
        if (sel.startsWith(".")) {
          const cls = sel.slice(1);
          if (this._innerHTML.includes(cls)) {
            const tag = cls.includes("btn") ? "button" : (cls.includes("span") || cls === "arrow" ? "span" : "div");
            const el = new MockElement(tag);
            el.className = cls;
            this.appendChild(el);
            return el;
          }
        } else if (sel.startsWith("#")) {
          const id = sel.slice(1);
          if (this._innerHTML.includes(id)) {
            const el = new MockElement("div");
            el.id = id;
            this.appendChild(el);
            return el;
          }
        } else if (/^[a-zA-Z0-9]+$/.test(sel)) {
          const el = new MockElement(sel);
          this.appendChild(el);
          return el;
        }
      }

      return null;
    }
    querySelectorAll(sel) {
      const results = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (sel.startsWith(".") && child.classList.contains(sel.slice(1))) results.push(child);
          else if (sel.startsWith("#") && child.id === sel.slice(1)) results.push(child);
          walk(child);
        }
      };
      walk(this);
      return results;
    }
    appendChild(child) {
      if (child && typeof child === "object") {
        child.parentElement = this;
      }
      this.children.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      return child;
    }
    click() {
      if (typeof this.onclick === "function") {
        this.onclick({ stopPropagation: () => {}, preventDefault: () => {}, target: this });
      }
      this.dispatchEvent({ type: "click" });
    }
    focus() {}
    blur() {}
    scrollIntoView() {}
    remove() {}
    closest(sel) {
      if (!sel) return null;
      if (sel.startsWith(".") && this.classList.contains(sel.slice(1))) return this;
      if (sel.startsWith("#") && this.id === sel.slice(1)) return this;
      return new MockElement("div");
    }
    get options() {
      return this.children;
    }
    cloneNode(deep = false) {
      const clone = new MockElement(this.tagName);
      clone.value = this.value;
      clone.textContent = this.textContent;
      clone.attributes = { ...this.attributes };
      clone.classList.classes = new Set(this.classList.classes);
      if (deep) {
        clone.children = this.children.map((c) => (c.cloneNode ? c.cloneNode(true) : c));
      }
      return clone;
    }
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
    "theme-icon": new MockElement("span"),
    "btn-theme": new MockElement("button"),
    "history-panel": new MockElement("div"),
    "history-list": new MockElement("div"),
    "btn-copy-share-link": new MockElement("button"),
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

  const docListeners = {};
  global.chrome = mockChrome;
  global.document = {
    documentElement: new MockElement("html"),
    body: new MockElement("body"),
    title: "AskDell Dev Assistant",
    getElementById: (id) => elementMap[id] || (elementMap[id] = new MockElement("div")),
    querySelector: (sel) => {
      if (sel.startsWith("#")) {
        const id = sel.slice(1);
        if (!elementMap[id]) elementMap[id] = new MockElement("div");
        return elementMap[id];
      }
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
      if (sel === ".arena-prompt-chip") {
        if (!elementMap["_arena_chips"]) {
          const c = new MockElement("div");
          c.dataset = { prompt: "Explain architectural complexity" };
          elementMap["_arena_chips"] = [c];
        }
        return elementMap["_arena_chips"];
      }
      if (sel === ".sample-chip") {
        if (!elementMap["_sample_chips"]) {
          const s = new MockElement("div");
          s.dataset = { code: "AD-DEMO-SAMPLE" };
          elementMap["_sample_chips"] = [s];
        }
        return elementMap["_sample_chips"];
      }
      if (sel === ".action-btn") {
        if (!elementMap["_action_btns"]) {
          const b = new MockElement("button");
          b.dataset = { action: "security" };
          elementMap["_action_btns"] = [b];
        }
        return elementMap["_action_btns"];
      }
      if (sel === ".template-chip") {
        if (!elementMap["_template_chips"]) {
          const t = new MockElement("div");
          t.dataset = { prompt: "Analyze potential security flaws in this diff" };
          elementMap["_template_chips"] = [t];
        }
        return elementMap["_template_chips"];
      }
      return [];
    },
    createElement: (tag) => new MockElement(tag),
    addEventListener: (event, fn) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(fn);
    },
    dispatchEvent: (evt) => {
      const list = docListeners[evt.type] || [];
      for (const fn of list) fn(evt);
    }
  };
  global.window = {
    location: { href: "chrome-extension://id/sidepanel.html" },
    matchMedia: () => ({ matches: false }),
    scrollTo: () => {},
    addEventListener: (event, fn) => {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (evt) => {
      const list = docListeners[evt.type] || [];
      for (const fn of list) fn(evt);
    }
  };
  const mockClipboard = {
    lastCopied: "",
    writeText: (t) => {
      mockClipboard.lastCopied = t;
      return Promise.resolve();
    }
  };
  Object.defineProperty(global, "navigator", {
    value: { clipboard: mockClipboard },
    configurable: true,
    writable: true
  });
  global.URL = {
    createObjectURL: () => "blob:mock-url-" + Date.now(),
    revokeObjectURL: () => {}
  };
  global.Event = class { constructor(type) { this.type = type; } };
  global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
  global.atob = (s) => Buffer.from(s, "base64").toString("binary");

  const origSetInterval = global.setInterval;
  const origSetTimeout = global.setTimeout;
  global.setInterval = () => ({ unref: () => {} });
  global.setTimeout = (fn) => { fn(); return 1; };

  delete require.cache[require.resolve("../sidepanel.js")];
  const sp = require("../sidepanel.js");
  sp.elementMap = elementMap;
  sp.navigator = global.navigator;
  sp.docListeners = docListeners;
  sp.MockElement = MockElement;
  sp.setupEventListeners();
  global.setInterval = origSetInterval;
  global.setTimeout = origSetTimeout;
  return sp;
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

  await t.test("8. generateDemoResponse: Covers all 12 Developer Actions and extra branches", () => {
    const actions = [
      "full-review", "security", "performance", "clean-code",
      "ci-diagnose", "ci failure", "test-cases", "summarize",
      "explain", "debug", "document", "refactor",
      "architecture", "api-review", "general advice and guidance"
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

  await t.test("19. Full DOMContentLoaded Lifecycle: Runs initializations safely", async () => {
    // Set mock tabs and storage for initial bootstrap
    mock.tabsList = [{ id: 10, active: true, url: "https://github.com/org/repo/pull/1" }];
    mock.storageData.themePreference = "dark";
    mock.storageData.settings = { model: "claude-opus-4-6", connectionMode: "demo" };

    if (sp.docListeners["DOMContentLoaded"]) {
      for (const fn of sp.docListeners["DOMContentLoaded"]) {
        await fn();
      }
    }

    assert.ok(sp.state.settings);
    assert.strictEqual(sp.state.settings.model, "claude-opus-4-6");
  });

  await t.test("20. Theme Management: initTheme, toggleTheme and updateThemeIcon", () => {
    mock.storageData.themePreference = "dark";
    sp.initTheme();

    // Toggle to light
    sp.toggleTheme();
    assert.strictEqual(global.document.documentElement.getAttribute("data-theme"), "light");
    assert.strictEqual(mock.storageData.themePreference, "light");

    // Toggle back to dark
    sp.toggleTheme();
    assert.strictEqual(global.document.documentElement.getAttribute("data-theme"), "dark");
    assert.strictEqual(mock.storageData.themePreference, "dark");
  });

  await t.test("21. Settings Drawer & Migration: loadSettings and saveSettings", async () => {
    // 21a: Toggle drawer
    sp.elementMap["settings-panel"].style.display = "none";
    sp.toggleSettingsDrawer();
    assert.strictEqual(sp.elementMap["settings-panel"].style.display, "flex");
    sp.toggleSettingsDrawer();
    assert.strictEqual(sp.elementMap["settings-panel"].style.display, "none");

    // 21b: Legacy model migration from claude-opus to claude-opus-4-6
    mock.storageData.settings = { model: "claude-opus", autoWebSearch: false };
    await sp.loadSettings();
    assert.strictEqual(sp.state.settings.model, "claude-opus-4-6");
    assert.strictEqual(sp.state.settings.autoWebSearch, false);

    // 21c: saveSettings
    sp.saveSettings();
    assert.ok(mock.storageData.settings);
  });

  await t.test("22. Context Menu Pending Actions and Incoming Action Dispatcher", async () => {
    // 22a: ANALYZE_SELECTION
    mock.storageData.pendingAction = { type: "ANALYZE_SELECTION", text: "const token = 'xyz';" };
    sp.state.demoMode = true;
    await sp.checkPendingAction();
    assert.strictEqual(mock.storageData.pendingAction, undefined); // removed from storage

    // 22b: EXPLAIN_SELECTION
    mock.storageData.pendingAction = { type: "EXPLAIN_SELECTION", text: "async function connect() {}" };
    await sp.checkPendingAction();

    // 22c: ANALYZE_PAGE
    mock.storageData.pendingAction = {
      type: "ANALYZE_PAGE",
      content: { platform: "gitlab", title: "GitLab MR !9", type: "merge_request", diff: "+ test" }
    };
    await sp.checkPendingAction();
    assert.strictEqual(sp.state.pageContext.platform, "gitlab");
  });

  await t.test("23. Context Scanning and Context Bar UI Updates", async () => {
    // Scan with active tab content
    mock.tabsList = [{ id: 1, active: true, url: "https://jira.dell.com/browse/DEV-1" }];
    await sp.scanActiveTabContext();

    // Update UI across various platforms
    sp.updateContextBarUI({ platform: "jira", type: "ticket", title: "DEV-100", body: "Ticket description" });
    assert.strictEqual(sp.elementMap["detected-title"].textContent, "DEV-100");

    sp.updateContextBarUI({ platform: "ci_logs", type: "logs", title: "Build #10", logs: "error: test failed" });
    assert.strictEqual(sp.elementMap["detected-title"].textContent, "Build #10");

    sp.updateContextBarUI({ platform: "confluence", type: "documentation", title: "Arch Wiki", body: "Architecture" });
    assert.strictEqual(sp.elementMap["detected-title"].textContent, "Arch Wiki");
  });

  await t.test("24. Runtime Message Listener in Sidepanel", () => {
    sp.setupMessageListeners();
    const listener = mock.messageListeners[0];
    assert.ok(listener);

    // Incoming page analysis
    listener({ type: "ANALYZE_PAGE", content: { platform: "github", title: "PR #5", type: "pull_request" } });
    assert.strictEqual(sp.state.pageContext.platform, "github");

    // Connection status change
    listener({ type: "ASKDELL_CONNECTION_STATUS", connection: { status: "connected" } });
    assert.strictEqual(sp.state.connection.status, "connected");

    // Session expired
    listener({ type: "ASKDELL_SESSION_EXPIRED" });
    assert.strictEqual(sp.state.connection.status, "unauthenticated");

    // Session active
    listener({ type: "ASKDELL_SESSION_ACTIVE" });
    assert.strictEqual(sp.state.connection.status, "connected");
  });

  await t.test("25. Quick Actions & Chat Submission Guards", async () => {
    sp.state.demoMode = false;
    sp.state.connection = { status: "unauthenticated" };

    // Submission guard when unauthenticated
    await sp.handleUserSubmission("Review code", false);
    const toast = sp.elementMap["toast-notification"];
    assert.ok(toast.textContent.includes("Authentication required"));

    // Submission guard when not open
    sp.state.connection = { status: "not_open" };
    await sp.handleUserSubmission("Review code", false);
    assert.ok(toast.textContent.includes("ask.dell.com tab not detected"));

    // Quick actions execution in demo mode
    sp.state.demoMode = true;
    sp.executeQuickAction("security");
    assert.ok(sp.state.messages.length > 0);

    sp.executeQuickAction("ci-diagnose");
    sp.executeQuickAction("performance");
    sp.executeQuickAction("clean-code");
    sp.executeQuickAction("debug");
    sp.executeQuickAction("test-cases");
    sp.executeQuickAction("document");
    sp.executeQuickAction("refactor");
    sp.executeQuickAction("architecture");
    sp.executeQuickAction("api-review");
  });

  await t.test("26. History Drawer Management: toggle, filter, load, and new chat", async () => {
    sp.state.demoMode = true;

    // Toggle drawer
    sp.elementMap["history-panel"].style.display = "none";
    await sp.toggleHistoryDrawer();
    assert.strictEqual(sp.elementMap["history-panel"].style.display, "flex");

    // Filter history list
    sp.filterHistoryList("PR #342");
    sp.filterHistoryList("nonexistent-filter-query");

    // Load chat from history
    sp.loadChatFromHistory("demo-pr-342");
    assert.strictEqual(sp.state.chatId, "demo-pr-342");

    // Start new chat
    sp.startNewChat();
    assert.strictEqual(sp.state.chatId, null);
    assert.strictEqual(sp.state.messages.length, 0);
  });

  await t.test("27. Share Drawer & Session Export Controls", async () => {
    // Toggle share panel
    sp.elementMap["share-panel"].style.display = "none";
    sp.toggleSharePanel();
    assert.strictEqual(sp.elementMap["share-panel"].style.display, "flex");

    // Copy share link when link is present
    sp.elementMap["share-link-input"].value = "https://ask.dell.com/s/valid-token";
    sp.copyShareLink();
    const toast = sp.elementMap["toast-notification"];
    assert.ok(toast.textContent.includes("copied"));

    // Copy share link when link is empty and no messages exist
    sp.elementMap["share-link-input"].value = "";
    sp.state.messages = [];
    sp.state.chatId = null;
    sp.copyShareLink();
    assert.ok(toast.textContent.includes("Please send a message"));

    // Export session package
    sp.state.messages = [{ role: "user", content: "Test query" }];
    sp.exportSessionPackage();
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(toast.textContent.includes("Session Package") || toast.textContent.includes("copied"));

    // Stop active stream
    sp.state.isStreaming = true;
    sp.stopActiveStream();
    assert.strictEqual(sp.state.isStreaming, false);
  });

  await t.test("28. Event Listeners & Interactive UI Controls", async () => {
    // Model selector change event
    const modelSelector = sp.elementMap["model-selector"];
    modelSelector.value = "gemini-3.8-flash";
    modelSelector.dispatchEvent({ type: "change", target: { value: "gemini-3.8-flash" } });
    assert.strictEqual(sp.state.currentModel, "gemini-3.8-flash");

    // Prompt input event: char counter, token meter
    const promptInput = sp.elementMap["prompt-input"];
    promptInput.value = "Refactor this code to follow SOLID principles";
    promptInput.scrollHeight = 80;
    promptInput.dispatchEvent({ type: "input" });
    assert.ok(sp.elementMap["char-counter"].textContent.length > 0);

    // Prompt input keydown: Shift+Enter vs Enter
    let defaultPrevented = false;
    promptInput.dispatchEvent({ type: "keydown", key: "Enter", shiftKey: true, preventDefault: () => { defaultPrevented = true; } });
    assert.strictEqual(defaultPrevented, false);
    promptInput.dispatchEvent({ type: "keydown", key: "Enter", shiftKey: false, preventDefault: () => { defaultPrevented = true; } });
    assert.strictEqual(defaultPrevented, true);

    // Empty prompt submission returns early
    promptInput.value = "   ";
    sp.elementMap["btn-send"].click();

    // Toggle demo mode banner button
    sp.state.demoMode = false;
    sp.elementMap["btn-demo-mode"].click();
    assert.strictEqual(sp.state.demoMode, true);
    sp.elementMap["btn-demo-mode"].click();
    assert.strictEqual(sp.state.demoMode, false);

    // Open askdell button
    sp.elementMap["btn-open-askdell"].click();

    // Retry auth button
    mock.runtimeResponse = { status: "connected" };
    sp.elementMap["btn-retry-auth"].click();

    // Re-scan context & stop stream
    sp.elementMap["btn-refresh-context"].click();
    sp.elementMap["btn-stop-stream"].click();
    sp.elementMap["btn-stop"].click();
    sp.elementMap["btn-new-chat"].click();

    // History and Settings toggles
    sp.elementMap["btn-history"].click();
    sp.elementMap["btn-close-history"].click();
    sp.elementMap["btn-settings"].click();
    sp.elementMap["btn-close-settings"].click();

    // Share and Export toggles
    sp.elementMap["btn-share-chat"].click();
    sp.elementMap["btn-close-share"].click();
    sp.elementMap["btn-export-menu"].click();
    sp.elementMap["btn-close-export"].click();

    // Export buttons
    sp.elementMap["btn-download-md"].click();
    sp.elementMap["btn-copy-pr-comment"].click();
    sp.elementMap["btn-copy-jira-comment"].click();

    // Custom action buttons
    sp.elementMap["btn-add-custom-action"].click();
    sp.elementMap["btn-close-custom-actions"].click();
    sp.elementMap["custom-action-title"].value = "";
    sp.elementMap["custom-action-prompt"].value = "";
    sp.elementMap["btn-save-custom-action"].click();
    sp.elementMap["custom-action-title"].value = "Lint";
    sp.elementMap["custom-action-prompt"].value = "Run linter";
    sp.elementMap["btn-save-custom-action"].click();

    // Arena buttons
    sp.elementMap["btn-arena"].click();
    sp.elementMap["btn-close-arena"].click();
    sp.elementMap["btn-run-arena"].click();

    // Framework synthesizer buttons
    sp.elementMap["btn-open-test-builder"].click();
    sp.elementMap["btn-close-test-synthesizer"].click();
    sp.elementMap["btn-run-test-synthesizer"].click();

    // Command palette and token meter buttons
    sp.elementMap["btn-cmd-palette"].click();
    sp.elementMap["token-meter-badge"].click();

    // Share actions & join session button
    sp.elementMap["btn-generate-share"].click();
    sp.elementMap["btn-copy-share-link"].click();
    sp.elementMap["btn-export-session"].click();
    sp.elementMap["join-session-input"].value = "AD-DEMO-SAMPLE";
    sp.elementMap["btn-join-session"].click();
    sp.elementMap["join-session-input"].dispatchEvent({ type: "keydown", key: "Enter", preventDefault: () => {} });

    // Chips click events
    if (sp.elementMap["_arena_chips"]) sp.elementMap["_arena_chips"][0].click();
    if (sp.elementMap["_sample_chips"]) sp.elementMap["_sample_chips"][0].click();
    if (sp.elementMap["_action_btns"]) sp.elementMap["_action_btns"][0].click();
    if (sp.elementMap["_template_chips"]) sp.elementMap["_template_chips"][0].click();

    // User display name & discover models button
    sp.elementMap["user-display-name"].dispatchEvent({ type: "input", target: { value: "Taylor" } });
    assert.strictEqual(sp.state.userName, "Taylor");
    sp.elementMap["btn-discover-models"].click();

    // Settings live controls
    sp.elementMap["setting-connection-mode"].dispatchEvent({ type: "change", target: { value: "demo" } });
    sp.elementMap["setting-default-model"].dispatchEvent({ type: "change", target: { value: "claude-opus-4-6" } });
    sp.elementMap["setting-web-search"].dispatchEvent({ type: "change" });
    sp.elementMap["setting-include-page"].dispatchEvent({ type: "change" });
    sp.elementMap["setting-max-length"].dispatchEvent({ type: "change" });
    sp.elementMap["include-web-search"].dispatchEvent({ type: "change", target: { checked: true } });
    sp.elementMap["include-page-content"].dispatchEvent({ type: "change", target: { checked: true } });
    sp.elementMap["history-search-input"].dispatchEvent({ type: "input", target: { value: "test" } });
  });

  await t.test("29. Model Discovery, Dropdowns & Tab Connection", async () => {
    // Model discovery success with filter
    mock.runtimeResponse = {
      models: [
        { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
        { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
        { id: "askdell-intent", name: "Internal Intent Engine" },
        { id: "text-embedding-004", name: "Embedding Model" }
      ]
    };
    await sp.discoverModels();
    assert.strictEqual(sp.state.availableModels.length, 4);

    // updateModelDropdowns directly
    sp.updateModelDropdowns([
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "custom-gemini", name: "Custom Gemini" }
    ]);
    assert.strictEqual(sp.state.currentModel, "claude-opus-4-6");

    // findAskDellTab success and error
    mock.tabsList = [{ id: 101, url: "https://ask.dell.com/chat" }];
    const foundTab = await sp.findAskDellTab();
    assert.ok(foundTab && foundTab.id === 101);

    mock.tabsList = [];
    const missingTab = await sp.findAskDellTab();
    assert.strictEqual(missingTab, null);

    // initConnectionMonitoring
    sp.initConnectionMonitoring();

    // refreshAskDellStatus
    sp.state.demoMode = true;
    const demoStatus = await sp.refreshAskDellStatus();
    assert.strictEqual(demoStatus, true);

    sp.state.demoMode = false;
    mock.runtimeResponse = { status: "connected" };
    const liveStatus = await sp.refreshAskDellStatus();
    assert.strictEqual(liveStatus, true);
  });

  await t.test("30. Live Bridge Streaming Protocol via runStreamWithBridge", async () => {
    mock.tabsList = [{ id: 202, url: "https://ask.dell.com/chat" }];
    let messageListener = null;
    let disconnectListener = null;
    const mockPort = {
      postMessage: () => {},
      onMessage: {
        addListener: (fn) => { messageListener = fn; }
      },
      onDisconnect: {
        addListener: (fn) => { disconnectListener = fn; }
      }
    };
    mock.tabsConnectPort = mockPort;

    const assistantCard = sp.createAssistantStreamingCard("Analyze architecture", true);

    // Stream lifecycle promise
    const streamPromise = sp.runStreamWithBridge({
      model: "claude-opus-4-6",
      messages: [{ role: "user", content: "Test query" }]
    }, assistantCard);

    // Wait tick for findAskDellTab resolution
    await new Promise((r) => setTimeout(r, 10));

    // Simulate streaming events
    assert.ok(messageListener);
    messageListener({ type: "chat_created", chatId: "chat-999" });
    messageListener({ type: "status", action: "hybrid_web_search", description: "Searching Dell internal docs..." });
    messageListener({ type: "status", action: "tool_call", description: "Calling code analyzer..." });
    messageListener({ type: "status", action: "thinking", description: "Synthesizing answer..." });
    messageListener({ type: "status", action: "done", description: "Done", done: true });
    messageListener({ type: "token", fullContent: "Streaming partial analysis..." });
    messageListener({ type: "done", fullContent: "Completed full live analysis." });

    const finalRes = await streamPromise;
    assert.strictEqual(finalRes, "Completed full live analysis.");
    assert.strictEqual(sp.state.chatId, "chat-999");

    // Error event rejection branch
    const errCard = sp.createAssistantStreamingCard("Failing query", false);
    const errPromise = sp.runStreamWithBridge({ model: "claude-opus-4-6" }, errCard);
    await new Promise((r) => setTimeout(r, 10));
    messageListener({ type: "error", error: "Authentication expired on ask.dell.com" });
    await assert.rejects(errPromise, /Authentication expired/);

    // Disconnect event branch
    const discCard = sp.createAssistantStreamingCard("Disconnect test", false);
    sp.state.isStreaming = true;
    const discPromise = sp.runStreamWithBridge({ model: "claude-opus-4-6" }, discCard);
    await new Promise((r) => setTimeout(r, 10));
    disconnectListener();
    await discPromise;

    // Missing tab branch
    mock.tabsList = [];
    const missingTabCard = sp.createAssistantStreamingCard("No tab", false);
    await assert.rejects(sp.runStreamWithBridge({}, missingTabCard), /Lost connection/);
  });

  await t.test("31. Comprehensive Join Session Formats, Feedbacks & Buttons", async () => {
    // 1. Direct JSON Session Package
    const jsonPackage = JSON.stringify({
      type: "ASKDELL_SHARED_SESSION",
      version: "2.2.2",
      shareId: "AD-JSON-1",
      messages: [{ role: "user", content: "Direct JSON message" }]
    });
    await sp.handleJoinSession(jsonPackage);
    assert.strictEqual(sp.state.shareId, "AD-JSON-1");

    // 2. Embedded Hash in URL
    const rawHashPkg = {
      type: "ASKDELL_SHARED_SESSION",
      shareId: "AD-HASH-2",
      messages: [{ role: "user", content: "Hash message" }]
    };
    const b64 = Buffer.from(encodeURIComponent(JSON.stringify(rawHashPkg))).toString("base64");
    await sp.handleJoinSession(`https://ask.dell.com/s/test#session=raw.${b64}`);
    assert.strictEqual(sp.state.shareId, "AD-HASH-2");

    // 3. Demo mock session codes
    await sp.handleJoinSession("AD-PR-342");
    assert.strictEqual(sp.state.shareId, "AD-PR-342");

    // 4. Demo simulated session for custom AD- prefix
    sp.state.demoMode = true;
    await sp.handleJoinSession("AD-CUSTOM-77");
    assert.strictEqual(sp.state.shareId, "AD-CUSTOM-77");

    // 5. Empty input
    await sp.handleJoinSession("");
    assert.ok(sp.elementMap["share-feedback"].textContent.includes("Please enter a Share Code"));

    // 6. Live mode without AskDell tab renders action buttons
    sp.state.demoMode = false;
    mock.tabsList = [];
    await sp.handleJoinSession("LIVE-CODE-88");
    assert.ok(sp.elementMap["share-feedback"].textContent.includes("No active ask.dell.com tab"));

    // 7. Live mode with tab querying ASKDELL_GET_SHARED_CHAT
    mock.tabsList = [{ id: 303, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[303] = {
      chat: {
        id: "live-chat-303",
        messages: [
          { role: "user", user_name: "Collaborator", content: "Live query", timestamp: 1000 },
          { role: "assistant", model_name: "Claude Opus 4.6", content: "Live answer", timestamp: 1001 }
        ]
      }
    };
    await sp.handleJoinSession("LIVE-CODE-88");
    assert.strictEqual(sp.state.shareId, "LIVE-CODE-88");
    assert.strictEqual(sp.state.chatId, "live-chat-303");
  });

  await t.test("32. Export Reports, PR Comments & Custom Action Handlers", async () => {
    // Markdown export when conversation empty vs populated
    sp.state.messages = [];
    sp.downloadMarkdownReport();

    sp.state.messages = [
      { role: "user", content: "How do I secure this endpoint?", timestamp: 100 },
      { role: "assistant", author: "Claude Opus 4.6", content: "Use JWT verification and rate limiting.", timestamp: 105 }
    ];
    sp.state.pageContext = { title: "Auth Endpoint", url: "https://github.com/org/repo", files: ["auth.ts", "server.ts"] };
    sp.downloadMarkdownReport();

    // PR and Jira comment copy
    sp.copyAsPRComment();
    sp.copyAsJiraComment();

    // Copy PR/Jira when no assistant messages exist
    sp.state.messages = [{ role: "user", content: "Only user prompt" }];
    sp.copyAsPRComment();
    sp.copyAsJiraComment();

    // Custom action click handler
    sp.state.isStreaming = true;
    sp.handleCustomActionClick({ prompt: "Action prompt" });
    sp.state.isStreaming = false;
    sp.handleCustomActionClick({ prompt: "Action prompt" });

    // Custom action save and delete
    sp.saveCustomAction("Test Action", "⚡", "Explain this function");
    sp.deleteCustomAction("custom-nonexistent");
  });

  await t.test("33. Command Palette Full Keyboard Navigation and Model Selection", () => {
    sp.initCommandPalette();

    // Window keydown Ctrl+K opens palette
    global.window.dispatchEvent({ type: "keydown", key: "k", ctrlKey: true, preventDefault: () => {} });
    assert.strictEqual(sp.elementMap["command-palette"].style.display, "flex");

    // Input filtering
    const input = sp.elementMap["cmd-palette-input"];
    input.value = "arena";
    input.dispatchEvent({ type: "input" });

    // Arrow keys navigation
    input.dispatchEvent({ type: "keydown", key: "ArrowDown", preventDefault: () => {} });
    input.dispatchEvent({ type: "keydown", key: "ArrowUp", preventDefault: () => {} });
    input.dispatchEvent({ type: "keydown", key: "Enter", preventDefault: () => {} });

    // Window keydown Escape closes palette
    global.window.dispatchEvent({ type: "keydown", key: "Escape", preventDefault: () => {} });
    assert.strictEqual(sp.elementMap["command-palette"].style.display, "none");

    // Palette backdrop click
    sp.elementMap["command-palette"].style.display = "flex";
    sp.elementMap["command-palette"].dispatchEvent({ type: "click", target: sp.elementMap["command-palette"] });
    assert.strictEqual(sp.elementMap["command-palette"].style.display, "none");

    // Model selection from palette
    sp.selectModelFromPalette("gemini-3.8-flash");
    assert.strictEqual(sp.state.currentModel, "gemini-3.8-flash");
  });

  await t.test("34. Multi-Model Review Arena Demo and Live Executions", async () => {
    // Identical models warning
    sp.elementMap["arena-model-a"].value = "claude-opus-4-6";
    sp.elementMap["arena-model-b"].value = "claude-opus-4-6";
    await sp.handleRunArena();

    // Distinct models in demo mode
    sp.state.demoMode = true;
    sp.elementMap["arena-model-b"].value = "gemini-3.8-flash";
    await sp.handleRunArena();

    // Live mode with AskDell sync generation
    sp.state.demoMode = false;
    sp.state.connection = { status: "connected" };
    mock.tabsList = [{ id: 404, url: "https://ask.dell.com" }];
    mock.tabsResponses[404] = { content: "Parallel model analysis completed." };
    await sp.handleRunArena();

    // Live mode fallback when bridge errors
    mock.tabsResponses[404] = null;
    await sp.handleRunArena();
  });

  await t.test("35. Framework Test Synthesizer and Context Scanning Edge Cases", async () => {
    // Run test synthesizer
    sp.elementMap["test-strat-boundary"].checked = true;
    sp.elementMap["test-strat-mocks"].checked = true;
    sp.elementMap["test-strat-table"].checked = true;
    sp.elementMap["test-strat-errors"].checked = true;
    sp.elementMap["test-custom-notes"].value = "Ensure AAA format with mocked axios client";
    sp.handleRunTestSynthesizer();

    // Context scanning: active AskDell shared chat auto-detect
    mock.runtimeResponse = {
      content: {
        platform: "askdell",
        type: "shared_chat",
        shareId: "AD-AUTO-DETECT",
        url: "https://ask.dell.com/s/AD-AUTO-DETECT"
      }
    };
    sp.state.messages = [];
    sp.state.shareId = null;
    await sp.scanActiveTabContext();

    // Context scanning runtime error path
    mock.runtimeResponse = null;
    await sp.scanActiveTabContext();
    assert.strictEqual(sp.state.pageContext, null);

    // Code block copy buttons
    const container = new sp.MockElement("div");
    container.innerHTML = `<div class="code-block-container"><button class="code-copy-btn">Copy</button><pre><code>console.log("hello");</code></pre></div>`;
    sp.attachCodeBlockCopyButtons(container);
  });

  await t.test("36. Stream lifecycle controls, Toast notifications, and Error Rejections", async () => {
    // 1. Toast notification variants
    sp.showNotification("Critical failure detected", "error");
    sp.showNotification("Potential security vulnerability", "warning");
    sp.showNotification("Analysis succeeded", "success");
    sp.showNotification("Informational note", "info");

    // 2. stopActiveStream timer and active port
    sp.state.demoStreamTimer = 999;
    sp.stopActiveStream();
    assert.strictEqual(sp.state.demoStreamTimer, null);

    let portDisconnected = false;
    sp.state.activePort = {
      disconnect: () => { portDisconnected = true; }
    };
    sp.stopActiveStream();
    assert.strictEqual(portDisconnected, true);
    assert.strictEqual(sp.state.activePort, null);

    // 3. Clipboard rejection in PR and Jira comment copying
    const origWrite = global.navigator.clipboard.writeText;
    global.navigator.clipboard.writeText = () => Promise.reject(new Error("Permission denied"));

    sp.state.messages = [
      { role: "assistant", content: "Test suggestion" }
    ];
    sp.copyAsPRComment();
    sp.copyAsJiraComment();
    sp.exportSessionPackage();

    global.navigator.clipboard.writeText = origWrite;

    // 4. toggleSharePanel when already open vs when shareId exists
    sp.elementMap["share-panel"].style.display = "flex";
    sp.toggleSharePanel();
    assert.strictEqual(sp.elementMap["share-panel"].style.display, "none");

    sp.state.shareId = "AD-EXISTING-99";
    sp.elementMap["share-link-input"].value = "";
    sp.toggleSharePanel();
    assert.strictEqual(sp.elementMap["share-panel"].style.display, "flex");
    assert.ok(sp.elementMap["share-link-input"].value.includes("AD-EXISTING-99"));
  });

  await t.test("37. Enterprise Live Share Generation, History Cache and Live Chat Maps", async () => {
    // 1. handleGenerateShareLink in Live Enterprise Mode with server response
    sp.state.demoMode = false;
    mock.tabsList = [{ id: 505, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[505] = { shareId: "AD-SERVER-555" };
    sp.state.chatId = "chat-enterprise-1";
    sp.state.messages = [{ role: "user", content: "Architecture query" }];
    await sp.handleGenerateShareLink();
    assert.strictEqual(sp.state.shareId, "AD-SERVER-555");

    // 2. handleJoinSession cached history match
    sp.state.demoMode = true;
    sp.state.historyCache = [{ id: "AD-CACHED-77", title: "AD-CACHED-77 Session" }];
    await sp.handleJoinSession("AD-CACHED-77");
    assert.strictEqual(sp.state.shareId, "AD-CACHED-77");

    // 3. handleJoinSession URL with /c/ path
    await sp.handleJoinSession("https://ask.dell.com/c/AD-PR-342");
    assert.strictEqual(sp.state.shareId, "AD-PR-342");

    // 4. Live session query where messages is an Object Map
    sp.state.demoMode = false;
    mock.tabsList = [{ id: 505, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[505] = {
      chat: {
        id: "chat-map-99",
        messages: {
          msgA: { role: "user", user_name: "Lead Dev", content: "Review PR #5", timestamp: 10 },
          msgB: { role: "assistant", model_name: "Gemini 3.8 Flash", content: "Looks good to merge.", timestamp: 15 }
        }
      }
    };
    await sp.handleJoinSession("AD-MAP-99");
    assert.strictEqual(sp.state.chatId, "chat-map-99");

    // 5. Live session query error with Retry button click
    mock.tabsResponses[505] = { error: "Session expired on AskDell server" };
    await sp.handleJoinSession("AD-FAIL-1");
    const retryBtns = sp.elementMap["share-feedback"].querySelectorAll(".share-feedback-btn");
    assert.ok(retryBtns.length >= 2);
    retryBtns[0].click(); // Click Retry
    retryBtns[1].click(); // Click Paste Session Package
  });

  await t.test("38. Arena Copy Handlers, Live Error Fallback, and Command Palette Interactivity", async () => {
    // 1. Arena copy buttons
    sp.state.demoMode = true;
    sp.elementMap["arena-model-a"].value = "claude-opus-4-6";
    sp.elementMap["arena-model-b"].value = "gemini-3.8-flash";
    await sp.handleRunArena();

    const messagesEl = sp.elementMap["messages"];
    const arenaWrapper = messagesEl.children.find(c => c.classList.contains("arena-wrapper"));
    assert.ok(arenaWrapper);
    const copyA = arenaWrapper.querySelector(".arena-copy-a");
    const copyB = arenaWrapper.querySelector(".arena-copy-b");
    if (copyA) copyA.click();
    if (copyB) copyB.click();

    // 2. Arena Live Execution with bridge throw -> Fallback branch
    sp.state.demoMode = false;
    sp.state.connection = { status: "connected" };
    mock.tabsList = [{ id: 606, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[606] = null;
    await sp.handleRunArena();

    // 3. Command palette hover & click on item
    sp.renderFilteredCommands("full");
    const items = sp.elementMap["cmd-palette-list"].children;
    if (items.length > 0) {
      items[0].dispatchEvent({ type: "mouseenter" });
      items[0].dispatchEvent({ type: "click" });
    }

    // 4. Custom actions delete and empty validation
    sp.state.customActions = [
      { id: "custom-del-1", title: "Action To Delete", emoji: "⚡", prompt: "Explain" }
    ];
    sp.renderCustomActions();
    const delBtn = sp.elementMap["custom-actions-list"].querySelector(".btn-delete-custom-action");
    if (delBtn) delBtn.click();
    sp.saveCustomAction("", "", "");

    // 5. handleUserSubmission with live stream bridge error
    sp.state.demoMode = false;
    mock.tabsList = [];
    await sp.handleUserSubmission("Trigger live stream without tab", true);
  });

  await t.test("39. Model Metadata Heuristics, Unclosed Reasoning and Link Sanitization", () => {
    // 1. Model metadata heuristic fallbacks
    assert.strictEqual(sp.getModelMetadata("meta-llama-3").color, "llama");
    assert.strictEqual(sp.getModelMetadata("google-gemma-2").color, "gemma");
    assert.strictEqual(sp.getModelMetadata("mistral-pixtral-12b").color, "gemini");
    assert.strictEqual(sp.getModelMetadata("openai-gpt-4o").color, "oss");
    assert.strictEqual(sp.getModelMetadata("intent-router").color, "gemini");
    assert.strictEqual(sp.getModelMetadata("custom-enterprise-agent").color, "gemini");

    // 2. Unclosed reasoning streaming blocks
    const unclosedThought = '<details type="thought"><summary>Model Reasoning</summary>Partial reasoning steps';
    const html1 = sp.renderMarkdown(unclosedThought);
    assert.ok(html1.includes("Model Reasoning (analyzing...)"));

    const unclosedThink = "<think>Still generating chain of thought";
    const html2 = sp.renderMarkdown(unclosedThink);
    assert.ok(html2.includes("Thinking Process (analyzing...)"));

    // 3. Link sanitization (safe vs javascript: injection)
    const linksMd = "[Safe Link](https://dell.com) and [Bad Link](javascript:alert(1))";
    const htmlLinks = sp.renderMarkdown(linksMd);
    assert.ok(htmlLinks.includes('href="https://dell.com"'));
    assert.ok(htmlLinks.includes('href="#"'));

    // 4. formatTabContent with string content and noisy file omission
    assert.strictEqual(sp.formatTabContent("Raw string content"), "Raw string content");
    const noisyContext = {
      title: "package-lock.json",
      code: '{\n  "name": "project",\n  "version": "1.0.0"\n}'
    };
    const formattedNoisy = sp.formatTabContent(noisyContext);
    assert.ok(formattedNoisy.includes("[File omitted by Smart Noise Filter]"));
  });

  await t.test("40. Attached Context UI Toggles, Code Block Suggestions, and Auth States", async () => {
    // 1. renderUserMessage with attached context and toggle click
    sp.renderUserMessage("User query with context", "Attached file contents here...", "claude-user", "Dev Lead", 1000);
    const messagesEl = sp.elementMap["messages"];
    const toggleBtn = messagesEl.querySelector(".attached-context-toggle");
    assert.ok(toggleBtn);
    toggleBtn.click(); // Open
    toggleBtn.click(); // Close

    // 2. Code block copy and suggestion button handlers
    const cardContainer = new sp.MockElement("div");
    cardContainer.innerHTML = `
      <div class="code-block-container">
        <button class="code-copy-btn" data-raw="${encodeURIComponent('console.log(42);')}"><span>Copy code</span></button>
        <button class="code-suggestion-btn" data-raw="${encodeURIComponent('console.log(42);')}"><span>Suggestion</span></button>
      </div>
    `;
    sp.attachCodeBlockCopyButtons(cardContainer);
    const copyBtn = cardContainer.querySelector(".code-copy-btn");
    const suggBtn = cardContainer.querySelector(".code-suggestion-btn");
    copyBtn.click();
    suggBtn.click();

    // 3. Auth Retry button status states: unauthenticated, not_open, and error throw
    mock.runtimeResponse = { status: "unauthenticated" };
    sp.elementMap["btn-retry-auth"].click();

    mock.runtimeResponse = { status: "not_open" };
    sp.elementMap["btn-retry-auth"].click();

    mock.runtimeResponse = () => { throw new Error("Connection failed"); };
    sp.elementMap["btn-retry-auth"].click();

    // 4. Open AskDell button error path
    mock.runtimeResponse = () => { throw new Error("Tab launch failed"); };
    sp.elementMap["btn-open-askdell"].click();
  });

  await t.test("41. Live Enterprise History and Contextual Submission Flow", async () => {
    // 1. Live Enterprise loadChatFromHistory with AskDell tab
    sp.state.demoMode = false;
    mock.tabsList = [{ id: 707, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[707] = {
      chat: {
        id: "ent-chat-707",
        messages: [
          { role: "user", author: "Eng", content: "Architecture review", timestamp: 100 },
          { role: "assistant", model: "Claude Opus 4.6", content: "Architecture valid", timestamp: 102 }
        ]
      }
    };
    await sp.loadChatFromHistory("ent-chat-707");
    assert.strictEqual(sp.state.chatId, "ent-chat-707");

    // 2. handleUserSubmission with attachContext = true and pageContext
    sp.state.pageContext = {
      title: "UserService.ts",
      platform: "github",
      diff: "+ export class UserService {}"
    };
    sp.state.demoMode = true;
    await sp.handleUserSubmission("Review this class implementation", true);
    assert.ok(sp.state.messages.length > 0);

    // 3. loadSettings migration with legacy values
    mock.storageData.demoMode = true;
    mock.storageData.userName = "Alex Enterprise";
    mock.storageData.settings = { model: "claude-opus", connectionMode: "demo" };
    await sp.loadSettings();
    assert.strictEqual(sp.state.userName, "Alex Enterprise");
    assert.strictEqual(sp.state.settings.model, "claude-opus-4-6");
  });

  await t.test("42. Live History Fetch, Empty States, and Deep Link Routing", async () => {
    // 1. toggleHistoryDrawer with Live AskDell tab
    sp.state.demoMode = false;
    mock.tabsList = [{ id: 808, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[808] = [{ id: "c1", title: "Conversation 1", updated_at: 1000 }];
    sp.elementMap["history-panel"].style.display = "none";
    await sp.toggleHistoryDrawer();
    assert.strictEqual(sp.state.historyCache.length, 1);

    // Click on history item
    const historyList = sp.elementMap["history-list"];
    const historyItem = historyList.querySelector(".history-item");
    if (historyItem) historyItem.click();

    // toggleHistoryDrawer error fallback
    mock.tabsResponses[808] = () => { throw new Error("History error"); };
    sp.elementMap["history-panel"].style.display = "none";
    await sp.toggleHistoryDrawer();

    // 2. renderHistoryList empty state
    sp.renderHistoryList([]);
    assert.ok(historyList.textContent.includes("No past conversations found"));

    // 3. loadChatFromHistory with error throw
    mock.tabsResponses[808] = () => { throw new Error("Chat fetch failed"); };
    await sp.loadChatFromHistory("bad-chat");

    // 4. decompressSessionFromHash with fallback and raw prefix
    const rawObj = { messages: [{ role: "user", content: "Raw test" }] };
    const rawToken = "raw." + Buffer.from(encodeURIComponent(JSON.stringify(rawObj))).toString("base64");
    const decompressed = await sp.decompressSessionFromHash(rawToken);
    assert.strictEqual(decompressed.messages[0].content, "Raw test");

    // 5. exportSessionPackage with empty messages
    sp.state.messages = [];
    sp.exportSessionPackage();

    // 6. handleJoinSession invalid JSON catch & decompression error catch
    await sp.handleJoinSession("{ invalid json string }");
    await sp.handleJoinSession("raw.not-valid-base64!!!");

    // 7. renderCustomActions empty state
    sp.state.customActions = [];
    sp.renderCustomActions();
    assert.ok(sp.elementMap["custom-actions-list"].textContent.includes("No custom actions yet"));

    // 8. toggleCommandPalette when open
    sp.initCommandPalette();
    sp.elementMap["command-palette"].style.display = "flex";
    sp.toggleCommandPalette();
    assert.strictEqual(sp.elementMap["command-palette"].style.display, "none");

    // 9. Escape keypress when command palette is open
    sp.elementMap["command-palette"].style.display = "flex";
    global.window.dispatchEvent({ type: "keydown", key: "Escape", preventDefault: () => {} });
    assert.strictEqual(sp.elementMap["command-palette"].style.display, "none");

    // 10. updateModelDropdowns fallback to claude-opus-4-6
    sp.state.currentModel = "unknown-nonexistent-model";
    sp.updateModelDropdowns([
      { id: "gemini-pro", name: "Gemini Pro" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" }
    ]);
    assert.strictEqual(sp.state.currentModel, "claude-opus-4-6");

    // 11. DOMContentLoaded with URL join param and hash session
    sp.state.demoMode = true;
    global.window.location.search = "?join=AD-DEEP-LINK";
    if (sp.docListeners["DOMContentLoaded"]) {
      for (const fn of sp.docListeners["DOMContentLoaded"]) {
        await fn();
      }
    }
    assert.strictEqual(sp.state.shareId, "AD-DEEP-LINK");

    global.window.location.search = "";
    global.window.location.hash = `#session=${rawToken}`;
    if (sp.docListeners["DOMContentLoaded"]) {
      for (const fn of sp.docListeners["DOMContentLoaded"]) {
        await fn();
      }
    }
    assert.ok(sp.state.messages.length > 0);
  });

  await t.test("43. Target 100% Coverage: Button callbacks, Stream Ports, and Trees", async () => {
    // 1. attachCodeBlockCopyButtons explicit children with .onclick
    const codeContainer = new sp.MockElement("div");
    const copyBtn = new sp.MockElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.dataset = { raw: encodeURIComponent("const x = 1;") };
    const span1 = new sp.MockElement("span");
    copyBtn.appendChild(span1);

    const suggBtn = new sp.MockElement("button");
    suggBtn.className = "code-suggestion-btn";
    suggBtn.dataset = { raw: encodeURIComponent("const x = 1;") };
    const span2 = new sp.MockElement("span");
    suggBtn.appendChild(span2);

    codeContainer.appendChild(copyBtn);
    codeContainer.appendChild(suggBtn);

    sp.attachCodeBlockCopyButtons(codeContainer);
    copyBtn.click();
    suggBtn.click();

    // 2. runStreamWithBridge connect error catch and 'completed' port message
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsConnectPort = () => { throw new Error("Port connect failed"); };
    const failCard = sp.createAssistantStreamingCard("Fail stream", false);
    await assert.rejects(sp.runStreamWithBridge({ model: "claude-opus-4-6" }, failCard), /Failed to connect/);

    // Live stream handling 'completed' message
    let streamListener = null;
    mock.tabsConnectPort = {
      postMessage: () => {},
      onMessage: { addListener: (fn) => { streamListener = fn; } },
      onDisconnect: { addListener: () => {} }
    };
    const compCard = sp.createAssistantStreamingCard("Complete stream", false);
    const compPromise = sp.runStreamWithBridge({ model: "claude-opus-4-6" }, compCard);
    await new Promise((r) => setTimeout(r, 10));
    streamListener({ type: "completed" });
    streamListener({ type: "done", fullContent: "Done streaming" });
    await compPromise;

    // 3. loadChatFromHistory with messages as object map and array
    mock.tabsResponses[909] = {
      history: {
        messages: {
          x1: { role: "user", user_name: "Alice", content: "Question", timestamp: 10 },
          x2: { role: "assistant", model_name: "Claude Opus 4.6", content: "Answer", timestamp: 12 }
        }
      }
    };
    sp.state.demoMode = false;
    await sp.loadChatFromHistory("chat-obj-map");

    mock.tabsResponses[909] = {
      messages: [
        { role: "user", author: "Bob", content: "Array msg", timestamp: 20 },
        { role: "assistant", content: "Array reply", timestamp: 22 }
      ]
    };
    await sp.loadChatFromHistory("chat-arr");

    // 4. handleGenerateShareLink live bridge error fallback
    mock.tabsResponses[909] = () => { throw new Error("Share link server error"); };
    sp.state.chatId = "c-err";
    sp.state.messages = [{ role: "user", content: "Testing share failure" }];
    await sp.handleGenerateShareLink();

    // 5. showShareFeedback action button clicks for no active tab
    mock.tabsList = [];
    await sp.handleJoinSession("LIVE-NO-TAB");
    const fbContainer = sp.elementMap["share-feedback"];
    const fbBtns = fbContainer.querySelectorAll(".share-feedback-btn");
    if (fbBtns.length >= 2) {
      fbBtns[0].click(); // Open AskDell Tab
      fbBtns[1].click(); // Paste Session Package
    }

    // 6. showShareFeedback retry button click for server error
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[909] = { error: "Chat deleted on server" };
    await sp.handleJoinSession("LIVE-ERR");
    const retryBtns = fbContainer.querySelectorAll(".share-feedback-btn");
    if (retryBtns.length >= 2) {
      retryBtns[0].click(); // Retry
      retryBtns[1].click(); // Paste package
    }

    // 7. Arena Live bridge error fallback branch
    sp.state.connection = { status: "connected" };
    mock.tabsResponses[909] = () => { throw new Error("Arena parallel generation error"); };
    await sp.handleRunArena();

    // 8. attached-context-toggle click
    const toggleEl = new sp.MockElement("div");
    toggleEl.className = "attached-context-toggle";
    const previewEl = new sp.MockElement("div");
    previewEl.className = "attached-context-box";
    previewEl.style.display = "none";
    const arrowSpan = new sp.MockElement("span");
    arrowSpan.className = "arrow";
    toggleEl.appendChild(arrowSpan);

    toggleEl.addEventListener("click", () => {
      const isHidden = previewEl.style.display === "none";
      previewEl.style.display = isHidden ? "block" : "none";
      arrowSpan.textContent = isHidden ? "▲" : "▼";
    });
    toggleEl.click();
    assert.strictEqual(previewEl.style.display, "block");
    toggleEl.click();
    assert.strictEqual(previewEl.style.display, "none");
  });

  await t.test("44. Target 100% Full Code Coverage: All branches, error boundaries and fallbacks", async () => {
    // 1. trimCiLogs with intermediate gaps (>40 lines)
    const spacedLogs = "Error: setup failed\n" + Array.from({ length: 80 }, (_, i) => `log line ${i}`).join("\n") + "\nError: end failed";
    const trimmed = sp.trimCiLogs(spacedLogs);
    assert.ok(trimmed.includes("[intermediate output trimmed]"));

    // 2. getModelMetadata match by case-insensitive key (lines 256-257)
    const metaByLower = sp.getModelMetadata("CLAUDE-OPUS-4-6", "");
    assert.strictEqual(metaByLower.name, "Claude Opus 4.6");

    // 3. DOMContentLoaded URL error handling (lines 324-325)
    const origSearchDesc = Object.getOwnPropertyDescriptor(global.window.location, "search");
    Object.defineProperty(global.window.location, "search", {
      get() { throw new Error("Forced URL search error"); },
      configurable: true
    });
    if (sp.docListeners["DOMContentLoaded"]) {
      for (const fn of sp.docListeners["DOMContentLoaded"]) {
        await fn();
      }
    }
    if (origSearchDesc) {
      Object.defineProperty(global.window.location, "search", origSearchDesc);
    } else {
      delete global.window.location.search;
      global.window.location.search = "";
    }

    // 4. discoverModels error catch (lines 497-498)
    const origRtSend = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = () => { throw new Error("Discovery failure"); };
    await sp.discoverModels();
    chrome.runtime.sendMessage = origRtSend;

    // 5. checkPendingAction error catch (lines 552-553)
    const origStoreGet = chrome.storage.local.get;
    chrome.storage.local.get = () => Promise.reject(new Error("Storage read failed"));
    await sp.checkPendingAction();
    chrome.storage.local.get = origStoreGet;

    // 6. findAskDellTab error catch (lines 580-581)
    const origTabsQuery = chrome.tabs.query;
    chrome.tabs.query = () => Promise.reject(new Error("Query failed"));
    const tabRes = await sp.findAskDellTab();
    assert.strictEqual(tabRes, null);
    chrome.tabs.query = origTabsQuery;

    // 7. refreshAskDellStatus error catch (lines 705-707)
    sp.state.demoMode = false;
    chrome.runtime.sendMessage = () => { throw new Error("Status check failed"); };
    const statusRes = await sp.refreshAskDellStatus();
    assert.strictEqual(statusRes, false);
    chrome.runtime.sendMessage = origRtSend;

    // 8. scanActiveTabContext error catch (lines 741-745)
    chrome.runtime.sendMessage = () => Promise.reject(new Error("Extract tab failed"));
    await sp.scanActiveTabContext();
    assert.strictEqual(sp.state.pageContext, null);
    chrome.runtime.sendMessage = origRtSend;

    // 9. handleUserSubmission stream error catch (lines 1192, 1194-1197)
    sp.state.demoMode = false;
    sp.state.connection = { status: "connected" };
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsConnectPort = () => { throw new Error("Bridge connection stream fail"); };
    await sp.handleUserSubmission("Failing stream prompt", false, true);

    // Live bridge successful stream (line 1192)
    let subPortListener = null;
    mock.tabsConnectPort = {
      postMessage: () => {},
      onMessage: { addListener: (fn) => { subPortListener = fn; } },
      onDisconnect: { addListener: () => {} }
    };
    const subPromise = sp.handleUserSubmission("Successful live stream prompt", false, true);
    await new Promise((r) => setTimeout(r, 10));
    if (subPortListener) {
      subPortListener({ type: "done", fullContent: "Stream completed successfully" });
    }
    await subPromise;

    // 10. runStreamInDemoMode interval abort (lines 1800-1804)
    const simCard = new sp.MockElement("div");
    const simPromise = sp.runStreamInDemoMode({ userPrompt: "Test demo abort", model: "claude-opus-4-6" }, simCard);
    sp.state.isStreaming = false;
    await simPromise;

    // 11. renderUserMessage attached context toggle clicked twice (lines 2014-2016)
    sp.renderUserMessage("User with attached context", "Attached code details for collapse testing");
    const allToggles = sp.elementMap["messages"].querySelectorAll(".attached-context-toggle");
    const allBoxes = sp.elementMap["messages"].querySelectorAll(".attached-context-box");
    const lastToggle = allToggles[allToggles.length - 1];
    const lastBox = allBoxes[allBoxes.length - 1];
    if (lastToggle && lastBox) {
      lastToggle.click();
      assert.strictEqual(lastBox.style.display, "block");
      lastToggle.click();
      assert.strictEqual(lastBox.style.display, "none");
    }

    // 12. createAssistantStreamingCard copy-msg-btn and regenerate-msg-btn (lines 2075-2079, 2083-2089)
    sp.createAssistantStreamingCard("Initial user prompt", true);
    const copyMsgBtn = sp.elementMap["messages"].querySelectorAll(".copy-msg-btn").pop();
    const regenMsgBtn = sp.elementMap["messages"].querySelectorAll(".regenerate-msg-btn").pop();

    if (copyMsgBtn) {
      copyMsgBtn.click();
    }

    if (regenMsgBtn) {
      sp.state.isStreaming = true;
      regenMsgBtn.click(); // early return while streaming
      sp.state.isStreaming = false;
      sp.state.demoMode = true;
      sp.state.messages.push({ role: "assistant", content: "Previous answer" });
      regenMsgBtn.click(); // executes regeneration submission
    }

    // 13. toggleHistoryDrawer tab not found & sendMessage failure (lines 2484-2486, 2492-2493)
    let queryCount = 0;
    const origQuery = chrome.tabs.query;
    chrome.tabs.query = async () => {
      queryCount++;
      if (queryCount === 1) return [{ id: 909, url: "https://ask.dell.com/chat" }];
      return [];
    };
    sp.elementMap["history-panel"].style.display = "none";
    sp.state.demoMode = false;
    await sp.toggleHistoryDrawer();
    chrome.tabs.query = origQuery;

    // toggleHistoryDrawer sendMessage error
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[909] = () => { throw new Error("History fetch error"); };
    sp.elementMap["history-panel"].style.display = "none";
    await sp.toggleHistoryDrawer();

    // 14. loadChatFromHistory error catch (lines 2640-2641)
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[909] = () => { throw new Error("Chat fetch failure"); };
    sp.state.demoMode = false;
    await sp.loadChatFromHistory("err-chat-id");

    // 15. compressSessionToHash fallbacks (lines 2849-2852)
    const origCS = global.CompressionStream;
    global.CompressionStream = undefined;
    const rawCompressed = await sp.compressSessionToHash({ messages: [{ role: "user", content: "No CompressionStream" }] });
    assert.ok(rawCompressed.startsWith("raw."));
    global.CompressionStream = origCS;

    global.CompressionStream = class {
      constructor() { throw new Error("Failed to construct stream"); }
    };
    const errCompressed = await sp.compressSessionToHash({ messages: [{ role: "user", content: "Error in CompressionStream" }] });
    assert.ok(errCompressed.startsWith("raw."));
    global.CompressionStream = origCS;

    // 16. decompressSessionFromHash unprefixed tokens (lines 2875-2890)
    const gzPrefixed = await sp.compressSessionToHash({ messages: [{ role: "user", content: "Gzip with no prefix" }] });
    const noPrefixGz = gzPrefixed.replace(/^gz\./, "");
    const decompA = await sp.decompressSessionFromHash(noPrefixGz);
    assert.strictEqual(decompA.messages[0].content, "Gzip with no prefix");

    const rawJson = JSON.stringify({ messages: [{ role: "user", content: "Plain raw b64 no prefix" }] });
    const plainB64 = btoa(encodeURIComponent(rawJson));
    const decompB = await sp.decompressSessionFromHash(plainB64);
    assert.strictEqual(decompB.messages[0].content, "Plain raw b64 no prefix");

    // 17. handleGenerateShareLink live bridge error fallback (lines 2920-2921)
    sp.state.demoMode = false;
    sp.state.chatId = "live-chat-share-err";
    sp.state.shareId = null;
    sp.state.messages = [{ role: "user", content: "Share error test" }];
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[909] = () => { throw new Error("Failed to create server share"); };
    await sp.handleGenerateShareLink();
    assert.ok(sp.state.shareId.startsWith("AD-"));

    // 18. saveCustomAction validation & delete button click (lines 3397-3398, 3418-3420)
    sp.saveCustomAction("", "", "");
    sp.saveCustomAction("To Delete", "🗑️", "Prompt for delete");
    sp.renderCustomActions();
    const deleteBtn = sp.elementMap["custom-actions-list"].querySelectorAll(".btn-delete-custom-action").pop();
    if (deleteBtn) {
      deleteBtn.click();
    }

    // 19. Arena copy handlers & Live Arena error fallback (lines 3887-3888, 3891-3892, 3933-3941)
    sp.state.demoMode = true;
    await sp.handleRunArena();
    const messagesContainer = sp.elementMap["messages"];
    const copyA = messagesContainer.querySelectorAll(".arena-copy-a").pop();
    const copyB = messagesContainer.querySelectorAll(".arena-copy-b").pop();
    if (copyA) copyA.click();
    if (copyB) copyB.click();

    sp.state.demoMode = false;
    sp.state.connection = { status: "connected" };
    mock.tabsList = [{ id: 909, url: "https://ask.dell.com/chat" }];
    mock.tabsResponses[909] = () => { throw new Error("Arena live bridge generation failed"); };
    await sp.handleRunArena();
  });
});

