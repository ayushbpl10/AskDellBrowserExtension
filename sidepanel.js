// ============================================================
// sidepanel.js — AskDell Dev Assistant v2.0.0
// Features: Multi-model selector, Claude Opus default,
// general-purpose developer analysis, and model auto-discovery
// ============================================================

// State Management
let state = {
  chatId: null,
  shareId: null,
  isShared: false,
  userName: "You",
  messages: [], // { role, content, timestamp, model, author }
  isStreaming: false,
  activePort: null,
  demoStreamTimer: null,
  demoMode: false,
  currentModel: "claude-opus-4-6",
  pageContext: null,
  availableModels: [],
  historyCache: [],
  customActions: [],
  connection: { status: "checking" },
  settings: {
    model: "claude-opus-4-6",
    includePageContent: true,
    smartNoiseFilter: true,
    autoWebSearch: true,
    maxContentLength: 100000,
    connectionMode: "enterprise"
  }
};

// Model Metadata Registry — Full 10-Model AskDell Catalog
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
  // Legacy aliases
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

// Model Context Windows (Tokens)
const MODEL_CONTEXT_WINDOWS = {
  "claude-opus-4-6": 200000,
  "claude-sonnet-5": 200000,
  "claude-opus": 200000,
  "claude-sonnet": 200000,
  "gemini-3-8-flash": 1000000,
  "gemini-3.1-pro-preview": 1000000,
  "gemini-flash": 1000000,
  "gemini-pro": 1000000,
  "llama-3.3-70b-instruct": 128000,
  "gemma-3-27b-it": 128000,
  "gpt-oss-120b": 128000,
  "gpt-oss-20b": 64000,
  "pixtral-12b-vision": 128000
};

// Default Custom Action Templates
const DEFAULT_CUSTOM_ACTIONS = [
  {
    id: "custom-sdl-security",
    title: "Dell SDL Security",
    emoji: "🛡️",
    prompt: "Conduct a comprehensive Dell Secure Development Lifecycle (SDL) audit: check for hardcoded API keys, private corporate tokens, unencrypted communication, TLS verification bypass, and vulnerable open-source dependencies."
  },
  {
    id: "custom-k8s-manifest",
    title: "K8s & Cloud Audit",
    emoji: "☸️",
    prompt: "Audit this Kubernetes / Helm / Docker configuration for security and resilience: check resource limits, read-only root filesystems, non-root user enforcement, health probes, and secret mounting."
  }
];

// Smart Noise Filter Patterns for Code Review
const NOISY_FILE_EXTENSIONS = [
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
  "gemfile.lock", "cargo.lock", "go.sum", "poetry.lock", "pipfile.lock",
  ".min.js", ".min.css", ".bundle.js", ".chunk.js", ".map"
];

function isNoisyFile(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  const lower = filePath.toLowerCase().trim();
  return NOISY_FILE_EXTENSIONS.some(noise => lower.endsWith(noise) || lower.includes("/" + noise));
}

function sanitizeDiffNoise(diffText) {
  if (!diffText || typeof diffText !== "string") return "";
  const splitPattern = diffText.includes("diff --git")
    ? /(?=(?:^|\n)diff --git )/
    : /(?=(?:^|\n)(?:Index: |=== |--- [ab]\/))/;
  const blocks = diffText.split(splitPattern);
  if (blocks.length <= 1) return diffText;

  let omittedCount = 0;
  const cleaned = [];
  for (const block of blocks) {
    let isBlockNoisy = false;
    for (const noise of NOISY_FILE_EXTENSIONS) {
      if (block.toLowerCase().includes(noise)) {
        isBlockNoisy = true;
        omittedCount++;
        break;
      }
    }
    if (!isBlockNoisy) {
      cleaned.push(block);
    }
  }

  if (omittedCount > 0) {
    cleaned.push(`\n[ℹ️ Smart Noise Filter: Omitted ${omittedCount} generated / lockfile diff section(s) to optimize context tokens]`);
  }
  return cleaned.join("");
}

function formatPrSuggestion(rawCode) {
  if (!rawCode || typeof rawCode !== "string") return "```suggestion\n```";
  let clean = rawCode;
  if (clean.includes("\n+") || clean.startsWith("+")) {
    const lines = clean.split(/\r?\n/)
      .filter(l => l.startsWith("+") && !l.startsWith("+++"))
      .map(l => (l.startsWith("+ ") ? l.slice(2) : l.slice(1)));
    if (lines.length > 0) clean = lines.join("\n");
  }
  return `\`\`\`suggestion\n${clean.trim()}\n\`\`\``;
}

function trimCiLogs(rawLogs) {
  if (!rawLogs || typeof rawLogs !== "string") return "";
  const lines = rawLogs.split(/\r?\n/);
  if (lines.length <= 40) return rawLogs;

  const failurePattern = /(?:npm ERR!|FAILED:|AssertionError|panic:|FATAL:|BUILD FAILURE|FAILURE:|Exit status:|Traceback \(most recent call last\):|Exception in thread|SyntaxError:|ReferenceError:|TypeError:|NullPointerException|FAIL [a-zA-Z0-9_/.-]+|❌|=== RUN|Error:|ERROR:|FAILED TESTS)/i;

  const matchedIndices = new Set();
  lines.forEach((line, idx) => {
    if (failurePattern.test(line)) {
      const start = Math.max(0, idx - 3);
      const end = Math.min(lines.length - 1, idx + 8);
      for (let i = start; i <= end; i++) {
        matchedIndices.add(i);
      }
    }
  });

  if (matchedIndices.size === 0) {
    const head = lines.slice(0, 15).join("\n");
    const tail = lines.slice(-40).join("\n");
    return `${head}\n\n[... non-error setup logs truncated ...]\n\n${tail}`;
  }

  const sortedIndices = Array.from(matchedIndices).sort((a, b) => a - b);
  const resultLines = [];
  let lastIdx = -1;

  sortedIndices.forEach((idx) => {
    if (lastIdx !== -1 && idx > lastIdx + 1) {
      resultLines.push("... [intermediate output trimmed] ...");
    }
    resultLines.push(lines[idx]);
    lastIdx = idx;
  });

  return `[🔍 CI Log Trimmer: Isolated failure sections from ${lines.length} lines]\n` + resultLines.join("\n");
}

function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.max(1, Math.ceil(text.length / 3.8));
}

function getModelMetadata(modelId, modelName = "") {
  if (MODEL_META[modelId]) return MODEL_META[modelId];

  const lowerId = (modelId || "").toLowerCase();
  const lowerName = (modelName || "").toLowerCase();

  for (const [key, meta] of Object.entries(MODEL_META)) {
    if (lowerId === key.toLowerCase() || lowerName === meta.name.toLowerCase()) {
      return meta;
    }
  }

  // Smart heuristic fallbacks
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

// DOM Element Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await loadSettings();
  await loadCustomActions();
  setupEventListeners();
  setupMessageListeners();
  initCommandPalette();
  updateTokenMeter();
  
  // Detect active tab context immediately
  await scanActiveTabContext();

  // Monitor AskDell connectivity and authentication silently in background
  initConnectionMonitoring();

  // Auto-discover available models on AskDell instance
  discoverModels();

  // Check if opened via context menu action
  await checkPendingAction();

  // Check if opened with a shared link in query param or hash
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const joinParam = urlParams.get("join") || urlParams.get("share");
    const hash = window.location.hash;
    if (joinParam) {
      await handleJoinSession(joinParam);
    } else if (hash && hash.includes("session=")) {
      await handleJoinSession(hash);
    }
  } catch (err) {
    // Ignore URL parse errors
  }
});

// ============================================================
// THEME MANAGEMENT
// ============================================================
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

// ============================================================
// SETTINGS MANAGEMENT
// ============================================================
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["settings", "demoMode", "userName"], (res) => {
      if (res.settings) {
        state.settings = { ...state.settings, ...res.settings };
        if (state.settings.model === "claude-opus") {
          state.settings.model = "claude-opus-4-6";
          chrome.storage.local.set({ settings: state.settings });
        }
      }
      
      if (res.demoMode !== undefined) {
        state.demoMode = Boolean(res.demoMode);
      } else if (state.settings.connectionMode === "demo") {
        state.demoMode = true;
      }

      if (res.userName) {
        state.userName = res.userName;
      }
      const nameInput = $("#user-display-name");
      if (nameInput) nameInput.value = state.userName === "You" ? "" : state.userName;

      const connModeEl = $("#setting-connection-mode");
      if (connModeEl) connModeEl.value = state.demoMode ? "demo" : "enterprise";

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

      state.settings.smartNoiseFilter = res.settings?.smartNoiseFilter ?? true;
      const noiseEl = $("#setting-noise-filter");
      if (noiseEl) noiseEl.checked = state.settings.smartNoiseFilter;

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
  state.settings.smartNoiseFilter = $("#setting-noise-filter")?.checked ?? true;
  state.settings.maxContentLength = parseInt($("#setting-max-length")?.value, 10) || 100000;
  state.settings.connectionMode = $("#setting-connection-mode")?.value || (state.demoMode ? "demo" : "enterprise");
  state.demoMode = state.settings.connectionMode === "demo";

  const quickIncludeEl = $("#include-page-content");
  if (quickIncludeEl) quickIncludeEl.checked = state.settings.includePageContent;

  const quickWebEl = $("#include-web-search");
  if (quickWebEl) quickWebEl.checked = state.settings.autoWebSearch;

  chrome.storage.local.set({ settings: state.settings, demoMode: state.demoMode });
}

// ============================================================
// MODEL SELECTION & DISCOVERY
// ============================================================
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

  // Web search is supported natively on Gemini models
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

  // Keep existing selection if valid, or default to claude-opus-4-6
  if (Array.from(selector.options).some((o) => o.value === currentVal)) {
    selector.value = currentVal;
  } else if (Array.from(selector.options).some((o) => o.value === "claude-opus-4-6")) {
    selector.value = "claude-opus-4-6";
  }

  state.currentModel = selector.value;
  if (settingSelector) settingSelector.value = state.currentModel;
  updateModelUI();
}

// ============================================================
// CONTEXT MENU PENDING ACTIONS
// ============================================================
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

// ============================================================
// ASKDIELL BRIDGE & SILENT BACKGROUND CONNECTION
// ============================================================
async function findAskDellTab() {
  try {
    const tabs = await chrome.tabs.query({ url: "*://ask.dell.com/*" });
    if (tabs && tabs.length > 0) {
      return tabs[0];
    }
  } catch (e) {
    console.warn("[AskDell] findAskDellTab error:", e);
  }
  return null;
}

function applyConnectionState(conn) {
  const dot = $("#connection-status-dot");
  const banner = $("#auth-banner");
  const bannerText = $("#auth-banner-text");
  const bannerSubtext = $("#auth-banner-subtext");
  const bannerIcon = $("#auth-banner-icon");
  const openBtn = $("#btn-open-askdell");
  const openBtnLabel = $("#btn-open-askdell-label");
  const retryBtn = $("#btn-retry-auth");
  const retryLabel = $("#btn-retry-auth-label");
  const demoBtn = $("#btn-demo-mode");
  const demoBtnLabel = $("#btn-demo-mode-label");

  if (!dot || !banner) return;

  // 1. Reviewer Demo Mode Active
  if (state.demoMode) {
    dot.className = "status-dot dot-demo";
    dot.title = "Reviewer Demo Mode Active (Simulated Claude Opus 4.6 & Gemini 3.8)";
    banner.className = "auth-card auth-card-demo";
    banner.style.display = "flex";
    if (bannerIcon) bannerIcon.textContent = "🧪";
    if (bannerText) bannerText.textContent = "Reviewer Demo Mode Active";
    if (bannerSubtext) {
      bannerSubtext.textContent = "Simulated Claude Opus 4.6 & Gemini 3.8 models with full action & chat support.";
    }
    if (openBtn) openBtn.style.display = "none";
    if (retryBtn) retryBtn.style.display = "none";
    if (demoBtn) {
      demoBtn.style.display = "inline-flex";
      demoBtn.style.width = "100%";
      if (demoBtnLabel) demoBtnLabel.textContent = "🌐 Switch to Live Dell VPN";
    }
    return true;
  }

  // 2. Enterprise Mode: Reset button styling
  if (demoBtn) {
    demoBtn.style.width = "";
    if (demoBtnLabel) demoBtnLabel.textContent = "🧪 Try Demo Mode";
  }

  const status = conn?.status || "not_open";

  if (status === "connected") {
    dot.className = "status-dot dot-connected";
    dot.title = "Connected to AskDell · Session Active (Dell VPN)";
    banner.style.display = "none";
    return true;
  }

  if (status === "unauthenticated") {
    dot.className = "status-dot dot-warning";
    dot.title = "Authentication Required · Please sign in on ask.dell.com";
    banner.className = "auth-card auth-card-unauth";
    banner.style.display = "flex";
    if (bannerIcon) bannerIcon.textContent = "🔐";
    if (bannerText) bannerText.textContent = "Authentication Required";
    if (bannerSubtext) {
      bannerSubtext.textContent = "Please sign in to your Dell account on ask.dell.com to start your session.";
    }
    if (openBtn) {
      openBtn.style.display = "inline-flex";
      if (openBtnLabel) openBtnLabel.textContent = "🔑 Switch to Tab & Sign In";
    }
    if (retryBtn) {
      retryBtn.style.display = "inline-flex";
      if (retryLabel) retryLabel.textContent = "Check Status";
    }
    if (demoBtn) demoBtn.style.display = "inline-flex";
    return false;
  }

  // status === "not_open" or fallback
  dot.className = "status-dot dot-offline";
  dot.title = "No ask.dell.com tab open (Requires Dell Corporate Network/VPN)";
  banner.className = "auth-card auth-card-warning";
  banner.style.display = "flex";
  if (bannerIcon) bannerIcon.textContent = "🏢";
  if (bannerText) bannerText.textContent = "AskDell Session Not Open";
  if (bannerSubtext) {
    bannerSubtext.textContent = "Open an AskDell tab on your Dell VPN to enable live Claude Opus 4 & Gemini models.";
  }
  if (openBtn) {
    openBtn.style.display = "inline-flex";
    if (openBtnLabel) openBtnLabel.textContent = "🌐 Open AskDell Session";
  }
  if (retryBtn) {
    retryBtn.style.display = "inline-flex";
    if (retryLabel) retryLabel.textContent = "Check Connection";
  }
  if (demoBtn) demoBtn.style.display = "inline-flex";
  return false;
}

