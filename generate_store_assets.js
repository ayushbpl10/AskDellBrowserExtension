const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.join(__dirname, 'store_assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Copy icon128.png to store_assets for easy access
fs.copyFileSync(
  path.join(__dirname, 'icons', 'icon128.png'),
  path.join(outDir, 'store-icon-128x128.png')
);

const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #0b0f17;
    color: #f1f5f9;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .browser-frame {
    width: 1280px;
    height: 800px;
    display: flex;
    flex-direction: column;
    background: #0d1117;
  }
  .browser-header {
    height: 42px;
    background: #161b22;
    border-bottom: 1px solid #30363d;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
  }
  .window-dots {
    display: flex;
    gap: 8px;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .dot.red { background: #ff5f56; }
  .dot.yellow { background: #ffbd2e; }
  .dot.green { background: #27c93f; }
  .address-bar {
    flex: 1;
    max-width: 650px;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    color: #8b949e;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .address-bar svg { color: #58a6ff; }
  .browser-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }
  .ext-pill {
    background: rgba(0, 118, 206, 0.2);
    border: 1px solid #0076CE;
    color: #38bdf8;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .browser-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  .main-content {
    flex: 1;
    background: #0d1117;
    border-right: 1px solid #30363d;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: #c9d1d9;
  }
  .side-panel {
    width: 440px;
    background: #111827;
    border-left: 1px solid #1f2937;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
  }
  .panel-header {
    height: 48px;
    border-bottom: 1px solid #1f2937;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: #0f172a;
  }
  .brand-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #f8fafc;
  }
  .status-badge {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .model-bar {
    padding: 10px 14px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .model-pill-select {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #c084fc;
    background: rgba(124, 58, 237, 0.2);
    border: 1px solid #7c3aed;
    padding: 5px 10px;
    border-radius: 6px;
  }
  .model-caps {
    font-size: 11px;
    color: #94a3b8;
  }
  .action-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
  }
  .chip {
    font-size: 10.5px;
    padding: 4px 8px;
    border-radius: 5px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #cbd5e1;
    font-weight: 500;
  }
  .chip.active {
    background: #0076CE;
    border-color: #38bdf8;
    color: #ffffff;
    font-weight: 600;
  }
  .chat-scroll {
    flex: 1;
    padding: 14px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .thought-box {
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11.5px;
    color: #e9d5ff;
  }
  .thought-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #c084fc;
    margin-bottom: 4px;
  }
  .ai-response {
    background: #182234;
    border: 1px solid #23354d;
    border-radius: 8px;
    padding: 14px;
    font-size: 12px;
    line-height: 1.55;
    color: #f1f5f9;
  }
  .finding-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 6px;
  }
  .badge-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
  .badge-crit { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
  .badge-ok { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
  .code-diff {
    background: #0a0d14;
    border: 1px solid #243042;
    border-radius: 6px;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 11px;
    margin: 8px 0;
    overflow: hidden;
  }
  .diff-line {
    padding: 2px 8px;
    display: flex;
  }
  .diff-line.del { background: rgba(239, 68, 68, 0.15); color: #f87171; }
  .diff-line.add { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
  .diff-line.ctx { color: #8b949e; }
`;

// 1. Screenshot 1: Full PR Review in GitHub with Claude Opus 4.6
const html1 = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${sharedStyles}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-header">
      <div class="window-dots">
        <div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div>
      </div>
      <div class="address-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>https://github.dellemc.com/enterprise-core/payments-service/pull/1428/files</span>
      </div>
      <div class="browser-actions">
        <div class="ext-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          AskDell Dev Assistant Active
        </div>
      </div>
    </div>
    <div class="browser-body">
      <!-- Main Webpage Area: GitHub PR -->
      <div class="main-content">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #30363d; padding-bottom:14px;">
          <div>
            <div style="font-size:18px; font-weight:600; color:#f0f6fc; margin-bottom:4px;">
              feat(checkout): Add async idempotent token processing pipeline #1428
            </div>
            <div style="font-size:12px; color:#8b949e;">
              <span style="background:#238636; color:#fff; padding:2px 8px; border-radius:12px; font-weight:600; font-size:11px;">Open</span>
              <strong style="color:#c9d1d9;">ayush-dell</strong> wants to merge 14 commits into <code style="color:#58a6ff;">main</code> from <code style="color:#58a6ff;">feat/async-pipeline</code>
            </div>
          </div>
        </div>

        <div style="background:#161b22; border:1px solid #30363d; border-radius:6px; overflow:hidden;">
          <div style="background:#21262d; padding:8px 14px; font-size:12px; font-family:monospace; color:#8b949e; display:flex; justify-content:space-between;">
            <span>src/services/payment-processor.ts</span>
            <span style="color:#3fb950;">+48 -12 lines</span>
          </div>
          <div style="padding:12px; font-family:monospace; font-size:11px; line-height:1.5;">
            <div style="color:#8b949e;">@@ -124,12 +124,19 @@ export async function processTransaction(ctx: Context) {</div>
            <div style="background:rgba(248,81,73,0.15); color:#f85149;">-  const token = await redis.get(ctx.idempotencyKey);</div>
            <div style="background:rgba(248,81,73,0.15); color:#f85149;">-  if (token) return JSON.parse(token);</div>
            <div style="background:rgba(46,160,67,0.15); color:#3fb950;">+  const lockAcquired = await redis.set(ctx.lockKey, 'LOCKED', 'NX', 'EX', 15);</div>
            <div style="background:rgba(46,160,67,0.15); color:#3fb950;">+  if (!lockAcquired) throw new ConcurrencyConflictError(ctx.idempotencyKey);</div>
            <div style="background:rgba(46,160,67,0.15); color:#3fb950;">+  const cached = await redis.get(ctx.idempotencyKey);</div>
            <div style="color:#8b949e;">   const result = await gateway.executeCharge(ctx.payload);</div>
            <div style="background:rgba(46,160,67,0.15); color:#3fb950;">+  await redis.setex(ctx.idempotencyKey, 86400, JSON.stringify(result));</div>
            <div style="color:#8b949e;">   return result;</div>
          </div>
        </div>
      </div>

      <!-- Extension Side Panel -->
      <div class="side-panel">
        <div class="panel-header">
          <div class="brand-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0076CE" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            AskDell Dev Assistant
            <span class="status-badge">Connected</span>
          </div>
          <span style="font-size:10px; color:#64748b; font-weight:600;">v2.1</span>
        </div>

        <div class="model-bar">
          <div class="model-pill-select">
            <span>🟣 Claude Opus 4.6</span>
          </div>
          <span class="model-caps">🧠 deep reasoning · 200k</span>
        </div>

        <div class="action-chips">
          <div class="chip active">🔍 Full PR Review</div>
          <div class="chip">🛡️ Security</div>
          <div class="chip">⚡ Performance</div>
          <div class="chip">🧹 Clean Code</div>
          <div class="chip">🧪 Test Cases</div>
        </div>

        <div class="chat-scroll">
          <div class="thought-box">
            <div class="thought-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Thinking Process (Claude Opus 4.6)
            </div>
            <div>Analyzing distributed lock lifecycle in <code>payment-processor.ts</code>. The lock acquired via <code>redis.set(..., 'NX')</code> is never released in a <code>finally</code> block if <code>gateway.executeCharge()</code> throws an unhandled exception. This could cause a 15-second denial of service for retry attempts.</div>
          </div>

          <div class="ai-response">
            <div style="font-weight:700; color:#38bdf8; margin-bottom:8px; font-size:13px;">
              📋 Pull Request Review: PR #1428
            </div>

            <div style="margin-bottom:8px;">
              <span class="finding-badge badge-warn">Risk</span>
              <strong>Lock Starvation on Upstream Failure</strong>: If <code>executeCharge()</code> fails, <code>ctx.lockKey</code> stays locked for 15s. Wrap in <code>try/finally</code> to ensure <code>redis.del(ctx.lockKey)</code>.
            </div>

            <div style="margin-bottom:8px;">
              <span class="finding-badge badge-ok">Verified</span>
              <strong>Idempotency Strategy</strong>: 86400s (24h) TTL conforms to enterprise transaction specifications.
            </div>

            <div class="code-diff">
              <div class="diff-line del">- const result = await gateway.executeCharge(ctx.payload);</div>
              <div class="diff-line add">+ try {</div>
              <div class="diff-line add">+   return await gateway.executeCharge(ctx.payload);</div>
              <div class="diff-line add">+ } finally {</div>
              <div class="diff-line add">+   await redis.del(ctx.lockKey);</div>
              <div class="diff-line add">+ }</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// 2. Screenshot 2: 10 Enterprise Models & Collapsible Reasoning
const html2 = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${sharedStyles}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-header">
      <div class="window-dots">
        <div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div>
      </div>
      <div class="address-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>https://gitlab.dellemc.com/cloud-platform/k8s-operator/-/merge_requests/582</span>
      </div>
      <div class="browser-actions">
        <div class="ext-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          AskDell Dev Assistant
        </div>
      </div>
    </div>
    <div class="browser-body">
      <div class="main-content" style="background:#090d16;">
        <div style="font-size:20px; font-weight:700; color:#38bdf8; margin-bottom:8px;">Enterprise Multi-Model Intelligence</div>
        <p style="color:#94a3b8; font-size:13px; line-height:1.6;">Switch seamlessly between 10 frontier models hosted securely on Dell Enterprise Infrastructure. Full privacy, zero data retention, and instant token streaming directly via ask.dell.com.</p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:16px;">
          <div style="background:#131c2e; border:1px solid #1e2e48; padding:14px; border-radius:8px;">
            <div style="color:#c084fc; font-weight:700; font-size:13px; margin-bottom:4px;">🟣 Claude Opus 4.6 & Sonnet 5</div>
            <div style="font-size:12px; color:#94a3b8;">Deep code reasoning, complex refactoring, full AST analysis, and detailed thinking process display.</div>
          </div>
          <div style="background:#131c2e; border:1px solid #1e2e48; padding:14px; border-radius:8px;">
            <div style="color:#38bdf8; font-weight:700; font-size:13px; margin-bottom:4px;">🔵 Gemini 3.8 Flash & 3.1 Pro</div>
            <div style="font-size:12px; color:#94a3b8;">Sub-second latency, 1M+ token context windows, live hybrid web search integration for latest API docs.</div>
          </div>
          <div style="background:#131c2e; border:1px solid #1e2e48; padding:14px; border-radius:8px;">
            <div style="color:#fbbf24; font-weight:700; font-size:13px; margin-bottom:4px;">🦙 Llama-3.3 70B & Gemma-3 27B</div>
            <div style="font-size:12px; color:#94a3b8;">Frontier open-weights models tuned for developer productivity, clean code standards, and shell scripting.</div>
          </div>
          <div style="background:#131c2e; border:1px solid #1e2e48; padding:14px; border-radius:8px;">
            <div style="color:#34d399; font-weight:700; font-size:13px; margin-bottom:4px;">👁️ Pixtral-12B & GPT-OSS-120B</div>
            <div style="font-size:12px; color:#94a3b8;">Visual architecture diagram OCR, multimodal image reviews, and high-capacity open-source LLMs.</div>
          </div>
        </div>
      </div>

      <div class="side-panel">
        <div class="panel-header">
          <div class="brand-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0076CE" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            Select Enterprise Model
          </div>
          <span class="status-badge">10 Models Ready</span>
        </div>

        <div style="padding:14px; background:#0f172a; border-bottom:1px solid #1e293b;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:8px;">Available on ask.dell.com:</div>
          
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="background:#1e293b; border:2px solid #7c3aed; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#e9d5ff; font-weight:600; font-size:12px;">🟣 Claude Opus 4.6</span>
              <span style="font-size:10px; background:#7c3aed; color:#fff; padding:2px 6px; border-radius:4px; font-weight:700;">DEFAULT</span>
            </div>
            <div style="background:#182234; border:1px solid #23354d; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#c084fc; font-weight:500; font-size:12px;">🟣 Claude Sonnet 5</span>
              <span style="font-size:10px; color:#94a3b8;">200k tokens</span>
            </div>
            <div style="background:#182234; border:1px solid #0076CE; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#38bdf8; font-weight:600; font-size:12px;">🔵 Gemini 3.8 Flash</span>
              <span style="font-size:10px; background:#0076CE; color:#fff; padding:2px 6px; border-radius:4px;">FAST · SEARCH</span>
            </div>
            <div style="background:#182234; border:1px solid #23354d; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#93c5fd; font-weight:500; font-size:12px;">🔵 Gemini 3.1 Pro Preview</span>
              <span style="font-size:10px; color:#94a3b8;">1M tokens</span>
            </div>
            <div style="background:#182234; border:1px solid #23354d; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#fde047; font-weight:500; font-size:12px;">🦙 Llama-3.3 70B Instruct</span>
              <span style="font-size:10px; color:#94a3b8;">Meta Open</span>
            </div>
            <div style="background:#182234; border:1px solid #23354d; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
              <span style="color:#67e8f9; font-weight:500; font-size:12px;">💎 Gemma-3 27B It</span>
              <span style="font-size:10px; color:#94a3b8;">Efficient</span>
            </div>
          </div>
        </div>

        <div class="chat-scroll">
          <div style="display:flex; align-items:center; gap:8px; background:rgba(0,118,206,0.15); border:1px solid rgba(0,118,206,0.3); padding:8px 12px; border-radius:6px; font-size:11px; color:#38bdf8;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Hybrid Web Search: <strong>Verified with latest Kubernetes v1.31 API specs</strong></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// 3. Screenshot 3: Security Audit & OWASP Detection
const html3 = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${sharedStyles}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-header">
      <div class="window-dots">
        <div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div>
      </div>
      <div class="address-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>https://dev.azure.com/dellemc/CloudSuite/_git/identity-provider/pullrequest/8904</span>
      </div>
      <div class="browser-actions">
        <div class="ext-pill" style="border-color:#ef4444; color:#f87171; background:rgba(239,68,68,0.15);">
          🛡️ Security Audit Mode
        </div>
      </div>
    </div>
    <div class="browser-body">
      <div class="main-content">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #30363d; padding-bottom:12px;">
          <div>
            <div style="font-size:17px; font-weight:600; color:#f0f6fc;">
              PR #8904: Upgrade User Permission Filter & Tenant Context Handler
            </div>
            <div style="font-size:12px; color:#8b949e; margin-top:4px;">
              Azure DevOps Git · Target Branch: <code>release/2026.3</code>
            </div>
          </div>
        </div>

        <div style="background:#161b22; border:1px solid #30363d; border-radius:6px; padding:16px;">
          <div style="color:#58a6ff; font-weight:600; font-size:13px; margin-bottom:8px;">Diff in <code>src/controllers/TenantAuthController.cs</code></div>
          <div style="font-family:monospace; font-size:11px; background:#0d1117; padding:12px; border-radius:4px; line-height:1.5;">
            <div style="color:#8b949e;">public async Task&lt;IActionResult&gt; QueryTenantData(string tenantId, string filter) {</div>
            <div style="color:#f87171; background:rgba(248,81,73,0.15);">-   var sql = $"SELECT * FROM TenantAudit WHERE TenantId='{tenantId}' AND Status='{filter}'";</div>
            <div style="color:#f87171; background:rgba(248,81,73,0.15);">-   return Ok(await _dbContext.Database.SqlQueryRaw&lt;AuditRecord&gt;(sql).ToListAsync());</div>
            <div style="color:#8b949e;">}</div>
          </div>
        </div>
      </div>

      <div class="side-panel">
        <div class="panel-header">
          <div class="brand-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Automated Security Audit
          </div>
          <span class="finding-badge badge-crit">1 Critical Flaw</span>
        </div>

        <div class="action-chips">
          <div class="chip">🔍 Full PR Review</div>
          <div class="chip active" style="background:#dc2626; border-color:#f87171;">🛡️ Security Audit</div>
          <div class="chip">⚡ Performance</div>
          <div class="chip">🧹 Clean Code</div>
        </div>

        <div class="chat-scroll">
          <div class="ai-response" style="border-left: 3px solid #ef4444;">
            <div style="font-weight:700; color:#f87171; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
              <span>🚨 Critical: SQL Injection Detected (CWE-89)</span>
            </div>
            
            <p style="font-size:11.5px; color:#cbd5e1; margin-bottom:8px;">
              Raw string interpolation in <code>SqlQueryRaw</code> allows unauthenticated tenant cross-talk and SQL injection via untrusted <code>filter</code> parameter.
            </p>

            <div style="font-weight:600; color:#38bdf8; font-size:11px; margin-bottom:4px;">
              Recommended Secure Parameterization:
            </div>

            <div class="code-diff">
              <div class="diff-line del">- var sql = $"SELECT * FROM TenantAudit WHERE TenantId='{tenantId}'";</div>
              <div class="diff-line add">+ var sql = "SELECT * FROM TenantAudit WHERE TenantId = @p0 AND Status = @p1";</div>
              <div class="diff-line add">+ return Ok(await _dbContext.TenantAudits</div>
              <div class="diff-line add">+     .FromSqlRaw(sql, tenantId, filter)</div>
              <div class="diff-line add">+     .AsNoTracking()</div>
              <div class="diff-line add">+     .ToListAsync());</div>
            </div>

            <div style="margin-top:10px; padding:6px 10px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:4px; font-size:11px; color:#4ade80;">
              ✅ Zero-Trust & OWASP Top 10 Compliant
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// 4. Screenshot 4: 12 Quick Actions & Comprehensive Unit Test Generation
const html4 = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${sharedStyles}</style>
</head>
<body>
  <div class="browser-frame">
    <div class="browser-header">
      <div class="window-dots">
        <div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div>
      </div>
      <div class="address-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>https://jira.dell.com/browse/ENG-49210</span>
      </div>
      <div class="browser-actions">
        <div class="ext-pill">
          12 Quick Actions Available
        </div>
      </div>
    </div>
    <div class="browser-body">
      <div class="main-content">
        <div style="border-bottom:1px solid #30363d; padding-bottom:12px;">
          <div style="font-size:18px; font-weight:700; color:#f0f6fc;">Jira Story: ENG-49210 — Rate Limiter & Token Bucket Service</div>
          <div style="font-size:12px; color:#8b949e; margin-top:4px;">Status: In Development · Assignee: Ayush · Priority: High</div>
        </div>
        
        <div style="margin-top:14px; background:#161b22; padding:16px; border-radius:8px; border:1px solid #30363d;">
          <div style="font-weight:600; color:#58a6ff; font-size:13px; margin-bottom:6px;">Acceptance Criteria</div>
          <ul style="padding-left:18px; font-size:12px; color:#c9d1d9; line-height:1.6;">
            <li>Enforce 100 req/min per tenant API token.</li>
            <li>Gracefully handle Redis cluster failover with in-memory fallback.</li>
            <li>Return standard RFC 6585 <code>429 Too Many Requests</code> with <code>Retry-After</code> headers.</li>
          </ul>
        </div>
      </div>

      <div class="side-panel">
        <div class="panel-header">
          <div class="brand-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0076CE" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            AskDell Dev Assistant
          </div>
          <span class="status-badge">Test Generator</span>
        </div>

        <div class="action-chips" style="gap:5px;">
          <div class="chip">🔍 Full PR Review</div>
          <div class="chip">🛡️ Security</div>
          <div class="chip">⚡ Performance</div>
          <div class="chip">🧹 Clean Code</div>
          <div class="chip">📝 Summarize</div>
          <div class="chip">💡 Explain</div>
          <div class="chip">🐛 Debug</div>
          <div class="chip active">🧪 Test Cases</div>
          <div class="chip">📖 Docs</div>
          <div class="chip">♻️ Refactor</div>
          <div class="chip">🏗️ Architecture</div>
          <div class="chip">🔗 API Review</div>
        </div>

        <div class="chat-scroll">
          <div class="ai-response">
            <div style="font-weight:700; color:#38bdf8; margin-bottom:6px;">
              🧪 Generated Test Suite (Jest + AAA Pattern)
            </div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">
              Covering edge cases, burst limiters, and Redis failover.
            </div>

            <div class="code-diff" style="padding:8px;">
              <pre style="color:#e2e8f0; font-size:10.5px; line-height:1.45;"><code>describe('RateLimiterService', () => {
  it('allows requests within burst quota', async () => {
    const res = await limiter.check('tenant-1', 99);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(1);
  });

  it('rejects 101st request with 429 and Retry-After', async () => {
    await limiter.consume('tenant-1', 100);
    const res = await limiter.check('tenant-1', 1);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });
});</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// 5. Small Promo Tile: 440 x 280 Canvas (JPEG)
const htmlSmallPromo = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 440px;
    height: 280px;
    background: radial-gradient(circle at 100% 0%, #1e1b4b 0%, #0b0f17 65%, #06090e 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f1f5f9;
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    position: relative;
  }
  .glow {
    position: absolute;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(0, 118, 206, 0.25) 0%, rgba(124, 58, 237, 0.15) 50%, transparent 70%);
    top: -60px;
    right: -60px;
    pointer-events: none;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 1;
  }
  .icon-wrapper {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #0076CE 0%, #7C3AED 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(0, 118, 206, 0.4);
  }
  .title-group h1 {
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #ffffff;
  }
  .title-group p {
    font-size: 11.5px;
    color: #38bdf8;
    font-weight: 600;
  }
  .feature-list {
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 12px 0;
  }
  .feature-item {
    font-size: 12px;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .feature-item span {
    color: #4ade80;
    font-weight: bold;
  }
  .models-footer {
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 12px;
  }
  .badge {
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .badge.claude { background: rgba(124, 58, 237, 0.25); color: #c084fc; border: 1px solid #7c3aed; }
  .badge.gemini { background: rgba(0, 118, 206, 0.25); color: #38bdf8; border: 1px solid #0076CE; }
  .powered-by { font-size: 10px; color: #64748b; font-weight: 500; }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="header-brand">
    <div class="icon-wrapper">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.6"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
    </div>
    <div class="title-group">
      <h1>AskDell Dev Assistant</h1>
      <p>AI Side Panel for Enterprise Developers</p>
    </div>
  </div>

  <div class="feature-list">
    <div class="feature-item"><span>✓</span> 1-Click Pull Request & Diff Analysis</div>
    <div class="feature-item"><span>✓</span> Automated Security & OWASP Vulnerability Audits</div>
    <div class="feature-item"><span>✓</span> 10 Models: Claude Opus 4.6 & Gemini 3.8 Flash</div>
  </div>

  <div class="models-footer">
    <div style="display:flex; gap:6px;">
      <span class="badge claude">Claude Opus 4.6</span>
      <span class="badge gemini">Gemini 3.8 Flash</span>
    </div>
    <div class="powered-by">ask.dell.com Enterprise</div>
  </div>
</body>
</html>`;

// 6. Marquee Promo Tile: 1400 x 560 Canvas (JPEG)
const htmlMarquee = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1400px;
    height: 560px;
    background: radial-gradient(circle at 80% 20%, #1e1b4b 0%, #0b0f17 55%, #05070a 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f1f5f9;
    display: flex;
    overflow: hidden;
    position: relative;
    padding: 60px 80px;
    align-items: center;
  }
  .glow-left {
    position: absolute;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(0, 118, 206, 0.2) 0%, transparent 70%);
    top: -100px;
    left: -100px;
  }
  .glow-right {
    position: absolute;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%);
    bottom: -150px;
    right: 50px;
  }
  .content-col {
    flex: 1.2;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .brand-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 118, 206, 0.15);
    border: 1px solid #0076CE;
    color: #38bdf8;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
    width: fit-content;
  }
  h1 {
    font-size: 46px;
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #ffffff 40%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p.subtitle {
    font-size: 18px;
    line-height: 1.5;
    color: #94a3b8;
    max-width: 600px;
  }
  .pills-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .model-pill {
    font-size: 13px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 8px;
  }
  .model-pill.claude { background: rgba(124, 58, 237, 0.2); color: #c084fc; border: 1px solid #7c3aed; }
  .model-pill.gemini { background: rgba(0, 118, 206, 0.2); color: #38bdf8; border: 1px solid #0076CE; }
  .model-pill.llama { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }
  .preview-col {
    flex: 0.9;
    z-index: 2;
    display: flex;
    justify-content: center;
  }
  .card-mockup {
    width: 380px;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 14px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mockup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #1f2937;
    padding-bottom: 10px;
  }
  .mockup-title { font-weight: 700; font-size: 14px; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
  .mockup-chip { background: #1e293b; border: 1px solid #334155; font-size: 11px; padding: 4px 8px; border-radius: 6px; color: #cbd5e1; }
  .mockup-response {
    background: #182234;
    border: 1px solid #23354d;
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    color: #e2e8f0;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="glow-left"></div>
  <div class="glow-right"></div>
  
  <div class="content-col">
    <div class="brand-pill">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      Enterprise AI in Chrome & Edge Side Panel
    </div>
    <h1>AskDell Dev Assistant</h1>
    <p class="subtitle">Accelerate pull request reviews, automated security audits, unit tests, and architecture analysis directly inside your browser side panel.</p>
    
    <div class="pills-row">
      <div class="model-pill claude">🟣 Claude Opus 4.6</div>
      <div class="model-pill gemini">🔵 Gemini 3.8 Flash</div>
      <div class="model-pill llama">🦙 Llama-3.3 70B</div>
      <div class="model-pill claude">🟣 Claude Sonnet 5</div>
    </div>
  </div>

  <div class="preview-col">
    <div class="card-mockup">
      <div class="mockup-header">
        <div class="mockup-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0076CE" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          AskDell Dev Assistant
        </div>
        <span style="color:#4ade80; font-size:10px; font-weight:700; background:rgba(34,197,94,0.15); padding:2px 6px; border-radius:4px;">Connected</span>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <span class="mockup-chip" style="background:#0076CE; color:#fff; font-weight:600;">🔍 Full PR Review</span>
        <span class="mockup-chip">🛡️ Security</span>
        <span class="mockup-chip">⚡ Performance</span>
        <span class="mockup-chip">🧪 Test Cases</span>
      </div>
      <div class="mockup-response">
        <div style="color:#38bdf8; font-weight:700; margin-bottom:4px;">✨ Claude Opus 4.6 Analysis</div>
        <div>Detected 3 critical path changes in distributed caching pipeline. Race condition mitigation verified. Full test plan generated.</div>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'screenshot-1.html'), html1, 'utf8');
fs.writeFileSync(path.join(outDir, 'screenshot-2.html'), html2, 'utf8');
fs.writeFileSync(path.join(outDir, 'screenshot-3.html'), html3, 'utf8');
fs.writeFileSync(path.join(outDir, 'screenshot-4.html'), html4, 'utf8');
fs.writeFileSync(path.join(outDir, 'promo-small.html'), htmlSmallPromo, 'utf8');
fs.writeFileSync(path.join(outDir, 'promo-marquee.html'), htmlMarquee, 'utf8');

console.log('HTML templates written successfully.');
