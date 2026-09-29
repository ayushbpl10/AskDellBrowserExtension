// ============================================================
// background.js — Service Worker (Manifest V3)
// AskDell Dev Assistant v2.0.0
// General-purpose developer analysis tool
// ============================================================

// Configure side panel to open on action click where supported
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.warn("[AskDell] setPanelBehavior error:", err);
  });
}

// Fallback action click handler
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn("[AskDell] Failed to open side panel on action click:", err);
    }
  }
});

// Setup context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "askdell-analyze-selection",
    title: "AskDell: Analyze Selection",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "askdell-explain-selection",
    title: "AskDell: Explain Selection",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "askdell-analyze-page",
    title: "AskDell: Analyze Current Page / PR / Code",
    contexts: ["page"]
  });

  // Default settings — Claude Opus 4 as primary default model
  chrome.storage.local.get(["settings"], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          model: "claude-opus-4-6",
          includePageContent: true,
          autoWebSearch: true,
          maxContentLength: 100000
        }
      });
    } else if (result.settings.model === "claude-opus") {
      // Migrate legacy model ID
      result.settings.model = "claude-opus-4-6";
      chrome.storage.local.set({ settings: result.settings });
    }
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (e) {
      console.warn("[AskDell] Could not open side panel:", e);
    }
  }

  if (info.menuItemId === "askdell-analyze-selection") {
    const payload = {
      type: "ANALYZE_SELECTION",
      text: info.selectionText,
      url: tab?.url || "",
      title: tab?.title || ""
    };
    await chrome.storage.local.set({ pendingAction: payload });
    chrome.runtime.sendMessage(payload).catch(() => {});
  } else if (info.menuItemId === "askdell-explain-selection") {
    const payload = {
      type: "EXPLAIN_SELECTION",
      text: info.selectionText,
      url: tab?.url || "",
      title: tab?.title || ""
    };
    await chrome.storage.local.set({ pendingAction: payload });
    chrome.runtime.sendMessage(payload).catch(() => {});
  } else if (info.menuItemId === "askdell-analyze-page") {
    if (!tab?.id) return;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPageContent
      });
      const content = results?.[0]?.result;
      const payload = {
        type: "ANALYZE_PAGE",
        content: content,
        url: tab?.url || "",
        title: tab?.title || ""
      };
      await chrome.storage.local.set({ pendingAction: payload });
      chrome.runtime.sendMessage(payload).catch(() => {});
    } catch (err) {
      console.error("[AskDell] Failed to extract page content from context menu:", err);
    }
  }
});

// Message listener for tab content extraction, model discovery, and tab management
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_TAB_CONTENT") {
    (async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          sendResponse({ error: "No active tab found" });
          return;
        }

        // Check if tab is a restricted browser internal URL
        if (
          activeTab.url?.startsWith("chrome://") ||
          activeTab.url?.startsWith("edge://") ||
          activeTab.url?.startsWith("about:") ||
          activeTab.url?.startsWith("chrome-extension://")
        ) {
          sendResponse({
            error: "Cannot extract content from internal browser pages. Please open a code file, PR, documentation, or ticket."
          });
          return;
        }

        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: extractPageContent
        });

        if (results && results[0]?.result) {
          sendResponse({ content: results[0].result });
        } else {
          sendResponse({ error: "Could not extract content from the active tab." });
        }
      } catch (err) {
        console.error("[AskDell] Script execution failed:", err);
        sendResponse({ error: err.message });
      }
    })();
    return true; // async response
  }

  if (message.type === "GET_ASKDELL_TAB") {
    chrome.tabs.query({ url: "*://ask.dell.com/*" }, (tabs) => {
      sendResponse({ tabId: tabs && tabs.length > 0 ? tabs[0].id : null });
    });
    return true;
  }

  if (message.type === "FETCH_MODELS") {
    chrome.tabs.query({ url: "*://ask.dell.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "ASKDELL_GET_MODELS" }, (response) => {
          sendResponse(response || { error: "No response from AskDell bridge" });
        });
      } else {
        sendResponse({ error: "No ask.dell.com tab open" });
      }
    });
    return true;
  }

  if (message.type === "OPEN_ASKDELL_TAB") {
    (async () => {
      try {
        const tab = await chrome.tabs.create({ url: "https://ask.dell.com" });
        sendResponse({ success: true, tabId: tab.id });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (message.type === "REFRESH_ASKDELL_TAB") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ url: "*://ask.dell.com/*" });
        if (tabs && tabs[0]?.id) {
          await chrome.tabs.reload(tabs[0].id);
          sendResponse({ success: true, tabId: tabs[0].id });
        } else {
          const tab = await chrome.tabs.create({ url: "https://ask.dell.com" });
          sendResponse({ success: true, tabId: tab.id });
        }
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }
});

