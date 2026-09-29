# Microsoft Edge Add-ons Store Guide — 1-Click Team Distribution

> **Goal**: Distribute AskDell Dev Assistant to anyone at Dell via a single direct link where teammates click **"Get"** (or **"Add to Edge"**) without seeing code, touching developer mode, or dealing with `.crx` files.

---

## 🌟 Why Microsoft Edge Add-ons (Unlisted)?

1. **True 1-Click Install**: You send a link like `https://microsoftedge.microsoft.com/addons/detail/<id>`. Teammates click **"Get"** and it installs instantly.
2. **Zero Code Exposure**: The extension binary is hosted on Microsoft's secure CDN. Teammates cannot view or edit your source code.
3. **Automatic Silent Updates**: When you push bug fixes or new models, Microsoft Edge automatically updates the extension in the background on everyone's computer.
4. **"Unlisted" (Hidden) Privacy**: The extension is **not** indexed by Bing/Google and does **not** appear in public Edge Add-ons search. Only people who have your direct link can install it.
5. **Completely Free**: Unlike Chrome Web Store ($5 fee), Microsoft Edge Add-ons developer registration is **100% free** for individuals and Microsoft/corporate accounts.

---

## 📋 Pre-Packaged Submission File

Your production package is ready and already built at:
```
F:\AskDellBrowserExtension\dist\AskDell-Dev-Assistant-v2.1.zip
```
*(To re-generate anytime after making updates, simply run `node build.js`).*

---

## 🚀 Step-by-Step Submission (5 Minutes)

### Step 1: Sign in to Microsoft Partner Center
1. Navigate to: **[Microsoft Partner Center — Edge Add-ons](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview)**.
2. Sign in with your Dell corporate Microsoft account (or personal Microsoft account).
3. If this is your first time, complete the 1-minute free developer registration.

### Step 2: Create a New Extension
1. Click the **"Create new extension"** button (top-right).
2. Drag and drop the zip file:
   ```
   F:\AskDellBrowserExtension\dist\AskDell-Dev-Assistant-v2.1.zip
   ```
3. Microsoft will validate your `manifest.json` and package structure (takes ~10 seconds).

---

### Step 3: Configure Visibility to "Hidden" (Unlisted)

Under **Availability & Pricing** / **Market distribution**:
* **Visibility**: Select **"Hidden"** (Unlisted).
* *Note: "Hidden" means only users with the direct store link can find and install the extension.*
* **Markets**: All markets (or United States / Corporate).

---

### Step 4: Fill in Store Listing Details

Copy and paste these pre-formatted fields:

#### Extension Name:
```
AskDell Dev Assistant
```

#### Short Description (Max 100 characters):
```
AI developer assistant via ask.dell.com — review PRs, debug code, and analyze diffs in side panel.
```

#### Detailed Description:
```
AskDell Dev Assistant brings the power of enterprise AI directly into your browser side panel.

Accelerate code reviews, PR audits, and technical documentation using your authenticated ask.dell.com session.

KEY CAPABILITIES:
• Direct Pull Request Detection: Automatically detects and extracts PR diffs, file trees, and descriptions from GitHub Enterprise (eos2git), GitLab, Azure DevOps, and Bitbucket.
• Enterprise AI Models: Seamlessly switch between Claude Opus 4.6, Claude Sonnet 5, Gemini 3.8 Flash, Gemini 3.1 Pro, Llama-3.3 70B, Gemma-3, and GPT-OSS.
• 12 Developer Quick Actions: 1-click triggers for Full PR Review, Security Vulnerability Audit, Performance & Complexity (Big-O), Clean Code & SOLID Refactoring, Test Case Generation, and API Review.
• Real-Time Streaming: Instant token-by-token feedback with collapsible thinking process blocks for reasoning models.
• Enterprise Security: Operates entirely inside your authenticated ask.dell.com session. No external third-party servers, telemetry, or data collection.

HOW TO USE:
1. Open and sign in to ask.dell.com in any browser tab.
2. Navigate to your pull request on GitHub Enterprise or your code repository.
3. Open the browser Side Panel and click any review action!
```

#### Category:
```
Developer Tools
```

#### Store Logo:
* Upload `icons/icon128.png` (or 300x300 logo).

---

### Step 5: Notes for Certification (Guarantees Approval)

Microsoft reviewers check why broad host permissions (`https://*/*`) are requested. Paste this exact text into the **"Notes for certification"** box to ensure approval:

```
CERTIFICATION NOTES FOR REVIEW TEAM:

1. PURPOSE OF PERMISSIONS:
- "host_permissions": ["https://ask.dell.com/*", "https://*/*", "http://*/*"]:
  This extension is an enterprise developer assistant. It extracts code diffs and repository context from developer pages (such as internal GitHub Enterprise instances like eos2git.cec.lab.emc.com, GitLab, Azure DevOps, Bitbucket, and documentation wikis) when the user opens the side panel and requests a code review.
  The host permissions are required solely for the content script/scripting API to read active tab DOM elements (e.g. .diff-table, PR titles) when explicitly invoked by the user.

2. AUTHENTICATION & DATA HANDLING:
- The extension does NOT collect, store, or sell any user data.
- All AI queries and code diffs are transmitted exclusively to the user's authenticated ask.dell.com enterprise instance via session cookies.
- No third-party servers, external analytics, or remote tracking libraries are used.

3. TESTING INSTRUCTIONS:
- Open ask.dell.com in one tab and log in.
- Open any code or pull request page (e.g. github.com or internal git).
- Open the Side Panel via toolbar icon.
- Click "Full PR Review" or ask a question. Responses stream live into the panel.
```

---

### Step 6: Submit for Review
1. Click **Submit**.
2. Microsoft's automated review system typically reviews and certifies unlisted extensions within **1 to 2 business days**.

---

## 🎯 How Your Team Installs It (The 1-Click Experience)

Once certified, Microsoft will provide you with your permanent direct URL:
```
https://microsoftedge.microsoft.com/addons/detail/askdell-dev-assistant/<extension-id>
```

### What You Send to Your Team:
> *"Hey team! We have our internal AskDell Dev Assistant live on Edge Add-ons.  
> Click here to install in 1 click: **`https://microsoftedge.microsoft.com/addons/detail/<extension-id>`**  
> Click **Get** / **Add to Edge**, keep `ask.dell.com` logged in, and enjoy 1-click PR reviews in your side panel!"*

### How Future Updates Work:
* Whenever you add features, change prompts, or Dell adds new models:
  1. Make your code changes in this folder.
  2. Run `node build.js`.
  3. Upload the new `AskDell-Dev-Assistant-v2.1.zip` to Microsoft Partner Center.
  4. Once approved, **Edge automatically and silently updates the extension on all your teammates' machines**. No action required from them!
