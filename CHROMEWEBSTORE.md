# Chrome Web Store Developer Console Guide — AskDell Dev Assistant v2.1

> **Status**: ⏳ Pending Review (Submitted 2026-09-30)  
> **Item ID**: `emfpgabhdjmfbmfcdnkflcgkcchejfik`  
> **Package Version**: `2.1.0` (Manifest V3)  
> **Last Updated**: 2026-09-30

---

## 1. Store Listing Tab (`/edit/listing`)

### Product Details

* **Title from package** *(Auto-filled)*:  
  `AskDell Dev Assistant`

* **Summary from package** *(Auto-filled)*:  
  `AI-powered developer assistant via ask.dell.com — analyze code, PRs, docs, and tickets with Claude Opus 4 and Gemini`

* **Description** *(Copy and paste the exact block below)*:
```text
Accelerate your developer workflow with AskDell Dev Assistant.

AskDell Dev Assistant brings the power of enterprise frontier AI directly into your browser side panel via ask.dell.com. Effortlessly review pull requests, inspect unified diffs, run automated OWASP security audits, generate comprehensive unit test suites, and analyze architecture without leaving your repository tabs or copying code back and forth.

KEY FEATURES
• Multi-Platform Pull Request Detection: Automatically detects and extracts PR diffs, file trees, and descriptions across GitHub Enterprise (eos2git), GitLab, Azure DevOps, Bitbucket, and Jira.
• 10 Enterprise AI Models: Seamlessly switch between Claude Opus 4.6, Claude Sonnet 5, Gemini 3.8 Flash, Gemini 3.1 Pro, Llama-3.3 70B Instruct, Gemma-3 27B, GPT-OSS-120B, GPT-OSS-20B, and Pixtral-12B Vision.
• Collapsible Reasoning & Thinking Blocks: View step-by-step reasoning processes and architectural deliberation for models with thought chains (Claude Opus 4.6).
• Two-Phase Hybrid Web Search: Live verification of modern library versions, framework updates, and API documentation with real-time status indicators.
• 12 One-Click Developer Actions:
  - 🔍 Full PR Review: Architecture, logic correctness, edge cases, and line-level feedback.
  - 🛡️ Security Audit: OWASP Top 10 vulnerabilities, injection, XSS, CSRF, and authorization flaws.
  - ⚡ Performance: Big-O algorithmic complexity, memory allocations, and N+1 query analysis.
  - 🧹 Clean Code: SOLID violations, DRY principles, naming conventions, and refactoring tips.
  - 📝 Summarize: High-level technical executive summary of changes and risks.
  - 💡 Explain: Step-by-step logic breakdown for onboarding team members.
  - 🐛 Debug Issues: Null pointer risks, race conditions, and unhandled exception analysis.
  - 🧪 Test Cases: Unit test suites, mocks, and boundary tests following AAA pattern.
  - 📖 Generate Docs: Markdown API documentation, parameters, return types, and usage examples.
  - ♻️ Refactor: Design patterns (Strategy, Factory, DI) and code simplification.
  - 🏗️ Architecture: Modularity, coupling/cohesion, separation of concerns, and scalability.
  - 🔗 API Review: HTTP methods, request/response models, pagination, and error schemas.
• Native Markdown & Diff Viewer: Colorized syntax highlighting, green/red diff styling, and one-click code copy buttons.
• Conversation History: Search, browse, and resume previous AskDell discussions directly from the side panel.
• Enterprise Security: Connects directly with your existing authenticated ask.dell.com session using secure same-origin cookies. Zero third-party servers, zero telemetry.

HOW TO USE IT
1. Sign in to ask.dell.com in any browser tab.
2. Navigate to your pull request or code repository on GitHub, GitLab, Azure DevOps, or Bitbucket.
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
| `https://*/*`, `http://*/*` | host_permission | Extracts pull request diffs and repository code on internal and external Git hosting platforms (GitHub, GitLab, Azure DevOps, Bitbucket). |

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

Google Chrome Web Store reviewers test your extension. Because `ask.dell.com` requires Dell authentication, provide this clear note in the **Test instructions** box:

```text
NOTE FOR REVIEW TEAM:
AskDell Dev Assistant is an enterprise developer extension designed for engineers using Dell's internal AI portal (ask.dell.com).

To test the extension:
1. Open any public GitHub pull request (e.g., https://github.com/facebook/react/pull/28000/files).
2. Click the extension icon in the toolbar to open the Side Panel.
3. The side panel UI initializes and detects the repository and pull request diffs.
4. When authenticated to ask.dell.com in an adjacent tab, clicking any of the 12 quick action chips (e.g. "Full PR Review" or "Security Audit") streams AI analysis into the side panel. If not logged in, the UI displays a clear "AskDell tab not detected or session expired" warning banner with a 1-click "Open AskDell" button.
```

---

## 4. Distribution Tab (`/edit/distribution`)

* **Visibility**:  
  - If sharing only with team members: Select **Unlisted** (Only users with the direct link can install).  
  - If distributing publicly: Select **Public**.
* **Pricing**: **Free**