function initConnectionMonitoring() {
  chrome.runtime.sendMessage({ type: "GET_ASKDELL_CONNECTION" }, (conn) => {
    if (chrome.runtime.lastError) return;
    if (conn) {
      state.connection = conn;
      applyConnectionState(conn);
    }
  });
}

async function refreshAskDellStatus() {
  if (state.demoMode) {
    applyConnectionState(state.connection);
    return true;
  }
  try {
    const conn = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CHECK_ASKDELL_CONNECTION" }, (res) => resolve(res));
    });
    if (conn) {
      state.connection = conn;
      applyConnectionState(conn);
      return conn.status === "connected";
    }
  } catch (e) {
    console.warn("[AskDell] Check connection error:", e);
  }
  return false;
}

// ============================================================
// ACTIVE TAB CONTEXT SCANNING
// ============================================================
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

      // Auto-detect shared AskDell session in active tab
      if (response.content.platform === "askdell" && response.content.type === "shared_chat" && response.content.shareId) {
        if (state.messages.length === 0 && !state.shareId) {
          console.log("[AskDell Dev Assistant] Auto-syncing active tab shared session:", response.content.shareId);
          handleJoinSession(response.content.url || response.content.shareId);
        }
      }
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
    shared_chat: "Shared Session",
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
  updateTokenMeter();
}

// ============================================================
// EVENT LISTENERS SETUP
// ============================================================
function setupEventListeners() {
  // Model selector change
  $("#model-selector")?.addEventListener("change", (e) => {
    state.currentModel = e.target.value;
    updateModelUI();
    updateTokenMeter();
  });

  // Send message
  $("#btn-send").addEventListener("click", () => {
    const input = $("#prompt-input");
    const text = input.value.trim();
    if (!text || state.isStreaming) return;
    const includeContext = $("#include-page-content").checked;
    input.value = "";
    updateCharCounter();
    updateTokenMeter();
    handleUserSubmission(text, includeContext);
  });

  // Enter to send (Shift+Enter for newline)
  $("#prompt-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#btn-send").click();
    }
  });

  // Auto-expand textarea & character counter & token meter
  $("#prompt-input").addEventListener("input", () => {
    const input = $("#prompt-input");
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
    updateCharCounter();
    updateTokenMeter();
  });

  // Banner Actions
  $("#btn-demo-mode")?.addEventListener("click", async () => {
    if (!state.demoMode) {
      state.demoMode = true;
      await chrome.storage.local.set({ demoMode: true });
      const settingConn = $("#setting-connection-mode");
      if (settingConn) settingConn.value = "demo";
      applyConnectionState(state.connection);
      showNotification("🧪 Reviewer Demo Mode activated. All 12 AI actions and streaming are now testable.", "info");
    } else {
      state.demoMode = false;
      await chrome.storage.local.set({ demoMode: false });
      const settingConn = $("#setting-connection-mode");
      if (settingConn) settingConn.value = "enterprise";
      applyConnectionState(state.connection);
      showNotification("Switched to Live Enterprise Mode (requires ask.dell.com tab on Dell VPN).", "info");
    }
  });

  $("#btn-open-askdell")?.addEventListener("click", async () => {
    const labelEl = $("#btn-open-askdell-label");
    const origText = labelEl ? labelEl.textContent : "";
    if (labelEl) labelEl.textContent = "Opening / Switching...";
    try {
      await chrome.runtime.sendMessage({ type: "OPEN_OR_FOCUS_ASKDELL" });
      showNotification("Opened or focused ask.dell.com. If unauthenticated, please sign in.", "info");
    } catch (err) {
      console.warn("[AskDell] Open tab error:", err);
    } finally {
      setTimeout(() => {
        if (labelEl) labelEl.textContent = origText;
      }, 1500);
    }
  });

  $("#btn-retry-auth")?.addEventListener("click", async () => {
    const retryIcon = $("#btn-retry-icon");
    const retryLabel = $("#btn-retry-auth-label");
    if (retryIcon) retryIcon.classList.add("spin-icon");
    if (retryLabel) retryLabel.textContent = "Checking...";

    try {
      const conn = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CHECK_ASKDELL_CONNECTION" }, (res) => resolve(res));
      });
      if (conn) {
        state.connection = conn;
        applyConnectionState(conn);
        if (conn.status === "connected") {
          showNotification("✅ Connected to AskDell! Live Claude Opus 4.6 & Gemini ready.", "success");
        } else if (conn.status === "unauthenticated") {
          showNotification("🔐 AskDell tab detected. Please sign in to complete authentication.", "warning");
        } else {
          showNotification("🏢 AskDell tab not open. Connect to Dell VPN and click Open Session.", "warning");
        }
      }
    } catch (err) {
      console.warn("[AskDell] Check connection error:", err);
    } finally {
      setTimeout(() => {
        if (retryIcon) retryIcon.classList.remove("spin-icon");
        if (retryLabel) {
          retryLabel.textContent = state.connection?.status === "unauthenticated" ? "Check Status" : "Check Connection";
        }
      }, 500);
    }
  });

  // Re-scan context
  $("#btn-refresh-context").addEventListener("click", () => {
    scanActiveTabContext();
  });

  // Stop Generation buttons
  $("#btn-stop-stream").addEventListener("click", stopActiveStream);
  $("#btn-stop").addEventListener("click", stopActiveStream);

  // New Chat button
  $("#btn-new-chat").addEventListener("click", startNewChat);

  // History Drawer toggle
  $("#btn-history").addEventListener("click", toggleHistoryDrawer);
  $("#btn-close-history").addEventListener("click", () => {
    $("#history-panel").style.display = "none";
  });

  // Settings Drawer toggle
  $("#btn-settings").addEventListener("click", () => {
    const panel = $("#settings-panel");
    const isHidden = panel.style.display === "none";
    closeAllDrawers();
    panel.style.display = isHidden ? "flex" : "none";
  });

  $("#btn-close-settings").addEventListener("click", () => {
    saveSettings();
    $("#settings-panel").style.display = "none";
  });

  // Group Chat & Share Drawer toggle
  $("#btn-share-chat")?.addEventListener("click", toggleSharePanel);
  $("#btn-close-share")?.addEventListener("click", () => {
    $("#share-panel").style.display = "none";
  });
  $("#shared-session-badge")?.addEventListener("click", toggleSharePanel);

  // Export & Report Drawer toggle
  $("#btn-export-menu")?.addEventListener("click", toggleExportDrawer);
  $("#btn-close-export")?.addEventListener("click", () => {
    $("#export-panel").style.display = "none";
  });
  $("#btn-download-md")?.addEventListener("click", downloadMarkdownReport);
  $("#btn-copy-pr-comment")?.addEventListener("click", copyAsPRComment);
  $("#btn-copy-jira-comment")?.addEventListener("click", copyAsJiraComment);

  // Custom Actions Drawer toggle & management
  $("#btn-add-custom-action")?.addEventListener("click", toggleCustomActionsDrawer);
  $("#btn-close-custom-actions")?.addEventListener("click", () => {
    $("#custom-action-panel").style.display = "none";
  });
  $("#btn-save-custom-action")?.addEventListener("click", () => {
    const title = $("#custom-action-title")?.value?.trim();
    const emoji = $("#custom-action-emoji")?.value?.trim() || "⚡";
    const prompt = $("#custom-action-prompt")?.value?.trim();
    if (title && prompt) {
      saveCustomAction(title, emoji, prompt);
      if ($("#custom-action-title")) $("#custom-action-title").value = "";
      if ($("#custom-action-prompt")) $("#custom-action-prompt").value = "";
    } else {
      showNotification("Please provide both an Action Name and Prompt.", "warning");
    }
  });

  // Model Arena Drawer
  $("#btn-arena")?.addEventListener("click", toggleArenaDrawer);
  $("#btn-close-arena")?.addEventListener("click", () => {
    $("#arena-panel").style.display = "none";
  });
  $("#btn-run-arena")?.addEventListener("click", handleRunArena);
  $$(".arena-prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const p = chip.dataset.prompt;
      const inp = $("#arena-prompt-input");
      if (inp && p) inp.value = p;
    });
  });

  // Framework Test Synthesizer
  $("#btn-open-test-builder")?.addEventListener("click", toggleTestSynthesizerDrawer);
  $("#btn-close-test-synthesizer")?.addEventListener("click", () => {
    $("#test-synthesizer-panel").style.display = "none";
  });
  $("#btn-run-test-synthesizer")?.addEventListener("click", handleRunTestSynthesizer);

  // Command Palette
  $("#btn-cmd-palette")?.addEventListener("click", toggleCommandPalette);

  // Token meter click for stats breakdown
  $("#token-meter-badge")?.addEventListener("click", () => {
    const modelName = MODEL_META[state.currentModel]?.name || state.currentModel;
    const maxTokens = MODEL_CONTEXT_WINDOWS[state.currentModel] || 128000;
    showNotification(`⚡ Model Window: ${modelName} (${maxTokens.toLocaleString()} tokens capacity)`, "info");
  });

  $("#btn-generate-share")?.addEventListener("click", handleGenerateShareLink);
  $("#btn-copy-share-link")?.addEventListener("click", copyShareLink);
  $("#btn-export-session")?.addEventListener("click", exportSessionPackage);
  $("#btn-join-session")?.addEventListener("click", () => {
    const val = $("#join-session-input")?.value?.trim();
    if (val) handleJoinSession(val);
  });
  $("#join-session-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#btn-join-session")?.click();
    }
  });

  // Sample chips in Share panel
  $$(".sample-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const code = chip.dataset.code;
      const input = $("#join-session-input");
      if (input) input.value = code;
      handleJoinSession(code);
    });
  });

  // User display name in Share panel
  $("#user-display-name")?.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    state.userName = val || "You";
    chrome.storage.local.set({ userName: state.userName });
  });

  // Discover Models button in settings
  $("#btn-discover-models")?.addEventListener("click", async () => {
    const discDiv = $("#discovered-models");
    if (discDiv) discDiv.textContent = "Querying ask.dell.com/api/models...";
    await discoverModels();
  });

  // Settings live change events
  $("#setting-connection-mode")?.addEventListener("change", async (e) => {
    state.demoMode = e.target.value === "demo";
    await chrome.storage.local.set({ demoMode: state.demoMode });
    applyConnectionState(state.connection);
    saveSettings();
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

  // History search filter
  $("#history-search-input").addEventListener("input", (e) => {
    filterHistoryList(e.target.value);
  });

  // 12 Quick Action Buttons
  $$(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      executeQuickAction(action);
    });
  });

  // Template Chips
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
    if (msg.type === "ASKDELL_CONNECTION_STATUS" && msg.connection) {
      state.connection = msg.connection;
      applyConnectionState(msg.connection);
    }
    if (msg.type === "ASKDELL_SESSION_EXPIRED" || msg.type === "SESSION_EXPIRED") {
      state.connection = { status: "unauthenticated" };
      applyConnectionState(state.connection);
    }
    if (msg.type === "ASKDELL_SESSION_ACTIVE") {
      state.connection = { status: "connected" };
      applyConnectionState(state.connection);
    }
  });
}

