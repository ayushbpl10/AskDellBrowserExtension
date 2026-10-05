# Chrome Web Store Developer Console Guide — AskDell Dev Assistant v2.2.2

> **Status**: Ready for Resubmission  
> **Item ID**: `emfpgabhdjmfbmfcdnkflcgkcchejfik`  
> **Package Version**: `2.2.2` (Manifest V3)  
> **Package File**: `dist/AskDell-Dev-Assistant-v2.2.2.zip`  
> **Last Updated**: 2026-10-05

---

## 1. Store Listing Tab (`/edit/listing`)

### Product Details

* **Title from package** *(Auto-filled)*:  
  `AskDell Dev Assistant`

* **Summary from package** *(Auto-filled)*:  
  `Enterprise AI developer assistant via ask.dell.com — review pull requests, diffs, security, and architecture in your side panel`

* **Description** *(Copy and paste the exact block below)*:
```text
Accelerate your developer workflow with AskDell Dev Assistant.

AskDell Dev Assistant brings the power of enterprise frontier AI directly into your browser side panel via ask.dell.com. Effortlessly review pull requests, inspect unified diffs, run automated security audits, generate comprehensive unit test suites, and analyze architecture without leaving your repository tabs or copying code back and forth.

KEY FEATURES
• Multi-Platform Code Review Detection: Automatically detects and extracts pull request diffs, changed file trees, and commit details across enterprise git repositories and code review systems.
• Enterprise AI Model Switching: Seamlessly select between frontier reasoning models, high-speed execution engines, and multimodal architectures configured for your enterprise environment.
• Collapsible Reasoning & Thinking Blocks: View step-by-step reasoning processes and architectural deliberation for models supporting thought chains.
• Two-Phase Hybrid Web Search: Live verification of modern library versions, framework updates, and API documentation with real-time status indicators.
• 12 One-Click Developer Actions:
  - 🔍 Full PR Review: Architecture, logic correctness, edge cases, and line-level feedback.
  - 🛡️ Security Audit: Common vulnerabilities, injection flaws, cross-site scripting risks, and authorization checks.
  - ⚡ Performance: Algorithmic complexity, memory allocations, and query bottlenecks.
  - 🧹 Clean Code: Modularity, maintainability, naming conventions, and refactoring tips.
  - 📝 Summarize: High-level technical executive summary of changes and risks.
  - 💡 Explain: Step-by-step logic breakdown for onboarding team members.
  - 🐛 Debug Issues: Potential null pointers, race conditions, and unhandled exception analysis.
  - 🧪 Test Cases: Unit test suites, mocks, and boundary tests following standard patterns.
  - 📖 Generate Docs: Markdown API documentation, parameters, return types, and usage examples.
  - ♻️ Refactor: Design patterns and code simplification suggestions.
  - 🏗️ Architecture: Modularity, separation of concerns, and scalability best practices.
  - 🔗 API Review: HTTP methods, request/response models, pagination, and error schemas.
• Native Markdown & Diff Viewer: Colorized syntax highlighting, visual diff styling, and one-click code copy buttons.
• Team Collaboration & Session Sharing: Generate shareable encrypted conversation snapshots to collaborate with team members across reviews.
• Conversation History: Search, browse, and resume previous AskDell discussions directly from the side panel.
• Enterprise Security: Connects directly with your existing authenticated ask.dell.com session using secure same-origin cookies. Zero third-party servers, zero telemetry.

HOW TO USE IT
1. Sign in to ask.dell.com in any browser tab.
2. Navigate to any pull request, code diff, or repository page in your browser.
3. Click the extension icon in your toolbar to open the Side Panel.
4. Click any quick action button (e.g. "Full PR Review" or "Security Audit") or ask a custom question.

ENTERPRISE PRIVACY & SECURITY
Your code stays secure within your enterprise environment. Code snippets and PR diffs are sent exclusively to your authenticated ask.dell.com endpoint. No third-party servers, external telemetry, or data mining are involved.
```

* **Category** [REQUIRED]:  
  `Developer Tools`

* **Language** [REQUIRED]:  
  `English`

---

### Graphic Assets

All required assets have been rendered to exact Google Chrome Web Store pixel dimensions in **24-bit JPEG format (zero alpha channel)** to guarantee acceptance without rejection:

| Field | Required Size | File Path in Workspace | Status |
| :--- | :--- | :--- | :--- |
| **Store icon** | 128 × 128 px | `f:\AskDellBrowserExtension\store_assets\store-icon-128x128.png` | ✅ Generated |
| **Screenshot 1** *(Required)* | 1,280 × 800 px | `f:\AskDellBrowserExtension\store_assets\screenshot-1-pr-review.jpg` | ✅ Generated |
| **Screenshot 2** *(Recommended)* | 1,280 × 800 px | `f:\AskDellBrowserExtension\store_assets\screenshot-2-enterprise-models.jpg` | ✅ Generated |
| **Screenshot 3** *(Recommended)* | 1,280 × 800 px | `f:\AskDellBrowserExtension\store_assets\screenshot-3-security-audit.jpg` | ✅ Generated |
| **Screenshot 4** *(Recommended)* | 1,280 × 800 px | `f:\AskDellBrowserExtension\store_assets\screenshot-4-quick-actions-tests.jpg` | ✅ Generated |
| **Small promo tile** *(Recommended)* | 440 × 280 px | `f:\AskDellBrowserExtension\store_assets\promo-small-440x280.jpg` | ✅ Generated |
| **Marquee promo tile** *(Recommended)* | 1,400 × 560 px | `f:\AskDellBrowserExtension\store_assets\promo-marquee-1400x560.jpg` | ✅ Generated |

