# AskDell Dev Assistant — Chrome & Edge Extension v2.1 (Manifest V3)

> Enterprise AI developer assistant in your browser side panel, powered by **Claude Opus 4** (`claude-opus-4-6`) and **Gemini 3.8 Flash** via `ask.dell.com`.
> Single codebase compatible with both **Google Chrome** and **Microsoft Edge**.

---

## 🚀 Overview & Architecture

AskDell Dev Assistant is a **Manifest V3 Side Panel Extension** designed for developers analyzing code, pull requests, technical documentation, Jira tickets, and CI logs across enterprise tools.

### Authentication & API Bridge
AskDell uses session-cookie authentication without an exposed bearer token. To bypass cross-origin cookie restrictions (`SameSite=Lax`), this extension uses an **origin bridge content script**:

```
┌─────────────────────────────────────────────────────────────┐
│ EXTENSION ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐ chrome.scripting  ┌──────────────┐        │
│  │  Side Panel  │──── executeScript ─▶│  Active Tab  │      │
│  │ (UI + Chat)  │◀─── page content ──│ (PR/Code/Doc)│        │
│  │ Model: [▼]   │                    └──────────────┘        │
│  │ Claude Opus 4│                                           │
│  └──────┬───────┘                                           │
│         │                                                   │
│         │ chrome.tabs.connect("askdell-stream")              │
│         ▼                                                   │
│  ┌──────────────────────────────────────────┐               │
│  │ askdell-bridge.js                        │               │
│  │ (Content script on ask.dell.com)         │               │
│  │ • Runs in ask.dell.com origin            │               │
│  │ • Session cookies automatically attached │               │
│  │ • Discovers models via /api/models       │               │
│  │ • SSE token streaming via Port           │               │
│  │ • Tracks two-phase hybrid_web_search     │               │
│  │ • Auto-aborts if stream cancelled        │               │
│  └──────────────────┬───────────────────────┘               │
│                     │ fetch(..., credentials: "include")    │
│                     ▼                                       │
│  ┌──────────────────────────────────────────┐               │
│  │ ask.dell.com API (Open WebUI backend)    │               │
│  │ • POST /api/chat/completions (SSE stream)│               │
│  │ • POST /api/chat/completed               │               │
│  │ • GET /api/models & GET /api/v1/models   │               │
│  │ • GET /api/v1/chats?page=N               │               │
│  │ Discovered Models (10 Enterprise Models): │               │
│  │ 1. Claude Opus 4.6 (claude-opus-4-6, default)│             │
│  │ 2. Claude Sonnet 5 (claude-sonnet-5)         │             │
│  │ 3. Gemini 3.8 Flash (gemini-3.8-flash)       │             │
│  │ 4. Gemini 3.1 Pro Preview (gemini-3.1-pro)   │             │
│  │ 5. Llama-3.3 70B Instruct (llama-3.3-70b)    │             │
│  │ 6. Gemma-3 27B It (gemma-3-27b-it)           │             │
│  │ 7. GPT-OSS-120B (gpt-oss-120b)               │             │
│  │ 8. GPT-OSS-20B (gpt-oss-20b)                 │             │
│  │ 9. Pixtral-12B Vision (pixtral-12b-vision)   │             │
│  │ 10. AskDell Intent (askdell-intent)          │             │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌟 Discovered Enterprise Models (10 Models)

| Model Name | ID | Provider / Engine | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **🟣 Claude Opus 4.6** *(Default)* | `claude-opus-4-6` | Anthropic | 🧠 Deep reasoning, 👁️ vision, 200k tokens |
| **🟣 Claude Sonnet 5** | `claude-sonnet-5` | Anthropic | ⚡ Fast coding, 🧠 reasoning, 200k tokens |
| **🔵 Gemini 3.8 Flash** | `gemini-3.8-flash` | Google GCP | ⚡ Ultra-fast, 🌐 web search, 👁️ vision, 1M tokens |
| **🔵 Gemini 3.1 Pro Preview** | `gemini-3.1-pro-preview` | Google GCP | 🧠 Complex reasoning, 🌐 web search, 1M tokens |
| **🦙 Llama-3.3 70B Instruct** | `llama-3.3-70b-instruct` | Meta / Dell | 🦙 Open weights frontier, code generation |
| **💎 Gemma-3 27B It** | `gemma-3-27b-it` | Google / Dell | 💎 Efficient instruction-tuned model |
| **🟢 GPT-OSS-120B** | `gpt-oss-120b` | Open Weights | 🏛️ 120B large open model for deep tasks |
| **🟢 GPT-OSS-20B** | `gpt-oss-20b` | Open Weights | ⚡ 20B lightweight, ultra-low latency |
| **👁️ Pixtral-12B Vision** | `pixtral-12b-vision` | Mistral AI | 👁️ Multimodal visual document & diagram OCR |
| **⚡ AskDell Intent** | `askdell-intent` | Dell Enterprise | 🎯 Smart query routing & task classification |

---

## 🔬 HAR Verified Insights (v2.1)

1. **Exact Model ID**:
   - Claude Opus model identifier confirmed as **`claude-opus-4-6`** with `owned_by: "dell"` and `dell_endpoint: "anthropic"`.
   - Gemini identifier confirmed as **`gemini-3.8-flash`** with `owned_by: "dell"` and `dell_endpoint: "gcp"`.
2. **Collapsible Reasoning / Thinking Blocks**:
   - Claude Opus emits reasoning blocks via `<details type="thought" class="thought"><summary>Thought</summary>...</details>` or `<think>...</think>`.
   - The side panel renders these as interactive collapsible **"💭 Thinking Process"** cards both during streaming and upon completion.
3. **Two-Phase Web Search Status**:
   - AskDell executes hybrid search with explicit `done: false` and `done: true` status indicators:
     - `{"action": "hybrid_web_search", "description": "Performing web search", "done": false}`
     - `{"action": "web_search_complete", "description": "Web search completed in 2.4s", "done": true}`
   - The status bar reflects `🔍` during search and `✅` once completed.
4. **Dynamic Model Discovery**:
   - Auto-queries `GET /api/models` and `GET /api/v1/models` on `ask.dell.com` to dynamically populate all available models on your enterprise instance.
5. **Dual Authentication & 10-Minute Session Keep-Alive**:
   - **Layer 1 (REST APIs)**: Uses `askdell_session` session cookie with `max-age=600` (10 minutes!).
   - **Layer 2 (WebSocket)**: Uses short-lived rotating JWT tokens (`HS256`) for Socket.IO at `wss://ask.dell.com/ws/socket.io/`.
   - **Automated Keep-Alive**: The bridge script pings `/api/v1/chats?page=1` every 4 minutes to prevent the 10-minute cookie from expiring.
   - **1-Click Renewal**: If the session ever expires after idle periods, a "Refresh Tab" button in the extension banner lets you renew with one click.

