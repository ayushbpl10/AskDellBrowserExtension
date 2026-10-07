console.log("[AskDell Dev Assistant Bridge v2.0.0] Initialized on", window.location.origin);
let AVAILABLE_MODELS = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    owned_by: "dell",
    dell_endpoint: "anthropic",
    max_tokens: 200000,
    info: {
      timeout: { default: 120 },
      base_model_id: null,
      meta: { capabilities: { vision: true, web_search: true, reasoning: true } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet 5",
    owned_by: "dell",
    dell_endpoint: "anthropic",
    max_tokens: 200000,
    info: {
      timeout: { default: 90 },
      base_model_id: null,
      meta: { capabilities: { vision: true, web_search: true, reasoning: true } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    owned_by: "dell",
    dell_endpoint: "gcp",
    max_tokens: 1048576,
    info: {
      timeout: { default: 60 },
      base_model_id: null,
      meta: { capabilities: { vision: true, web_search: true, reasoning: false } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    owned_by: "dell",
    dell_endpoint: "gcp",
    max_tokens: 1048576,
    info: {
      timeout: { default: 90 },
      base_model_id: null,
      meta: { capabilities: { vision: true, web_search: true, reasoning: true } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "llama-3.3-70b-instruct",
    name: "Llama-3.3 70B Instruct",
    owned_by: "dell",
    dell_endpoint: "dell",
    max_tokens: 128000,
    info: {
      timeout: { default: 90 },
      base_model_id: null,
      meta: { capabilities: { vision: false, web_search: false, reasoning: true } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "gemma-3-27b-it",
    name: "Gemma-3 27B It",
    owned_by: "dell",
    dell_endpoint: "gcp",
    max_tokens: 128000,
    info: {
      timeout: { default: 60 },
      base_model_id: null,
      meta: { capabilities: { vision: false, web_search: false, reasoning: false } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS-120B",
    owned_by: "dell",
    dell_endpoint: "dell",
    max_tokens: 128000,
    info: {
      timeout: { default: 90 },
      base_model_id: null,
      meta: { capabilities: { vision: false, web_search: false, reasoning: true } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "gpt-oss-20b",
    name: "GPT-OSS-20B",
    owned_by: "dell",
    dell_endpoint: "dell",
    max_tokens: 64000,
    info: {
      timeout: { default: 45 },
      base_model_id: null,
      meta: { capabilities: { vision: false, web_search: false, reasoning: false } }
    },
    actions: [], filters: [], tags: []
  },
  {
    id: "pixtral-12b-vision",
    name: "Pixtral-12B Vision",
    owned_by: "dell",
    dell_endpoint: "dell",
    max_tokens: 128000,
    info: {
      timeout: { default: 60 },
      base_model_id: null,
      meta: { capabilities: { vision: true, web_search: false, reasoning: false } }
    },
    actions: [], filters: [], tags: []
  }
];
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ASKDELL_CHECK_AUTH") {
    checkAuth()
      .then(sendResponse)
      .catch((err) => sendResponse({ authenticated: false, error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_GET_MODELS") {
    fetchModels()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message, models: AVAILABLE_MODELS }));
    return true;
  }
  if (message.type === "ASKDELL_CREATE_CHAT") {
    createChat(message.title, message.model)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_GET_HISTORY") {
    getChatHistory(message.page || 1)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_GET_CHAT") {
    getChat(message.chatId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_SHARE_CHAT") {
    shareChat(message.chatId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_GET_SHARED_CHAT") {
    getSharedChat(message.shareId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_PING_KEEPALIVE") {
    pingKeepAlive()
      .then((ok) => sendResponse({ active: ok }))
      .catch((err) => sendResponse({ active: false, error: err.message }));
    return true;
  }
  if (message.type === "ASKDELL_PING") {
    sendResponse({ status: "alive", origin: window.location.origin });
    return false;
  }
});
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;
let keepAliveTimer = null;
async function pingKeepAlive() {
  try {
    const res = await fetch("/api/v1/chats?page=1", {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      console.log("[AskDell Bridge] Session keep-alive ping successful (10-min cookie renewed)");
      chrome.runtime.sendMessage({
        type: "ASKDELL_SESSION_ACTIVE",
        timestamp: Date.now()
      }).catch(() => {});
      return true;
    } else if (res.status === 401 || res.status === 403) {
      console.warn("[AskDell Bridge] Session expired (status " + res.status + ")");
      chrome.runtime.sendMessage({
        type: "SESSION_EXPIRED",
        detail: "askdell_session expired (10-min limit)",
        status: res.status
      }).catch(() => {});
      chrome.runtime.sendMessage({
        type: "ASKDELL_SESSION_EXPIRED",
        status: res.status
      }).catch(() => {});
      return false;
    }
    return false;
  } catch (err) {
    console.warn("[AskDell Bridge] Keep-alive ping error:", err);
    return false;
  }
}
function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  setTimeout(pingKeepAlive, 15000);
  keepAliveTimer = setInterval(pingKeepAlive, KEEPALIVE_INTERVAL_MS);
}
startKeepAlive();
async function ensureSession() {
  try {
    const res = await fetch("/api/v1/chats?page=1", {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) {
      chrome.runtime.sendMessage({ type: "SESSION_EXPIRED", status: res.status }).catch(() => {});
      chrome.runtime.sendMessage({ type: "ASKDELL_SESSION_EXPIRED", status: res.status }).catch(() => {});
      throw new Error("AskDell session expired (10-minute timeout). Please refresh your ask.dell.com tab.");
    }
    return true;
  } catch (err) {
    chrome.runtime.sendMessage({ type: "SESSION_EXPIRED" }).catch(() => {});
    chrome.runtime.sendMessage({ type: "ASKDELL_SESSION_EXPIRED" }).catch(() => {});
    throw err;
  }
}
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "askdell-stream") return;
  const abortController = new AbortController();
  port.onDisconnect.addListener(() => {
    console.log("[AskDell Bridge] Port disconnected, aborting active stream");
    abortController.abort();
  });
  port.onMessage.addListener(async (msg) => {
    if (msg.type === "START_CHAT") {
      try {
        await handleChatStream(msg.payload, port, abortController.signal);
      } catch (err) {
        if (!abortController.signal.aborted) {
          port.postMessage({ type: "error", error: err.message });
        }
      }
    }
  });
});
async function fetchModels() {
  try {
    const res = await fetch("/api/models", {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.data || data.models || []);
      if (rawList && rawList.length > 0) {
        AVAILABLE_MODELS = mergeDiscoveredModels(rawList);
        return { models: AVAILABLE_MODELS };
      }
    }
  } catch (err) {
    console.warn("[AskDell Bridge] /api/models query error:", err);
  }
  try {
    const res2 = await fetch("/api/v1/models", {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (res2.ok) {
      const data2 = await res2.json();
      const rawList2 = Array.isArray(data2) ? data2 : (data2.data || data2.models || []);
      if (rawList2 && rawList2.length > 0) {
        AVAILABLE_MODELS = mergeDiscoveredModels(rawList2);
        return { models: AVAILABLE_MODELS };
      }
    }
  } catch (err2) {
    console.warn("[AskDell Bridge] /api/v1/models query error:", err2);
  }
  return { models: AVAILABLE_MODELS };
}
function mergeDiscoveredModels(rawList) {
  const filteredList = rawList.filter((m) => {
    const id = (m.id || "").toLowerCase();
    return id !== "askdell-intent" && !id.includes("intent") && !id.includes("embedding") && !id.includes("rerank");
  });
  const mapped = filteredList.map((m) => {
    const isClaude = m.id.toLowerCase().includes("claude") || (m.name && m.name.toLowerCase().includes("claude"));
    const isGemini = m.id.toLowerCase().includes("gemini") || (m.name && m.name.toLowerCase().includes("gemini"));
    return {
      id: m.id,
      name: m.name || m.id,
      owned_by: m.owned_by || "dell",
      dell_endpoint: m.dell_endpoint || (isClaude ? "anthropic" : isGemini ? "gcp" : "dell"),
      max_tokens: m.max_tokens || (isGemini ? 1048576 : 200000),
      info: m.info || {
        timeout: { default: isClaude ? 120 : 60 },
        base_model_id: null,
        meta: {
          capabilities: {
            vision: true,
            web_search: isGemini,
            reasoning: isClaude
          }
        }
      },
      actions: m.actions || [],
      filters: m.filters || [],
      tags: m.tags || []
    };
  });
  for (const fallback of [
    { id: "claude-opus-4-6", name: "Claude Opus 4", endpoint: "anthropic" },
    { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", endpoint: "gcp" }
  ]) {
    if (!mapped.some((m) => m.id === fallback.id)) {
      mapped.push({
        id: fallback.id,
        name: fallback.name,
        owned_by: "dell",
        dell_endpoint: fallback.endpoint,
        max_tokens: fallback.id.includes("gemini") ? 1048576 : 200000,
        info: {
          timeout: { default: fallback.id.includes("claude") ? 120 : 60 },
          base_model_id: null,
          meta: {
            capabilities: {
              vision: true,
              web_search: fallback.id.includes("gemini"),
              reasoning: fallback.id.includes("claude")
            }
          }
        },
        actions: [],
        filters: [],
        tags: []
      });
    }
  }
  return mapped;
}
async function checkAuth() {
  try {
    const res = await fetch("/api/v1/chats?page=1", {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const chatCount = Array.isArray(data) ? data.length : (data?.data ? data.data.length : 0);
      return { authenticated: true, status: res.status, chatCount, data };
    }
    return { authenticated: false, status: res.status };
  } catch (e) {
    return { authenticated: false, error: e.message };
  }
}
async function createChat(title = "Analysis", modelId = "claude-opus-4-6") {
  const res = await fetch("/api/v1/chats/new", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      chat: {
        title: title || "Analysis",
        models: [modelId || "claude-opus-4-6"],
        params: {},
        history: { messages: {} }
      }
    })
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      chrome.runtime.sendMessage({ type: "ASKDELL_SESSION_EXPIRED", status: res.status }).catch(() => {});
      throw new Error("AskDell session expired (10-minute timeout). Please refresh the ask.dell.com tab to re-authenticate.");
    }
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create chat (${res.status}): ${text || res.statusText}`);
  }
  return await res.json();
}
async function getChatHistory(page = 1) {
  const res = await fetch(`/api/v1/chats?page=${encodeURIComponent(page)}`, {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch chat history: HTTP ${res.status}`);
  }
  return await res.json();
}
async function getChat(chatId) {
  const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}`, {
    method: "GET",
    credentials: "include",
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch chat details: HTTP ${res.status}`);
  }
  return await res.json();
}
async function shareChat(chatId) {
  try {
    const res = await fetch(`/api/v1/chats/${encodeURIComponent(chatId)}/share`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    if (res.ok) {
      const data = await res.json();
      const shareId = data.share_id || data.id || chatId;
      try {
        await fetch(`/api/v1/chats/shared/${encodeURIComponent(chatId)}/access/update`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            access_grants: [
              { permission: "read" },
              { principal_type: "user", principal_id: "*", permission: "read" }
            ]
          })
        });
        console.log("[AskDell Bridge] Share access grants successfully granted for:", chatId);
      } catch (grantErr) {
        console.warn("[AskDell Bridge] Could not update access grants:", grantErr);
      }
      return {
        success: true,
        shareId: shareId,
        shareUrl: `https://ask.dell.com/s/${shareId}`,
        data: data
      };
    }
  } catch (e) {
    console.warn("[AskDell Bridge] /api/v1/chats/share error, falling back to direct ID:", e);
  }
  return {
    success: true,
    shareId: chatId,
    shareUrl: `https://ask.dell.com/c/${chatId}`
  };
}
async function getSharedChat(shareId) {
  let lastStatus = 0;
  let lastError = null;
  try {
    const res = await fetch(`/api/v1/chats/share/${encodeURIComponent(shareId)}`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    lastStatus = res.status;
    if (res.ok) {
      const data = await res.json();
      console.log("[AskDell Bridge] Successfully retrieved shared chat via /api/v1/chats/share");
      return { success: true, chat: data };
    } else {
      const errJson = await res.json().catch(() => ({}));
      lastError = errJson.detail || `HTTP ${res.status}`;
      console.warn(`[AskDell Bridge] /api/v1/chats/share status ${res.status}:`, lastError);
    }
  } catch (e) {
    console.warn("[AskDell Bridge] /api/v1/chats/share fetch error:", e);
    lastError = e.message;
  }
  try {
    const cloneRes = await fetch(`/api/v1/chats/${encodeURIComponent(shareId)}/clone/shared`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    if (cloneRes.ok) {
      const data = await cloneRes.json();
      console.log("[AskDell Bridge] Successfully cloned shared chat via /clone/shared");
      return { success: true, chat: data, cloned: true };
    }
  } catch (e) {
    console.warn("[AskDell Bridge] clone/shared fetch error:", e);
  }
  try {
    const directRes = await fetch(`/api/v1/chats/${encodeURIComponent(shareId)}`, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" }
    });
    if (directRes.ok) {
      const data = await directRes.json();
      console.log("[AskDell Bridge] Retrieved chat via direct chat route");
      return { success: true, chat: data };
    }
  } catch (e) {
    console.warn("[AskDell Bridge] /api/v1/chats direct fetch error:", e);
  }
  try {
    const domChat = extractChatFromDom();
    if (domChat && domChat.messages && domChat.messages.length > 0) {
      console.log("[AskDell Bridge] Extracted shared chat from page DOM");
      return { success: true, chat: domChat, fromDom: true };
    }
  } catch (e) {
    console.warn("[AskDell Bridge] DOM extraction error:", e);
  }
  if (lastStatus === 401 || lastStatus === 403) {
    throw new Error(`AskDell Access Prohibited (HTTP ${lastStatus}). Enterprise Open WebUI restrictions require the author to share using 'Export Package' or an updated share link with embedded session.`);
  } else if (lastStatus === 404) {
    throw new Error(`Shared session [${shareId}] not found on AskDell (HTTP 404). Verify that the link or code is correct.`);
  }
  throw new Error(`Unable to retrieve shared chat: ${lastError || "AskDell server error"}. Verify your ask.dell.com session is active.`);
}
function extractChatFromDom() {
  const messages = [];
  const messageElements = document.querySelectorAll("[data-message-id], .chat-message, [id^='message-'], .message");
  messageElements.forEach((el) => {
    const isUser = el.classList.contains("user") || el.getAttribute("data-role") === "user" || Boolean(el.querySelector(".user-message"));
    const contentEl = el.querySelector(".content, .message-content, .prose, .markdown") || el;
    const content = contentEl?.innerText?.trim();
    if (content) {
      messages.push({
        role: isUser ? "user" : "assistant",
        author: isUser ? "Teammate" : "Claude Opus 4.6",
        content: content,
        timestamp: Math.floor(Date.now() / 1000)
      });
    }
  });
  if (messages.length > 0) {
    return {
      id: window.location.pathname.split("/s/")[1]?.split(/[?#/]/)[0] || "shared-chat",
      title: document.title || "Shared AskDell Session",
      messages: messages
    };
  }
  return null;
}
async function handleChatStream(payload, port, abortSignal) {
  await ensureSession();
  const modelId = payload.model || "claude-opus-4-6";
  let modelItem = AVAILABLE_MODELS.find((m) => m.id === modelId);
  const isClaude = modelId.toLowerCase().includes("claude");
  const isGemini = modelId.toLowerCase().includes("gemini");
  const enableWebSearch = payload.webSearch !== false;
  if (!modelItem) {
    modelItem = {
      id: modelId,
      name: isClaude ? (modelId.includes("opus") ? "Claude Opus 4" : "Claude Sonnet") : (isGemini ? "Gemini 3.8 Flash" : modelId),
      owned_by: "dell",
      dell_endpoint: isClaude ? "anthropic" : (isGemini ? "gcp" : "dell"),
      max_tokens: isGemini ? 1048576 : 200000,
      info: {
        timeout: { default: isClaude ? 120 : 60 },
        base_model_id: null,
        meta: {
          capabilities: {
            vision: true,
            web_search: isGemini ? enableWebSearch : false,
            reasoning: isClaude
          }
        }
      },
      actions: [],
      filters: [],
      tags: []
    };
  } else {
    modelItem = JSON.parse(JSON.stringify(modelItem));
    if (modelItem.info?.meta?.capabilities && isGemini) {
      modelItem.info.meta.capabilities.web_search = enableWebSearch;
    }
  }
  let chatId = payload.chatId;
  if (!chatId) {
    const newChat = await createChat(payload.chatTitle || `Analysis (${modelItem.name})`, modelId);
    chatId = newChat.id;
    port.postMessage({ type: "chat_created", chatId });
  }
  const assistantMsgId = crypto.randomUUID();
  const sessionId = generateSessionId(20);
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const formattedMessages = payload.messages.map((m) => ({
    id: m.id || crypto.randomUUID(),
    role: m.role,
    content: m.content,
    timestamp: m.timestamp || nowTimestamp
  }));
  const requestBody = {
    stream: true,
    model: modelId,
    messages: formattedMessages,
    model_item: {
      ...modelItem,
      actions: modelItem.actions || [],
      filters: modelItem.filters || [],
      tags: modelItem.tags || []
    },
    chat_id: chatId,
    session_id: sessionId,
    id: assistantMsgId,
    background_tasks: {
      title_generation: true,
      tags_generation: true,
      follow_up_generation: true
    }
  };
  const res = await fetch("/api/chat/completions", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream"
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      chrome.runtime.sendMessage({ type: "ASKDELL_SESSION_EXPIRED", status: res.status }).catch(() => {});
      throw new Error("AskDell session expired (10-minute timeout). Please refresh the ask.dell.com tab to re-authenticate.");
    }
    const errText = await res.text().catch(() => "");
    throw new Error(`AskDell API Error (${res.status}): ${errText || res.statusText}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let accumulatedReasoning = "";
  let accumulatedContent = "";
  const statusHistory = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          fullContent = accumulatedReasoning
            ? `<details type="thought">\n<summary>Thinking Process</summary>\n${accumulatedReasoning}\n</details>\n\n${accumulatedContent}`
            : accumulatedContent;
          port.postMessage({ type: "done", fullContent, chatId });
          break;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "status") {
            const action = parsed.action || "";
            const desc = parsed.description || parsed.data?.description || "Processing...";
            const isDone = parsed.done === true;
            statusHistory.push({
              action: action,
              description: desc,
              done: isDone
            });
            port.postMessage({
              type: "status",
              action: action,
              description: desc,
              done: isDone
            });
            continue;
          }
          const delta = parsed.choices?.[0]?.delta;
          const reasoningToken = delta?.reasoning_content || delta?.reasoning || delta?.thought;
          const contentToken = delta?.content || parsed.content;
          if (reasoningToken) {
            accumulatedReasoning += reasoningToken;
            fullContent = `<details type="thought" open>\n<summary>Thinking Process</summary>\n${accumulatedReasoning}\n</details>\n\n${accumulatedContent}`;
            port.postMessage({ type: "token", token: reasoningToken, fullContent });
          }
          if (contentToken) {
            accumulatedContent += contentToken;
            fullContent = accumulatedReasoning
              ? `<details type="thought">\n<summary>Thinking Process</summary>\n${accumulatedReasoning}\n</details>\n\n${accumulatedContent}`
              : accumulatedContent;
            port.postMessage({ type: "token", token: contentToken, fullContent });
          }
        } catch (parseErr) {
        }
      }
    }
  } catch (readErr) {
    if (abortSignal.aborted) {
      console.log("[AskDell Bridge] Stream read aborted by user");
      return;
    }
    throw readErr;
  }
  try {
    await fetch("/api/chat/completed", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          ...formattedMessages,
          {
            id: assistantMsgId,
            role: "assistant",
            content: fullContent,
            model: modelId,
            modelName: modelItem.name || modelId,
            modelIdx: 0,
            timestamp: Math.floor(Date.now() / 1000),
            statusHistory: statusHistory,
            sources: []
          }
        ],
        chat_id: chatId,
        session_id: sessionId,
        id: assistantMsgId
      }),
      signal: abortSignal
    });
  } catch (completeErr) {
    console.warn("[AskDell Bridge] Failed to post /api/chat/completed:", completeErr);
  }
  port.postMessage({ type: "completed", chatId, fullContent, statusHistory, model: modelId });
}
function generateSessionId(length = 20) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => chars[b % chars.length])
    .join("");
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    get AVAILABLE_MODELS() { return AVAILABLE_MODELS; },
    set AVAILABLE_MODELS(v) { AVAILABLE_MODELS = v; },
    pingKeepAlive,
    startKeepAlive,
    ensureSession,
    fetchModels,
    mergeDiscoveredModels,
    checkAuth,
    createChat,
    getChatHistory,
    getChat,
    shareChat,
    getSharedChat,
    extractChatFromDom,
    handleChatStream,
    generateSessionId
  };
}