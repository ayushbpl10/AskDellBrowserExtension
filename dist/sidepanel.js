let state = {
  chatId: null,
  messages: [],
  isStreaming: false,
  activePort: null,
  currentModel: "claude-opus-4-6",
  pageContext: null,
  availableModels: [],
  historyCache: [],
  settings: {
    model: "claude-opus-4-6",
    includePageContent: true,
    autoWebSearch: true,
    maxContentLength: 100000
  }
};
const MODEL_META = {
  "claude-opus-4-6": {
    name: "Claude Opus 4.6",
    provider: "anthropic",
    color: "claude",
    capabilities: "🧠 deep reasoning · 👁️ vision · 200k",
    icon: "🟣"
  },
  "claude-sonnet-5": {
    name: "Claude Sonnet 5",
    provider: "anthropic",
    color: "claude",
    capabilities: "⚡ fast coding · 🧠 reasoning · 200k",
    icon: "🟣"
  },
  "gemini-3.8-flash": {
    name: "Gemini 3.8 Flash",
    provider: "gcp",
    color: "gemini",
    capabilities: "⚡ ultra-fast · 🌐 web search · 1M",
    icon: "🔵"
  },
  "gemini-3.1-pro-preview": {
    name: "Gemini 3.1 Pro Preview",
    provider: "gcp",
    color: "gemini",
    capabilities: "🧠 complex reasoning · 🌐 web search · 1M",
    icon: "🔵"
  },
  "llama-3.3-70b-instruct": {
    name: "Llama-3.3 70B Instruct",
    provider: "meta",
    color: "llama",
    capabilities: "🦙 Meta frontier · code & reasoning",
    icon: "🦙"
  },
  "gemma-3-27b-it": {
    name: "Gemma-3 27B It",
    provider: "google",
    color: "gemma",
    capabilities: "💎 open weights · instruction tuned",
    icon: "💎"
  },
  "gpt-oss-120b": {
    name: "GPT-OSS-120B",
    provider: "oss",
    color: "oss",
    capabilities: "🏛️ 120B frontier open model",
    icon: "🟢"
  },
  "gpt-oss-20b": {
    name: "GPT-OSS-20B",
    provider: "oss",
    color: "oss",
    capabilities: "⚡ 20B lightweight open model",
    icon: "🟢"
  },
  "pixtral-12b-vision": {
    name: "Pixtral-12B Vision",
    provider: "mistral",
    color: "gemini",
    capabilities: "👁️ multimodal vision & OCR",
    icon: "👁️"
  },
  "claude-opus": {
    name: "Claude Opus 4.6",
    provider: "anthropic",
    color: "claude",
    capabilities: "🧠 deep reasoning · 👁️ vision",
    icon: "🟣"
  },
  "claude-sonnet": {
    name: "Claude Sonnet 5",
    provider: "anthropic",
    color: "claude",
    capabilities: "⚡ fast coding · 🧠 reasoning",
    icon: "🟣"
  }
};
function getModelMetadata(modelId, modelName = "") {
  if (MODEL_META[modelId]) return MODEL_META[modelId];
  const lowerId = (modelId || "").toLowerCase();
  const lowerName = (modelName || "").toLowerCase();
  for (const [key, meta] of Object.entries(MODEL_META)) {
    if (lowerId === key.toLowerCase() || lowerName === meta.name.toLowerCase()) {
      return meta;
    }
  }
  if (lowerId.includes("claude") || lowerName.includes("claude")) {
    return { name: modelName || modelId, icon: "🟣", color: "claude", capabilities: "🧠 reasoning · 👁️ vision" };
  }
  if (lowerId.includes("gemini") || lowerName.includes("gemini")) {
    return { name: modelName || modelId, icon: "🔵", color: "gemini", capabilities: "🌐 web search · 👁️ vision" };
  }
  if (lowerId.includes("llama") || lowerName.includes("llama")) {
    return { name: modelName || modelId, icon: "🦙", color: "llama", capabilities: "🦙 code & reasoning" };
  }
  if (lowerId.includes("gemma") || lowerName.includes("gemma")) {
    return { name: modelName || modelId, icon: "💎", color: "gemma", capabilities: "💎 instruction tuned" };
  }
  if (lowerId.includes("pixtral") || lowerName.includes("pixtral")) {
    return { name: modelName || modelId, icon: "👁️", color: "gemini", capabilities: "👁️ multimodal vision" };
  }
  if (lowerId.includes("gpt") || lowerName.includes("gpt")) {
    return { name: modelName || modelId, icon: "🟢", color: "oss", capabilities: "🏛️ open weights model" };
  }
  if (lowerId.includes("intent") || lowerName.includes("intent")) {
    return { name: modelName || modelId, icon: "⚡", color: "gemini", capabilities: "🎯 smart intent routing" };
  }
  return { name: modelName || modelId, icon: "⚪", color: "gemini", capabilities: "Enterprise AI" };
}
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await loadSettings();
  setupEventListeners();
  setupMessageListeners();
  await scanActiveTabContext();
  await refreshAskDellStatus();
  discoverModels();
  await checkPendingAction();
});
function initTheme() {
  chrome.storage.local.get(["themePreference"], (res) => {
    if (res.themePreference) {
      document.documentElement.setAttribute("data-theme", res.themePreference);
      updateThemeIcon(res.themePreference);
    }
  });
  $("#btn-theme").addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const isDark = currentTheme === "dark" || (!currentTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.local.set({ themePreference: newTheme });
    updateThemeIcon(newTheme);
  });
}
function updateThemeIcon(theme) {
  const icon = $("#theme-icon");
  if (theme === "dark") {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }
}
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings"], (res) => {
      if (res.settings) {
        state.settings = { ...state.settings, ...res.settings };
        if (state.settings.model === "claude-opus") {
          state.settings.model = "claude-opus-4-6";
          chrome.storage.local.set({ settings: state.settings });
        }
      }
      state.currentModel = state.settings.model || "claude-opus-4-6";
      const selector = $("#model-selector");
      if (selector) selector.value = state.currentModel;
      const defaultModelEl = $("#setting-default-model");
      if (defaultModelEl) defaultModelEl.value = state.settings.model;
      const webSearchEl = $("#setting-web-search");
      if (webSearchEl) webSearchEl.checked = state.settings.autoWebSearch;
      const includePageEl = $("#setting-include-page");
      if (includePageEl) includePageEl.checked = state.settings.includePageContent;
      const maxLenEl = $("#setting-max-length");
      if (maxLenEl) maxLenEl.value = state.settings.maxContentLength;
      const quickIncludeEl = $("#include-page-content");
      if (quickIncludeEl) quickIncludeEl.checked = state.settings.includePageContent;
      const quickWebEl = $("#include-web-search");
      if (quickWebEl) quickWebEl.checked = state.settings.autoWebSearch;
      updateModelUI();
      resolve();
    });
  });
}
function saveSettings() {
  state.settings.model = $("#setting-default-model")?.value || state.currentModel;
  state.settings.autoWebSearch = $("#setting-web-search")?.checked ?? true;
  state.settings.includePageContent = $("#setting-include-page")?.checked ?? true;
  state.settings.maxContentLength = parseInt($("#setting-max-length")?.value, 10) || 100000;
  const quickIncludeEl = $("#include-page-content");
  if (quickIncludeEl) quickIncludeEl.checked = state.settings.includePageContent;
  const quickWebEl = $("#include-web-search");
  if (quickWebEl) quickWebEl.checked = state.settings.autoWebSearch;
  chrome.storage.local.set({ settings: state.settings });
}
function updateModelUI() {
  const modelId = state.currentModel;
  const meta = getModelMetadata(modelId);
  const infoEl = $("#model-info");
  if (infoEl) {
    infoEl.textContent = meta.capabilities || "Enterprise AI";
    let capClass = "model-info";
    if (meta.color === "gemini") capClass += " gemini-cap";
    else if (meta.color === "llama") capClass += " llama-cap";
    else if (meta.color === "gemma") capClass += " gemma-cap";
    else if (meta.color === "oss") capClass += " oss-cap";
    infoEl.className = capClass;
  }
  const sendBtn = $("#btn-send");
  if (sendBtn) {
    if (meta.color === "claude") {
      sendBtn.classList.add("claude-send");
    } else {
      sendBtn.classList.remove("claude-send");
    }
  }
  const wsContainer = $("#include-web-search")?.closest(".checkbox-container");
  if (wsContainer) {
    wsContainer.title = modelId.includes("gemini")
      ? "Hybrid Web Search (supported on Gemini)"
      : "Web search capability (primarily Gemini)";
  }
}
async function discoverModels() {
  try {
    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "FETCH_MODELS" }, (response) => {
        resolve(response);
      });
    });
    if (resp && resp.models && Array.isArray(resp.models) && resp.models.length > 0) {
      state.availableModels = resp.models;
      updateModelDropdowns(resp.models);
      const discDiv = $("#discovered-models");
      if (discDiv) {
        const names = resp.models.map((m) => m.name || m.id).join(", ");
        discDiv.innerHTML = `<strong>Discovered:</strong> ${escapeHtml(names)}`;
      }
    }
  } catch (err) {
    console.warn("[AskDell] Model discovery failed:", err);
  }
}
function updateModelDropdowns(models) {
  const selector = $("#model-selector");
  const settingSelector = $("#setting-default-model");
  if (!selector) return;
  const currentVal = state.currentModel;
  selector.innerHTML = "";
  if (settingSelector) settingSelector.innerHTML = "";
  const validModels = models.filter((m) => {
    const id = (m.id || "").toLowerCase();
    return id !== "askdell-intent" && !id.includes("intent") && !id.includes("embedding") && !id.includes("rerank");
  });
  validModels.forEach((m) => {
    const meta = getModelMetadata(m.id, m.name);
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${meta.icon || "⚪"} ${meta.name || m.name || m.id}`;
    selector.appendChild(opt);
    if (settingSelector) {
      const opt2 = opt.cloneNode(true);
      settingSelector.appendChild(opt2);
    }
  });
  if (Array.from(selector.options).some((o) => o.value === currentVal)) {
    selector.value = currentVal;
  } else if (Array.from(selector.options).some((o) => o.value === "claude-opus-4-6")) {
    selector.value = "claude-opus-4-6";
  }
  state.currentModel = selector.value;
  if (settingSelector) settingSelector.value = state.currentModel;
  updateModelUI();
}
async function checkPendingAction() {
  try {
    const { pendingAction } = await chrome.storage.local.get("pendingAction");
    if (pendingAction) {
      await chrome.storage.local.remove("pendingAction");
      handleIncomingAction(pendingAction);
    }
  } catch (err) {
    console.warn("[AskDell] Failed to check pending action:", err);
  }
}
function handleIncomingAction(action) {
  if (action.type === "ANALYZE_SELECTION" && action.text) {
    const prompt = `Analyze the following code/text in detail. Identify issues, suggest improvements, and explain the logic:\n\`\`\`\n${action.text}\n\`\`\``;
    handleUserSubmission(prompt, false);
  } else if (action.type === "EXPLAIN_SELECTION" && action.text) {
    const prompt = `Explain the following code/text clearly. Break down the logic, architecture patterns, and key decisions:\n\`\`\`\n${action.text}\n\`\`\``;
    handleUserSubmission(prompt, false);
  } else if (action.type === "ANALYZE_PAGE" && action.content) {
    state.pageContext = action.content;
    updateContextBarUI(action.content);
    handleUserSubmission("Analyze this page / code / PR: evaluate correctness, architecture, security, and potential improvements.", true);
  }
}
async function findAskDellTab() {
  const tabs = await chrome.tabs.query({ url: "*://ask.dell.com/*" });
  if (tabs && tabs.length > 0) {
    return tabs[0];
  }
  return null;
}
async function refreshAskDellStatus() {
  const dot = $("#connection-status-dot");
  const banner = $("#auth-banner");
  const bannerText = $("#auth-banner-text");
  const refreshBtn = $("#btn-refresh-askdell-tab");
  dot.className = "status-dot dot-checking";
  dot.title = "Checking AskDell connection...";
  const tab = await findAskDellTab();
  if (!tab) {
    dot.className = "status-dot dot-offline";
    dot.title = "No ask.dell.com tab open";
    banner.style.display = "flex";
    bannerText.textContent = "Open ask.dell.com in a tab to connect your session.";
    if (refreshBtn) refreshBtn.style.display = "none";
    return false;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_CHECK_AUTH" });
    if (res && res.authenticated) {
      dot.className = "status-dot dot-connected";
      dot.title = "Connected to AskDell (Logged In · Session Kept Alive)";
      banner.style.display = "none";
      if (refreshBtn) refreshBtn.style.display = "none";
      return true;
    } else {
      dot.className = "status-dot dot-offline";
      dot.title = "AskDell tab found but session expired (10-min timeout)";
      banner.style.display = "flex";
      bannerText.textContent = "AskDell session expired (10-minute timeout). Please refresh the tab.";
      if (refreshBtn) refreshBtn.style.display = "inline-block";
      return false;
    }
  } catch (err) {
    console.warn("[AskDell] Bridge ping failed:", err);
    dot.className = "status-dot dot-offline";
    dot.title = "AskDell bridge not responding";
    banner.style.display = "flex";
    bannerText.textContent = "AskDell tab detected. Please refresh the AskDell tab.";
    if (refreshBtn) refreshBtn.style.display = "inline-block";
    return false;
  }
}
async function scanActiveTabContext() {
  const badge = $("#detected-platform-badge");
  const title = $("#detected-title");
  const sizeBadge = $("#context-size-badge");
  badge.textContent = "Scanning...";
  title.textContent = "Checking active tab...";
  try {
    const response = await chrome.runtime.sendMessage({ type: "EXTRACT_TAB_CONTENT" });
    if (response && response.content) {
      state.pageContext = response.content;
      updateContextBarUI(response.content);
    } else {
      state.pageContext = null;
      badge.textContent = "Idle";
      title.textContent = "No page content available";
      sizeBadge.textContent = "0 KB";
    }
  } catch (err) {
    state.pageContext = null;
    badge.textContent = "None";
    title.textContent = "Could not read active tab";
    sizeBadge.textContent = "0 KB";
  }
}
function updateContextBarUI(content) {
  const badge = $("#detected-platform-badge");
  const title = $("#detected-title");
  const sizeBadge = $("#context-size-badge");
  const typeLabels = {
    pull_request: "PR / Diff",
    merge_request: "MR / Diff",
    source_code: "Source Code",
    issue: "Issue",
    ticket: "Ticket",
    documentation: "Docs",
    logs: "Build Logs",
    webpage: "Web Page"
  };
  const platformPrefix = content.platform ? content.platform.replace("_", " ").toUpperCase() : "WEB";
  const typeLabel = typeLabels[content.type] || "PAGE";
  badge.className = `platform-badge platform-${(content.platform || 'web').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  badge.textContent = `${platformPrefix} · ${typeLabel}`;
  title.textContent = content.title || content.url || "Current Page";
  title.title = `${content.title || ''}\n${content.url || ''}`;
  const totalLength = (content.diff?.length || 0) + (content.code?.length || 0) + (content.body?.length || 0) + (content.comments?.length || 0);
  const kb = (totalLength / 1024).toFixed(1);
  sizeBadge.textContent = `${kb} KB`;
}
function setupEventListeners() {
  $("#model-selector")?.addEventListener("change", (e) => {
    state.currentModel = e.target.value;
    updateModelUI();
  });
  $("#btn-send").addEventListener("click", () => {
    const input = $("#prompt-input");
    const text = input.value.trim();
    if (!text || state.isStreaming) return;
    const includeContext = $("#include-page-content").checked;
    input.value = "";
    updateCharCounter();
    handleUserSubmission(text, includeContext);
  });
  $("#prompt-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#btn-send").click();
    }
  });
  $("#prompt-input").addEventListener("input", () => {
    const input = $("#prompt-input");
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
    updateCharCounter();
  });
  $("#btn-open-askdell").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_ASKDELL_TAB" });
    setTimeout(refreshAskDellStatus, 2000);
  });
  $("#btn-refresh-askdell-tab")?.addEventListener("click", async () => {
    $("#auth-banner-text").textContent = "Refreshing ask.dell.com tab to renew session...";
    await chrome.runtime.sendMessage({ type: "REFRESH_ASKDELL_TAB" });
    setTimeout(refreshAskDellStatus, 2500);
  });
  $("#btn-retry-auth").addEventListener("click", () => {
    refreshAskDellStatus();
  });
  $("#btn-refresh-context").addEventListener("click", () => {
    scanActiveTabContext();
  });
  $("#btn-stop-stream").addEventListener("click", stopActiveStream);
  $("#btn-stop").addEventListener("click", stopActiveStream);
  $("#btn-new-chat").addEventListener("click", startNewChat);
  $("#btn-history").addEventListener("click", toggleHistoryDrawer);
  $("#btn-close-history").addEventListener("click", () => {
    $("#history-panel").style.display = "none";
  });
  $("#btn-settings").addEventListener("click", () => {
    const panel = $("#settings-panel");
    $("#history-panel").style.display = "none";
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  $("#btn-close-settings").addEventListener("click", () => {
    saveSettings();
    $("#settings-panel").style.display = "none";
  });
  $("#btn-discover-models")?.addEventListener("click", async () => {
    const discDiv = $("#discovered-models");
    if (discDiv) discDiv.textContent = "Querying ask.dell.com/api/models...";
    await discoverModels();
  });
  $("#setting-default-model")?.addEventListener("change", (e) => {
    state.currentModel = e.target.value;
    const selector = $("#model-selector");
    if (selector) selector.value = e.target.value;
    updateModelUI();
    saveSettings();
  });
  $("#setting-web-search")?.addEventListener("change", saveSettings);
  $("#setting-include-page")?.addEventListener("change", saveSettings);
  $("#setting-max-length")?.addEventListener("change", saveSettings);
  $("#include-web-search")?.addEventListener("change", (e) => {
    state.settings.autoWebSearch = e.target.checked;
    const s = $("#setting-web-search");
    if (s) s.checked = e.target.checked;
    chrome.storage.local.set({ settings: state.settings });
  });
  $("#include-page-content")?.addEventListener("change", (e) => {
    state.settings.includePageContent = e.target.checked;
    const s = $("#setting-include-page");
    if (s) s.checked = e.target.checked;
    chrome.storage.local.set({ settings: state.settings });
  });
  $("#history-search-input").addEventListener("input", (e) => {
    filterHistoryList(e.target.value);
  });
  $$(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      executeQuickAction(action);
    });
  });
  $$(".template-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.dataset.prompt;
      $("#prompt-input").value = prompt;
      $("#prompt-input").focus();
      $("#prompt-input").dispatchEvent(new Event("input"));
    });
  });
}
function updateCharCounter() {
  const len = $("#prompt-input").value.length;
  $("#char-counter").textContent = `${len} chars`;
}
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "ANALYZE_SELECTION" || msg.type === "EXPLAIN_SELECTION" || msg.type === "ANALYZE_PAGE") {
      handleIncomingAction(msg);
    }
    if (msg.type === "ASKDELL_SESSION_EXPIRED" || msg.type === "SESSION_EXPIRED") {
      showSessionExpiredBanner();
    }
    if (msg.type === "ASKDELL_SESSION_ACTIVE") {
      const dot = $("#connection-status-dot");
      if (dot && !state.isStreaming) {
        dot.className = "status-dot dot-connected";
        dot.title = "Connected to AskDell (Session Kept Alive)";
      }
    }
  });
}
function showSessionExpiredBanner() {
  const dot = $("#connection-status-dot");
  const banner = $("#auth-banner");
  const bannerText = $("#auth-banner-text");
  const refreshBtn = $("#btn-refresh-askdell-tab");
  dot.className = "status-dot dot-offline";
  dot.title = "AskDell session expired (10-minute timeout)";
  banner.className = "banner banner-warning";
  banner.style.display = "flex";
  bannerText.textContent = "AskDell session expired (10-minute timeout). Please refresh the tab to renew.";
  if (refreshBtn) refreshBtn.style.display = "inline-block";
}
function executeQuickAction(actionType) {
  const prompts = {
    "full-review": "Perform a comprehensive PR code review on these changes. Evaluate architecture, logic correctness, edge cases, error handling, maintainability, and regression risks. Provide line-level feedback and severity ratings.",
    "security": "Perform a rigorous security vulnerability audit. Check for OWASP Top 10 flaws, injection risks (SQL, command, LDAP), XSS, CSRF, auth/authz bypasses, sensitive data exposure, SSRF, and insecure deserialization.",
    "performance": "Analyze this code for performance bottlenecks: algorithmic complexity (Big-O), redundant memory allocations, N+1 queries, unindexed DB accesses, thread safety, and resource leaks.",
    "clean-code": "Review this code for clean code practices, SOLID design principles, DRY adherence, naming readability, cyclomatic complexity, and recommend concise refactorings.",
    "summarize": "Provide a high-level technical executive summary of this content: 1) What changes or features are implemented, 2) Why they were implemented, 3) Key components affected, and 4) Potential deployment risks.",
    "explain": "Explain this code and architecture thoroughly as if onboarding a developer to the team. Explain data flow, design patterns, and non-obvious implementation details.",
    "debug": "Analyze this code for subtle bugs, race conditions, null pointer risks, off-by-one errors, and unhandled exceptions. For each bug, describe the issue, show the fix, and rate severity.",
    "test-cases": "Generate a comprehensive test suite specification for this code. Include unit test scenarios, boundary conditions, edge cases, negative tests, and mock recommendations following AAA (Arrange-Act-Assert).",
    "document": "Generate clean, comprehensive API and module documentation in Markdown format. Include function signatures, parameter descriptions, return types, usage examples, and architecture notes.",
    "refactor": "Suggest high-impact refactoring opportunities for this code. Propose modern design patterns (Strategy, Factory, Dependency Injection, etc.) to simplify complexity and improve modularity.",
    "architecture": "Evaluate the architectural design of this code/system: modularity, separation of concerns, coupling and cohesion, scalability considerations, and extensibility.",
    "api-review": "Perform an API design review: REST/GraphQL endpoint naming conventions, HTTP method semantics, payload design, error code structure, pagination, versioning, and rate limiting."
  };
  const template = prompts[actionType] || "Analyze the provided content in detail.";
  handleUserSubmission(template, true);
}
async function handleUserSubmission(userPromptText, attachContext = true, isRegenerate = false) {
  if (state.isStreaming) return;
  const isAuth = await refreshAskDellStatus();
  if (!isAuth) {
    showNotification("Please make sure ask.dell.com is open and logged in.", "error");
    return;
  }
  const welcomeCard = $("#welcome-card");
  if (welcomeCard) welcomeCard.remove();
  let fullPromptToSend = userPromptText;
  let attachedContextText = null;
  if (attachContext && state.pageContext) {
    attachedContextText = formatTabContent(state.pageContext);
    fullPromptToSend = `${userPromptText}\n\n---\n### Attached Page Context:\n${attachedContextText}`;
  }
  const meta = MODEL_META[state.currentModel] || {};
  if (!isRegenerate) {
    renderUserMessage(userPromptText, attachedContextText, meta.color === "claude" ? "claude-user" : "");
    state.messages.push({
      role: "user",
      content: fullPromptToSend,
      timestamp: Math.floor(Date.now() / 1000)
    });
  }
  const assistantCard = createAssistantStreamingCard(userPromptText, attachContext);
  state.isStreaming = true;
  updateUIStreamingState(true);
  const enableWebSearch = $("#include-web-search")?.checked ?? state.settings.autoWebSearch;
  try {
    await runStreamWithBridge({
      chatId: state.chatId,
      chatTitle: state.pageContext?.title ? `Analysis: ${state.pageContext.title.substring(0, 30)}` : "Developer Analysis",
      model: state.currentModel,
      webSearch: enableWebSearch,
      messages: state.messages
    }, assistantCard);
  } catch (err) {
    console.error("[AskDell] Stream error:", err);
    finalizeStreamingCard(assistantCard, `⚠️ **Error during analysis:**\n${err.message}`);
    updateUIStreamingState(false);
  }
}
function runStreamWithBridge(payload, assistantCard) {
  return new Promise(async (resolve, reject) => {
    const tab = await findAskDellTab();
    if (!tab) {
      reject(new Error("Lost connection to AskDell tab."));
      return;
    }
    try {
      state.activePort = chrome.tabs.connect(tab.id, { name: "askdell-stream" });
    } catch (e) {
      reject(new Error("Failed to connect to bridge content script. Please refresh ask.dell.com."));
      return;
    }
    let fullAccumulatedText = "";
    state.activePort.onDisconnect.addListener(() => {
      state.activePort = null;
      if (state.isStreaming) {
        updateUIStreamingState(false);
        finalizeStreamingCard(assistantCard, fullAccumulatedText);
        resolve(fullAccumulatedText);
      }
    });
    state.activePort.onMessage.addListener((msg) => {
      switch (msg.type) {
        case "chat_created":
          state.chatId = msg.chatId;
          break;
        case "status": {
          const action = msg.action || msg.status?.action;
          const desc = msg.description || msg.status?.description || "Processing...";
          const isDone = msg.done === true;
          let icon = isDone ? "✅" : "⏳";
          if (!isDone) {
            if (action && (action.includes("search") || action === "hybrid_web_search")) {
              icon = "🔍";
            } else if (action === "tool_call") {
              icon = "🔧";
            } else if (action === "thinking") {
              icon = "💭";
            }
          }
          updateStreamStatus(`${icon} ${desc}`, isDone);
          break;
        }
        case "token":
          fullAccumulatedText = msg.fullContent;
          updateAssistantStreamingContent(assistantCard, fullAccumulatedText);
          break;
        case "done":
          fullAccumulatedText = msg.fullContent;
          state.chatId = msg.chatId || state.chatId;
          finalizeStreamingCard(assistantCard, fullAccumulatedText);
          state.messages.push({
            role: "assistant",
            content: fullAccumulatedText,
            timestamp: Math.floor(Date.now() / 1000)
          });
          updateUIStreamingState(false);
          resolve(fullAccumulatedText);
          break;
        case "completed":
          break;
        case "error":
          updateUIStreamingState(false);
          finalizeStreamingCard(assistantCard, `⚠️ **AskDell API Error:**\n${msg.error}`);
          reject(new Error(msg.error));
          break;
      }
    });
    state.activePort.postMessage({
      type: "START_CHAT",
      payload: payload
    });
  });
}
function stopActiveStream() {
  if (state.activePort) {
    state.activePort.disconnect();
    state.activePort = null;
  }
  state.isStreaming = false;
  updateUIStreamingState(false);
  const activeMsg = $(".streaming-active");
  if (activeMsg) {
    activeMsg.classList.remove("streaming-active");
  }
}
function updateUIStreamingState(streaming) {
  state.isStreaming = streaming;
  $("#btn-send").disabled = streaming;
  $("#btn-stop").style.display = streaming ? "flex" : "none";
  $("#streaming-controls").style.display = streaming ? "flex" : "none";
  const meta = MODEL_META[state.currentModel] || { name: state.currentModel };
  if (streaming) {
    updateStreamStatus(`${meta.name || state.currentModel} is analyzing...`, false);
  } else {
    updateStreamStatus(`${meta.name || state.currentModel} is ready`, true);
  }
}
function updateStreamStatus(statusText, isDone = false) {
  const textEl = $("#stream-status-text");
  if (textEl) textEl.textContent = statusText;
  const iconEl = $("#stream-status-icon");
  if (iconEl) {
    if (isDone) {
      iconEl.className = "stream-done-icon";
      iconEl.textContent = "✅";
    } else {
      iconEl.className = "stream-spinner";
      iconEl.textContent = "";
    }
  }
}
function renderUserMessage(text, attachedContext, extraClass = "") {
  const container = $("#messages");
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper user";
  const msgDiv = document.createElement("div");
  msgDiv.className = `message message-user ${extraClass}`;
  const textDiv = document.createElement("div");
  textDiv.className = "user-text";
  textDiv.textContent = text;
  msgDiv.appendChild(textDiv);
  if (attachedContext) {
    const toggle = document.createElement("div");
    toggle.className = "attached-context-toggle";
    toggle.innerHTML = `<span>📎 Attached Context</span> <span class="arrow">▼</span>`;
    const preview = document.createElement("div");
    preview.className = "attached-context-box";
    preview.style.display = "none";
    preview.textContent = attachedContext.substring(0, 3000) + (attachedContext.length > 3000 ? "\n\n...[content truncated in preview]..." : "");
    toggle.addEventListener("click", () => {
      const isHidden = preview.style.display === "none";
      preview.style.display = isHidden ? "block" : "none";
      toggle.querySelector(".arrow").textContent = isHidden ? "▲" : "▼";
    });
    msgDiv.appendChild(toggle);
    msgDiv.appendChild(preview);
  }
  wrapper.appendChild(msgDiv);
  container.appendChild(wrapper);
  scrollMessagesToBottom();
}
function createAssistantStreamingCard(originalUserPrompt, wasContextAttached) {
  const container = $("#messages");
  const meta = MODEL_META[state.currentModel] || { name: state.currentModel, icon: "🟣", color: "claude" };
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper assistant";
  const msgDiv = document.createElement("div");
  msgDiv.className = "message message-assistant";
  const headerBar = document.createElement("div");
  headerBar.className = "message-header-bar";
  headerBar.innerHTML = `
    <div class="assistant-badge ${meta.color === 'gemini' ? 'gemini-badge' : ''}">
      <span>${meta.icon || '🟣'}</span>
      <span>${meta.name || state.currentModel}</span>
    </div>
    <div class="msg-header-actions">
      <button class="regenerate-msg-btn" title="Regenerate response">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>Regenerate</span>
      </button>
      <button class="copy-msg-btn" title="Copy response text">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      </button>
    </div>
  `;
  const bodyDiv = document.createElement("div");
  bodyDiv.className = `markdown-body streaming-active ${meta.color === 'gemini' ? 'gemini-stream' : ''}`;
  bodyDiv.innerHTML = "<p><em>Analyzing context and reasoning...</em></p>";
  msgDiv.appendChild(headerBar);
  msgDiv.appendChild(bodyDiv);
  wrapper.appendChild(msgDiv);
  container.appendChild(wrapper);
  scrollMessagesToBottom();
  headerBar.querySelector(".copy-msg-btn").addEventListener("click", () => {
    const rawText = bodyDiv.innerText;
    navigator.clipboard.writeText(rawText);
    const btnSpan = headerBar.querySelector(".copy-msg-btn span");
    btnSpan.textContent = "Copied!";
    setTimeout(() => { btnSpan.textContent = "Copy"; }, 1800);
  });
  headerBar.querySelector(".regenerate-msg-btn").addEventListener("click", () => {
    if (state.isStreaming) return;
    wrapper.remove();
    if (state.messages.length > 0 && state.messages[state.messages.length - 1].role === "assistant") {
      state.messages.pop();
    }
    const lastUserPrompt = originalUserPrompt || "Regenerate analysis with this model.";
    handleUserSubmission(lastUserPrompt, wasContextAttached ?? true, true);
  });
  return bodyDiv;
}
function updateAssistantStreamingContent(bodyElement, rawMarkdown) {
  bodyElement.innerHTML = renderMarkdown(rawMarkdown);
  attachCodeBlockCopyButtons(bodyElement);
  scrollMessagesToBottom();
}
function finalizeStreamingCard(bodyElement, finalMarkdown) {
  bodyElement.classList.remove("streaming-active", "gemini-stream");
  bodyElement.innerHTML = renderMarkdown(finalMarkdown || "(No content generated)");
  attachCodeBlockCopyButtons(bodyElement);
  scrollMessagesToBottom();
}
function scrollMessagesToBottom() {
  const container = $("#messages");
  container.scrollTop = container.scrollHeight;
}
function showNotification(text, type = "info") {
  const banner = $("#auth-banner");
  const bannerText = $("#auth-banner-text");
  banner.className = `banner banner-${type === "error" ? "warning" : "info"}`;
  bannerText.textContent = text;
  banner.style.display = "flex";
  setTimeout(() => {
    banner.style.display = "none";
  }, 4000);
}
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function renderMarkdown(md) {
  if (!md) return "";
  const codeBlocks = [];
  let processed = md.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({ lang: lang.trim().toLowerCase(), code: code });
    return `§§CODEBLOCK_${index}§§`;
  });
  const reasoningBlocks = [];
  processed = processed.replace(/<details\b[^>]*?(?:type=["']?thought["']?|class=["']?thought["']?)[^>]*>([\s\S]*?)<\/details>/gi, (match, inner) => {
    const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
    const summaryText = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "Thinking Process";
    const content = inner.replace(/<summary>[\s\S]*?<\/summary>/i, "").trim();
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: summaryText, content, inProgress: false });
    return `§§REASONING_${index}§§`;
  });
  processed = processed.replace(/<think>([\s\S]*?)<\/think>/gi, (match, inner) => {
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: "Thinking Process", content: inner.trim(), inProgress: false });
    return `§§REASONING_${index}§§`;
  });
  processed = processed.replace(/<details\b[^>]*?(?:type=["']?thought["']?|class=["']?thought["']?)[^>]*>([\s\S]*)$/gi, (match, inner) => {
    const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
    const summaryText = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "Thinking Process";
    const content = inner.replace(/<summary>[\s\S]*?<\/summary>/i, "").trim();
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: `${summaryText} (analyzing...)`, content, inProgress: true });
    return `§§REASONING_${index}§§`;
  });
  processed = processed.replace(/<think>([\s\S]*)$/gi, (match, inner) => {
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: "Thinking Process (analyzing...)", content: inner.trim(), inProgress: true });
    return `§§REASONING_${index}§§`;
  });
  processed = escapeHtml(processed);
  processed = processed.replace(/^#### (.*?)$/gm, "<h4>$1</h4>");
  processed = processed.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  processed = processed.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  processed = processed.replace(/^# (.*?)$/gm, "<h1>$1</h1>");
  processed = processed.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr class="markdown-hr">');
  processed = processed.replace(/^(?:&gt;|>)[ \t]?(.*?)$/gm, "<blockquote>$1</blockquote>");
  processed = processed.replace(/<\/blockquote>\s*<blockquote>/g, "<br>");
  processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");
  processed = processed.replace(/~~(.*?)~~/g, "<del>$1</del>");
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const safeUrl = /^(https?:|\/|#)/i.test(url.trim()) ? url.trim() : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="markdown-link">${text}</a>`;
  });
  processed = renderMarkdownTables(processed);
  processed = processed.replace(/^\s*[\-\*]\s+(.*?)$/gm, "<li>$1</li>");
  processed = processed.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
  processed = processed.replace(/<\/ul>\s*<ul>/g, "");
  processed = processed.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<oli value="$1">$2</oli>');
  processed = processed.replace(/(<oli[^>]*>[\s\S]*?<\/oli>)/g, "<ol>$1</ol>");
  processed = processed.replace(/<\/ol>\s*<ol>/g, "");
  processed = processed.replace(/<oli value="(\d+)">/g, '<li value="$1">');
  processed = processed.replace(/<\/oli>/g, "</li>");
  processed = processed.replace(/\s*(<hr[^>]*>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(<ol>[\s\S]*?<\/ol>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(<ul>[\s\S]*?<\/ul>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(<blockquote[\s\S]*?<\/blockquote>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(§§CODEBLOCK_\d+§§)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(§§REASONING_\d+§§)\s*/g, "\n\n$1\n\n");
  const paragraphs = processed.split(/\n{2,}/);
  processed = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("§§CODEBLOCK_") ||
        trimmed.startsWith("§§REASONING_")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
  processed = processed.replace(/§§CODEBLOCK_(\d+)§§/g, (match, idx) => {
    const item = codeBlocks[Number(idx)];
    if (!item) return "";
    return formatCodeBlock(item.lang, item.code);
  });
  processed = processed.replace(/§§REASONING_(\d+)§§/g, (match, idx) => {
    const item = reasoningBlocks[Number(idx)];
    if (!item) return "";
    const escapedSummary = escapeHtml(item.summary || "Thinking Process");
    const escapedInner = escapeHtml(item.content || "");
    const isOpen = item.inProgress ? "open" : "";
    return `
      <details class="reasoning-block" ${isOpen}>
        <summary class="reasoning-summary">
          <span class="reasoning-icon">💭</span>
          <span class="reasoning-title">${escapedSummary}</span>
        </summary>
        <div class="reasoning-content">${escapedInner}</div>
      </details>
    `;
  });
  return processed;
}
function formatCodeBlock(lang, code) {
  const languageLabel = lang || "code";
  const escapedCode = escapeHtml(code.trim());
  let formattedInner = "";
  if (lang === "diff" || /^[+\-@ ]/m.test(code)) {
    const lines = escapedCode.split("\n");
    formattedInner = lines
      .map((line) => {
        if (line.startsWith("+")) {
          return `<span class="diff-line diff-add">${line}</span>`;
        } else if (line.startsWith("-")) {
          return `<span class="diff-line diff-del">${line}</span>`;
        } else if (line.startsWith("@@")) {
          return `<span class="diff-line diff-meta">${line}</span>`;
        }
        return `<span class="diff-line">${line}</span>`;
      })
      .join("");
  } else {
    formattedInner = escapedCode;
  }
  return `
    <div class="code-block-container">
      <div class="code-header">
        <span>${languageLabel}</span>
        <button class="code-copy-btn" data-raw="${encodeURIComponent(code)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy code</span>
        </button>
      </div>
      <pre><code>${formattedInner}</code></pre>
    </div>
  `;
}
function renderMarkdownTables(text) {
  return text.replace(/((\|[^\n]+\|\r?\n)((?:\|[^\n]+\|\r?\n?)+))/g, (match) => {
    const rows = match.trim().split("\n").map(r => r.trim());
    if (rows.length < 2) return match;
    const headerCols = rows[0].split("|").slice(1, -1).map(c => c.trim());
    const isDivider = /^[\s|:-]+$/.test(rows[1]);
    const bodyStartIndex = isDivider ? 2 : 1;
    let html = "<table><thead><tr>";
    headerCols.forEach(col => {
      html += `<th>${col}</th>`;
    });
    html += "</tr></thead><tbody>";
    for (let i = bodyStartIndex; i < rows.length; i++) {
      const cols = rows[i].split("|").slice(1, -1).map(c => c.trim());
      html += "<tr>";
      cols.forEach(c => {
        html += `<td>${c}</td>`;
      });
      html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
  });
}
function attachCodeBlockCopyButtons(container) {
  container.querySelectorAll(".code-copy-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const raw = decodeURIComponent(btn.dataset.raw || "");
      navigator.clipboard.writeText(raw);
      const span = btn.querySelector("span");
      span.textContent = "Copied!";
      setTimeout(() => { span.textContent = "Copy code"; }, 1800);
    };
  });
}
function formatTabContent(content) {
  if (typeof content === "string") return content.substring(0, state.settings.maxContentLength);
  const parts = [];
  if (content.platform) parts.push(`Platform: ${content.platform}`);
  if (content.type) parts.push(`Content Type: ${content.type}`);
  if (content.title) parts.push(`Title: ${content.title}`);
  if (content.url) parts.push(`URL: ${content.url}`);
  if (content.files?.length) parts.push(`Files (${content.files.length}):\n${content.files.map(f => `- ${f}`).join("\n")}`);
  if (content.body) parts.push(`\nDescription / Body:\n${content.body}`);
  if (content.diff) parts.push(`\nDiff / Changes:\n\`\`\`diff\n${content.diff}\n\`\`\``);
  if (content.code) parts.push(`\nSource Code:\n\`\`\`\n${content.code}\n\`\`\``);
  if (content.comments) parts.push(`\nDiscussion / Comments:\n${content.comments}`);
  if (content.logs) parts.push(`\nLogs:\n\`\`\`\n${content.logs}\n\`\`\``);
  if (content.tables) parts.push(`\nTables:\n${content.tables}`);
  return parts.join("\n\n").substring(0, state.settings.maxContentLength);
}
async function toggleHistoryDrawer() {
  const panel = $("#history-panel");
  $("#settings-panel").style.display = "none";
  if (panel.style.display !== "none") {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "flex";
  const list = $("#history-list");
  list.innerHTML = `<div class="history-loading">Fetching conversations from AskDell...</div>`;
  const tab = await findAskDellTab();
  if (!tab) {
    list.innerHTML = `<div class="history-loading" style="color:var(--text-muted);">Please open ask.dell.com to view history.</div>`;
    return;
  }
  try {
    const history = await chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_GET_HISTORY", page: 1 });
    renderHistoryList(history);
  } catch (err) {
    list.innerHTML = `<div class="history-loading" style="color:#ef4444;">Failed to load history: ${err.message}</div>`;
  }
}
function renderHistoryList(historyData) {
  const list = $("#history-list");
  list.innerHTML = "";
  const items = Array.isArray(historyData) ? historyData : (historyData?.chats || historyData?.data || []);
  state.historyCache = items;
  if (items.length === 0) {
    list.innerHTML = `<div class="history-loading" style="color:var(--text-muted);">No past conversations found.</div>`;
    return;
  }
  items.forEach((chat) => {
    const itemEl = document.createElement("div");
    itemEl.className = `history-item ${chat.id === state.chatId ? 'active' : ''}`;
    const title = chat.title || "Untitled Conversation";
    const dateStr = chat.updated_at ? new Date(chat.updated_at * 1000).toLocaleDateString() : "";
    itemEl.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      ${dateStr ? `<span class="history-item-date">${dateStr}</span>` : ""}
    `;
    itemEl.addEventListener("click", () => {
      loadChatFromHistory(chat.id);
    });
    list.appendChild(itemEl);
  });
}
function filterHistoryList(query) {
  const q = query.toLowerCase().trim();
  const list = $("#history-list");
  list.innerHTML = "";
  const filtered = state.historyCache.filter(item => (item.title || "").toLowerCase().includes(q));
  if (filtered.length === 0) {
    list.innerHTML = `<div class="history-loading" style="color:var(--text-muted);">No matching conversations</div>`;
    return;
  }
  filtered.forEach((chat) => {
    const itemEl = document.createElement("div");
    itemEl.className = `history-item ${chat.id === state.chatId ? 'active' : ''}`;
    itemEl.innerHTML = `<strong>${escapeHtml(chat.title || "Untitled")}</strong>`;
    itemEl.addEventListener("click", () => loadChatFromHistory(chat.id));
    list.appendChild(itemEl);
  });
}
async function loadChatFromHistory(chatId) {
  const tab = await findAskDellTab();
  if (!tab) return;
  try {
    const chat = await chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_GET_CHAT", chatId });
    if (chat) {
      state.chatId = chatId;
      state.messages = [];
      const container = $("#messages");
      container.innerHTML = "";
      const msgsMap = chat?.chat?.history?.messages || chat?.history?.messages;
      let orderedMessages = [];
      if (msgsMap && typeof msgsMap === "object" && !Array.isArray(msgsMap)) {
        orderedMessages = Object.values(msgsMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      } else if (Array.isArray(chat?.chat?.messages)) {
        orderedMessages = chat.chat.messages;
      } else if (Array.isArray(chat?.messages)) {
        orderedMessages = chat.messages;
      }
      orderedMessages.forEach((msg) => {
        if (!msg.content && msg.role !== "user") return;
        state.messages.push({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        });
        if (msg.role === "user") {
          renderUserMessage(msg.content, null);
        } else if (msg.role === "assistant") {
          const card = createAssistantStreamingCard(null, false);
          finalizeStreamingCard(card, msg.content);
        }
      });
      $("#history-panel").style.display = "none";
    }
  } catch (err) {
    showNotification(`Could not load chat: ${err.message}`, "error");
  }
}
function startNewChat() {
  state.chatId = null;
  state.messages = [];
  const container = $("#messages");
  container.innerHTML = `
    <div id="welcome-card" class="welcome-card">
      <div class="welcome-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <h2>New Analysis Session</h2>
      <p>Ask a question about the active page or choose an action chip above.</p>
    </div>
  `;
  $("#prompt-input").value = "";
  $("#prompt-input").focus();
  updateCharCounter();
}