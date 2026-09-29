# Chrome Web Store Listing — AskDell PR Reviewer

> Last Updated: 2026-09-28

## Store Listing

**Extension Name** [REQUIRED]
AskDell PR Reviewer

**Short Description** [REQUIRED]
AI-powered PR and code reviews directly inside your browser side panel using Gemini 3.8 Flash via AskDell.

**Detailed Description** [REQUIRED]
Accelerate your code review workflow with AskDell PR Reviewer.

AskDell PR Reviewer brings the enterprise power of Gemini 3.8 Flash hosted on Dell GCP directly into your browser's side panel. Effortlessly review pull requests, inspect unified diffs, run automated security audits, and generate test plans without toggling between tabs or copying code back and forth.

KEY FEATURES
- Direct Pull Request Detection: Seamlessly extracts diffs, file lists, and PR descriptions from GitHub, GitLab, Azure DevOps, and Bitbucket.
- Enterprise AskDell Integration: Connects directly with your existing ask.dell.com session using secure same-origin session authentication.
- Real-Time Streaming AI Responses: Streams instant feedback token-by-token with live status indicators.
- One-Click Review Actions: Instant buttons for Full PR Review, Security Vulnerability Audit, Performance & Complexity Analysis, Clean Code Refactoring, and Test Plan Generation.
- Rich Markdown & Diff Rendering: Native formatting with syntax highlighting, green/red diff styling, and one-click code copy buttons.
- Conversation History: Access and resume your previous discussions directly from your AskDell account.
- Dark & Light Themes: Polished Dell Technologies design system tailored for modern developer workflows.

HOW TO USE IT
1. Open and sign in to ask.dell.com in any browser tab.
2. Navigate to your pull request or code repository on GitHub, GitLab, Azure DevOps, or Bitbucket.
3. Click the extension icon in your toolbar to open the Side Panel.
4. Click any quick action button (e.g., "Full PR Review" or "Security Audit") or type your custom prompt.

PRIVACY & SECURITY
Your code stays secure within your enterprise environment. Code snippets and PR diffs are sent exclusively to your authenticated ask.dell.com endpoint. No third-party servers or external telemetry are used.

**Category** [REQUIRED]
Developer Tools

**Single Purpose** [REQUIRED]
Extracts code diffs from active web pages and provides AI-powered code reviews through the user's authenticated AskDell session.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon128.png` |
| Small Icon | 48×48 PNG | ✅ Ready | `icons/icon48.png` |
| Toolbar Icon | 16×16 PNG | ✅ Ready | `icons/icon16.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | permissions | Displays the AI chat and review interface in Chrome's side panel side-by-side with code pages. |
| `storage` | permissions | Persists user theme preference and pending review actions from context menus across sessions. |
| `tabs` | permissions | Reads the active tab's title and URL to provide context-aware PR reviews and locate the user's AskDell tab. |
| `scripting` | permissions | Injects the content extraction script into the active PR/code tab to read diffs when requested by the user. |
| `contextMenus` | permissions | Adds right-click options ("AskDell: Review Selection", "AskDell: Review PR / Diff") to trigger instant reviews. |
| `https://ask.dell.com/*` | host_permissions | Allows the bridge content script to communicate with AskDell's API and execute authenticated fetch calls. |
| `https://*/*`, `http://*/*` | host_permissions | Enables reading pull request diffs and repository code on arbitrary Git hosting sites (GitHub, GitLab, ADO, internal Git servers) from the side panel. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Authentication info | No | No | Session cookies remain within the browser's ask.dell.com origin | No |
| Web history | No | No | Only active tab URL/title is read during review request | No |
| Website content | Yes | Yes (Only to user's ask.dell.com) | PR diffs and selected code are transmitted to AskDell for AI review | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-28 | Initial release with side panel, bridge communication, PR extraction, and streaming SSE | Draft |