// ============================================================
// 12 GENERAL DEVELOPER QUICK ACTIONS
// ============================================================
function executeQuickAction(actionType) {
  const prompts = {
    "full-review": "Perform a comprehensive PR code review on these changes. Evaluate architecture, logic correctness, edge cases, error handling, maintainability, and regression risks. Provide line-level feedback and severity ratings.",
    "security": "Perform a rigorous security vulnerability audit. Check for OWASP Top 10 flaws, injection risks (SQL, command, LDAP), XSS, CSRF, auth/authz bypasses, sensitive data exposure, SSRF, and insecure deserialization.",
    "performance": "Analyze this code for performance bottlenecks: algorithmic complexity (Big-O), redundant memory allocations, N+1 queries, unindexed DB accesses, thread safety, and resource leaks.",
    "clean-code": "Review this code for clean code practices, SOLID design principles, DRY adherence, naming readability, cyclomatic complexity, and recommend concise refactorings.",
    "ci-diagnose": "Analyze these CI/CD pipeline and build failure logs in detail. Pinpoint the failing stack trace, file, and line number. Explain the exact root cause, and provide a code patch fix with verification commands.",
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

// ============================================================
// CHAT SUBMISSION & STREAMING
// ============================================================
async function handleUserSubmission(userPromptText, attachContext = true, isRegenerate = false) {
  if (state.isStreaming) return;

  // Ensure AskDell tab is reachable or Reviewer Demo Mode is active
  if (!state.demoMode && state.connection?.status !== "connected") {
    if (state.connection?.status === "unauthenticated") {
      showNotification("🔐 Authentication required on AskDell. Please log in on the open tab to start your session.", "warning");
    } else {
      showNotification("🏢 ask.dell.com tab not detected. Click 'Open AskDell Session' above or switch to Demo Mode.", "warning");
    }
    return;
  }

  // Remove welcome card if present
  const welcomeCard = $("#welcome-card");
  if (welcomeCard) welcomeCard.remove();

  // Prepare full prompt payload
  let fullPromptToSend = userPromptText;
  let attachedContextText = null;

  if (attachContext && state.pageContext) {
    attachedContextText = formatTabContent(state.pageContext);
    fullPromptToSend = `${userPromptText}\n\n---\n### Attached Page Context:\n${attachedContextText}`;
  }

  // If not regenerating, render new user message in UI
  const meta = MODEL_META[state.currentModel] || {};
  if (!isRegenerate) {
    const authorName = state.userName || "You";
    const nowTime = Math.floor(Date.now() / 1000);
    renderUserMessage(userPromptText, attachedContextText, meta.color === "claude" ? "claude-user" : "", authorName, nowTime);
    state.messages.push({
      role: "user",
      author: authorName,
      content: fullPromptToSend,
      timestamp: nowTime
    });
  }

  // Prepare Assistant Streaming Card
  const assistantCard = createAssistantStreamingCard(userPromptText, attachContext);
  state.isStreaming = true;
  updateUIStreamingState(true);

  const enableWebSearch = $("#include-web-search")?.checked ?? state.settings.autoWebSearch;

  // Initiate Streaming: Demo Mode vs Live Bridge
  try {
    if (state.demoMode) {
      await runStreamInDemoMode({
        userPrompt: userPromptText,
        pageContext: state.pageContext,
        model: state.currentModel,
        messages: state.messages
      }, assistantCard);
    } else {
      await runStreamWithBridge({
        chatId: state.chatId,
        chatTitle: state.pageContext?.title ? `Analysis: ${state.pageContext.title.substring(0, 30)}` : "Developer Analysis",
        model: state.currentModel,
        webSearch: enableWebSearch,
        messages: state.messages
      }, assistantCard);
    }
  } catch (err) {
    console.error("[AskDell] Stream error:", err);
    finalizeStreamingCard(assistantCard, `⚠️ **Error during analysis:**\n${err.message}`);
    updateUIStreamingState(false);
  }
}

// ============================================================
// REVIEWER / DEMO MODE SIMULATED AI ENGINE
// Allows Microsoft Edge Store reviewers and off-VPN users
// to test all 12 AI review actions, streaming, and chat
// ============================================================
const DEMO_HISTORY_ITEMS = [
  {
    id: "demo-pr-342",
    title: "PR #342: Optimized database query cache & connection pool",
    updated_at: Math.floor(Date.now() / 1000) - 3600 * 2,
    messages: [
      { role: "user", content: "Perform a full PR review on PR #342 focusing on database connection leak risks and transaction boundaries." },
      { role: "assistant", content: "<think>\n1. Analyzing database connection pool parameters (max connections, timeout).\n2. Reviewing transaction commit/rollback pathways.\n3. Checking connection release in error handlers.\n</think>\n\n### Executive Summary\n- **PR Risk Rating**: 🟢 Low-Medium\n- **Verdict**: LGTM with minor suggestions.\n\n### Key Findings\n1. Connection pool acquisition is wrapped in `try...finally` with explicit release.\n2. Query parameters properly sanitized against SQL injection.\n\n```sql\n-- Verified index creation\nCREATE INDEX CONCURRENTLY idx_orders_user_created ON orders (user_id, created_at DESC);\n```\n\nAll automated unit tests pass with 94% coverage." }
    ]
  },
  {
    id: "demo-sec-88",
    title: "Security Audit: JWT expiration & CSRF defense",
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 2,
    messages: [
      { role: "user", content: "Audit JWT auth middleware for replay attacks and token expiration." },
      { role: "assistant", content: "<think>\n1. Validating HS256 signature verification.\n2. Reviewing token expiration window and clock skew tolerance.\n</think>\n\n### Security Audit Report\n- **Status**: 🟢 PASSED (0 Critical, 0 High, 1 Low Advisory)\n- Token expiration enforced at 15 minutes.\n- Added `jti` tracking to Redis blacklist for immediate revocation on logout." }
    ]
  },
  {
    id: "demo-perf-51",
    title: "Performance: Algorithmic complexity and async I/O batching",
    updated_at: Math.floor(Date.now() / 1000) - 86400 * 5,
    messages: [
      { role: "user", content: "Analyze throughput bottlenecks in the webhook dispatcher queue." },
      { role: "assistant", content: "### Performance Analysis\n- Replaced sequential HTTP requests with concurrent worker pools (`Promise.allSettled` batch size 20).\n- Reduced p99 dispatch latency from 1,420ms to 180ms." }
    ]
  }
];

function generateDemoResponse(promptText, pageContext, modelId) {
  const meta = MODEL_META[modelId] || { name: modelId || "Claude Opus 4.6" };
  const modelName = meta.name || "Claude Opus 4.6";
  const title = pageContext?.title || "Active Developer Tab";
  const platform = pageContext?.platform ? pageContext.platform.toUpperCase() : "REPOSITORY";
  const pLower = (promptText || "").toLowerCase();

  // 1. Full PR Review
  if (pLower.includes("comprehensive pr code review") || pLower.includes("full-review") || pLower.includes("pr review")) {
    return `<think>
1. Scanning repository context: ${platform} - "${title}".
2. Checking architectural boundaries, SOLID principles, cyclomatic complexity.
3. Inspecting boundary conditions, concurrency/async safety, and error propagation.
4. Formulating actionable findings prioritized by impact.
</think>

### 🔍 Comprehensive Pull Request Review

**Target**: \`${title}\`  
**Reviewing Model**: ${modelName}  
**Overall PR Risk**: 🟢 **LOW RISK (Safe to Merge with minor polish)**

---

#### 1. Executive Summary
The proposed changes demonstrate solid engineering rigor with clean separation of concerns and clear modularity. Core business logic is well-structured, and async data flows properly propagate state without unhandled exception leaks.

#### 2. Architecture & Design Evaluation
- **Modularity**: Good encapsulation of domain handlers and presentation layer.
- **SOLID Compliance**: Adheres to Single Responsibility; dependencies are appropriately injected rather than hard-coded.
- **API Consistency**: Method signatures and payload contracts follow established project conventions.

#### 3. Detailed Code Analysis & Observations

##### 🟢 Strengths
- Comprehensive input sanitization prior to payload processing.
- Consistent application of strict typing and boundary validation.
- Clean logging with appropriate contextual metadata for observability.

##### 🟡 Recommendation (Defensive Boundary Check)
Ensure nullish checks guard against unexpected upstream payloads when parsing collection results:

\`\`\`javascript
// Suggested defensive enhancement:
const sanitizePayload = (input) => {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid payload structure' };
  }
  return {
    valid: true,
    data: Object.freeze({ ...input, processedAt: Date.now() })
  };
};
\`\`\`

#### 4. Verification Matrix
| Criterion | Status | Notes |
| :--- | :---: | :--- |
| **Correctness** | ✅ PASS | Logic matches intended specifications |
| **Security** | ✅ PASS | No injection or credential exposure detected |
| **Performance** | ✅ PASS | Sub-millisecond execution; O(N) linear iteration |
| **Test Coverage** | ⚠️ RECOMMENDED | Add edge-case test for empty collection inputs |

---
**Verdict**: **APPROVE WITH MINOR COMMENTS** — Safe for staging deployment.`;
  }

  // 2. Security Audit
  if (pLower.includes("security vulnerability audit") || pLower.includes("security") || pLower.includes("owasp")) {
    return `<think>
1. OWASP Top 10 evaluation: A01:2021-Broken Access Control through A10:2021-SSRF.
2. Checking input deserialization, parameter tampering, and output encoding.
3. Verifying authorization checks, session token lifetimes, and cryptographic hygiene.
</think>

### 🛡️ Enterprise Security Vulnerability Audit

**Target**: \`${title}\`  
**Audit Standard**: OWASP Top 10 · Enterprise Secure Coding Guidelines  
**Security Posture**: 🟢 **SECURE (0 Critical, 0 High, 1 Low Advisory)**

---

#### 1. Threat Modeling Overview
| Vulnerability Category | Risk Level | Status | Notes |
| :--- | :---: | :---: | :--- |
| **A01: Broken Access Control** | High | 🟢 PASS | Role-based authorization verified |
| **A02: Cryptographic Failures** | Critical | 🟢 PASS | Strong TLS 1.3 & AES-256 primitives |
| **A03: Injection (SQL/XSS/Command)**| Critical | 🟢 PASS | Parameterized queries & strict escaping |
| **A05: Security Misconfiguration** | Medium | 🟢 PASS | CSP headers and strict CORS enforced |
| **A07: Identification & Auth** | High | 🟡 INFO | Confirm JWT token revocation blacklist |

#### 2. Findings & Recommendations

##### 🟡 Advisory SEC-01: Explicit Token Revocation Check
When invalidating sessions on logout, ensure the stateless JWT identifier (\`jti\`) is recorded in the distributed revocation cache (e.g. Redis) to eliminate residual replay windows:

\`\`\`javascript
// Secure session termination pattern:
async function invalidateUserSession(tokenPayload) {
  const { jti, exp } = tokenPayload;
  const remainingTtl = Math.max(0, exp - Math.floor(Date.now() / 1000));
  if (remainingTtl > 0) {
    await tokenBlacklist.set(\`revoked:\${jti}\`, true, 'EX', remainingTtl);
  }
}
\`\`\`

#### 3. Compliance Summary
- **Zero-Trust Readiness**: Verified — every inbound request authenticates independently.
- **Audit Logging**: Verified — security events log user ID, timestamp, and client IP without recording PII.`;
  }

  // 3. Performance & Complexity
  if (pLower.includes("performance bottlenecks") || pLower.includes("performance") || pLower.includes("big-o")) {
    return `<think>
1. Time Complexity Analysis: Reviewing loops, recursive stacks, and collection operations.
2. Space Complexity & Memory Allocations: Identifying uncollected closures, cache bloat.
3. I/O & Network Bottlenecks: Verifying connection pooling, async concurrency, and batching.
</think>

### ⚡ Performance & Complexity Analysis

**Target**: \`${title}\`  
**Analyzer**: ${modelName} Engine  

---

#### 1. Algorithmic Complexity Benchmark
- **Time Complexity**: **O(N)** — Linear time traversal over collection items.
- **Space Complexity**: **O(1)** auxiliary heap allocation (in-place processing where applicable).

#### 2. Profiling & Bottleneck Inspection
| Component | Current State | Potential Bottleneck | Recommended Optimization |
| :--- | :--- | :--- | :--- |
| **Data Parsing** | Serial loop | High-volume burst lag | Chunked pipeline or stream |
| **Memory Allocation**| Temporary objects | Minor GC pressure | Object pool or buffer reuse |
| **Network Requests**| Sequential fetch | High latency waterfall | \`Promise.allSettled\` concurrent batch |

#### 3. Recommended Performance Refactor
Batch concurrent operations with concurrency limits to avoid thread-pool exhaustion:

\`\`\`javascript
// High-throughput concurrency limiter:
async function processInBatches(items, batchSize = 5, processorFn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map(processorFn));
    results.push(...chunkResults);
  }
  return results;
}
\`\`\`

**Outcome**: Reduces execution latency by up to **65%** under concurrent workloads while keeping GC pauses below 5ms.`;
  }

  // 4. Clean Code & SOLID
  if (pLower.includes("clean code") || pLower.includes("clean-code") || pLower.includes("solid")) {
    return `<think>
1. Reviewing SOLID Principles: SRP, OCP, LSP, ISP, DIP.
2. Identifying DRY violations, cyclomatic complexity peaks (>10), and naming ambiguity.
3. Suggesting functional composition and clear interface boundaries.
</think>

### 🧹 Clean Code & SOLID Architecture Review

**Target**: \`${title}\`  

---

#### 1. SOLID Principles Scorecard
- **S — Single Responsibility**: 🟢 **9/10** — Functions stay concise and focused on single tasks.
- **O — Open/Closed**: 🟢 **8/10** — Behaviors extended via strategy patterns without modifying core callers.
- **L — Liskov Substitution**: 🟢 **10/10** — Subtypes cleanly conform to base contracts.
- **I — Interface Segregation**: 🟢 **9/10** — Narrow, client-specific interfaces prevent bloat.
- **D — Dependency Inversion**: 🟢 **8/10** — Relies on abstractions rather than concrete singletons.

#### 2. Readability & Maintainability Improvements
- **Self-Documenting Naming**: Replace generic identifiers (e.g. \`data\`, \`res\`, \`temp\`) with domain terms (\`userAccountProfile\`, \`validationOutcome\`).
- **Guard Clauses**: Invert nested conditionals to return early, reducing cognitive indentation depth.

\`\`\`javascript
// Clean Code: Guard Clauses & Early Returns
function processOrderRequest(order, customer) {
  if (!order || !order.items.length) {
    throw new ValidationError("Order contains no items");
  }
  if (!customer.isActive) {
    throw new AuthorizationError("Customer account is suspended");
  }

  return executeFulfillment(order, customer);
}
\`\`\``;
  }

  // CI/CD Failure Diagnoser
  if (pLower.includes("ci-diagnose") || pLower.includes("ci failure") || pLower.includes("pipeline failure") || pLower.includes("stack trace") || pLower.includes("build failure")) {
    return `<think>
1. Scanning CI pipeline execution logs for build failure and non-zero exit status.
2. Isolating active stack trace frame and failing test assertion.
3. Formulating root cause explanation and pinpointed code diff patch with suggestion syntax.
</think>

### 🚨 CI/CD Build & Pipeline Failure Root Cause Analysis

**Target**: \`${title}\`  
**Platform**: ${platform}  
**Classification**: \`Pipeline Job Failure (Exit Code 1)\`

---

#### 1. Isolated Stack Trace Frame
\`\`\`text
FAIL src/services/auth.spec.ts > AuthenticationMiddleware > should verify JWT token
AssertionError: expected 'UNAUTHORIZED' to equal 'TOKEN_EXPIRED'
    at verifyToken (src/services/auth.ts:42:15)
    at runTest (src/services/auth.spec.ts:88:22)
    at processTicksAndRejections (node:internal/process/task_queues:104:5)
\`\`\`

#### 2. Root Cause Analysis
- **Defect Location**: \`src/services/auth.ts:42\`
- **Mechanism**: The authentication handler caught an expired token but unconditionally mapped it to a generic \`UNAUTHORIZED\` error code rather than checking for \`TOKEN_EXPIRED\`.
- **Pipeline Impact**: Unit test assertion failed on contract match; blocked \`Test & Lint\` stage.

#### 3. Targeted Code Fix
\`\`\`diff
- if (!decoded) throw new AuthError("UNAUTHORIZED");
+ if (decoded.isExpired) {
+   throw new AuthError("TOKEN_EXPIRED", "Session expired, please refresh token");
+ }
+ if (!decoded.isValid) {
+   throw new AuthError("UNAUTHORIZED", "Invalid token signature");
+ }
\`\`\`

#### 4. Verification Command
\`\`\`bash
npm test -- src/services/auth.spec.ts --run
\`\`\``;
  }

  // 5. Test Cases
  if (pLower.includes("test suite specification") || pLower.includes("test-cases") || pLower.includes("unit test")) {
    return `<think>
1. Formulating test matrix following AAA (Arrange-Act-Assert) pattern.
2. Identifying Happy Path, Edge Cases, Boundary Limits, and Failure Handling.
3. Generating production-ready test code with mocks and assertions.
</think>

### 🧪 Comprehensive Test Suite Specification

**Target**: \`${title}\`  
**Framework**: Jest / Vitest / Mocha compatible  

---

#### 1. Test Coverage Matrix
| Scenario Type | Test Description | Expected Result | Priority |
| :--- | :--- | :--- | :---: |
| **Happy Path** | Valid input payload with all required fields | Returns 200 OK + validated entity | P0 |
| **Boundary** | Maximum payload length (edge boundary test) | Processes without buffer overflow | P1 |
| **Edge Case** | Empty strings and null field values | Gracefully handles with validation error | P0 |
| **Security** | Payload containing XSS attempt / SQL injection | Input escaped; transaction sanitized | P0 |
| **Resilience** | Upstream dependency timeout | Fails fast with circuit-breaker fallback | P1 |

#### 2. Automated Test Implementation

\`\`\`javascript
describe("Component Integration Tests", () => {
  let mockService;

  beforeEach(() => {
    mockService = {
      execute: jest.fn().mockResolvedValue({ success: true, id: "test-uuid-101" })
    };
  });

  test("should successfully process valid request (Happy Path)", async () => {
    const input = { userId: "user-42", payload: "standard-data" };
    const result = await mockService.execute(input);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.id).toBe("test-uuid-101");
    expect(mockService.execute).toHaveBeenCalledTimes(1);
  });

  test("should reject malformed input without unhandled exception", async () => {
    mockService.execute.mockRejectedValueOnce(new Error("ValidationError: invalid payload"));
    await expect(mockService.execute(null)).rejects.toThrow("ValidationError");
  });
});
\`\`\``;
  }

  // 6. Summarize
  if (pLower.includes("executive summary") || pLower.includes("summarize")) {
    return `<think>
1. Extracting core change intent from page context.
2. Identifying affected components, breaking change risk, and deployment notes.
</think>

### 📝 Technical Executive Summary

**Scope**: \`${title}\`  
**Source Platform**: ${platform}  

---

#### 1. Primary Objectives
- Modernizes business logic and stream handling for improved developer productivity.
- Eliminates synchronous blocking calls and enhances fault isolation across service boundaries.
- Tightens data validation schemas to ensure compliance with enterprise zero-trust standards.

#### 2. Key Components Impacted
- **Data Layer**: Optimized query indices and connection pool lifecycle management.
- **API Boundary**: Standardized error response envelope with unique correlation trace IDs.
- **Client Interface**: Non-blocking streaming state updates with graceful fallback handlers.

#### 3. Deployment & Rollout Guidance
- **Breaking Changes**: None detected; 100% backward compatible with existing schema versions.
- **Database Migrations**: Concurrent index creation recommended prior to rolling out binary updates.
- **Rollback Complexity**: Low — simple previous-commit tag deployment if canary metrics exceed 0.1% error budget.`;
  }

  // 7. Explain
  if (pLower.includes("explain this code") || pLower.includes("explain")) {
    return `<think>
1. Structuring developer onboarding breakdown: Purpose, Data Flow, Key Patterns, Edge Handling.
</think>

### 💡 Architectural Walkthrough & Code Explanation

**Module**: \`${title}\`  

---

#### 1. Core Purpose
This module coordinates asynchronous event dispatching and payload transformation between client requests and backend processing services. It acts as an orchestrator ensuring safe execution, contextual enrichment, and observability.

#### 2. Key Architectural Patterns
- **Pipeline Pattern**: Inbound requests traverse sequential validation, transformation, and execution phases.
- **Circuit Breaker**: Detects downstream failure spikes and fails gracefully with cached responses.
- **Observer / Event-Driven**: Emits telemetry and audit events asynchronously without introducing latency to user-facing transactions.

#### 3. Data Flow Diagram (Conceptual)
\`\`\`text
Client Request ──> Input Validator ──> Context Enricher ──> Worker Dispatcher
                          │                                     │
                    (Throws 400)                          (Executes Task)
                                                                │
                                                         Emits Audit Log
\`\`\`

#### 4. Developer Tips for Extension
When adding new action handlers, extend the base \`AbstractActionHandler\` class and register the descriptor in the DI container.`;
  }

  // 8. Debug
  if (pLower.includes("subtle bugs") || pLower.includes("debug")) {
    return `<think>
1. Analyzing edge cases: null dereference, unhandled promise rejections, race conditions.
</think>

### 🐛 Debugging Diagnostic & Bug Audit

**Target**: \`${title}\`  

---

#### 1. Identified Risk Points
- **Potential Null Dereference**: Ensure nested object chains use optional chaining (\`?.\`) when accessing optional properties.
- **Async Promise Rejection**: Ensure promises inside \`.forEach()\` or detached timeouts are properly handled or converted to \`for...of\` / \`Promise.all\`.

#### 2. Proposed Patches

\`\`\`diff
- const userEmail = response.data.user.profile.email;
+ const userEmail = response?.data?.user?.profile?.email ?? "no-email@domain.com";

- items.forEach(async (item) => {
-   await processItem(item);
- });
+ for (const item of items) {
+   await processItem(item);
+ }
\`\`\`

**Result**: Eliminates unhandled rejection crashes and prevents runtime \`TypeError: Cannot read properties of undefined\`.`;
  }

  // 9. Document
  if (pLower.includes("api and module documentation") || pLower.includes("document")) {
    return `### 📖 API & Module Documentation

**Module**: \`${title}\`  
**Version**: \`v2.2.2\`  

---

#### Methods Specification

##### \`processAnalysis(context: ContextPayload): Promise<AnalysisResult>\`
Executes intelligent code review and analysis on provided tab context.

**Parameters**:
- \`context\` (*Object*): Context metadata extracted from the active page.
  - \`context.title\` (*string*): Page or PR title.
  - \`context.url\` (*string*): Repository or document URL.
  - \`context.diff\` (*string, optional*): Unified diff of code modifications.

**Returns**:
- \`Promise<AnalysisResult>\`: Analysis outcome containing markdown report and status metadata.

**Example Usage**:
\`\`\`javascript
const result = await devAssistant.processAnalysis({
  title: "PR #142: Fix auth leak",
  diff: "@@ -10,3 +10,4 @@ ...",
  platform: "github"
});
console.log(result.verdict); // "APPROVED"
\`\`\``;
  }

  // 10. Refactor
  if (pLower.includes("refactoring opportunities") || pLower.includes("refactor")) {
    return `### ♻️ High-Impact Refactoring Recommendations

**Target**: \`${title}\`  

---

#### Recommended Transformation: Strategy Pattern
Replace monolithic branching logic with modular action strategies to adhere to the Open/Closed Principle.

\`\`\`javascript
// Before: Multi-branch switch/case
// After: Modular Strategy Map
const ACTION_STRATEGIES = {
  fullReview: (ctx) => runComprehensiveAudit(ctx),
  securityScan: (ctx) => runSecurityCheck(ctx),
  performanceProfile: (ctx) => runPerfBenchmark(ctx)
};

function executeStrategy(actionType, ctx) {
  const handler = ACTION_STRATEGIES[actionType];
  if (!handler) throw new Error(\`Unsupported action: \${actionType}\`);
  return handler(ctx);
}
\`\`\`

**Benefits**:
- Decouples individual audit actions.
- Allows seamless addition of new model handlers without modifying existing dispatch logic.`;
  }

  // 11. Architecture
  if (pLower.includes("architectural design") || pLower.includes("architecture")) {
    return `### 🏗️ System Architecture Evaluation

**Target**: \`${title}\`  

---

#### 1. Architectural Highlights
- **Modularity**: Domain logic is decoupled from UI rendering components.
- **Resilience**: Asynchronous messaging channels prevent UI thread blocking during token generation.
- **Security Boundaries**: Host permissions are tightly scoped; credentials and private tokens are never stored in unencrypted storage.

#### 2. Scalability Assessment
- **Horizontal Scaling**: Stateless design allows seamless multi-window and multi-tab concurrency.
- **Memory Footprint**: Average resident memory remains under **28 MB**, well below the browser extension threshold.`;
  }

  // 12. API Review
  if (pLower.includes("api design review") || pLower.includes("api-review")) {
    return `### 🔗 RESTful / GraphQL API Design Review

**Target**: \`${title}\`  

---

#### 1. API Design Scorecard
| API Quality Dimension | Score | Assessment |
| :--- | :---: | :--- |
| **REST Semantics** | 🟢 9/10 | Proper use of GET, POST, PUT, DELETE verbs |
| **URI Naming** | 🟢 9/10 | Plural resource nouns (\`/api/v1/models\`) |
| **Idempotency** | 🟢 9/10 | Safe GET/PUT retries; POST properly tracked |
| **Error Handling** | 🟢 9/10 | Standard RFC 7807 Problem Details envelope |

#### 2. Suggested Improvement
Standardize the error response format across all endpoints:

\`\`\`json
{
  "type": "https://api.dell.com/errors/invalid-parameter",
  "title": "Invalid Parameter",
  "status": 400,
  "detail": "The 'max_tokens' parameter must not exceed 200000.",
  "instance": "/requests/req-789-abc"
}
\`\`\``;
  }

  // Default: General Developer Assistant Chat Response
  return `<think>
1. Analyzing developer query: "${promptText}".
2. Context: ${platform} - "${title}".
3. Formulating clear, actionable, technical explanation with code examples.
</think>

### 🤖 Developer Assistant Response

**Model**: ${modelName}  
**Context**: \`${title}\`  

---

Hello! I have analyzed your request regarding **${promptText.substring(0, 50)}...**:

#### Key Points & Insights
1. **Best Practice Design**: When designing resilient developer workflows, prefer asynchronous non-blocking patterns with explicit boundary handling.
2. **Context Awareness**: The extension currently tracks \`${title}\` (${platform}). All 12 quick action chips above can analyze this page with one click.
3. **Enterprise AI Models**: You can switch between **Claude Opus 4.6**, **Claude Sonnet 5**, **Gemini 3.8 Flash**, **Llama-3.3 70B**, and **GPT-OSS** using the top selector dropdown.

\`\`\`javascript
// Example helper:
function optimizeWorkflow(config = {}) {
  const { timeout = 5000, retries = 3 } = config;
  return {
    ready: true,
    engine: "${modelName}",
    activeAt: new Date().toISOString()
  };
}
\`\`\`

Feel free to click any of the action buttons above (e.g. **Full PR Review**, **Security Audit**, **Test Cases**) or ask specific questions about your code!`;
}

function runStreamInDemoMode(payload, assistantCard) {
  return new Promise((resolve) => {
    const meta = MODEL_META[payload.model] || { name: payload.model || "Claude Opus 4.6" };
    updateStreamStatus(`🔍 Reading active tab context & diff...`, false);

    const fullResponse = generateDemoResponse(payload.userPrompt, payload.pageContext, payload.model);
    
    // Split into token-sized chunks (words, markdown tokens, and newlines)
    const tokens = fullResponse.match(/<think>[\s\S]*?<\/think>|\S+\s*|\n/g) || [fullResponse];
    let tokenIndex = 0;
    let accumulated = "";

    setTimeout(() => {
      if (state.isStreaming) {
        updateStreamStatus(`💭 ${meta.name} reasoning with 200k context...`, false);
      }
    }, 450);

    state.demoStreamTimer = setInterval(() => {
      if (!state.isStreaming) {
        clearInterval(state.demoStreamTimer);
        state.demoStreamTimer = null;
        resolve(accumulated);
        return;
      }

      if (tokenIndex < tokens.length) {
        // Stream 2 to 4 tokens per tick for authentic streaming pacing
        const chunkCount = Math.min(3, tokens.length - tokenIndex);
        for (let i = 0; i < chunkCount; i++) {
          accumulated += tokens[tokenIndex++];
        }
        updateAssistantStreamingContent(assistantCard, accumulated);
      } else {
        clearInterval(state.demoStreamTimer);
        state.demoStreamTimer = null;
        finalizeStreamingCard(assistantCard, accumulated);
        state.messages.push({
          role: "assistant",
          author: meta.name || "Claude Opus 4.6",
          content: accumulated,
          timestamp: Math.floor(Date.now() / 1000)
        });
        updateUIStreamingState(false);
        updateStreamStatus(`✅ ${meta.name} analysis complete`, true);
        resolve(accumulated);
      }
    }, 28);
  });
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
            author: (MODEL_META[state.currentModel] || {}).name || state.currentModel,
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

    // Start request
    state.activePort.postMessage({
      type: "START_CHAT",
      payload: payload
    });
  });
}

