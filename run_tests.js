// ============================================================
// run_tests.js — Test Runner & Verification Harness
// Runs all test suites across the extension
// ============================================================

const { execSync } = require("child_process");
const path = require("path");

console.log("============================================================");
console.log("  AskDell Dev Assistant — Comprehensive Verification Suite  ");
console.log("============================================================\n");

const testFiles = [
  "tests/manifest.test.js",
  "tests/background.test.js",
  "tests/bridge.test.js",
  "tests/sidepanel.test.js"
];

let allPassed = true;

try {
  const cmd = `node --test ${testFiles.join(" ")}`;
  console.log(`Running: ${cmd}\n`);
  const output = execSync(cmd, { encoding: "utf-8", stdio: "inherit" });
  console.log("\n============================================================");
  console.log("  ✅ ALL FUNCTIONALITY TESTS PASSED (100% SUCCESS)         ");
  console.log("============================================================\n");
} catch (err) {
  allPassed = false;
  console.error("\n❌ Some tests failed. Please review error output above.\n");
  process.exit(1);
}