// ============================================================
// General-Purpose Content Extraction Function
// Detects: Pull Requests, Code Files, Issues/Tickets,
// Documentation, CI/Build Logs, and General Webpages
// ============================================================
function extractPageContent() {
  const url = window.location.href;
  const hostname = window.location.hostname;
  const title = document.title;

  // --- 1. Code / Git Platforms (GitHub, GitLab, ADO, Bitbucket) ---
  // Detect GitHub.com or GitHub Enterprise (e.g. eos2git.cec.lab.emc.com, github.*, git.*)
  const isGitHub =
    hostname.includes("github") ||
    Boolean(document.querySelector(".gh-header-title, .diff-table, .react-code-diff-table, meta[name*='octolytics'], [data-component='PH_Title'], .js-issue-title, .file-header")) ||
    ((hostname.includes("git") || hostname.includes("cec.lab.emc.com") || hostname.includes("lab.emc.com")) &&
     (url.includes("/pull/") || url.includes("/pulls") || url.includes("/commit/") || url.includes("/blob/") || url.includes("/tree/") || url.includes("/compare/")));

  if (isGitHub) {
    const isPR = url.includes("/pull/") || url.includes("/pulls") || url.includes("/compare/") || Boolean(document.querySelector(".diff-table, .file-header, [data-details-container-group='file'], .react-code-diff-table"));
    const isCode = url.includes("/blob/") || url.includes("/tree/");
    const isIssue = url.includes("/issues/");

    const prTitle = document.querySelector(".js-issue-title, .gh-header-title, [data-component='PH_Title'], [data-testid='issue-title'], h1.bcpXBm, .pr-title")?.innerText?.trim() || title;
    const prBody = document.querySelector(".comment-body, .markdown-body, [data-testid='issue-body'], .timeline-comment-group .edit-comment-hide")?.innerText?.trim() || "";
    
    let diff = "";
    let files = [];
    if (isPR) {
      files = Array.from(document.querySelectorAll(".file-header, [data-file-path], .file-info a, .ActionList-item-label, .file-info"))
        .map((f) => f.getAttribute("data-file-path") || f.getAttribute("title") || f.innerText?.trim())
        .filter(Boolean)
        .slice(0, 100);
      files = [...new Set(files)];

      diff = Array.from(document.querySelectorAll(".diff-table, .js-file-content, [data-tag='diff'], .blob-code-inner, .react-code-diff-table, .react-code-view, .blob-wrapper"))
        .map((el) => el.innerText)
        .join("\n")
        .substring(0, 120000);

      // If diff is empty (e.g. Conversation tab or collapsed diffs), also try checking file changes container or diff view
      if (!diff) {
        const diffContainer = document.querySelector("#files, .diff-view, [data-target='diff-layout.diffContainer'], .repository-content");
        if (diffContainer) {
          diff = diffContainer.innerText.substring(0, 120000);
        }
      }
    }

    let code = "";
    if (isCode) {
      const codeBlock = document.querySelector(".blob-code-content, .highlight, [data-testid='raw-content'], .react-blob-print-hide, .blob-wrapper");
      code = codeBlock ? codeBlock.innerText.substring(0, 100000) : "";
    }

    const comments = Array.from(document.querySelectorAll(".timeline-comment .comment-body, .review-comment .comment-body, .TimelineItem-body"))
      .map((el) => el.innerText.trim())
      .filter(Boolean)
      .join("\n---\n")
      .substring(0, 20000);

    return {
      platform: "github",
      type: isPR ? "pull_request" : isIssue ? "issue" : isCode ? "source_code" : "repository",
      title: prTitle,
      body: prBody.substring(0, 40000),
      files: files,
      diff: diff,
      code: code,
      comments: comments,
      url: url,
      isPR: isPR
    };
  }

  const isGitLab = hostname.includes("gitlab") || Boolean(document.querySelector(".gl-markdown, .detail-page-header, [data-qa-selector='mr_title']"));
  if (isGitLab) {
    const isMR = url.includes("/merge_requests/");
    const mrTitle = document.querySelector(".detail-page-header .title, .merge-request-details .title, .diffs .mr-title")?.innerText?.trim() || title;
    const mrBody = document.querySelector(".description .md, .gl-markdown, .merge-request-description")?.innerText?.trim() || "";
    const files = Array.from(document.querySelectorAll(".file-title-name, .diff-file-header .file-header-content"))
      .map((f) => f.innerText?.trim())
      .filter(Boolean);
    const diff = Array.from(document.querySelectorAll(".diff-content, .code, .diff-files-holder"))
      .map((el) => el.innerText)
      .join("\n")
      .substring(0, 120000);

    return {
      platform: "gitlab",
      type: isMR ? "merge_request" : "source_code",
      title: mrTitle,
      body: mrBody.substring(0, 40000),
      files: files,
      diff: diff,
      code: "",
      comments: "",
      url: url,
      isPR: isMR
    };
  }

  const isADO = hostname.includes("dev.azure.com") || hostname.includes("visualstudio.com") || Boolean(document.querySelector(".bolt-header-title, .vc-pullrequest-title, .repos-pr-title"));
  if (isADO) {
    const adoTitle = document.querySelector(".bolt-header-title, .vc-pullrequest-title, .repos-pr-title")?.innerText?.trim() || title;
    const adoBody = document.querySelector(".vc-pullrequest-description, .bolt-card-content, .repos-pr-details-description")?.innerText?.trim() || "";
    const files = Array.from(document.querySelectorAll(".file-container, .file-path, .repos-summary-file-name"))
      .map((f) => f.innerText?.trim())
      .filter(Boolean);
    const diff = Array.from(document.querySelectorAll(".repos-summary-diff-container, .bolt-diff-line, .vc-diff-viewer"))
      .map((el) => el.innerText)
      .join("\n")
      .substring(0, 120000);

    return {
      platform: "azure_devops",
      type: "pull_request",
      title: adoTitle,
      body: adoBody.substring(0, 40000),
      files: files,
      diff: diff,
      code: "",
      comments: "",
      url: url,
      isPR: true
    };
  }

  const isBitbucket = hostname.includes("bitbucket") || Boolean(document.querySelector("[data-testid='pr-title'], .udiff-line, .pull-request-title"));
  if (isBitbucket) {
    const bbTitle = document.querySelector("[data-testid='pr-title'], .pull-request-title, h1")?.innerText?.trim() || title;
    const bbBody = document.querySelector(".wiki-content, .pull-request-description, [data-testid='pr-description']")?.innerText?.trim() || "";
    const files = Array.from(document.querySelectorAll(".filename, [data-testid='file-header']"))
      .map((f) => f.innerText?.trim())
      .filter(Boolean);
    const diff = Array.from(document.querySelectorAll(".udiff-line, .diff-container, [data-module='components/diff-view']"))
      .map((el) => el.innerText)
      .join("\n")
      .substring(0, 120000);

    return {
      platform: "bitbucket",
      type: "pull_request",
      title: bbTitle,
      body: bbBody.substring(0, 40000),
      files: files,
      diff: diff,
      code: "",
      comments: "",
      url: url,
      isPR: true
    };
  }

  // --- 2. Documentation & Wiki Platforms (Confluence, Markdown docs) ---
  const isConfluence = hostname.includes("confluence") || Boolean(document.querySelector("#main-content, .wiki-content, #title-text"));
  if (isConfluence) {
    const docTitle = document.querySelector("#title-text, .page-title, h1")?.innerText?.trim() || title;
    const docContent = (document.querySelector("#main-content, .wiki-content, article") || document.body).innerText;
    return {
      platform: "confluence",
      type: "documentation",
      title: docTitle,
      body: docContent.substring(0, 100000),
      files: [],
      diff: "",
      code: "",
      comments: "",
      url: url,
      isPR: false
    };
  }

  // --- 3. Issue & Ticket Trackers (Jira, ServiceNow) ---
  const isJira = hostname.includes("jira") || hostname.includes("atlassian") || Boolean(document.querySelector("[data-testid='issue.views.issue-base.foundation.summary.heading']"));
  if (isJira) {
    const ticketTitle = document.querySelector("#summary-val, [data-testid='issue.views.issue-base.foundation.summary.heading'], h1")?.innerText?.trim() || title;
    const ticketDesc = document.querySelector("#description-val, [data-testid='issue.views.field.rich-text.description']")?.innerText?.trim() || "";
    const comments = Array.from(document.querySelectorAll(".issue-data-block .action-body, [data-testid='issue-comment-base.ui.comment.comment-body']"))
      .map((el) => el.innerText.trim())
      .join("\n---\n")
      .substring(0, 20000);

    return {
      platform: "jira",
      type: "ticket",
      title: ticketTitle,
      body: ticketDesc.substring(0, 40000),
      files: [],
      diff: "",
      code: "",
      comments: comments,
      url: url,
      isPR: false
    };
  }

  const isServiceNow = hostname.includes("service-now.com") || hostname.includes("servicenow");
  if (isServiceNow) {
    const snTitle = document.querySelector(".navbar_ui_actions .section-header, .form-header, h1")?.innerText?.trim() || title;
    return {
      platform: "servicenow",
      type: "ticket",
      title: snTitle,
      body: document.body.innerText.substring(0, 80000),
      files: [],
      diff: "",
      code: "",
      comments: "",
      url: url,
      isPR: false
    };
  }

  // --- 4. CI / Logs / Console Output ---
  const logContainer = document.querySelector(".console-output, .build-log, pre.log, .log-line, [class*='terminal'], [class*='console']");
  if (logContainer) {
    return {
      platform: "ci_logs",
      type: "logs",
      title: title,
      body: logContainer.innerText.substring(0, 100000),
      files: [],
      diff: "",
      code: "",
      comments: "",
      url: url,
      isPR: false
    };
  }

  // --- 5. Generic Code Page & Article Fallback ---
  const codeBlocks = Array.from(document.querySelectorAll("pre, code, .code, .hljs, .CodeMirror, .monaco-editor"))
    .map((el) => el.innerText)
    .filter(Boolean)
    .join("\n---\n")
    .substring(0, 60000);

  const tables = Array.from(document.querySelectorAll("table"))
    .map((t) => t.innerText)
    .join("\n---\n")
    .substring(0, 20000);

  const mainElement = document.querySelector("main, article, #content, .content") || document.body;

  return {
    platform: "webpage",
    type: codeBlocks.length > 200 ? "source_code" : "webpage",
    title: title,
    body: mainElement.innerText.substring(0, 80000),
    files: [],
    diff: "",
    code: codeBlocks,
    tables: tables,
    comments: "",
    url: url,
    isPR: false
  };
}