function stopActiveStream() {
  if (state.demoStreamTimer) {
    clearInterval(state.demoStreamTimer);
    state.demoStreamTimer = null;
  }
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
  const btnSend = $("#btn-send");
  if (btnSend) btnSend.disabled = streaming;
  const btnStop = $("#btn-stop");
  if (btnStop) btnStop.style.display = streaming ? "flex" : "none";
  const streamControls = $("#streaming-controls");
  if (streamControls) streamControls.style.display = streaming ? "flex" : "none";
  
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

// ============================================================
// UI RENDERING & DOM BUILDERS
// ============================================================
function renderUserMessage(text, attachedContext, extraClass = "", author = null, timestamp = null) {
  const container = $("#messages");

  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper user";

  const isTeammate = author && author !== state.userName && author !== "You";
  const authorClass = isTeammate ? "teammate-user" : "";

  const msgDiv = document.createElement("div");
  msgDiv.className = `message message-user ${extraClass} ${authorClass}`.trim();

  // Author & timestamp header (especially for shared threads or multi-user sessions)
  const displayName = author || state.userName || "You";
  const header = document.createElement("div");
  header.className = "user-meta-header";

  const timeStr = timestamp ? new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
  header.innerHTML = `
    <span class="user-author-tag">
      ${isTeammate ? '👥' : '👤'} ${escapeHtml(displayName)}
    </span>
    ${timeStr ? `<span class="user-timestamp">${timeStr}</span>` : ''}
  `;
  msgDiv.appendChild(header);

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

let toastTimeout = null;

function showNotification(text, type = "info") {
  showToastNotification(text, type);
}

function showToastNotification(text, type = "info") {
  const toast = $("#toast-notification");
  if (toast) {
    if (toastTimeout) clearTimeout(toastTimeout);
    const icon = type === "error" ? "❌" : type === "warning" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `<span>${icon} ${escapeHtml(text)}</span><button style="background:none;border:none;color:inherit;cursor:pointer;font-size:12px;opacity:0.8;margin-left:8px;" onclick="this.parentElement.style.display='none'">✕</button>`;
    toast.style.display = "flex";
    toastTimeout = setTimeout(() => {
      toast.style.display = "none";
    }, 4500);
  }

  const banner = $("#auth-banner");
  const bannerText = $("#auth-banner-text");
  const sharePanel = $("#share-panel");
  const histPanel = $("#history-panel");
  const isDrawerOpen = (sharePanel && sharePanel.style.display !== "none") || (histPanel && histPanel.style.display !== "none");

  if (banner && bannerText && !isDrawerOpen) {
    banner.className = `banner banner-${type === "error" ? "warning" : "info"}`;
    bannerText.textContent = text;
    banner.style.display = "flex";
    setTimeout(() => {
      banner.style.display = "none";
    }, 4000);
  }
}


// ============================================================
// LIGHTWEIGHT SECURE MARKDOWN & DIFF PARSER
// ============================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(md) {
  if (!md) return "";

  // 1. Protect Code Blocks
  const codeBlocks = [];
  let processed = md.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({ lang: lang.trim().toLowerCase(), code: code });
    return `§§CODEBLOCK_${index}§§`;
  });

  // 2. Extract and protect Reasoning / Thinking Blocks (<details type="thought">, <think>, etc.)
  const reasoningBlocks = [];

  // Match closed <details type="thought"...> ... </details> or with class="thought" or <summary>Thought...
  processed = processed.replace(/<details\b[^>]*?(?:type=["']?thought["']?|class=["']?thought["']?)[^>]*>([\s\S]*?)<\/details>/gi, (match, inner) => {
    const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
    const summaryText = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "Thinking Process";
    const content = inner.replace(/<summary>[\s\S]*?<\/summary>/i, "").trim();
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: summaryText, content, inProgress: false });
    return `§§REASONING_${index}§§`;
  });

  // Match closed <think> ... </think>
  processed = processed.replace(/<think>([\s\S]*?)<\/think>/gi, (match, inner) => {
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: "Thinking Process", content: inner.trim(), inProgress: false });
    return `§§REASONING_${index}§§`;
  });

  // Match unclosed / streaming <details type="thought"...> at tail
  processed = processed.replace(/<details\b[^>]*?(?:type=["']?thought["']?|class=["']?thought["']?)[^>]*>([\s\S]*)$/gi, (match, inner) => {
    const summaryMatch = inner.match(/<summary>([\s\S]*?)<\/summary>/i);
    const summaryText = summaryMatch ? summaryMatch[1].replace(/<[^>]+>/g, "").trim() : "Thinking Process";
    const content = inner.replace(/<summary>[\s\S]*?<\/summary>/i, "").trim();
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: `${summaryText} (analyzing...)`, content, inProgress: true });
    return `§§REASONING_${index}§§`;
  });

  // Match unclosed / streaming <think> at tail
  processed = processed.replace(/<think>([\s\S]*)$/gi, (match, inner) => {
    const index = reasoningBlocks.length;
    reasoningBlocks.push({ summary: "Thinking Process (analyzing...)", content: inner.trim(), inProgress: true });
    return `§§REASONING_${index}§§`;
  });

  // 3. Escape regular HTML (now safe since code and reasoning blocks are protected)
  processed = escapeHtml(processed);

  // 4. Headings
  processed = processed.replace(/^#### (.*?)$/gm, "<h4>$1</h4>");
  processed = processed.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  processed = processed.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  processed = processed.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // 5. Horizontal Rules (---, ***, ___)
  processed = processed.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr class="markdown-hr">');

  // 6. Blockquotes (handling &gt; from escapeHtml)
  processed = processed.replace(/^(?:&gt;|>)[ \t]?(.*?)$/gm, "<blockquote>$1</blockquote>");
  processed = processed.replace(/<\/blockquote>\s*<blockquote>/g, "<br>");

  // 7. Bold & Italic & Strikethrough
  processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");
  processed = processed.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // 8. Inline code
  processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 9. Links [text](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const safeUrl = /^(https?:|\/|#)/i.test(url.trim()) ? url.trim() : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="markdown-link">${text}</a>`;
  });

  // 10. Markdown Tables
  processed = renderMarkdownTables(processed);

  // 11. Lists (Unordered and Ordered)
  // Unordered lists (- or *)
  processed = processed.replace(/^\s*[\-\*]\s+(.*?)$/gm, "<li>$1</li>");
  processed = processed.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
  processed = processed.replace(/<\/ul>\s*<ul>/g, "");

  // Ordered lists (1. Item)
  processed = processed.replace(/^\s*(\d+)\.\s+(.*?)$/gm, '<oli value="$1">$2</oli>');
  processed = processed.replace(/(<oli[^>]*>[\s\S]*?<\/oli>)/g, "<ol>$1</ol>");
  processed = processed.replace(/<\/ol>\s*<ol>/g, "");
  processed = processed.replace(/<oli value="(\d+)">/g, '<li value="$1">');
  processed = processed.replace(/<\/oli>/g, "</li>");

  // Ensure block elements have double newlines before and after so they split cleanly
  processed = processed.replace(/\s*(<hr[^>]*>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(<ol>[\s\S]*?<\/ol>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(<ul>[\s\S]*?<\/ul>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(<blockquote[\s\S]*?<\/blockquote>)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(§§CODEBLOCK_\d+§§)\s*/g, "\n\n$1\n\n");
  processed = processed.replace(/\s*(§§REASONING_\d+§§)\s*/g, "\n\n$1\n\n");

  // 12. Paragraphs and line breaks
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

  // 11. Restore Code Blocks with syntax & diff coloring
  processed = processed.replace(/§§CODEBLOCK_(\d+)§§/g, (match, idx) => {
    const item = codeBlocks[Number(idx)];
    if (!item) return "";
    return formatCodeBlock(item.lang, item.code);
  });

  // 12. Restore Reasoning Blocks as Collapsible Details
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
        <div class="code-header-actions">
          <button class="code-suggestion-btn" data-raw="${encodeURIComponent(code)}" title="Copy as GitHub / GitLab PR Suggestion">
            <span>💡 Suggestion</span>
          </button>
          <button class="code-copy-btn" data-raw="${encodeURIComponent(code)}" title="Copy code">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy code</span>
          </button>
        </div>
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
  if (!container || !container.querySelectorAll) return;
  container.querySelectorAll(".code-copy-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const raw = decodeURIComponent(btn.dataset.raw || "");
      navigator.clipboard.writeText(raw);
      const span = btn.querySelector("span");
      if (span) span.textContent = "Copied!";
      setTimeout(() => { if (span) span.textContent = "Copy code"; }, 1800);
    };
  });

  container.querySelectorAll(".code-suggestion-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const raw = decodeURIComponent(btn.dataset.raw || "");
      const suggestion = formatPrSuggestion(raw);
      navigator.clipboard.writeText(suggestion);
      const span = btn.querySelector("span");
      if (span) span.textContent = "Copied Suggestion!";
      showNotification("📋 Copied as GitHub / GitLab PR Suggestion!", "info");
      setTimeout(() => { if (span) span.textContent = "💡 Suggestion"; }, 2000);
    };
  });
}

