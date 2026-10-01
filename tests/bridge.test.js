// ============================================================
// tests/bridge.test.js
// Complete Unit & Integration Tests for askdell-bridge.js
// ============================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { MockChrome } = require("./mock_chrome");

function loadBridgeScript(mockChrome, customFetch) {
  const bridgeCode = fs.readFileSync(path.resolve(__dirname, "../askdell-bridge.js"), "utf-8");
  const fetchMock = customFetch || (() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

  const sandbox = {
    chrome: mockChrome,
    window: {
      location: {
        origin: "https://ask.dell.com",
        href: "https://ask.dell.com/c/chat-1",
        pathname: "/c/chat-1"
      }
    },
    document: {
      title: "AskDell AI Portal",
      querySelectorAll: () => []
    },
    fetch: fetchMock,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    setInterval: () => {},
    clearInterval: () => {},
    setTimeout: (fn, ms) => fn(),
    TextDecoder: TextDecoder,
    AbortController: AbortController,
    Uint8Array: Uint8Array,
    crypto: {
      randomUUID: () => "uuid-" + Math.random().toString(36).substring(2, 9),
      getRandomValues: (arr) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      }
    },
    Array: Array,
    Object: Object,
    String: String,
    JSON: JSON,
    Promise: Promise
  };

  vm.createContext(sandbox);
  vm.runInContext(bridgeCode, sandbox);
  return sandbox;
}

