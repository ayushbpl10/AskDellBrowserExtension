# Privacy Policy for AskDell Dev Assistant

**Last updated:** September 30, 2026

## 1. Overview
AskDell Dev Assistant ("the Extension") is a developer productivity browser extension designed to provide code reviews, pull request audits, unit test generation, and architecture analysis directly inside the browser side panel. The extension connects to the user's authenticated session on `ask.dell.com`.

## 2. Information We Collect and Process
The Extension operates with an enterprise security and privacy-first model:

- **Website Content (Code Diffs & Text Selection)**: When the user explicitly interacts with the extension (such as clicking "Full PR Review", "Security Audit", or submitting a prompt), the extension extracts the visible pull request diff, file list, or selected code snippet from the active tab. This data is transmitted exclusively to the user's authenticated `ask.dell.com` instance for AI processing.
- **Active Tab URL and Title**: The extension reads the active tab's URL and title solely to detect pull request context (e.g. GitHub, GitLab, Azure DevOps) and locate an open `ask.dell.com` tab.
- **Local Settings**: User preferences such as theme selection (dark/light) and selected AI model are stored locally on the user's device using `chrome.storage.local`.

## 3. Data We Do NOT Collect
- We do **not** collect, store, or log personal identification information (names, emails, phone numbers).
- We do **not** collect or transmit browsing history outside of the active tab inspected during an explicit review action.
- We do **not** collect credentials, passwords, or authentication cookies. Authentication relies solely on same-origin session cookies managed natively by the browser for `ask.dell.com`.
- We do **not** use third-party analytics, tracking pixels, or telemetry services.

## 4. How We Use and Share Data
- **No Third-Party Transmission**: Data is never sent to third-party advertising, analytics, or broker services.
- **No Sale of Data**: User data and code snippets are never sold, rented, or monetized.
- **Enterprise Isolation**: All queries and context sent to `ask.dell.com` remain within Dell's enterprise-governed AI infrastructure.

## 5. User Control and Permissions
The extension requests only permissions necessary for its stated developer features:
- `sidePanel`: To display the AI chat assistant side-by-side with code pages.
- `storage`: To remember user UI settings locally.
- `tabs`: To identify pull request metadata on active tabs.
- `scripting`: To read code diffs upon user request.
- `contextMenus`: To allow right-click review actions on selected code.

Users can disable or remove the extension at any time via `chrome://extensions`.

## 6. Contact
For questions regarding this policy, contact the internal AskDell developer team or open an issue in the internal repository.