function formatTabContent(content) {
  if (!content) return "";
  const maxLen = state.settings?.maxContentLength || 100000;
  const useNoiseFilter = state.settings?.smartNoiseFilter ?? true;

  if (typeof content === "string") {
    const text = useNoiseFilter ? sanitizeDiffNoise(content) : content;
    return text.substring(0, maxLen);
  }

  const parts = [];
  if (content.platform) parts.push(`Platform: ${content.platform}`);
  if (content.type) parts.push(`Content Type: ${content.type}`);
  if (content.title) parts.push(`Title: ${content.title}`);
  if (content.url) parts.push(`URL: ${content.url}`);

  if (content.files?.length) {
    const files = content.files;
    if (useNoiseFilter) {
      const meaningfulFiles = files.filter(f => !isNoisyFile(f));
      const omitted = files.length - meaningfulFiles.length;
      if (omitted > 0) {
        parts.push(`Files (${meaningfulFiles.length} reviewed, ${omitted} lockfiles/assets omitted by Noise Filter):\n${meaningfulFiles.map(f => `- ${f}`).join("\n")}`);
      } else {
        parts.push(`Files (${files.length}):\n${files.map(f => `- ${f}`).join("\n")}`);
      }
    } else {
      parts.push(`Files (${files.length}):\n${files.map(f => `- ${f}`).join("\n")}`);
    }
  }

  if (content.body) parts.push(`\nDescription / Body:\n${content.body}`);
  if (content.diff) {
    const diffText = useNoiseFilter ? sanitizeDiffNoise(content.diff) : content.diff;
    parts.push(`\nDiff / Changes:\n\`\`\`diff\n${diffText}\n\`\`\``);
  }
  if (content.code) {
    const codeText = useNoiseFilter && isNoisyFile(content.title || content.url) ? "[File omitted by Smart Noise Filter]" : content.code;
    parts.push(`\nSource Code:\n\`\`\`\n${codeText}\n\`\`\``);
  }
  if (content.comments) parts.push(`\nDiscussion / Comments:\n${content.comments}`);
  if (content.logs) parts.push(`\nLogs:\n\`\`\`\n${trimCiLogs(content.logs)}\n\`\`\``);
  if (content.tables) parts.push(`\nTables:\n${content.tables}`);
  return parts.join("\n\n").substring(0, maxLen);
}

// ============================================================
// CONVERSATION HISTORY DRAWER
// ============================================================
async function toggleHistoryDrawer() {
  const panel = $("#history-panel");
  if (panel.style.display !== "none") {
    panel.style.display = "none";
    return;
  }

  closeAllDrawers();
  panel.style.display = "flex";
  const list = $("#history-list");

  // In Reviewer Demo Mode or if no AskDell tab is detected, show sample developer sessions
  if (state.demoMode || !(await findAskDellTab())) {
    renderHistoryList(DEMO_HISTORY_ITEMS);
    return;
  }

  list.innerHTML = `<div class="history-loading">Fetching conversations from AskDell...</div>`;
  const tab = await findAskDellTab();
  if (!tab) {
    renderHistoryList(DEMO_HISTORY_ITEMS);
    return;
  }

  try {
    const history = await chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_GET_HISTORY", page: 1 });
    renderHistoryList(history);
  } catch (err) {
    renderHistoryList(DEMO_HISTORY_ITEMS);
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
  // Check if this is a Demo Mode conversation item
  const demoItem = DEMO_HISTORY_ITEMS.find((item) => item.id === chatId);
  if (demoItem || state.demoMode) {
    const itemToLoad = demoItem || {
      id: chatId,
      title: "Saved Review Session",
      messages: [
        { role: "user", content: "Review code changes for this component." },
        { role: "assistant", content: "### Analysis Complete\nAll tests passed and code structure follows SOLID standards." }
      ]
    };
    state.chatId = itemToLoad.id;
    state.messages = [];
    const container = $("#messages");
    container.innerHTML = "";
    itemToLoad.messages.forEach((msg) => {
      state.messages.push({
        role: msg.role,
        author: msg.author || (msg.role === "user" ? "You" : "Claude Opus 4.6"),
        content: msg.content,
        timestamp: msg.timestamp || Math.floor(Date.now() / 1000)
      });
      if (msg.role === "user") {
        renderUserMessage(msg.content, null, "", msg.author || "You", msg.timestamp);
      } else if (msg.role === "assistant") {
        const card = createAssistantStreamingCard(null, false);
        finalizeStreamingCard(card, msg.content);
      }
    });

    const welcomeCard = $("#welcome-card");
    if (welcomeCard) welcomeCard.remove();

    closeAllDrawers();
    scrollMessagesToBottom();
    updateTokenMeter();
    return;
  }

  const tab = await findAskDellTab();
  if (!tab) return;

  try {
    const chat = await chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_GET_CHAT", chatId });
    if (chat) {
      state.chatId = chatId;
      state.messages = [];
      const container = $("#messages");
      container.innerHTML = "";

      // Parse Open WebUI conversation tree
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
        const isUser = msg.role === "user";
        const author = isUser ? (msg.user_name || msg.author || "You") : (msg.model_name || msg.model || "Assistant");

        state.messages.push({
          role: msg.role,
          author: author,
          content: msg.content,
          timestamp: msg.timestamp
        });

        if (isUser) {
          renderUserMessage(msg.content, null, "", author, msg.timestamp);
        } else if (msg.role === "assistant") {
          const card = createAssistantStreamingCard(null, false);
          finalizeStreamingCard(card, msg.content);
        }
      });

      const welcomeCard = $("#welcome-card");
      if (welcomeCard) welcomeCard.remove();

      closeAllDrawers();
      scrollMessagesToBottom();
      updateTokenMeter();
    }
  } catch (err) {
    showNotification(`Could not load chat: ${err.message}`, "error");
  }
}

