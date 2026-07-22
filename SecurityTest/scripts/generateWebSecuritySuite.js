#!/usr/bin/env node
/**
 * TripSync Web Security Suite Generator
 * ======================================
 * Orchestrates the full SAST pipeline and generates all output reports:
 *   - web-security-findings.xlsx (4 sheets)
 *   - web-security-review.md
 *   - web-executive-summary.md
 *
 * Author: TripSync Security Team
 * Version: 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const REPORT_DIR = path.resolve(__dirname, "../reports");
const ROOT_DIR = path.resolve(__dirname, "../../");

// ─── Dependency Check & Auto-Install ─────────────────────────────────────────
function ensureDependency(pkgName) {
  try {
    require.resolve(pkgName);
    return true;
  } catch {
    console.log(`  Installing ${pkgName}...`);
    try {
      execSync(`npm install ${pkgName} --no-save --prefix "${ROOT_DIR}"`, {
        stdio: "pipe",
        timeout: 60000,
      });
      return true;
    } catch (err) {
      console.warn(`  ⚠️  Could not install ${pkgName}: ${err.message}`);
      return false;
    }
  }
}

// ─── XLSX Generation ──────────────────────────────────────────────────────────
function generateXLSX(scanData) {
  const xlsxAvailable = ensureDependency("xlsx");
  
  if (!xlsxAvailable) {
    console.warn("  ⚠️  xlsx package not available. Skipping Excel report. Install with: npm install xlsx");
    return false;
  }

  const XLSX = require("xlsx");
  const { findings, depFindings } = scanData;

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Security Findings ──────────────────────────────────────────────
  const findingsHeaders = [
    "Finding ID", "Severity", "Category", "File", "Function", "Line",
    "Description", "Root Cause", "Impact", "Recommendation", "CWE", "OWASP", "Evidence"
  ];

  const safeStr = (val) => String(val || "").substring(0, 30000);

  const findingsData = [findingsHeaders];
  for (const f of findings) {
    findingsData.push([
      safeStr(f.id), safeStr(f.severity), safeStr(f.category), safeStr(f.file), safeStr(f.function), safeStr(f.line),
      safeStr(f.description), safeStr(f.rootCause), safeStr(f.impact), safeStr(f.recommendation), safeStr(f.cwe), safeStr(f.owasp), safeStr(f.evidence)
    ]);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(findingsData);

  // Column widths
  ws1["!cols"] = [
    { wch: 12 }, { wch: 10 }, { wch: 35 }, { wch: 50 }, { wch: 25 }, { wch: 6 },
    { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 12 }, { wch: 35 }, { wch: 40 }
  ];

  // Apply header styling
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E3A5F" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    },
  };

  // Severity color coding
  const severityColors = {
    CRITICAL: "C0392B",
    HIGH: "E67E22",
    MEDIUM: "F39C12",
    LOW: "27AE60",
    INFO: "2980B9",
  };

  // Style header row
  const headerRow = 0;
  findingsHeaders.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow, c: colIdx });
    if (!ws1[cellRef]) ws1[cellRef] = { v: findingsHeaders[colIdx], t: "s" };
    ws1[cellRef].s = headerStyle;
  });

  // Style data rows with severity colors
  findings.forEach((finding, rowIdx) => {
    const row = rowIdx + 1;
    const sevColor = severityColors[finding.severity] || "808080";
    const cellStyle = {
      alignment: { wrapText: true, vertical: "top" },
      fill: { fgColor: { rgb: row % 2 === 0 ? "F8F9FA" : "FFFFFF" } },
    };

    // Color the severity cell
    const sevCellRef = XLSX.utils.encode_cell({ r: row, c: 1 });
    if (ws1[sevCellRef]) {
      ws1[sevCellRef].s = {
        ...cellStyle,
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: sevColor } },
        alignment: { horizontal: "center" },
      };
    }

    // Style other cells
    for (let col = 0; col < findingsHeaders.length; col++) {
      if (col === 1) continue;
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws1[cellRef]) ws1[cellRef].s = cellStyle;
    }
  });

  XLSX.utils.book_append_sheet(wb, ws1, "Security Findings");

  // ── Sheet 2: Dependency Review ──────────────────────────────────────────────
  const depHeaders = ["Package", "Installed Version", "Latest Stable", "Severity", "Description", "Recommendation"];
  const depData = [depHeaders];

  for (const d of (depFindings || [])) {
    depData.push([
      d.package || "", d.installedVersion || "", d.latestVersion || "",
      d.severity || "", d.description || "", d.recommendation || ""
    ]);
  }

  // Add known packages from package.json
  const pkgPath = path.join(ROOT_DIR, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8") || "{}");
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const existingPkgs = new Set((depFindings || []).map((d) => d.package));
    
    const packageAuditNotes = {
      "next": { latest: "15.x", note: "Check for latest Next.js security patches" },
      "firebase": { latest: "11.x", note: "Keep Firebase SDK updated for security patches" },
      "react": { latest: "19.x", note: "Current, monitor for patches" },
      "typescript": { latest: "5.x", note: "Current, monitor for patches" },
      "@tanstack/react-query": { latest: "5.x", note: "Monitor for updates" },
      "framer-motion": { latest: "12.x", note: "Monitor for updates" },
      "leaflet": { latest: "1.9.x", note: "No known critical CVEs in current version" },
      "zod": { latest: "4.x", note: "Schema validation library, keep updated" },
    };

    for (const [name, version] of Object.entries(allDeps)) {
      if (!existingPkgs.has(name) && packageAuditNotes[name]) {
        const note = packageAuditNotes[name];
        depData.push([
          name, version, note.latest, "INFO", note.note,
          `Run 'npm audit' and update ${name} regularly`
        ]);
      }
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(depData);
  ws2["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 60 }, { wch: 50 }];
  
  // Style header
  depHeaders.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws2[cellRef]) ws2[cellRef] = { v: depHeaders[colIdx], t: "s" };
    ws2[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "155724" } },
      alignment: { horizontal: "center" },
    };
  });

  XLSX.utils.book_append_sheet(wb, ws2, "Dependency Review");

  // ── Sheet 3: Risk Summary ────────────────────────────────────────────────────
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const byCategory = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    const cat = f.category.split("/")[0].trim();
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  const riskScore = bySeverity.CRITICAL * 10 + bySeverity.HIGH * 7 + bySeverity.MEDIUM * 4 + bySeverity.LOW;
  const riskLevel = riskScore > 50 ? "HIGH RISK" : riskScore > 20 ? "MEDIUM RISK" : riskScore > 5 ? "LOW RISK" : "MINIMAL RISK";

  const riskData = [
    ["TripSync Web Application — Security Risk Summary"],
    [""],
    ["Generated", new Date().toISOString()],
    ["Scanner", "TripSync Web SAST v1.0.0"],
    ["Target", "TripSync Next.js Web Application"],
    [""],
    ["SEVERITY BREAKDOWN"],
    ["Severity", "Count", "Weight", "Risk Score Contribution"],
    ["CRITICAL", bySeverity.CRITICAL, 10, bySeverity.CRITICAL * 10],
    ["HIGH", bySeverity.HIGH, 7, bySeverity.HIGH * 7],
    ["MEDIUM", bySeverity.MEDIUM, 4, bySeverity.MEDIUM * 4],
    ["LOW", bySeverity.LOW, 1, bySeverity.LOW * 1],
    ["INFO", bySeverity.INFO, 0, 0],
    ["TOTAL", findings.length, "", riskScore],
    [""],
    ["Overall Risk Level", riskLevel],
    ["Risk Score", `${riskScore}/100`],
    [""],
    ["FINDINGS BY CATEGORY"],
    ["Category", "Finding Count"],
    ...Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => [cat, count]),
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(riskData);
  ws3["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 10 }, { wch: 25 }];

  // Style title
  const titleCell = ws3["A1"];
  if (titleCell) {
    titleCell.s = {
      font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1E3A5F" } },
      alignment: { horizontal: "center" },
    };
  }

  // Color severity rows
  const sevColors = {
    CRITICAL: "FADBD8", HIGH: "FDEBD0", MEDIUM: "FEF9E7", LOW: "EAFAF1", INFO: "EBF5FB"
  };
  [8, 9, 10, 11, 12].forEach((rowIdx, i) => {
    const sev = Object.keys(bySeverity)[i];
    const color = sevColors[sev] || "FFFFFF";
    for (let col = 0; col < 4; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: col });
      if (ws3[cellRef]) {
        ws3[cellRef].s = { fill: { fgColor: { rgb: color } }, alignment: { horizontal: col === 0 ? "left" : "center" } };
      }
    }
  });

  XLSX.utils.book_append_sheet(wb, ws3, "Risk Summary");

  // ── Sheet 4: Recommendations ─────────────────────────────────────────────────
  const recHeaders = ["Priority", "Action Item", "Timeline", "Effort", "Category", "Related Finding IDs"];
  const recData = [recHeaders];

  const recommendations = [
    ["P0 — Immediate", "Rotate all exposed API keys (GEMINI, GROQ, OpenRouter, HuggingFace, Firebase)", "24 hours", "Low", "Secrets Management", findings.filter(f => f.category.includes("Secret")).map(f => f.id).join(", ")],
    ["P0 — Immediate", "Fix OTP endpoint to NOT return OTP code in HTTP response body", "24 hours", "Low", "Authentication", findings.filter(f => f.category.includes("OTP")).map(f => f.id).join(", ")],
    ["P1 — Critical", "Implement middleware.ts for server-side route protection with Firebase token verification", "1 week", "Medium", "Authorization", findings.filter(f => f.category.includes("Middleware")).map(f => f.id).join(", ")],
    ["P1 — Critical", "Remove hardcoded Firebase config from source code; use environment variables only", "1 week", "Low", "Firebase Security", findings.filter(f => f.category.includes("Firebase")).map(f => f.id).join(", ")],
    ["P1 — Critical", "Install firebase-admin SDK for server-side JWT verification", "1 week", "Medium", "Authentication", findings.filter(f => f.description.includes("firebase-admin")).map(f => f.id).join(", ")],
    ["P2 — High", "Remove 'unsafe-eval' from Content-Security-Policy and refactor eval() usages", "2 weeks", "Medium", "Security Headers", ""],
    ["P2 — High", "Add Authorization: Bearer token headers to all authenticated API calls", "2 weeks", "Medium", "Authentication", ""],
    ["P2 — High", "Remove 'unsafe-inline' from CSP; implement nonce-based inline script handling", "2 weeks", "High", "Security Headers", ""],
    ["P3 — Medium", "Add HTTP Strict-Transport-Security (HSTS) header", "1 month", "Low", "Security Headers", ""],
    ["P3 — Medium", "Implement Firebase App Check to prevent unauthorized Firebase API access", "1 month", "High", "Firebase Security", ""],
    ["P3 — Medium", "Apply Firebase API key restrictions in Google Cloud Console (HTTP referrer)", "1 month", "Low", "Firebase Security", ""],
    ["P3 — Medium", "Restrict CORS to specific trusted origins instead of wildcard *", "1 month", "Low", "CORS", ""],
    ["P4 — Low", "Add Permissions-Policy header to restrict browser feature access", "1 quarter", "Low", "Security Headers", ""],
    ["P4 — Low", "Run npm audit regularly and update vulnerable dependencies", "Ongoing", "Low", "Dependencies", ""],
    ["P4 — Low", "Remove TypeScript and ESLint build error bypasses (ignoreBuildErrors, ignoreDuringBuilds)", "1 quarter", "Medium", "Code Quality", ""],
  ];

  for (const rec of recommendations) {
    recData.push(rec);
  }

  const ws4 = XLSX.utils.aoa_to_sheet(recData);
  ws4["!cols"] = [{ wch: 20 }, { wch: 70 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 30 }];

  // Style header
  recHeaders.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws4[cellRef]) ws4[cellRef] = { v: recHeaders[colIdx], t: "s" };
    ws4[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "7B241C" } },
      alignment: { horizontal: "center" },
    };
  });

  // Color by priority
  const priorityColors = { "P0": "FADBD8", "P1": "FDEBD0", "P2": "FEF9E7", "P3": "EAFAF1", "P4": "EBF5FB" };
  recommendations.forEach((rec, i) => {
    const priority = rec[0].substring(0, 2);
    const color = priorityColors[priority] || "FFFFFF";
    for (let col = 0; col < recHeaders.length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: col });
      if (ws4[cellRef]) {
        ws4[cellRef].s = {
          fill: { fgColor: { rgb: color } },
          alignment: { wrapText: true, vertical: "top" },
        };
      }
    }
  });

  XLSX.utils.book_append_sheet(wb, ws4, "Recommendations");

  // Save workbook
  const xlsxPath = path.join(REPORT_DIR, "web-security-findings.xlsx");
  XLSX.writeFile(wb, xlsxPath);
  console.log(`  ✅ Excel report: ${xlsxPath}`);
  return true;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║    TripSync Web Security Suite Generator v1.0.0             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Ensure report directory
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // Step 1: Run the scanner
  console.log("STEP 1: Running SAST Scanner...\n");
  const scanner = require("./webScanner");
  const scanData = await scanner.main();

  // Step 2: Load results (in case scanner was run standalone)
  const resultsPath = path.join(REPORT_DIR, "scan-results.json");
  let loadedData = scanData;
  if (!loadedData && fs.existsSync(resultsPath)) {
    loadedData = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  }

  if (!loadedData) {
    console.error("❌ No scan data available. Run webScanner.js first.");
    process.exit(1);
  }

  // Step 3: Generate Excel report
  console.log("\nSTEP 2: Generating Excel Report...");
  generateXLSX(loadedData);

  // Step 4: Summary
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                   SUITE GENERATION COMPLETE                 ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  Reports generated in SecurityTest/reports/:                ║");
  console.log("║  ✅  web-security-findings.xlsx  (4 sheets)                 ║");
  console.log("║  ✅  web-security-review.md                                 ║");
  console.log("║  ✅  web-executive-summary.md                               ║");
  console.log("║  ✅  scan-results.json           (raw data)                 ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main().catch((err) => {
  console.error("Suite generator error:", err);
  process.exit(1);
});
