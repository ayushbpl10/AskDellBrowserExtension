// ============================================================
// build.js — Production Build & Obfuscation Script
// Creates a clean, stripped, production-ready 'dist/' folder
// and packages it into 'dist/AskDell-Dev-Assistant-v2.1.zip'
// ============================================================

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, "dist");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "manifest.json"), "utf8"));
const ZIP_NAME = `AskDell-Dev-Assistant-v${manifest.version}.zip`;
const ZIP_PATH = path.join(DIST_DIR, ZIP_NAME);

console.log("============================================================");
console.log("  AskDell Dev Assistant — Production Packaging Build");
console.log("============================================================\n");

// 1. Prepare clean dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Safe JavaScript comment & whitespace minifier (syntax-preserving state machine)
function minifyJs(code) {
  let inString = null;
  let inRegex = false;
  let inLineComment = false;
  let inBlockComment = false;
  let out = "";
  let i = 0;
  let lastNonWhitespace = "";

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += "\n";
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === "\\") {
        i++;
        if (i < code.length) out += code[i];
      } else if (ch === inString) {
        inString = null;
      }
      i++;
      continue;
    }

    if (inRegex) {
      out += ch;
      if (ch === "\\") {
        i++;
        if (i < code.length) out += code[i];
      } else if (ch === "/") {
        inRegex = false;
      }
      i++;
      continue;
    }

    // Check for comments
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    // Check for regex start: / preceded by punctuation or keyword
    if (ch === "/" && /[(=,:;!&|?{\[\n]/.test(lastNonWhitespace)) {
      inRegex = true;
      out += ch;
      i++;
      continue;
    }

    // Check for string start
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      out += ch;
      i++;
      continue;
    }

    out += ch;
    if (!/\s/.test(ch)) {
      lastNonWhitespace = ch;
    }
    i++;
  }

  // Remove empty lines and trailing spaces
  return out.replace(/[ \t]+$/gm, "").replace(/^[ \t]*\n/gm, "").trim();
}

// 3. CSS minifier
function minifyCss(css) {
  let clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  clean = clean.replace(/\s+/g, " ");
  clean = clean.replace(/\s*([\{\}:;,>])\s*/g, "$1");
  clean = clean.replace(/;}/g, "}");
  return clean.trim();
}

// 4. HTML minifier
function minifyHtml(html) {
  let clean = html.replace(/<!--[\s\S]*?-->/g, "");
  clean = clean.replace(/\n\s*\n/g, "\n");
  return clean.trim();
}

// 5. Process and copy files
console.log("📦 Processing and minifying files into dist/...");

// manifest.json
fs.writeFileSync(path.join(DIST_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log("  ✓ manifest.json");

// JavaScript files
const jsFiles = ["background.js", "askdell-bridge.js", "sidepanel.js"];
for (const file of jsFiles) {
  const srcPath = path.join(ROOT_DIR, file);
  if (fs.existsSync(srcPath)) {
    const raw = fs.readFileSync(srcPath, "utf8");
    const minified = minifyJs(raw);
    const destPath = path.join(DIST_DIR, file);
    fs.writeFileSync(destPath, minified, "utf8");
    console.log(`  ✓ ${file} (${(raw.length / 1024).toFixed(1)} KB → ${(minified.length / 1024).toFixed(1)} KB)`);
  }
}

// HTML & CSS files
if (fs.existsSync(path.join(ROOT_DIR, "sidepanel.html"))) {
  const htmlRaw = fs.readFileSync(path.join(ROOT_DIR, "sidepanel.html"), "utf8");
  fs.writeFileSync(path.join(DIST_DIR, "sidepanel.html"), minifyHtml(htmlRaw), "utf8");
  console.log("  ✓ sidepanel.html");
}

if (fs.existsSync(path.join(ROOT_DIR, "sidepanel.css"))) {
  const cssRaw = fs.readFileSync(path.join(ROOT_DIR, "sidepanel.css"), "utf8");
  fs.writeFileSync(path.join(DIST_DIR, "sidepanel.css"), minifyCss(cssRaw), "utf8");
  console.log("  ✓ sidepanel.css");
}

// Copy icons
const iconsSrc = path.join(ROOT_DIR, "icons");
const iconsDist = path.join(DIST_DIR, "icons");
if (fs.existsSync(iconsSrc)) {
  fs.mkdirSync(iconsDist, { recursive: true });
  const iconFiles = fs.readdirSync(iconsSrc);
  for (const icon of iconFiles) {
    fs.copyFileSync(path.join(iconsSrc, icon), path.join(iconsDist, icon));
  }
  console.log(`  ✓ icons/ (${iconFiles.length} icons copied)`);
}

// 6. Validate JavaScript syntax of all output files
console.log("\n🔍 Validating production JavaScript syntax...");
try {
  for (const file of jsFiles) {
    execSync(`node -c "${path.join(DIST_DIR, file)}"`, { stdio: "inherit" });
  }
  console.log("  ✓ All dist/ JavaScript files verified (0 syntax errors)");
} catch (err) {
  console.error("❌ Syntax validation failed in dist/ files!");
  process.exit(1);
}

// 7. Create clean ZIP archive for Edge/Chrome Web Store submission (excluding .bat and .zip)
console.log("\n🗜️  Packaging into clean store distribution ZIP...");
try {
  const zipCmd = `powershell -NoProfile -Command "Get-ChildItem -Path '${DIST_DIR}' -Exclude '*.zip','*.bat' | Compress-Archive -DestinationPath '${ZIP_PATH}' -Force"`;
  execSync(zipCmd, { stdio: "inherit" });
  console.log(`  ✓ Created: ${ZIP_PATH} (clean package without .bat scripts)`);
} catch (err) {
  console.warn("  ⚠️ PowerShell zip failed, dist/ folder is still ready for use.");
}

// 8. Copy 1-click Install.bat to dist/ for local sideloading convenience (after ZIP creation)
if (fs.existsSync(path.join(ROOT_DIR, "Install.bat"))) {
  fs.copyFileSync(path.join(ROOT_DIR, "Install.bat"), path.join(DIST_DIR, "Install.bat"));
  console.log("  ✓ Install.bat (1-click team installer copied for offline sideloading)");
}

console.log("\n============================================================");
console.log("✅ BUILD COMPLETE!");
console.log(`📂 Production Folder: ${DIST_DIR}`);
console.log(`📦 Distribution Zip:   ${ZIP_PATH}`);
console.log("============================================================\n");