function startNewChat() {
  state.chatId = null;
  state.shareId = null;
  state.isShared = false;
  state.messages = [];

  const sharedBadge = $("#shared-session-badge");
  if (sharedBadge) sharedBadge.style.display = "none";

  const shareInput = $("#share-link-input");
  if (shareInput) shareInput.value = "";

  const sharePill = $("#share-status-pill");
  if (sharePill) {
    sharePill.textContent = "Private";
    sharePill.className = "share-pill";
  }

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

// ============================================================
// GROUP CHAT & SHARED CONTEXT ENGINE
// ============================================================
const DEMO_SHARED_SESSIONS = {
  "AD-PR-342": {
    shareId: "AD-PR-342",
    title: "PR #342: Optimized database query cache & connection pool",
    model: "claude-opus-4-6",
    pageContext: {
      platform: "github",
      type: "pull_request",
      title: "PR #342: Optimized database query cache & connection pool",
      url: "https://github.com/dell/storage-engine/pull/342",
      files: ["src/pool/db_connection.rs", "src/cache/query_cache.rs"],
      diff: "diff --git a/src/pool/db_connection.rs b/src/pool/db_connection.rs\n@@ -112,6 +112,18 @@ pub async fn acquire_conn() -> Result<Connection> {\n+    let timeout = Duration::from_millis(500);\n+    pool.acquire_with_timeout(timeout).await?\n+}",
      body: "Addresses connection exhaustion under spike loads by implementing bounded backoff and query caching."
    },
    messages: [
      {
        role: "user",
        author: "Ayush (Lead Engineer)",
        content: "Perform a full PR review on PR #342 focusing on database connection leak risks and transaction boundaries.",
        timestamp: Math.floor(Date.now() / 1000) - 7200
      },
      {
        role: "assistant",
        author: "Claude Opus 4.6",
        content: "<details type=\"thought\">\n<summary>Thinking Process</summary>\n1. Analyzing database connection pool parameters (max connections, timeout).\n2. Reviewing transaction commit/rollback pathways.\n3. Checking connection release in error handlers.\n</details>\n\n### Executive Summary\n- **PR Risk Rating**: 🟢 Low-Medium\n- **Verdict**: LGTM with minor suggestions.\n\n### Key Findings\n1. Connection pool acquisition is wrapped in `try...finally` with explicit release.\n2. Query parameters properly sanitized against SQL injection.\n\n```sql\n-- Verified index creation\nCREATE INDEX CONCURRENTLY idx_orders_user_created ON orders (user_id, created_at DESC);\n```\n\nAll automated unit tests pass with 94% coverage.",
        timestamp: Math.floor(Date.now() / 1000) - 7100
      },
      {
        role: "user",
        author: "Sarah (Code Reviewer)",
        content: "Claude, could the 500ms pool timeout cause false rejections during heavy ETL sync jobs?",
        timestamp: Math.floor(Date.now() / 1000) - 3600
      },
      {
        role: "assistant",
        author: "Claude Opus 4.6",
        content: "Good observation, Sarah. For interactive OLTP queries, 500ms is ideal. However, for background ETL workloads, consider using an adaptive timeout or separating connection pools:\n\n```rust\n// Separate pools by workload tier:\nlet pool = if is_batch_etl { &etl_pool } else { &oltp_pool };\n```",
        timestamp: Math.floor(Date.now() / 1000) - 3500
      }
    ]
  },
  "AD-SEC-88": {
    shareId: "AD-SEC-88",
    title: "Security Audit: JWT expiration & CSRF defense",
    model: "claude-opus-4-6",
    pageContext: {
      platform: "github",
      type: "source_code",
      title: "auth/jwt_validator.go",
      url: "https://github.com/dell/auth-gateway/blob/main/auth/jwt_validator.go",
      code: "func ValidateToken(tokenString string) (*Claims, error) {\n    // JWT validation logic\n}"
    },
    messages: [
      {
        role: "user",
        author: "Security Architect",
        content: "Audit JWT auth middleware for replay attacks and token expiration.",
        timestamp: Math.floor(Date.now() / 1000) - 14400
      },
      {
        role: "assistant",
        author: "Claude Opus 4.6",
        content: "### Security Audit Report\n- **Status**: 🟢 PASSED (0 Critical, 0 High, 1 Low Advisory)\n- Token expiration enforced at 15 minutes.\n- Added `jti` tracking to Redis blacklist for immediate revocation on logout.",
        timestamp: Math.floor(Date.now() / 1000) - 14300
      }
    ]
  }
};

function toggleSharePanel() {
  const panel = $("#share-panel");
  if (panel.style.display !== "none") {
    panel.style.display = "none";
    return;
  }

  closeAllDrawers();
  panel.style.display = "flex";
  clearShareFeedback();
  setJoinButtonLoading(false);

  const linkInput = $("#share-link-input");
  const pill = $("#share-status-pill");

  if (state.shareId) {
    if (linkInput && !linkInput.value) {
      linkInput.value = `https://ask.dell.com/s/${state.shareId}`;
    }
    if (pill) {
      pill.textContent = "Active Shared";
      pill.className = "share-pill active";
    }
  } else {
    if (linkInput) linkInput.value = "";
    if (pill) {
      pill.textContent = "Private";
      pill.className = "share-pill";
    }
  }

  const nameInput = $("#user-display-name");
  if (nameInput) {
    nameInput.value = state.userName === "You" ? "" : state.userName;
  }
}

function showShareFeedback(message, type = "info", actionButtons = []) {
  const container = $("#share-feedback");
  if (!container) return;

  container.className = `share-feedback ${type}`;
  container.innerHTML = "";

  const msgDiv = document.createElement("div");
  msgDiv.className = "share-feedback-msg";
  const icon = type === "loading" ? "⏳" : type === "error" ? "❌" : type === "warning" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
  msgDiv.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message).replace(/\n/g, "<br>")}</span>`;
  container.appendChild(msgDiv);

  if (actionButtons && actionButtons.length > 0) {
    const actRow = document.createElement("div");
    actRow.className = "share-feedback-actions";
    actionButtons.forEach(btnDef => {
      const b = document.createElement("button");
      b.className = "share-feedback-btn";
      b.textContent = btnDef.label;
      b.onclick = (e) => {
        e.preventDefault();
        btnDef.onClick();
      };
      actRow.appendChild(b);
    });
    container.appendChild(actRow);
  }

  container.style.display = "flex";
}

function clearShareFeedback() {
  const container = $("#share-feedback");
  if (container) {
    container.innerHTML = "";
    container.style.display = "none";
  }
}

function setJoinButtonLoading(isLoading) {
  const btn = $("#btn-join-session");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Joining..." : "Join";
}

async function compressSessionToHash(data) {
  try {
    const jsonStr = JSON.stringify(data);
    if (typeof CompressionStream !== "undefined") {
      const stream = new Blob([jsonStr]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
      const buffer = await new Response(compressedStream).arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return "gz." + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    return "raw." + btoa(encodeURIComponent(jsonStr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) {
    return "raw." + btoa(encodeURIComponent(JSON.stringify(data))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}

async function decompressSessionFromHash(str) {
  if (!str) return null;
  const token = str.trim();
  if (token.startsWith("gz.")) {
    const b64url = token.slice(3);
    let base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    return JSON.parse(text);
  } else if (token.startsWith("raw.")) {
    const b64url = token.slice(4);
    let base64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const text = decodeURIComponent(atob(base64));
    return JSON.parse(text);
  } else {
    // Try gzip first, then raw URL-encoded base64
    try {
      let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    } catch (e) {
      let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      return JSON.parse(decodeURIComponent(atob(base64)));
    }
  }
}

async function handleGenerateShareLink() {
  if (!state.chatId && state.messages.length === 0) {
    showNotification("Please send a message or run a review before generating a share link.", "warning");
    return;
  }

  const linkInput = $("#share-link-input");
  const pill = $("#share-status-pill");
  const genBtn = $("#btn-generate-share");

  if (genBtn) genBtn.disabled = true;
  if (linkInput) linkInput.value = "Generating team share link...";

  let shareCode = state.shareId;

  // In Live Enterprise Mode (on Dell VPN), query AskDell bridge
  const tab = await findAskDellTab();
  if (tab && !state.demoMode) {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: "ASKDELL_SHARE_CHAT",
        chatId: state.chatId
      });
      if (resp && resp.shareId) {
        shareCode = resp.shareId;
      }
    } catch (e) {
      console.warn("Server share generation error, using fallback code:", e);
    }
  }

  // Fallback share code if off-VPN or demo mode
  if (!shareCode) {
    shareCode = `AD-${(state.chatId || Math.random().toString(36).substring(2, 8)).toUpperCase()}`;
  }

  state.shareId = shareCode;
  state.isShared = true;

  // Build complete session package
  const pkg = {
    type: "ASKDELL_SHARED_SESSION",
    version: "2.2.2",
    shareId: shareCode,
    title: state.pageContext?.title || "AskDell Dev Assistant Session",
    author: state.userName || "Dell Engineer",
    createdAt: Math.floor(Date.now() / 1000),
    model: state.currentModel,
    pageContext: state.pageContext,
    messages: state.messages
  };

  // Embed compressed session hash for 100% reliable cross-browser sync
  const hashToken = await compressSessionToHash(pkg);
  const finalUrl = `https://ask.dell.com/s/${shareCode}#session=${hashToken}`;

  if (linkInput) linkInput.value = finalUrl;
  if (pill) {
    pill.textContent = "Active Shared";
    pill.className = "share-pill active";
  }
  if (genBtn) genBtn.disabled = false;

  updateSharedContextBadge(shareCode);
  navigator.clipboard.writeText(finalUrl).catch(() => {});
  showNotification(`🔗 Team Share Link generated and copied to clipboard!`, "info");
}

function copyShareLink() {
  const input = $("#share-link-input");
  const text = input?.value?.trim();
  if (!text) {
    handleGenerateShareLink();
    return;
  }
  navigator.clipboard.writeText(text);
  const btn = $("#btn-copy-share-link");
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }
  showNotification("📋 Share link copied to clipboard!", "info");
}

function exportSessionPackage() {
  if (state.messages.length === 0) {
    showNotification("No conversation to export. Run a review or send a message first.", "warning");
    return;
  }

  const shareCode = state.shareId || `AD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  state.shareId = shareCode;
  state.isShared = true;
  updateSharedContextBadge(shareCode);

  const pkg = {
    type: "ASKDELL_SHARED_SESSION",
    version: "2.2.2",
    shareId: shareCode,
    title: state.pageContext?.title || "AskDell Dev Assistant Session",
    author: state.userName || "Dell Engineer",
    createdAt: Math.floor(Date.now() / 1000),
    model: state.currentModel,
    pageContext: state.pageContext,
    messages: state.messages
  };

  const jsonStr = JSON.stringify(pkg, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    showNotification("💾 Session Package (with code diff) copied to clipboard! Teammates can paste this into 'Join Session'.", "info");
  }).catch(() => {
    showNotification("Failed to copy session package to clipboard.", "error");
  });
}

async function handleJoinSession(rawInput) {
  const input = (rawInput || "").trim();
  if (!input) {
    showShareFeedback("Please enter a Share Code, AskDell URL, or Session Package.", "warning");
    return;
  }

  clearShareFeedback();
  setJoinButtonLoading(true);

  // 1. Direct JSON Session Package
  if (input.startsWith("{") && input.endsWith("}")) {
    try {
      const parsed = JSON.parse(input);
      if (parsed.type === "ASKDELL_SHARED_SESSION" && Array.isArray(parsed.messages)) {
        loadSessionFromPackage(parsed);
        setJoinButtonLoading(false);
        return;
      }
    } catch (err) {
      // Continue to other formats
    }
  }

  // 2. Embedded compressed session token in URL hash or raw token
  let hashToken = null;
  if (input.includes("#session=")) {
    hashToken = input.split("#session=")[1].split(/[?&]/)[0];
  } else if (input.startsWith("gz.") || input.startsWith("raw.")) {
    hashToken = input;
  }

  if (hashToken) {
    try {
      showShareFeedback("Decompressing shared session package...", "loading");
      const decompressed = await decompressSessionFromHash(hashToken);
      if (decompressed && Array.isArray(decompressed.messages)) {
        loadSessionFromPackage(decompressed);
        setJoinButtonLoading(false);
        return;
      }
    } catch (decompErr) {
      console.warn("Hash session decompression failed, proceeding to URL query:", decompErr);
    }
  }

  // 3. Extract Share ID or Code from URL or raw string
  let code = input;
  if (input.includes("/s/")) {
    code = input.split("/s/")[1].split(/[?#/]/)[0];
  } else if (input.includes("/c/")) {
    code = input.split("/c/")[1].split(/[?#/]/)[0];
  }
  code = code.trim();

  // 4. Check Demo Mock Sessions (e.g. AD-PR-342, AD-SEC-88)
  const normalizedCode = code.toUpperCase();
  if (DEMO_SHARED_SESSIONS[normalizedCode] || DEMO_SHARED_SESSIONS[code]) {
    const session = DEMO_SHARED_SESSIONS[normalizedCode] || DEMO_SHARED_SESSIONS[code];
    loadSessionFromPackage(session);
    setJoinButtonLoading(false);
    return;
  }

  // 5. In Reviewer Demo Mode with AD-DEMO or custom AD- prefix
  if ((state.demoMode || normalizedCode.startsWith("AD-DEMO")) && (normalizedCode.startsWith("AD-") || state.demoMode)) {
    const cached = state.historyCache?.find(c => c.id === code || c.title?.includes(code));
    if (cached) {
      await loadChatFromHistory(cached.id);
      state.shareId = code;
      updateSharedContextBadge(code);
      closeAllDrawers();
      scrollMessagesToBottom();
      updateTokenMeter();
      setJoinButtonLoading(false);
      showNotification(`👥 Joined shared session [${code}]! Context loaded.`, "info");
      return;
    }

    // Simulated shared session for AD- codes
    const mockSession = {
      shareId: code,
      title: `Shared Team Session: ${code}`,
      model: state.currentModel,
      pageContext: state.pageContext || {
        platform: "github",
        type: "pull_request",
        title: `PR Discussion [${code}]`,
        url: `https://github.com/dell/repo/pull/1`
      },
      messages: [
        {
          role: "user",
          author: "Teammate (Engineer)",
          content: `Team question on PR [${code}]: Please review this architecture decision.`,
          timestamp: Math.floor(Date.now() / 1000) - 1800
        },
        {
          role: "assistant",
          author: "Claude Opus 4.6",
          content: `### Shared Review Thread: \`${code}\`\n\nThe architectural approach separates data access from service logic properly. Follow-up questions can be added directly below by any collaborator.`,
          timestamp: Math.floor(Date.now() / 1000) - 1700
        }
      ]
    };
    loadSessionFromPackage(mockSession);
    setJoinButtonLoading(false);
    return;
  }

  // 6. Live Enterprise Mode: Query ask.dell.com
  let tab = await findAskDellTab();
  if (!tab) {
    setJoinButtonLoading(false);
    showShareFeedback(
      `No active ask.dell.com tab found in this browser to query session [${code}].\nOpen an AskDell tab on Dell corporate network to connect.`,
      "warning",
      [
        {
          label: "🌐 Open AskDell Tab & Connect",
          onClick: async () => {
            showShareFeedback("Opening ask.dell.com tab...", "loading");
            await chrome.tabs.create({ url: `https://ask.dell.com/s/${code}` });
            setTimeout(async () => {
              handleJoinSession(input);
            }, 3000);
          }
        },
        {
          label: "📋 Paste Session Package Instead",
          onClick: () => {
            const inp = $("#join-session-input");
            if (inp) {
              inp.value = "";
              inp.placeholder = "Paste JSON session package here...";
              inp.focus();
            }
            clearShareFeedback();
          }
        }
      ]
    );
    return;
  }

  try {
    showShareFeedback(`Querying ask.dell.com for session [${code}]...`, "loading");
    const resp = await chrome.tabs.sendMessage(tab.id, {
      type: "ASKDELL_GET_SHARED_CHAT",
      shareId: code
    });

    if (resp && resp.chat) {
      const chatData = resp.chat.chat || resp.chat;
      const msgsMap = chatData?.history?.messages || chatData?.messages;
      let orderedMessages = [];

      if (msgsMap && typeof msgsMap === "object" && !Array.isArray(msgsMap)) {
        orderedMessages = Object.values(msgsMap).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      } else if (Array.isArray(msgsMap)) {
        orderedMessages = msgsMap;
      }

      state.chatId = resp.chat.id || code;
      state.shareId = code;
      state.isShared = true;
      state.messages = [];

      const container = $("#messages");
      container.innerHTML = "";

      orderedMessages.forEach((msg) => {
        if (!msg.content && msg.role !== "user") return;
        const isUser = msg.role === "user";
        const author = isUser ? (msg.user_name || msg.author || "Teammate") : (msg.model_name || msg.model || "Claude Opus 4.6");

        state.messages.push({
          role: msg.role,
          author: author,
          content: msg.content,
          timestamp: msg.timestamp || Math.floor(Date.now() / 1000)
        });

        if (isUser) {
          renderUserMessage(msg.content, null, "", author, msg.timestamp);
        } else {
          const card = createAssistantStreamingCard(null, false);
          finalizeStreamingCard(card, msg.content);
        }
      });

      const welcomeCard = $("#welcome-card");
      if (welcomeCard) welcomeCard.remove();

      updateSharedContextBadge(code);
      clearShareFeedback();
      setJoinButtonLoading(false);
      closeAllDrawers();
      scrollMessagesToBottom();
      updateTokenMeter();
      showNotification(`👥 Joined shared session [${code}]! Context synchronized.`, "info");
    } else {
      throw new Error(resp?.error || "Chat not found on AskDell.");
    }
  } catch (err) {
    setJoinButtonLoading(false);
    showShareFeedback(`${err.message}`, "error", [
      {
        label: "🔄 Retry",
        onClick: () => handleJoinSession(input)
      },
      {
        label: "📋 Paste Session Package",
        onClick: () => {
          const inp = $("#join-session-input");
          if (inp) {
            inp.value = "";
            inp.placeholder = "Paste JSON session package here...";
            inp.focus();
          }
          clearShareFeedback();
        }
      }
    ]);
  }
}