---

## 📁 Project Structure

```
f:/AskDellBrowserExtension/
├── manifest.json         # Manifest V3 configuration (v2.1.0)
├── background.js         # Service Worker (multi-platform extraction, context menus)
├── askdell-bridge.js     # Bridge script on ask.dell.com (auth, model registry, SSE streaming)
├── sidepanel.html        # Side panel UI (model selector, 12 action chips, stream controls)
├── sidepanel.css         # Modern design system (Claude purple, Gemini blue, reasoning blocks)
├── sidepanel.js          # Controller: SSE port connection, reasoning block parser, model switcher
├── icons/
│   ├── icon16.png        # 16×16 toolbar icon
│   ├── icon48.png        # 48×48 extension manager icon
│   └── icon128.png       # 128×128 store/high-res icon
├── CHROMEWEBSTORE.md     # Chrome Web Store metadata
└── README.md             # This documentation
```

---

## 🛠️ 12 Developer Quick Actions

1. **🔍 Full PR Review**: Architecture, logic correctness, edge cases, line-level feedback.
2. **🛡️ Security Audit**: OWASP Top 10 vulnerabilities, injection, XSS, CSRF, auth flaws.
3. **⚡ Performance**: Big-O algorithmic complexity, memory allocations, N+1 queries.
4. **🧹 Clean Code**: SOLID violations, DRY principles, naming conventions, refactoring.
5. **📝 Summarize**: High-level technical executive summary of changes and risks.
6. **💡 Explain**: Step-by-step logic breakdown for onboarding team members.
7. **🐛 Debug Issues**: Null pointer risks, race conditions, edge case exceptions with fixes.
8. **🧪 Test Cases**: Unit test suites, mocks, and boundary tests following AAA pattern.
9. **📖 Generate Docs**: Markdown API documentation, parameters, return types, usage examples.
10. **♻️ Refactor**: Design patterns (Strategy, Factory, DI) and code simplification.
11. **🏗️ Architecture**: Modularity, coupling/cohesion, separation of concerns, scalability.
12. **🔗 API Review**: HTTP methods, request/response models, pagination, error schemas.

---

## 🚀 Setup & Installation

1. Open your browser extension manager:
   - Microsoft Edge: `edge://extensions/`
   - Google Chrome: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right or sidebar).
3. Click **Load unpacked** and select `f:\AskDellBrowserExtension` (or click **Reload (↻)** if already loaded).
4. Make sure you have **`https://ask.dell.com`** open in a tab and logged in.
5. Navigate to any page (GitHub PR, Jira ticket, Confluence doc, or source code file) and open the side panel!

---

## 👥 Distributing to Your Team (Without Sharing Code)

To share this extension with your team without exposing source code, choose one of these methods:

### Method 1: Production `.crx` Package (Quickest & Completely Self-Contained)

1. Run the build script in this folder:
   ```bash
   node build.js
   ```
   This generates a cleaned, comment-stripped `dist/` directory.
2. In Microsoft Edge or Chrome, go to `edge://extensions/` (or `chrome://extensions/`).
3. Click the **Pack extension** button:
   - **Extension root directory**: browse and select `f:\AskDellBrowserExtension\dist`
   - **Private key file**: leave empty on first pack (it will generate a `.pem` key for you).
4. Click **Pack Extension**. The browser creates:
   - `dist.crx` (the signed binary package)
   - `dist.pem` (your private key — keep this safe for future updates).
5. **Send only `dist.crx` to your teammates.**
6. Teammates simply drag and drop `dist.crx` onto their `edge://extensions` page to install. The browser installs it directly into their profile cache with zero accessible source files!

### Method 2: Microsoft Edge Add-ons (Corporate "Unlisted" — Best User Experience)

Because Dell's default browser is Microsoft Edge:
1. Go to the [Microsoft Partner Center (Edge Add-ons)](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview).
2. Upload `dist/AskDell-Dev-Assistant-v2.1.zip` (generated by `node build.js`).
3. In **Visibility**, select **"Unlisted"** (or restricted to your enterprise tenant).
4. Once approved, you get a direct install link (`https://microsoftedge.microsoft.com/addons/detail/...`).
5. **Teammates click "Get" to install in 1 click.**
   - No code is ever shared or exposed.
   - Updates are pushed silently and automatically to everyone.

See [EDGE_STORE_GUIDE.md](file:///f:/AskDellBrowserExtension/EDGE_STORE_GUIDE.md) for the full step-by-step submission walkthrough and certification notes.

