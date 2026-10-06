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
  const fetchMock = customFetch || (() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

  global.chrome = mockChrome;
  global.window = {
    location: {
      origin: "https://ask.dell.com",
      href: "https://ask.dell.com/c/chat-1",
      pathname: "/c/chat-1"
    }
  };
  global.document = {
    title: "AskDell AI Portal",
    querySelectorAll: () => []
  };
  global.fetch = fetchMock;

  const origSetInterval = global.setInterval;
  const origSetTimeout = global.setTimeout;
  global.setInterval = () => ({ unref: () => {} });
  global.setTimeout = () => ({ unref: () => {} });

  delete require.cache[require.resolve("../askdell-bridge.js")];
  const bridge = require("../askdell-bridge.js");
  global.setInterval = origSetInterval;
  global.setTimeout = origSetTimeout;
  return bridge;
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

  await t.test("10. fetchModels(): tests /api/models, /api/v1/models, and error fallback", async () => {
    // 10a: /api/models returns list
    let fetchMock = async (url) => {
      if (url === "/api/models") {
        return { ok: true, json: async () => [{ id: "claude-opus-4-6", name: "Claude Opus" }] };
      }
      return { ok: false, status: 404 };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const res1 = await bridge.fetchModels();
    assert.ok(res1.models.some((m) => m.id === "claude-opus-4-6"));

    // 10b: /api/models fails, /api/v1/models succeeds
    fetchMock = async (url) => {
      if (url === "/api/v1/models") {
        return { ok: true, json: async () => ({ data: [{ id: "gemini-3.8-flash", name: "Gemini 3.8" }] }) };
      }
      return { ok: false, status: 404 };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const res2 = await bridge.fetchModels();
    assert.ok(res2.models.some((m) => m.id === "gemini-3.8-flash"));

    // 10c: Both endpoints fail or throw
    fetchMock = async () => { throw new Error("Network offline"); };
    bridge = loadBridgeScript(mock, fetchMock);
    const res3 = await bridge.fetchModels();
    assert.ok(res3.models.length > 0);
  });

  await t.test("11. getChatHistory() and getChat(): success and error branches", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/v1/chats?page=2")) {
        return { ok: true, json: async () => [{ id: "chat-page-2" }] };
      }
      if (url.includes("/api/v1/chats?page=99")) {
        return { ok: false, status: 500 };
      }
      if (url.includes("/api/v1/chats/chat-100")) {
        return { ok: true, json: async () => ({ id: "chat-100", title: "Valid Chat" }) };
      }
      if (url.includes("/api/v1/chats/chat-404")) {
        return { ok: false, status: 404 };
      }
      return { ok: true, json: async () => ({}) };
    };
    bridge = loadBridgeScript(mock, fetchMock);

    // History success & fail
    const history = await bridge.getChatHistory(2);
    assert.strictEqual(history[0].id, "chat-page-2");
    await assert.rejects(async () => await bridge.getChatHistory(99), /HTTP 500/);

    // Get chat success & fail
    const chat = await bridge.getChat("chat-100");
    assert.strictEqual(chat.id, "chat-100");
    await assert.rejects(async () => await bridge.getChat("chat-404"), /HTTP 404/);
  });

  await t.test("12. getSharedChat(): all routes and error handling", async () => {
    // 12a: Route 1 (/api/v1/chats/share/id) success
    let fetchMock = async (url) => {
      if (url.includes("/api/v1/chats/share/s1")) {
        return { ok: true, json: async () => ({ id: "chat-s1", messages: [] }) };
      }
      return { ok: false, status: 404 };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const res1 = await bridge.getSharedChat("s1");
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.chat.id, "chat-s1");

    // 12b: Route 2 (clone/shared) success
    fetchMock = async (url) => {
      if (url.includes("/clone/shared")) {
        return { ok: true, json: async () => ({ id: "cloned-chat" }) };
      }
      return { ok: false, status: 404, json: async () => ({ detail: "Not found" }) };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const res2 = await bridge.getSharedChat("s2");
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.cloned, true);

    // 12c: Route 3 (direct chat) success
    fetchMock = async (url) => {
      if (url === "/api/v1/chats/s3") {
        return { ok: true, json: async () => ({ id: "direct-chat" }) };
      }
      return { ok: false, status: 404, json: async () => ({ detail: "Not found" }) };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const res3 = await bridge.getSharedChat("s3");
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.chat.id, "direct-chat");

    // 12d: Route 4 (DOM extraction fallback)
    fetchMock = async () => ({ ok: false, status: 500, json: async () => ({ detail: "Server error" }) });
    bridge = loadBridgeScript(mock, fetchMock);
    global.window.location.pathname = "/s/s4";
    global.document = {
      title: "Shared DOM Title",
      querySelectorAll: (sel) => [
        {
          classList: { contains: (c) => c === "user" },
          getAttribute: () => "user",
          querySelector: () => null,
          innerText: "Hello team"
        }
      ]
    };
    const res4 = await bridge.getSharedChat("s4");
    assert.strictEqual(res4.success, true);
    assert.strictEqual(res4.fromDom, true);

    // 12e: Error 401/403
    fetchMock = async () => ({ ok: false, status: 403, json: async () => ({ detail: "Forbidden" }) });
    bridge = loadBridgeScript(mock, fetchMock);
    global.document = { querySelectorAll: () => [] };
    await assert.rejects(async () => await bridge.getSharedChat("s5"), /AskDell Access Prohibited/);

    // 12f: Error 404
    fetchMock = async () => ({ ok: false, status: 404, json: async () => ({ detail: "Not Found" }) });
    bridge = loadBridgeScript(mock, fetchMock);
    await assert.rejects(async () => await bridge.getSharedChat("s6"), /HTTP 404/);
  });

  await t.test("13. extractChatFromDom(): parses DOM elements correctly", () => {
    bridge = loadBridgeScript(mock);
    global.window.location.pathname = "/s/shared-abc";
    global.document = {
      title: "Shared Session",
      querySelectorAll: () => [
        {
          classList: { contains: (c) => c === "user" },
          getAttribute: (a) => a === "data-role" ? "user" : null,
          querySelector: (sel) => ({ innerText: "User question here" }),
          innerText: "User question here"
        },
        {
          classList: { contains: () => false },
          getAttribute: () => "assistant",
          querySelector: (sel) => sel.includes("user") ? null : ({ innerText: "AI response here" }),
          innerText: "AI response here"
        }
      ]
    };
    const parsed = bridge.extractChatFromDom();
    assert.ok(parsed);
    assert.strictEqual(parsed.id, "shared-abc");
    assert.strictEqual(parsed.messages.length, 2);
    assert.strictEqual(parsed.messages[0].role, "user");
    assert.strictEqual(parsed.messages[0].content, "User question here");
    assert.strictEqual(parsed.messages[1].role, "assistant");
    assert.strictEqual(parsed.messages[1].content, "AI response here");

    // Empty DOM case
    global.document = { querySelectorAll: () => [] };
    assert.strictEqual(bridge.extractChatFromDom(), null);
  });

  await t.test("14. chrome.runtime.onMessage handler dispatches all AskDell bridge actions", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200, json: async () => [] };
      if (url.includes("/api/models")) return { ok: true, json: async () => [] };
      if (url.includes("/api/v1/chats/new")) return { ok: true, json: async () => ({ id: "msg-chat" }) };
      if (url.includes("/share")) return { ok: true, json: async () => ({ share_id: "s-msg" }) };
      if (url.includes("/api/v1/chats/")) return { ok: true, json: async () => ({ id: "c-msg" }) };
      return { ok: true, json: async () => ({}) };
    };

    bridge = loadBridgeScript(mock, fetchMock);
    const listener = mock.messageListeners[0];
    assert.ok(listener);

    const sendMsg = (msg) => new Promise((resolve) => listener(msg, {}, resolve));

    // CHECK_AUTH
    const authRes = await sendMsg({ type: "ASKDELL_CHECK_AUTH" });
    assert.strictEqual(authRes.authenticated, true);

    // GET_MODELS
    const modelsRes = await sendMsg({ type: "ASKDELL_GET_MODELS" });
    assert.ok(modelsRes.models);

    // CREATE_CHAT
    const createRes = await sendMsg({ type: "ASKDELL_CREATE_CHAT", title: "Test", model: "claude-opus-4-6" });
    assert.strictEqual(createRes.id, "msg-chat");

    // GET_HISTORY
    const histRes = await sendMsg({ type: "ASKDELL_GET_HISTORY", page: 1 });
    assert.ok(Array.isArray(histRes));

    // GET_CHAT
    const chatRes = await sendMsg({ type: "ASKDELL_GET_CHAT", chatId: "c-msg" });
    assert.strictEqual(chatRes.id, "c-msg");

    // SHARE_CHAT
    const shareRes = await sendMsg({ type: "ASKDELL_SHARE_CHAT", chatId: "c-msg" });
    assert.strictEqual(shareRes.shareId, "s-msg");

    // GET_SHARED_CHAT
    const sharedRes = await sendMsg({ type: "ASKDELL_GET_SHARED_CHAT", shareId: "s-msg" });
    assert.strictEqual(sharedRes.success, true);

    // PING_KEEPALIVE
    const pingRes = await sendMsg({ type: "ASKDELL_PING_KEEPALIVE" });
    assert.strictEqual(pingRes.active, true);

    // PING
    let syncPingRes;
    listener({ type: "ASKDELL_PING" }, {}, (r) => { syncPingRes = r; });
    assert.strictEqual(syncPingRes.status, "alive");
  });

  await t.test("15. Port streaming lifecycle: onConnect, onDisconnect, START_CHAT error handling", async () => {
    bridge = loadBridgeScript(mock);
    const connectListener = mock.connectListeners[0];
    assert.ok(connectListener);

    // Wrong port name ignored
    connectListener({ name: "other-port" });

    // Valid port with onDisconnect abort
    let disconnectHandler = null;
    let messageHandler = null;
    const testPort = {
      name: "askdell-stream",
      onDisconnect: { addListener: (fn) => { disconnectHandler = fn; } },
      onMessage: { addListener: (fn) => { messageHandler = fn; } },
      postMessage: (m) => {}
    };
    connectListener(testPort);
    assert.ok(disconnectHandler);
    assert.ok(messageHandler);

    // Trigger disconnect
    disconnectHandler();

    // Port error when stream fails while port remains connected
    let portErrMsg = null;
    let activeHandler = null;
    const activePort = {
      name: "askdell-stream",
      onDisconnect: { addListener: () => {} },
      onMessage: { addListener: (fn) => { activeHandler = fn; } },
      postMessage: (m) => { if (m.type === "error") portErrMsg = m; }
    };
    connectListener(activePort);
    global.fetch = async () => ({ ok: false, status: 500, text: async () => "Internal server error" });
    await activeHandler({ type: "START_CHAT", payload: { model: "non-existent", messages: [] } });
    assert.ok(portErrMsg);
    assert.strictEqual(portErrMsg.type, "error");
  });

  await t.test("16. handleChatStream branches: custom model, no chatId, 401 error, malformed lines", async () => {
    // 16a: Custom synthesized model, no chatId in payload
    let createdChatId = null;
    const fetchMock = async (url, opts) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/v1/chats/new")) {
        return { ok: true, status: 200, json: async () => ({ id: "auto-chat-1", title: "New Auto Chat" }) };
      }
      if (url.includes("/api/chat/completions")) {
        const stream = {
          getReader: () => {
            const lines = [
              'malformed non-json line\n',
              'data: {bad-json}\n',
              'data: {"choices":[{"delta":{"content":"Synthesized model response"}}]}\n',
              'data: [DONE]\n'
            ];
            let i = 0;
            return {
              read: async () => {
                if (i < lines.length) {
                  return { done: false, value: new TextEncoder().encode(lines[i++]) };
                }
                return { done: true };
              }
            };
          }
        };
        return { ok: true, status: 200, body: stream };
      }
      if (url.includes("/api/chat/completed")) {
        throw new Error("Failed to post completion log");
      }
      return { ok: true };
    };

    bridge = loadBridgeScript(mock, fetchMock);
    const msgs = [];
    const mockPort = {
      name: "askdell-stream",
      postMessage: (m) => msgs.push(m)
    };

    const payload = {
      model: "custom-unregistered-model",
      messages: [{ role: "user", content: "Test custom model" }],
      webSearch: false
    };

    const controller = new AbortController();
    await bridge.handleChatStream(payload, mockPort, controller.signal);

    assert.ok(msgs.some((m) => m.type === "chat_created" && m.chatId === "auto-chat-1"));
    assert.ok(msgs.some((m) => m.type === "token" && m.token === "Synthesized model response"));
    assert.ok(msgs.some((m) => m.type === "completed"));

    // 16b: 401 session expiration error in completion request
    const expiredFetch = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/chat/completions")) {
        return { ok: false, status: 401, text: async () => "Unauthorized session" };
      }
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, expiredFetch);
    await assert.rejects(
      async () => await bridge.handleChatStream({ chatId: "c1", model: "claude-opus-4-6", messages: [] }, mockPort, controller.signal),
      /session expired/
    );
  });

  await t.test("17. ensureSession() throws and sends expired message on failure", async () => {
    const expiredFetch = async () => ({ ok: false, status: 401 });
    bridge = loadBridgeScript(mock, expiredFetch);
    await assert.rejects(async () => await bridge.ensureSession(), /session expired/);
  });

  await t.test("18. Additional error branches and Gemini model stream options", async () => {
    // 18a: pingKeepAlive when fetch throws and when status is 500
    let fetchMock = async () => { throw new Error("Connection reset"); };
    bridge = loadBridgeScript(mock, fetchMock);
    const pingOk = await bridge.pingKeepAlive();
    assert.strictEqual(pingOk, false);

    fetchMock = async () => ({ ok: false, status: 500 });
    bridge = loadBridgeScript(mock, fetchMock);
    const ping500 = await bridge.pingKeepAlive();
    assert.strictEqual(ping500, false);

    // 18b: checkAuth when fetch throws
    fetchMock = async () => { throw new Error("Connection reset"); };
    bridge = loadBridgeScript(mock, fetchMock);
    const authRes = await bridge.checkAuth();
    assert.strictEqual(authRes.authenticated, false);
    assert.strictEqual(authRes.error, "Connection reset");

    // 18c: createChat when status is 401 and when status is 500
    fetchMock = async () => ({ ok: false, status: 401, text: async () => "Forbidden" });
    bridge = loadBridgeScript(mock, fetchMock);
    await assert.rejects(async () => await bridge.createChat("Test"), /session expired/);

    fetchMock = async () => ({ ok: false, status: 500, text: async () => "Internal server error" });
    bridge = loadBridgeScript(mock, fetchMock);
    await assert.rejects(async () => await bridge.createChat("Test"), /Failed to create chat/);

    // 18d: shareChat when /share fetch throws (falls back to direct ID)
    fetchMock = async (url) => {
      if (url.includes("/share")) throw new Error("Share endpoint offline");
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const fallbackShare = await bridge.shareChat("chat-fallback");
    assert.strictEqual(fallbackShare.success, true);
    assert.strictEqual(fallbackShare.shareId, "chat-fallback");
    assert.strictEqual(fallbackShare.shareUrl, "https://ask.dell.com/c/chat-fallback");

    // 18e: shareChat when access update throws error
    fetchMock = async (url) => {
      if (url.includes("/access/update")) throw new Error("Access update timeout");
      if (url.includes("/share")) return { ok: true, json: async () => ({ share_id: "s-ok" }) };
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const grantThrowShare = await bridge.shareChat("chat-grant-throw");
    assert.strictEqual(grantThrowShare.success, true);

    // 18f: handleChatStream with registered Gemini model and webSearch enabled
    fetchMock = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/chat/completions")) {
        const stream = {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined })
          })
        };
        return { ok: true, status: 200, body: stream };
      }
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const port = { name: "askdell-stream", postMessage: () => {} };
    const ctrl = new AbortController();
    await bridge.handleChatStream({ chatId: "c-gem", model: "gemini-3.8-flash", webSearch: true, messages: [] }, port, ctrl.signal);

    // 18g: handleChatStream with API error status 500
    fetchMock = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/chat/completions")) {
        return { ok: false, status: 500, text: async () => "Internal AI cluster overload" };
      }
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    await assert.rejects(
      async () => await bridge.handleChatStream({ chatId: "c-err", model: "claude-opus-4-6", messages: [] }, port, ctrl.signal),
      /AskDell API Error \(500\)/
    );

    // 18h: handleChatStream stream read aborted by user
    fetchMock = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/chat/completions")) {
        const abortCtrl = new AbortController();
        const stream = {
          getReader: () => ({
            read: async () => {
              abortCtrl.abort();
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              throw err;
            }
          })
        };
        return { ok: true, status: 200, body: stream };
      }
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    const abortCtrl = new AbortController();
    abortCtrl.abort();
    await bridge.handleChatStream({ chatId: "c-abort", model: "claude-opus-4-6", messages: [] }, port, abortCtrl.signal);
  });

  await t.test("19. getSharedChat error logging and handleChatStream rethrow on unexpected read error", async () => {
    // 19a: getSharedChat when all routes throw errors and DOM extraction throws
    const fetchMock = async (url) => {
      if (url.includes("/api/v1/chats/share/")) throw new Error("Share route exploded");
      if (url.includes("/clone/shared")) throw new Error("Clone route exploded");
      if (url.includes("/api/v1/chats/")) throw new Error("Direct route exploded");
      return { ok: false, status: 500 };
    };
    bridge = loadBridgeScript(mock, fetchMock);
    global.document = {
      querySelectorAll: () => { throw new Error("DOM query threw error"); }
    };
    await assert.rejects(
      async () => await bridge.getSharedChat("throw-test-id"),
      /Unable to retrieve shared chat/
    );

    // 19b: handleChatStream rethrows when read error occurs while not aborted
    const streamFailFetch = async (url) => {
      if (url.includes("/api/v1/chats?page=1")) return { ok: true, status: 200 };
      if (url.includes("/api/chat/completions")) {
        const stream = {
          getReader: () => ({
            read: async () => { throw new Error("Corrupted chunk data"); }
          })
        };
        return { ok: true, status: 200, body: stream };
      }
      return { ok: true };
    };
    bridge = loadBridgeScript(mock, streamFailFetch);
    const ctrl = new AbortController();
    const port = { name: "askdell-stream", postMessage: () => {} };
    await assert.rejects(
      async () => await bridge.handleChatStream({ chatId: "c-fail", model: "claude-opus-4-6", messages: [] }, port, ctrl.signal),
      /Corrupted chunk data/
    );
  });
});