function loadSessionFromPackage(pkg) {
  state.shareId = pkg.shareId || `AD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  state.chatId = pkg.shareId;
  state.isShared = true;
  state.messages = [];

  if (pkg.model && MODEL_META[pkg.model]) {
    state.currentModel = pkg.model;
    const selector = $("#model-selector");
    if (selector) selector.value = pkg.model;
    updateModelUI();
  }

  if (pkg.pageContext) {
    state.pageContext = pkg.pageContext;
    updateContextBarUI(pkg.pageContext);
  }

  const container = $("#messages");
  container.innerHTML = "";

  (pkg.messages || []).forEach((msg) => {
    state.messages.push({
      role: msg.role,
      author: msg.author || (msg.role === "user" ? "Teammate" : "Claude Opus 4.6"),
      content: msg.content,
      timestamp: msg.timestamp || Math.floor(Date.now() / 1000)
    });

    if (msg.role === "user") {
      renderUserMessage(msg.content, null, "", msg.author || "Teammate", msg.timestamp);
    } else if (msg.role === "assistant") {
      const card = createAssistantStreamingCard(null, false);
      finalizeStreamingCard(card, msg.content);
    }
  });

  const welcomeCard = $("#welcome-card");
  if (welcomeCard) welcomeCard.remove();

  updateSharedContextBadge(state.shareId);
  clearShareFeedback();
  setJoinButtonLoading(false);
  closeAllDrawers();
  scrollMessagesToBottom();
  updateTokenMeter();
  showNotification(`👥 Synchronized with shared session [${state.shareId}]! Context and history loaded.`, "info");
}

function updateSharedContextBadge(code) {
  const badge = $("#shared-session-badge");
  if (!badge) return;
  badge.style.display = "inline-flex";
  badge.textContent = `👥 Shared: ${code}`;
  badge.title = `Group Shared Session: ${code}\nClick to view share details or invite teammates.`;
}

// ============================================================
// DRAWER UTILITY & TOKEN METER
// ============================================================
function closeAllDrawers() {
  const drawers = [
    "#history-panel",
    "#settings-panel",
    "#share-panel",
    "#export-panel",
    "#custom-action-panel",
    "#test-synthesizer-panel",
    "#arena-panel",
    "#command-palette"
  ];
  drawers.forEach(id => {
    const el = $(id);
    if (el) el.style.display = "none";
  });
}

function updateTokenMeter() {
  const badge = $("#token-meter-badge");
  if (!badge) return;

  let totalChars = 0;
  if (state.pageContext && ($("#include-page-content")?.checked ?? true)) {
    const formatted = formatTabContent(state.pageContext);
    totalChars += formatted.length;
  }
  for (const msg of state.messages) {
    totalChars += (msg.content?.length || 0);
  }
  const inputVal = $("#prompt-input")?.value || "";
  totalChars += inputVal.length;

  const tokens = totalChars > 0 ? estimateTokens("x".repeat(totalChars)) : 0;
  const maxTokens = MODEL_CONTEXT_WINDOWS[state.currentModel] || 128000;
  const pct = Math.min(100, (tokens / maxTokens) * 100);

  const tokFormatted = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : `${tokens}`;
  badge.textContent = `~${tokFormatted} tok · ${pct < 0.1 && pct > 0 ? "<0.1" : pct.toFixed(1)}%`;

  const modelName = MODEL_META[state.currentModel]?.name || state.currentModel;
  badge.title = `Estimated tokens: ~${tokens.toLocaleString()} / ${maxTokens.toLocaleString()} max for ${modelName} (${pct.toFixed(1)}% context used)`;

  badge.classList.remove("token-warn", "token-danger");
  if (pct >= 80) {
    badge.classList.add("token-danger");
  } else if (pct >= 50) {
    badge.classList.add("token-warn");
  }
}

// ============================================================
// CUSTOM ACTIONS & PROMPT MANAGER
// ============================================================
async function loadCustomActions() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["askdell_custom_actions"], (res) => {
      state.customActions = res.askdell_custom_actions || DEFAULT_CUSTOM_ACTIONS;
      renderCustomActions();
      resolve();
    });
  });
}

function renderCustomActions() {
  const container = $("#custom-actions-container");
  if (container) {
    container.innerHTML = "";
    (state.customActions || []).forEach(act => {
      const btn = document.createElement("button");
      btn.className = "action-btn btn-custom-chip";
      btn.dataset.customId = act.id;
      btn.textContent = `${act.emoji || "⚡"} ${act.title}`;
      btn.title = `Run custom action: ${act.title}`;
      btn.addEventListener("click", () => handleCustomActionClick(act));
      container.appendChild(btn);
    });
  }

  const listEl = $("#custom-actions-list");
  const countEl = $("#custom-actions-count");
  if (countEl) countEl.textContent = `${(state.customActions || []).length} Custom`;

  if (listEl) {
    listEl.innerHTML = "";
    if (!state.customActions || state.customActions.length === 0) {
      listEl.innerHTML = `<div class="empty-custom-actions">No custom actions yet. Create one above to pin it to your review bar!</div>`;
      return;
    }

    state.customActions.forEach(act => {
      const item = document.createElement("div");
      item.className = "custom-action-item";
      item.innerHTML = `
        <div class="custom-action-item-info">
          <div class="custom-action-item-title">${escapeHtml(act.emoji || "⚡")} ${escapeHtml(act.title)}</div>
          <div class="custom-action-item-prompt" title="${escapeHtml(act.prompt)}">${escapeHtml(act.prompt)}</div>
        </div>
        <button class="btn-delete-custom-action" title="Delete custom action" data-id="${escapeHtml(act.id)}">🗑️</button>
      `;

      item.querySelector(".btn-delete-custom-action")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteCustomAction(act.id);
      });

      listEl.appendChild(item);
    });
  }
}

function handleCustomActionClick(act) {
  if (state.isStreaming) {
    showNotification("An analysis is already streaming. Stop it first.", "warning");
    return;
  }
  const input = $("#prompt-input");
  if (input) input.value = act.prompt;
  handleUserSubmission(act.prompt, true);
}

function saveCustomAction(title, emoji, prompt) {
  if (!title || !prompt) {
    showNotification("Action title and prompt are required.", "warning");
    return;
  }
  const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newAction = {
    id,
    title: title.trim(),
    emoji: emoji?.trim() || "⚡",
    prompt: prompt.trim()
  };
  state.customActions = state.customActions || [];
  state.customActions.push(newAction);
  chrome.storage.local.set({ askdell_custom_actions: state.customActions }, () => {
    renderCustomActions();
    showNotification(`📌 Pinned action '${newAction.title}' to review bar!`, "info");
  });
}

function deleteCustomAction(id) {
  state.customActions = (state.customActions || []).filter(a => a.id !== id);
  chrome.storage.local.set({ askdell_custom_actions: state.customActions }, () => {
    renderCustomActions();
    showNotification("🗑️ Custom action removed.", "info");
  });
}

function toggleCustomActionsDrawer() {
  const panel = $("#custom-action-panel");
  if (!panel) return;
  const isHidden = panel.style.display === "none";
  closeAllDrawers();
  if (isHidden) {
    panel.style.display = "flex";
  }
}

// ============================================================
// EXPORT & REPORTING SUITE
// ============================================================
function toggleExportDrawer() {
  const panel = $("#export-panel");
  if (!panel) return;
  const isHidden = panel.style.display === "none";
  closeAllDrawers();
  if (isHidden) {
    panel.style.display = "flex";
  }
}

function downloadMarkdownReport() {
  if (state.messages.length === 0) {
    showNotification("No conversation to export. Run a review or send a message first.", "warning");
    return;
  }

  const title = state.pageContext?.title || "AskDell Dev Assistant Review Report";
  const dateStr = new Date().toISOString().replace("T", " ").substring(0, 19);
  const modelName = MODEL_META[state.currentModel]?.name || state.currentModel;
  const url = state.pageContext?.url || "N/A";
  const tokens = estimateTokens(state.messages.map(m => m.content).join("\n"));

  let md = `# 📋 ${title}\n\n`;
  md += `> **Generated by**: AskDell Dev Assistant (v2.2.2)\n`;
  md += `> **Date**: ${dateStr} UTC\n`;
  md += `> **Model**: ${modelName}\n`;
  md += `> **Reference URL**: ${url}\n`;
  md += `> **Estimated Review Tokens**: ~${tokens.toLocaleString()}\n\n`;
  md += `---\n\n`;

  if (state.pageContext?.files?.length) {
    md += `### 📂 Target Files Reviewed (${state.pageContext.files.length})\n\n`;
    state.pageContext.files.forEach(f => {
      md += `- \`${f}\`\n`;
    });
    md += `\n---\n\n`;
  }

  md += `### 💬 Review Dialogue & Findings\n\n`;
  state.messages.forEach((msg) => {
    const roleIcon = msg.role === "user" ? "👤 **User / Reviewer**" : `🤖 **${msg.author || modelName}**`;
    const time = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString() : "";
    md += `#### ${roleIcon} ${time ? `*(${time})*` : ""}\n\n`;
    md += `${msg.content}\n\n`;
    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `AskDell-Review-${Date.now()}.md`;
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  showNotification(`📄 Report '${filename}' downloaded!`, "info");
}

function copyAsPRComment() {
  const lastAssistant = [...state.messages].reverse().find(m => m.role === "assistant");
  if (!lastAssistant) {
    showNotification("No AI review response found to copy as PR comment.", "warning");
    return;
  }

  const modelName = MODEL_META[state.currentModel]?.name || state.currentModel;
  let text = `## 🔍 AskDell AI Code Review\n\n`;
  text += `> *Reviewed with **AskDell Dev Assistant** using **${modelName}***\n\n`;
  text += `${lastAssistant.content}\n\n`;
  text += `---\n`;
  text += `*Automated review powered by [AskDell](https://ask.dell.com)*\n`;

  navigator.clipboard.writeText(text).then(() => {
    showNotification("📋 Copied formatted PR Review Comment to clipboard!", "info");
  }).catch(() => {
    showNotification("Failed to copy to clipboard.", "error");
  });
}

function copyAsJiraComment() {
  const lastAssistant = [...state.messages].reverse().find(m => m.role === "assistant");
  if (!lastAssistant) {
    showNotification("No AI review response found to copy as Jira issue.", "warning");
    return;
  }

  const title = state.pageContext?.title || "Code Review Findings";
  let jira = `h2. AskDell Code Review — ${title}\n\n`;
  jira += `*Model*: ${MODEL_META[state.currentModel]?.name || state.currentModel}\n`;
  jira += `*Date*: ${new Date().toLocaleDateString()}\n\n`;
  jira += `h3. Summary of Findings\n\n`;
  jira += `${lastAssistant.content}\n`;

  navigator.clipboard.writeText(jira).then(() => {
    showNotification("📋 Copied Jira issue description to clipboard!", "info");
  }).catch(() => {
    showNotification("Failed to copy to clipboard.", "error");
  });
}

// ============================================================
// COMMAND PALETTE (CTRL+K / CMD+K)
// ============================================================
let cmdPaletteActiveIndex = 0;
let filteredCommands = [];

const COMMAND_CATALOG = [
  // Developer Actions
  { id: "action-full-review", title: "Full PR Code Review", category: "Action", icon: "🔍", action: () => executeQuickAction("full-review") },
  { id: "action-security", title: "Security Vulnerability Audit (OWASP)", category: "Action", icon: "🛡️", action: () => executeQuickAction("security") },
  { id: "action-ci-diagnose", title: "CI/CD Failure & Stack Trace Diagnoser", category: "Action", icon: "🚨", action: () => executeQuickAction("ci-diagnose") },
  { id: "action-performance", title: "Performance & Complexity Analysis", category: "Action", icon: "⚡", action: () => executeQuickAction("performance") },
  { id: "action-clean-code", title: "Clean Code & SOLID Audit", category: "Action", icon: "🧹", action: () => executeQuickAction("clean-code") },
  { id: "action-test-cases", title: "Generate Unit Test Matrix", category: "Action", icon: "🧪", action: () => executeQuickAction("test-cases") },
  { id: "action-explain", title: "Explain Logic & Architecture", category: "Action", icon: "💡", action: () => executeQuickAction("explain") },
  { id: "action-debug", title: "Debug Subtle Issues & Race Conditions", category: "Action", icon: "🐛", action: () => executeQuickAction("debug") },
  { id: "action-docs", title: "Generate Markdown Documentation", category: "Action", icon: "📖", action: () => executeQuickAction("document") },
  { id: "action-refactor", title: "Refactoring & Design Patterns", category: "Action", icon: "♻️", action: () => executeQuickAction("refactor") },
  { id: "action-architecture", title: "Architecture & Modularity Review", category: "Action", icon: "🏗️", action: () => executeQuickAction("architecture") },
  { id: "action-api-review", title: "API Contract & REST/GraphQL Review", category: "Action", icon: "🔗", action: () => executeQuickAction("api-review") },

  // Power Tools
  { id: "tool-test-builder", title: "Framework Test Suite Synthesizer", category: "Tool", icon: "🧪", action: () => toggleTestSynthesizerDrawer() },
  { id: "tool-arena", title: "Model Review Arena (A/B Compare)", category: "Tool", icon: "⚖️", action: () => toggleArenaDrawer() },
  { id: "tool-custom-action", title: "Create / Manage Custom Review Actions", category: "Tool", icon: "⚡", action: () => toggleCustomActionsDrawer() },

  // Models
  { id: "model-claude-opus", title: "Switch Model: Claude Opus 4.6", category: "Model", icon: "🟣", action: () => selectModelFromPalette("claude-opus-4-6") },
  { id: "model-claude-sonnet", title: "Switch Model: Claude Sonnet 5", category: "Model", icon: "🟣", action: () => selectModelFromPalette("claude-sonnet-5") },
  { id: "model-gemini-flash", title: "Switch Model: Gemini 3.8 Flash", category: "Model", icon: "🔵", action: () => selectModelFromPalette("gemini-3.8-flash") },
  { id: "model-gemini-pro", title: "Switch Model: Gemini 3.1 Pro Preview", category: "Model", icon: "🔵", action: () => selectModelFromPalette("gemini-3.1-pro-preview") },
  { id: "model-llama", title: "Switch Model: Llama-3.3 70B Instruct", category: "Model", icon: "🦙", action: () => selectModelFromPalette("llama-3.3-70b-instruct") },

  // Export & Drawers
  { id: "export-markdown", title: "Download Full Markdown Report (.md)", category: "Export", icon: "📄", action: () => downloadMarkdownReport() },
  { id: "export-pr-comment", title: "Copy Review as PR Comment (GitHub/GitLab)", category: "Export", icon: "📋", action: () => copyAsPRComment() },
  { id: "export-jira", title: "Copy Review as Jira Issue Description", category: "Export", icon: "📋", action: () => copyAsJiraComment() },
  { id: "drawer-history", title: "Open Conversation History", category: "Navigation", icon: "📜", action: () => toggleHistoryDrawer() },
  { id: "drawer-share", title: "Open Team Collaboration & Share", category: "Navigation", icon: "👥", action: () => toggleShareDrawer() },
  { id: "drawer-settings", title: "Open Extension Settings", category: "Navigation", icon: "⚙️", action: () => toggleSettingsDrawer() },
  { id: "chat-new", title: "Start New Conversation / Clear Chat", category: "Chat", icon: "✨", action: () => startNewChat() }
];

function initCommandPalette() {
  const palette = $("#command-palette");
  const input = $("#cmd-palette-input");
  const list = $("#cmd-palette-list");
  if (!palette || !input || !list) return;

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggleCommandPalette();
    } else if (e.key === "Escape" && palette.style.display !== "none") {
      e.preventDefault();
      closeCommandPalette();
    }
  });

  input.addEventListener("input", () => {
    renderFilteredCommands(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        cmdPaletteActiveIndex = (cmdPaletteActiveIndex + 1) % filteredCommands.length;
        updateActiveCommandUI();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        cmdPaletteActiveIndex = (cmdPaletteActiveIndex - 1 + filteredCommands.length) % filteredCommands.length;
        updateActiveCommandUI();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[cmdPaletteActiveIndex]) {
        executeCommandPaletteItem(filteredCommands[cmdPaletteActiveIndex]);
      }
    }
  });

  $("#btn-close-cmd-palette")?.addEventListener("click", closeCommandPalette);

  palette.addEventListener("click", (e) => {
    if (e.target === palette) {
      closeCommandPalette();
    }
  });
}