---

### Additional Fields

* **Official URL**:  
  *Leave blank / None* (unless your domain is registered in Google Search Console).

* **Homepage URL**:  
  `https://ask.dell.com` (or your team's internal repository link)

* **Support URL**:  
  `https://ask.dell.com` (or internal Dell developer support link)

* **Mature Content**:  
  Select **No** (Enterprise developer tool; no mature, violent, or sensitive content).

* **Item Support**:  
  Select **On** (Allows users to leave comments and feedback).

---

## 2. Privacy Tab (`/edit/privacy`)

### Single Purpose Statement [REQUIRED]
```text
AI-powered developer assistant that analyzes code diffs, pull requests, and technical pages via the user's authenticated AskDell session.
```

### Permission Justifications [REQUIRED]

Google reviewers require a specific, plain-English justification for every declared permission:

| Permission | Type | Exact Text to Paste into Developer Console |
| :--- | :--- | :--- |
| `sidePanel` | permission | Displays the interactive AI assistant interface side-by-side with code repositories and pull requests without leaving the page. |
| `storage` | permission | Persists user preferences locally (selected AI model, dark/light theme, and max content length settings) across browser sessions. |
| `tabs` | permission | Identifies active tab URL and title to detect pull requests and locate the user's authenticated ask.dell.com tab. |
| `scripting` | permission | Extracts code diffs, file trees, and pull request descriptions from active developer web pages when requested by the user. |
| `contextMenus` | permission | Adds right-click options ('AskDell: Review Selection', 'AskDell: Review PR / Diff') to send code directly to the assistant. |
| `https://ask.dell.com/*` | host_permission | Connects to ask.dell.com to communicate with the enterprise AI backend using the user's active session cookies. |
| `https://*/*`, `http://*/*` | host_permission | Extracts pull request diffs and repository code on web-based code review platforms upon explicit user action. |

---

### Data Usage Declarations

* **Does your extension collect user data?**  
  Select **Yes**

* **Types of Data Collected**:
  - Check **Website content**:
    - Purpose: *Functionality*
    - Description: *Pull request diffs and selected code snippets are extracted and transmitted solely to the user's authenticated ask.dell.com enterprise instance for AI analysis upon user request.*

* **Certification Checkboxes**:
  - [x] **I certify that data is not sold to third parties**
  - [x] **I certify that data is not used for purposes unrelated to the item's core functionality**
  - [x] **I certify that data is not used for creditworthiness or lending purposes**

* **Privacy Policy URL**:  
  Provide a public or internal URL containing the privacy disclosure (e.g., GitHub raw README or Gist).

---

## 3. Test Instructions Tab (`/testcredentials`)

Google and Microsoft store reviewers test your extension. Because `ask.dell.com` is Dell's internal corporate portal requiring Dell VPN/SSO, version 2.2.1 includes a full-fidelity **Reviewer Demo Mode** to allow testing of all features:

```text
NOTE FOR REVIEW TEAM:
AskDell Dev Assistant is an enterprise developer assistant designed for engineers using Dell's internal AI portal (ask.dell.com).
Because ask.dell.com is hosted on Dell Technologies' corporate intranet (accessible via Dell corporate VPN), version 2.2.1 includes a dedicated "Reviewer Demo Mode" so the store review team can thoroughly test all primary functions:

1. Open any public GitHub pull request or code page (e.g., https://github.com/microsoft/vscode or any active tab).
2. Click the extension icon in the toolbar to open the Side Panel.
3. In the top connection banner, click "🧪 Try Demo Mode" (or select Reviewer Demo Mode in the Settings drawer ⚙️).
4. Notice the connection dot turns cyan ("Reviewer Demo Mode Active").
5. Click any of the 12 quick action chips (e.g. "Full PR Review", "Security Audit", "Test Cases", "Performance") to test token streaming, markdown formatting, syntax highlighting, and collapsible reasoning blocks (<details>).
6. Test interactive chat by typing any question in the prompt box and clicking Send.
7. Switch models in the top dropdown (Claude Opus 4.6, Claude Sonnet 5, Gemini 3.8 Flash, Llama-3.3 70B) to verify model badges and capabilities.
8. Open the History drawer (clock icon in header) to test sample conversation loading and search.
```

---

## 4. Distribution Tab (`/edit/distribution`)

* **Visibility**:  
  - If sharing only with team members: Select **Unlisted** (Only users with the direct link can install).  
  - If distributing publicly: Select **Public**.
* **Pricing**: **Free**