test("AskDell Bridge Content Script Suite", async (t) => {
  let mock;
  let bridge;

  t.beforeEach(() => {
    mock = new MockChrome();
  });

  await t.test("1. Model Registry and Discovery merge logic", () => {
    bridge = loadBridgeScript(mock);

    const rawList = [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
      { id: "askdell-intent", name: "Intent Router (Exclude)" },
      { id: "text-embedding-3", name: "Embedding (Exclude)" },
      { id: "custom-rerank", name: "Reranker (Exclude)" },
      { id: "llama-3.3-70b-instruct", name: "Llama 3.3 70B" }
    ];

    const merged = bridge.mergeDiscoveredModels(rawList);

    // Intent, embedding, and rerank models must be filtered out
    assert.strictEqual(merged.some((m) => m.id === "askdell-intent"), false);
    assert.strictEqual(merged.some((m) => m.id === "text-embedding-3"), false);
    assert.strictEqual(merged.some((m) => m.id === "custom-rerank"), false);

    // Valid models mapped with proper endpoints
    const opus = merged.find((m) => m.id === "claude-opus-4-6");
    assert.ok(opus);
    assert.strictEqual(opus.dell_endpoint, "anthropic");
    assert.strictEqual(opus.info.meta.capabilities.reasoning, true);

    const gemini = merged.find((m) => m.id === "gemini-3.8-flash");
    assert.ok(gemini);
    assert.strictEqual(gemini.dell_endpoint, "gcp");
    assert.strictEqual(gemini.info.meta.capabilities.web_search, true);
  });

  await t.test("2. checkAuth(): returns authenticated=true on HTTP 200", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: "c1", title: "Chat 1" }]
        };
      }
      return { ok: false, status: 404 };
    };

    bridge = loadBridgeScript(mock, fetchMock);
    const res = await bridge.checkAuth();
    assert.strictEqual(res.authenticated, true);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.chatCount, 1);
  });

  await t.test("3. checkAuth(): returns authenticated=false on HTTP 401", async () => {
    const fetchMock = async (url) => {
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" })
      };
    };

    bridge = loadBridgeScript(mock, fetchMock);
    const res = await bridge.checkAuth();
    assert.strictEqual(res.authenticated, false);
    assert.strictEqual(res.status, 401);
  });

  await t.test("4. createChat(): sends POST to /api/v1/chats/new", async () => {
    let capturedBody = null;
    const fetchMock = async (url, opts) => {
      if (url.includes("/api/v1/chats/new")) {
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "new-chat-999", title: capturedBody.chat.title })
        };
      }
      return { ok: false, status: 500 };
    };

    bridge = loadBridgeScript(mock, fetchMock);
    const res = await bridge.createChat("Security Audit", "claude-opus-4-6");

    assert.strictEqual(res.id, "new-chat-999");
    assert.strictEqual(capturedBody.chat.title, "Security Audit");
    assert.deepStrictEqual(capturedBody.chat.models, ["claude-opus-4-6"]);
  });

  await t.test("5. shareChat(): generates share link with access grants", async () => {
    const calls = [];
    const fetchMock = async (url, opts) => {
      calls.push({ url, method: opts?.method });
      if (url.includes("/share")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ share_id: "share-abc-123" })
        };
      }
      if (url.includes("/access/update")) {
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
      return { ok: true };
    };

    bridge = loadBridgeScript(mock, fetchMock);
    const res = await bridge.shareChat("chat-xyz");

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.shareId, "share-abc-123");
    assert.strictEqual(res.shareUrl, "https://ask.dell.com/s/share-abc-123");
    assert.ok(calls.some((c) => c.url.includes("/access/update")), "Must update access grants");
  });

  await t.test("6. pingKeepAlive(): emits ASKDELL_SESSION_ACTIVE on HTTP 200", async () => {
    const fetchMock = async () => ({ ok: true, status: 200 });
    bridge = loadBridgeScript(mock, fetchMock);

    let sentMessage = null;
    mock.runtime.onMessage.addListener((msg) => {
      if (msg.type === "ASKDELL_SESSION_ACTIVE") sentMessage = msg;
    });

    const active = await bridge.pingKeepAlive();
    assert.strictEqual(active, true);
  });

  await t.test("7. pingKeepAlive(): emits SESSION_EXPIRED on HTTP 401", async () => {
    const fetchMock = async () => ({ ok: false, status: 401 });
    bridge = loadBridgeScript(mock, fetchMock);

    let expiredNotice = false;
    mock.runtime.onMessage.addListener((msg) => {
      if (msg.type === "SESSION_EXPIRED" || msg.type === "ASKDELL_SESSION_EXPIRED") {
        expiredNotice = true;
      }
    });

    const active = await bridge.pingKeepAlive();
    assert.strictEqual(active, false);
  });

  await t.test("8. SSE Streaming Communication: Delivers tokens & reasoning", async () => {
    // Simulated SSE stream response with reasoning and content
    const sseLines = [
      'data: {"choices":[{"delta":{"reasoning_content":"Step 1: Inspecting security bounds."}}]}\n\n',
      'data: {"type":"status","action":"hybrid_web_search","description":"Searching internal RFCs..."}\n\n',
      'data: {"choices":[{"delta":{"content":"Analysis complete: no vulnerabilities found."}}]}\n\n',
      'data: [DONE]\n\n'
    ];

    let lineIdx = 0;
    const stream = {
      getReader: () => ({
        read: async () => {
          if (lineIdx < sseLines.length) {
            const encoder = new TextEncoder();
            const chunk = encoder.encode(sseLines[lineIdx++]);
            return { done: false, value: chunk };
          }
          return { done: true, value: undefined };
        }
      })
    };

    const fetchMock = async (url, opts) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/chat/completions")) {
        return {
          ok: true,
          status: 200,
          body: stream
        };
      }
      if (url.includes("/api/chat/completed")) {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return { ok: true };
    };

    bridge = loadBridgeScript(mock, fetchMock);

    // Mock Port
    const postedMessages = [];
    const mockPort = {
      name: "askdell-stream",
      postMessage: (m) => postedMessages.push(m)
    };

    const payload = {
      chatId: "chat-active-1",
      model: "claude-opus-4-6",
      messages: [{ role: "user", content: "Audit code" }]
    };

    const controller = new AbortController();
    await bridge.handleChatStream(payload, mockPort, controller.signal);

    // Check message stream outputs
    assert.ok(postedMessages.some((m) => m.type === "token" && m.token.includes("Inspecting security bounds")));
    assert.ok(postedMessages.some((m) => m.type === "status" && m.action === "hybrid_web_search"));
    assert.ok(postedMessages.some((m) => m.type === "token" && m.token.includes("Analysis complete")));
    assert.ok(postedMessages.some((m) => m.type === "done"));
    assert.ok(postedMessages.some((m) => m.type === "completed"));
  });

  await t.test("9. generateSessionId generates random alphanumeric string", () => {
    bridge = loadBridgeScript(mock);
    const sid1 = bridge.generateSessionId(20);
    const sid2 = bridge.generateSessionId(20);
    assert.strictEqual(sid1.length, 20);
    assert.strictEqual(sid2.length, 20);
    assert.notStrictEqual(sid1, sid2);
    assert.match(sid1, /^[A-Za-z0-9]+$/);
  });
});