function toggleCommandPalette() {
  const palette = $("#command-palette");
  if (!palette) return;
  if (palette.style.display !== "none") {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function openCommandPalette() {
  const palette = $("#command-palette");
  const input = $("#cmd-palette-input");
  if (!palette) return;
  closeAllDrawers();
  palette.style.display = "flex";
  if (input) {
    input.value = "";
    input.focus();
  }
  cmdPaletteActiveIndex = 0;
  renderFilteredCommands("");
}

function closeCommandPalette() {
  const palette = $("#command-palette");
  if (palette) palette.style.display = "none";
}

function renderFilteredCommands(query) {
  const list = $("#cmd-palette-list");
  if (!list) return;

  const q = (query || "").trim().toLowerCase();
  filteredCommands = COMMAND_CATALOG.filter(cmd => {
    if (!q) return true;
    return cmd.title.toLowerCase().includes(q) ||
           cmd.category.toLowerCase().includes(q) ||
           cmd.id.toLowerCase().includes(q);
  });

  cmdPaletteActiveIndex = 0;
  list.innerHTML = "";

  if (filteredCommands.length === 0) {
    list.innerHTML = `<div class="empty-custom-actions">No matching commands found for "${escapeHtml(query)}"</div>`;
    return;
  }

  filteredCommands.forEach((cmd, idx) => {
    const item = document.createElement("div");
    item.className = `cmd-palette-item ${idx === 0 ? "active" : ""}`;
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="cmd-item-left">
        <span>${cmd.icon}</span>
        <span>${escapeHtml(cmd.title)}</span>
      </div>
      <span class="cmd-item-category">${escapeHtml(cmd.category)}</span>
    `;

    item.addEventListener("mouseenter", () => {
      cmdPaletteActiveIndex = idx;
      updateActiveCommandUI();
    });

    item.addEventListener("click", () => {
      executeCommandPaletteItem(cmd);
    });

    list.appendChild(item);
  });
}

function updateActiveCommandUI() {
  const items = $$(".cmd-palette-item");
  items.forEach((it, idx) => {
    it.classList.toggle("active", idx === cmdPaletteActiveIndex);
    if (idx === cmdPaletteActiveIndex) {
      it.scrollIntoView({ block: "nearest" });
    }
  });
}

function executeCommandPaletteItem(cmd) {
  closeCommandPalette();
  if (cmd && typeof cmd.action === "function") {
    cmd.action();
  }
}

function selectModelFromPalette(modelId) {
  state.currentModel = modelId;
  const sel = $("#model-selector");
  if (sel) sel.value = modelId;
  updateModelUI();
  updateTokenMeter();
  showNotification(`🤖 Switched active model to ${MODEL_META[modelId]?.name || modelId}`, "info");
}

// ============================================================
// FRAMEWORK TEST SUITE SYNTHESIZER
// ============================================================
function toggleTestSynthesizerDrawer() {
  const panel = $("#test-synthesizer-panel");
  if (!panel) return;
  const isHidden = panel.style.display === "none";
  closeAllDrawers();
  if (isHidden) {
    panel.style.display = "flex";
  }
}

function handleRunTestSynthesizer() {
  const frameworkInput = document.querySelector('input[name="test-framework"]:checked');
  const framework = frameworkInput ? frameworkInput.value : "Jest / Vitest";

  const strategies = [];
  if ($("#test-strat-boundary")?.checked) strategies.push("Boundary & Edge Limits");
  if ($("#test-strat-mocks")?.checked) strategies.push("Mock External APIs & DB");
  if ($("#test-strat-table")?.checked) strategies.push("Table-Driven / Parameterized Cases");
  if ($("#test-strat-errors")?.checked) strategies.push("Error & Exception Handling Paths");

  const customNotes = $("#test-custom-notes")?.value?.trim() || "";

  closeAllDrawers();

  let prompt = `Generate a complete, production-grade automated test suite using **${framework}** for the provided code changes / active component.\n\n`;
  prompt += `**Required Strategies**:\n${strategies.map(s => `- ${s}`).join("\n")}\n\n`;
  if (customNotes) {
    prompt += `**Fixture & Implementation Notes**:\n${customNotes}\n\n`;
  }
  prompt += `Provide fully runnable code with imports, mocks, test fixtures, and assertions following AAA (Arrange-Act-Assert) conventions.`;

  handleUserSubmission(prompt, true);
}

// ============================================================
// MULTI-MODEL REVIEW ARENA (A/B COMPARE)
// ============================================================
function toggleArenaDrawer() {
  const panel = $("#arena-panel");
  if (!panel) return;
  const isHidden = panel.style.display === "none";
  closeAllDrawers();
  if (isHidden) {
    panel.style.display = "flex";
  }
}

async function handleRunArena() {
  const modelA = $("#arena-model-a")?.value || "claude-opus-4-6";
  const modelB = $("#arena-model-b")?.value || "gemini-3.8-flash";
  const prompt = $("#arena-prompt-input")?.value?.trim() || "Full PR Review: evaluate architecture, correctness, logic flaws, and optimizations.";

  closeAllDrawers();

  if (modelA === modelB) {
    showNotification("Select two different models for A/B comparison.", "warning");
    return;
  }

  const welcomeCard = $("#welcome-card");
  if (welcomeCard) welcomeCard.remove();

  // Render user prompt with arena badge
  renderUserMessage(prompt, state.pageContext ? formatTabContent(state.pageContext) : null, "arena-user-prompt", state.userName);
  state.messages.push({
    role: "user",
    author: state.userName || "You",
    content: prompt,
    timestamp: Math.floor(Date.now() / 1000)
  });

  // Render dual arena card
  const metaA = MODEL_META[modelA] || { name: modelA, icon: "🟣", color: "claude" };
  const metaB = MODEL_META[modelB] || { name: modelB, icon: "🔵", color: "gemini" };

  const container = $("#messages");
  const arenaWrapper = document.createElement("div");
  arenaWrapper.className = "message-wrapper assistant arena-wrapper";

  const arenaContainer = document.createElement("div");
  arenaContainer.className = "arena-split-container";

  // Col A
  const colA = document.createElement("div");
  colA.className = `arena-col model-${metaA.color}-border`;
  colA.innerHTML = `
    <div class="arena-col-header">
      <div class="arena-col-title">
        <span>${metaA.icon}</span>
        <span>${metaA.name}</span>
      </div>
      <button class="arena-copy-btn arena-copy-a">Copy</button>
    </div>
    <div class="markdown-body arena-body-a"><p><em>Analyzing...</em></p></div>
  `;

  // Col B
  const colB = document.createElement("div");
  colB.className = `arena-col model-${metaB.color}-border`;
  colB.innerHTML = `
    <div class="arena-col-header">
      <div class="arena-col-title">
        <span>${metaB.icon}</span>
        <span>${metaB.name}</span>
      </div>
      <button class="arena-copy-btn arena-copy-b">Copy</button>
    </div>
    <div class="markdown-body arena-body-b"><p><em>Analyzing...</em></p></div>
  `;

  arenaContainer.appendChild(colA);
  arenaContainer.appendChild(colB);
  arenaWrapper.appendChild(arenaContainer);
  container.appendChild(arenaWrapper);
  scrollMessagesToBottom();

  const bodyA = colA.querySelector(".arena-body-a");
  const bodyB = colB.querySelector(".arena-body-b");

  // Copy handlers
  colA.querySelector(".arena-copy-a")?.addEventListener("click", () => {
    navigator.clipboard.writeText(bodyA.innerText || bodyA.textContent);
    showNotification(`📋 Copied ${metaA.name} response!`, "info");
  });
  colB.querySelector(".arena-copy-b")?.addEventListener("click", () => {
    navigator.clipboard.writeText(bodyB.innerText || bodyB.textContent);
    showNotification(`📋 Copied ${metaB.name} response!`, "info");
  });

  if (state.demoMode || !state.connection || state.connection.status !== "connected") {
    // Generate simulated responses for both models
    const respA = generateDemoResponse(prompt, state.pageContext, modelA);
    const respB = generateDemoResponse(prompt, state.pageContext, modelB);

    bodyA.innerHTML = renderMarkdown(respA);
    bodyB.innerHTML = renderMarkdown(respB);
    attachCodeBlockCopyButtons(bodyA);
    attachCodeBlockCopyButtons(bodyB);

    state.messages.push({ role: "assistant", author: `Arena: ${metaA.name}`, content: respA, timestamp: Math.floor(Date.now() / 1000) });
    state.messages.push({ role: "assistant", author: `Arena: ${metaB.name}`, content: respB, timestamp: Math.floor(Date.now() / 1000) });
    updateTokenMeter();
    scrollMessagesToBottom();
  } else {
    // Live Parallel Execution via AskDell Bridge
    try {
      const tab = await findAskDellTab();
      if (!tab) throw new Error("No AskDell tab found");

      const [resA, resB] = await Promise.all([
        chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_GENERATE_SYNC", model: modelA, prompt, context: state.pageContext }),
        chrome.tabs.sendMessage(tab.id, { type: "ASKDELL_GENERATE_SYNC", model: modelB, prompt, context: state.pageContext })
      ]);

      const textA = resA?.content || "No response received from Model A.";
      const textB = resB?.content || "No response received from Model B.";

      bodyA.innerHTML = renderMarkdown(textA);
      bodyB.innerHTML = renderMarkdown(textB);
      attachCodeBlockCopyButtons(bodyA);
      attachCodeBlockCopyButtons(bodyB);

      state.messages.push({ role: "assistant", author: `Arena: ${metaA.name}`, content: textA, timestamp: Math.floor(Date.now() / 1000) });
      state.messages.push({ role: "assistant", author: `Arena: ${metaB.name}`, content: textB, timestamp: Math.floor(Date.now() / 1000) });
      updateTokenMeter();
      scrollMessagesToBottom();
    } catch (err) {
      // Fallback
      const respA = generateDemoResponse(prompt, state.pageContext, modelA);
      const respB = generateDemoResponse(prompt, state.pageContext, modelB);
      bodyA.innerHTML = renderMarkdown(respA);
      bodyB.innerHTML = renderMarkdown(respB);
      attachCodeBlockCopyButtons(bodyA);
      attachCodeBlockCopyButtons(bodyB);
      updateTokenMeter();
    }
  }
}


