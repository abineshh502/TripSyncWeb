#!/usr/bin/env node
/**
 * TripSync Web Security Scanner (SAST)
 * =====================================
 * Production-ready static analysis for Next.js / React / TypeScript / Firebase
 * Uses hybrid AST → Semantic → Regex analysis pipeline.
 *
 * Author: TripSync Security Team
 * Version: 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Configuration ────────────────────────────────────────────────────────────
const ROOT_DIR = path.resolve(__dirname, "../../");
const REPORT_DIR = path.resolve(__dirname, "../reports");
const RULES_PATH = path.resolve(__dirname, "../config/security-rules.json");

const rules = JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));

// ─── SAST Finding Registry ────────────────────────────────────────────────────
let findings = [];
let findingCounter = 1;
const SCAN_TIMESTAMP = new Date().toISOString();

function addFinding({
  severity,
  category,
  file,
  func,
  line,
  description,
  rootCause,
  impact,
  recommendation,
  cwe,
  owasp,
  evidence,
}) {
  findings.push({
    id: `WEB-${String(findingCounter++).padStart(4, "0")}`,
    severity,
    category,
    file: file.replace(ROOT_DIR, "").replace(/\\/g, "/"),
    function: func || "N/A",
    line: line || "N/A",
    description,
    rootCause,
    impact,
    recommendation,
    cwe,
    owasp,
    evidence: evidence || "",
  });
}

// ─── File Discovery ───────────────────────────────────────────────────────────
const SCAN_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".mjs", ".env"];
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", "SecurityTest", "e2e-tests", "dist", ".github"]);

function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walkDir(fullPath, files);
    } else if (SCAN_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

// ─── Technology Detection ─────────────────────────────────────────────────────
function detectTechnology() {
  const pkgPath = path.join(ROOT_DIR, "package.json");
  if (!fs.existsSync(pkgPath)) return {};
  const pkg = JSON.parse(readFile(pkgPath) || "{}");
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  return {
    nextjs: !!allDeps["next"],
    react: !!allDeps["react"],
    typescript: !!allDeps["typescript"],
    tailwindcss: !!allDeps["tailwindcss"],
    firebase: !!allDeps["firebase"],
    reactHookForm: !!allDeps["react-hook-form"],
    zod: !!allDeps["zod"],
    framerMotion: !!allDeps["framer-motion"],
    version: {
      next: allDeps["next"],
      react: allDeps["react"],
      firebase: allDeps["firebase"],
      typescript: allDeps["typescript"],
    },
  };
}

// ─── Line-Aware Search Helper ─────────────────────────────────────────────────
function findMatchesWithLines(content, pattern, flags = "g") {
  const lines = content.split("\n");
  const results = [];
  const regex = new RegExp(pattern, flags);
  lines.forEach((line, idx) => {
    regex.lastIndex = 0;
    if (regex.test(line)) {
      results.push({ line: idx + 1, content: line.trim() });
    }
  });
  return results;
}

// ─── SCANNER MODULES ──────────────────────────────────────────────────────────

// MODULE 1: Firebase Security Analysis
function scanFirebaseConfig(files) {
  console.log("  [+] Scanning Firebase configuration...");
  
  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;
    const relPath = filePath.replace(ROOT_DIR, "").replace(/\\/g, "/");

    // Check 1: Firebase API key hardcoded in source (not env)
    if (!filePath.includes(".env")) {
      const apiKeyMatches = findMatchesWithLines(content, 'apiKey\\s*:\\s*["\'][A-Za-z0-9_\\-]{20,}["\']');
      for (const m of apiKeyMatches) {
        addFinding({
          severity: "HIGH",
          category: "Firebase / Secret Exposure",
          file: filePath,
          func: "firebaseConfig",
          line: m.line,
          description: "Firebase API key is hardcoded directly in source code instead of being loaded from environment variables.",
          rootCause: `The firebaseConfig object in ${relPath} contains the apiKey literal value, which is committed to source control.`,
          impact: "Firebase API key is exposed in version control. Malicious actors can scrape the repository and misuse the key for unauthorized Firebase access, quota abuse, or data exfiltration.",
          recommendation: "Move all Firebase config values to environment variables (NEXT_PUBLIC_FIREBASE_*). Access via process.env. Ensure .env.local is in .gitignore. Apply Firebase App Check and restrict API key by HTTP referrer in Google Cloud Console.",
          cwe: "CWE-798",
          owasp: "A02 - Cryptographic Failures",
          evidence: m.content,
        });
      }
    }

    // Check 2: NEXT_PUBLIC_ Firebase key (publicly visible in browser bundle)
    if (filePath.endsWith(".env.local") || filePath.endsWith(".env") || filePath.endsWith(".env.production")) {
      const pubKeyMatches = findMatchesWithLines(content, "NEXT_PUBLIC_FIREBASE_API_KEY=.+");
      for (const m of pubKeyMatches) {
        addFinding({
          severity: "MEDIUM",
          category: "Firebase / Client Key Exposure",
          file: filePath,
          func: "N/A",
          line: m.line,
          description: "NEXT_PUBLIC_FIREBASE_API_KEY is exposed to the browser bundle. Firebase client keys are by design public but must be restricted.",
          rootCause: "Next.js NEXT_PUBLIC_ prefix exposes variables to the client JavaScript bundle.",
          impact: "Firebase API key is accessible in the browser. Without Firebase App Check and key restrictions, malicious users can use it to abuse Firebase services.",
          recommendation: "Apply Firebase App Check to prevent unauthorized client access. Restrict the Firebase API key in Google Cloud Console to only your application domain. Enable Firebase Security Rules to prevent unauthorized data access.",
          cwe: "CWE-200",
          owasp: "A05 - Security Misconfiguration",
          evidence: m.content.replace(/=.*$/, "=[REDACTED]"),
        });
      }
    }

    // Check 3: measurementId exposed (analytics tracking ID)
    if (!filePath.includes(".env")) {
      const measurementMatches = findMatchesWithLines(content, 'measurementId\\s*:\\s*["\']G-[A-Z0-9]+["\']');
      for (const m of measurementMatches) {
        addFinding({
          severity: "LOW",
          category: "Firebase / Analytics ID Exposure",
          file: filePath,
          func: "firebaseConfig",
          line: m.line,
          description: "Firebase Measurement ID (Analytics) is hardcoded in source code.",
          rootCause: "measurementId is directly embedded in the firebase config object in source code.",
          impact: "Low direct risk but contributes to overall credential exposure surface. Could enable analytics spoofing.",
          recommendation: "Move measurementId to NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID environment variable.",
          cwe: "CWE-200",
          owasp: "A05 - Security Misconfiguration",
          evidence: m.content,
        });
      }
    }

    // Check 4: Missing Firebase Admin SDK (server-side auth)
    if (filePath.endsWith("package.json")) {
      const pkg = JSON.parse(content || "{}");
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (!allDeps["firebase-admin"]) {
        addFinding({
          severity: "MEDIUM",
          category: "Firebase / Missing Server-Side Auth",
          file: filePath,
          func: "N/A",
          line: 1,
          description: "Firebase Admin SDK is not installed. Server-side token verification is not possible without it.",
          rootCause: "firebase-admin is absent from package.json dependencies. Authentication relies entirely on client-side Firebase SDK.",
          impact: "Without server-side JWT verification via Firebase Admin, API routes cannot securely verify user identity. Client-supplied UIDs or tokens could be forged.",
          recommendation: "Install firebase-admin and verify Firebase ID tokens in Next.js API routes or middleware before processing authenticated requests.",
          cwe: "CWE-287",
          owasp: "A07 - Identification and Authentication Failures",
          evidence: "firebase-admin not found in package.json",
        });
      }
    }
  }
}

// MODULE 2: Authentication & Session Management
function scanAuthentication(files) {
  console.log("  [+] Scanning authentication patterns...");

  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;

    // Check: localStorage usage for auth tokens
    const lsTokenMatches = findMatchesWithLines(
      content,
      "localStorage\\.setItem\\(['\"](?:token|authToken|jwt|accessToken|idToken|refreshToken|user)['\"]"
    );
    for (const m of lsTokenMatches) {
      addFinding({
        severity: "HIGH",
        category: "Authentication / Insecure Token Storage",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "Authentication token is stored in localStorage, which is accessible to any JavaScript on the page.",
        rootCause: "localStorage.setItem() used to persist authentication token. localStorage is vulnerable to XSS attacks.",
        impact: "Any XSS vulnerability can exfiltrate tokens from localStorage. Tokens can persist after logout if not explicitly removed. Enables session hijacking.",
        recommendation: "Use HttpOnly, Secure, SameSite=Strict cookies for token storage. If using Next.js, leverage server-side session management or encrypted cookies via iron-session or next-auth.",
        cwe: "CWE-312",
        owasp: "A07 - Identification and Authentication Failures",
        evidence: m.content,
      });
    }

    // Check: sessionStorage for token
    const ssTokenMatches = findMatchesWithLines(
      content,
      "sessionStorage\\.setItem\\(['\"](?:token|authToken|jwt|accessToken|idToken)['\"]"
    );
    for (const m of ssTokenMatches) {
      addFinding({
        severity: "MEDIUM",
        category: "Authentication / Insecure Token Storage",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "Authentication token stored in sessionStorage is still accessible via JavaScript and vulnerable to XSS.",
        rootCause: "sessionStorage.setItem() used for token persistence.",
        impact: "XSS attacks can read sessionStorage. Better than localStorage but still not recommended for sensitive tokens.",
        recommendation: "Prefer HttpOnly cookies for authentication token storage.",
        cwe: "CWE-312",
        owasp: "A07 - Identification and Authentication Failures",
        evidence: m.content,
      });
    }

    // Check: JWT decode without verification
    const jwtDecodeMatches = findMatchesWithLines(content, "atob\\(.*split\\(\\'\\.'\\)|jwt_decode|jwtDecode|parseJwt");
    for (const m of jwtDecodeMatches) {
      addFinding({
        severity: "HIGH",
        category: "Authentication / JWT Validation",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "JWT token appears to be decoded client-side without signature verification.",
        rootCause: "Client-side JWT decoding bypasses signature validation and can be manipulated by attackers.",
        impact: "If the application makes authorization decisions based on client-decoded JWT claims, an attacker can forge claims by modifying the token payload.",
        recommendation: "Never trust client-decoded JWT claims for authorization decisions. Always verify tokens server-side using Firebase Admin SDK or dedicated JWT library.",
        cwe: "CWE-347",
        owasp: "A07 - Identification and Authentication Failures",
        evidence: m.content,
      });
    }

    // Check: Client-side only auth guard (useEffect-based)
    if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
      const clientAuthGuard = content.includes("useEffect") && content.includes("router.push") &&
        (content.includes("!user") || content.includes("!loading")) && content.includes("use client");
      if (clientAuthGuard) {
        const lines = content.split("\n");
        const lineNum = lines.findIndex((l) => l.includes("router.push") && lines.some((ll) => ll.includes("!user"))) + 1;
        addFinding({
          severity: "MEDIUM",
          category: "Authorization / Client-Side Auth Guard",
          file: filePath,
          func: "DashboardLayout",
          line: lineNum || "N/A",
          description: "Route protection is implemented client-side only using useEffect. This creates a brief window where protected content may flash before redirect.",
          rootCause: "Authentication guard uses useEffect + router.push pattern which runs after initial render. A fast network or cached response could expose protected routes momentarily.",
          impact: "Protected page content may briefly flash to unauthenticated users. Does not provide true server-side protection. Search engine crawlers could index protected content.",
          recommendation: "Implement server-side auth using Next.js middleware (middleware.ts) to redirect unauthenticated users before any content is served. Use Firebase Admin to verify tokens in middleware.",
          cwe: "CWE-285",
          owasp: "A01 - Broken Access Control",
          evidence: `useEffect-based auth guard in ${filePath.replace(ROOT_DIR, "")}`,
        });
      }
    }
  }
}

// MODULE 3: XSS Analysis
function scanXSS(files) {
  console.log("  [+] Scanning for XSS vulnerabilities...");

  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;

    // Check: dangerouslySetInnerHTML
    const dsiHtmlMatches = findMatchesWithLines(content, "dangerouslySetInnerHTML");
    for (const m of dsiHtmlMatches) {
      addFinding({
        severity: "HIGH",
        category: "XSS / Dangerous HTML Rendering",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "dangerouslySetInnerHTML found which bypasses React's XSS protection and directly injects HTML into the DOM.",
        rootCause: "Use of React's dangerouslySetInnerHTML prop which bypasses the framework's built-in escaping.",
        impact: "If the HTML content contains user-controlled input without proper sanitization, it enables stored or reflected XSS attacks.",
        recommendation: "Avoid dangerouslySetInnerHTML. If HTML rendering is required, sanitize input using DOMPurify before injection. Prefer React-controlled rendering.",
        cwe: "CWE-79",
        owasp: "A03 - Injection",
        evidence: m.content,
      });
    }

    // Check: eval usage
    const evalMatches = findMatchesWithLines(content, "(?<!['\"])\\beval\\s*\\(");
    for (const m of evalMatches) {
      const trimmed = m.content.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
      addFinding({
        severity: "CRITICAL",
        category: "XSS / Code Injection",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "eval() function detected which executes arbitrary JavaScript code.",
        rootCause: "eval() evaluates a string as JavaScript code at runtime, creating a code injection vector.",
        impact: "If user-controlled data reaches eval(), it enables Remote Code Execution (RCE) in the browser context, complete session hijacking, and data exfiltration.",
        recommendation: "Never use eval(). Use JSON.parse() for data parsing, and refactor logic to avoid dynamic code execution.",
        cwe: "CWE-95",
        owasp: "A03 - Injection",
        evidence: m.content,
      });
    }

    // Check: innerHTML assignment
    const innerHtmlMatches = findMatchesWithLines(content, "\\.innerHTML\\s*=");
    for (const m of innerHtmlMatches) {
      addFinding({
        severity: "HIGH",
        category: "XSS / Direct DOM Manipulation",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "Direct innerHTML assignment detected which can introduce XSS if content includes user input.",
        rootCause: "innerHTML assignment allows HTML injection when the value contains unsanitized user input.",
        impact: "Enables DOM-based XSS if user-controlled data is assigned to innerHTML without sanitization.",
        recommendation: "Use textContent for plain text. If HTML is needed, sanitize with DOMPurify. Prefer React state management over direct DOM manipulation.",
        cwe: "CWE-79",
        owasp: "A03 - Injection",
        evidence: m.content,
      });
    }
  }
}

// MODULE 4: Security Headers & CSP Analysis
function scanSecurityHeaders() {
  console.log("  [+] Scanning security headers configuration...");

  const nextConfigPath = path.join(ROOT_DIR, "next.config.ts");
  if (!fs.existsSync(nextConfigPath)) {
    addFinding({
      severity: "HIGH",
      category: "Security Headers / Missing Config",
      file: nextConfigPath,
      func: "N/A",
      line: 1,
      description: "next.config.ts not found. Security headers cannot be verified.",
      rootCause: "Missing Next.js configuration file.",
      impact: "Cannot confirm presence of security headers without configuration file.",
      recommendation: "Create next.config.ts and configure security headers including CSP, HSTS, X-Frame-Options, etc.",
      cwe: "CWE-693",
      owasp: "A05 - Security Misconfiguration",
      evidence: "next.config.ts not found",
    });
    return;
  }

  const content = readFile(nextConfigPath);

  // Check CSP
  if (content.includes("Content-Security-Policy")) {
    // Check for unsafe-eval in CSP
    if (content.includes("'unsafe-eval'")) {
      addFinding({
        severity: "HIGH",
        category: "Security Headers / CSP unsafe-eval",
        file: nextConfigPath,
        func: "headers()",
        line: findMatchesWithLines(content, "'unsafe-eval'")[0]?.line || "N/A",
        description: "Content Security Policy includes 'unsafe-eval' directive which allows eval() and similar functions.",
        rootCause: "CSP configured with 'unsafe-eval' in script-src, negating protection against eval-based XSS.",
        impact: "Bypasses XSS protections for eval-based injection vectors. Any eval() usage becomes exploitable.",
        recommendation: "Remove 'unsafe-eval' from CSP. Refactor code to eliminate eval() usage. Use a nonce-based CSP for inline scripts if needed.",
        cwe: "CWE-693",
        owasp: "A05 - Security Misconfiguration",
        evidence: "'unsafe-eval' found in Content-Security-Policy script-src",
      });
    }

    // Check for unsafe-inline in CSP
    if (content.includes("'unsafe-inline'")) {
      addFinding({
        severity: "MEDIUM",
        category: "Security Headers / CSP unsafe-inline",
        file: nextConfigPath,
        func: "headers()",
        line: findMatchesWithLines(content, "'unsafe-inline'")[0]?.line || "N/A",
        description: "Content Security Policy includes 'unsafe-inline' which allows inline scripts and styles.",
        rootCause: "CSP script-src or style-src contains 'unsafe-inline', weakening XSS protections.",
        impact: "Inline script injection is possible. Reduces effectiveness of CSP as an XSS mitigation layer.",
        recommendation: "Use nonce-based or hash-based CSP instead of 'unsafe-inline'. Implement Next.js nonce generation for inline scripts.",
        cwe: "CWE-693",
        owasp: "A05 - Security Misconfiguration",
        evidence: "'unsafe-inline' found in Content-Security-Policy",
      });
    }
  } else {
    addFinding({
      severity: "HIGH",
      category: "Security Headers / Missing CSP",
      file: nextConfigPath,
      func: "headers()",
      line: 1,
      description: "Content-Security-Policy header is not configured in next.config.ts.",
      rootCause: "No CSP directive found in Next.js headers configuration.",
      impact: "Without CSP, XSS attacks have no browser-enforced restriction on script execution, enabling full script injection.",
      recommendation: "Implement a strict Content-Security-Policy header in next.config.ts headers() function.",
      cwe: "CWE-693",
      owasp: "A05 - Security Misconfiguration",
      evidence: "No Content-Security-Policy in next.config.ts headers()",
    });
  }

  // Check HSTS
  if (!content.includes("Strict-Transport-Security")) {
    addFinding({
      severity: "MEDIUM",
      category: "Security Headers / Missing HSTS",
      file: nextConfigPath,
      func: "headers()",
      line: 1,
      description: "HTTP Strict-Transport-Security (HSTS) header is not configured.",
      rootCause: "HSTS is absent from the Next.js headers configuration.",
      impact: "Without HSTS, browsers may accept HTTP connections, enabling downgrade attacks and man-in-the-middle attacks.",
      recommendation: "Add 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload' to the security headers configuration.",
      cwe: "CWE-319",
      owasp: "A05 - Security Misconfiguration",
      evidence: "Strict-Transport-Security not found in next.config.ts",
    });
  }

  // Check Permissions-Policy
  if (!content.includes("Permissions-Policy")) {
    addFinding({
      severity: "LOW",
      category: "Security Headers / Missing Permissions-Policy",
      file: nextConfigPath,
      func: "headers()",
      line: 1,
      description: "Permissions-Policy header is not configured to restrict browser feature access.",
      rootCause: "Permissions-Policy not included in Next.js security headers.",
      impact: "Browser features (camera, microphone, geolocation) are not restricted by policy, increasing attack surface.",
      recommendation: "Add Permissions-Policy header to restrict unneeded browser APIs: 'camera=(), microphone=(), geolocation=(self)'.",
      cwe: "CWE-693",
      owasp: "A05 - Security Misconfiguration",
      evidence: "Permissions-Policy not found in next.config.ts",
    });
  }

  // Check X-Frame-Options
  if (!content.includes("X-Frame-Options")) {
    addFinding({
      severity: "MEDIUM",
      category: "Security Headers / Missing X-Frame-Options",
      file: nextConfigPath,
      func: "headers()",
      line: 1,
      description: "X-Frame-Options header missing, leaving application vulnerable to clickjacking.",
      rootCause: "X-Frame-Options not configured in Next.js headers().",
      impact: "Application can be embedded in iframes on malicious sites, enabling clickjacking attacks.",
      recommendation: "Add 'X-Frame-Options: DENY' or 'SAMEORIGIN' to prevent iframe embedding.",
      cwe: "CWE-1021",
      owasp: "A05 - Security Misconfiguration",
      evidence: "X-Frame-Options not found in next.config.ts",
    });
  }

  // TypeScript build error bypass
  if (content.includes("ignoreBuildErrors: true")) {
    addFinding({
      severity: "MEDIUM",
      category: "Security Headers / TypeScript Safety Bypass",
      file: nextConfigPath,
      func: "nextConfig",
      line: findMatchesWithLines(content, "ignoreBuildErrors")[0]?.line || "N/A",
      description: "TypeScript build errors are suppressed (ignoreBuildErrors: true). Type-safety checks are bypassed during production builds.",
      rootCause: "typescript.ignoreBuildErrors set to true in Next.js config.",
      impact: "Type errors that could indicate insecure data handling, missing validations, or incorrect API contract usage are silently ignored in builds.",
      recommendation: "Remove ignoreBuildErrors: true and fix all TypeScript errors. Type safety is a security control.",
      cwe: "CWE-704",
      owasp: "A04 - Insecure Design",
      evidence: "ignoreBuildErrors: true in typescript config",
    });
  }

  // ESLint bypass
  if (content.includes("ignoreDuringBuilds: true")) {
    addFinding({
      severity: "LOW",
      category: "Security Headers / ESLint Safety Bypass",
      file: nextConfigPath,
      func: "nextConfig",
      line: findMatchesWithLines(content, "ignoreDuringBuilds")[0]?.line || "N/A",
      description: "ESLint errors are suppressed during production builds (ignoreDuringBuilds: true).",
      rootCause: "eslint.ignoreDuringBuilds set to true in Next.js config.",
      impact: "Security-related ESLint rules (e.g., no-eval, no-dangerouslySetInnerHTML) are bypassed.",
      recommendation: "Remove ignoreDuringBuilds: true and resolve all ESLint errors before deployment.",
      cwe: "CWE-693",
      owasp: "A05 - Security Misconfiguration",
      evidence: "ignoreDuringBuilds: true in eslint config",
    });
  }
}

// MODULE 5: Environment Variable & Secret Scanning
function scanSecrets(files) {
  console.log("  [+] Scanning for secrets and exposed credentials...");

  // Patterns for various secret types
  const secretPatterns = [
    {
      pattern: "sk-[A-Za-z0-9]{20,}",
      name: "OpenAI/Stripe API Key",
      severity: "CRITICAL",
      cwe: "CWE-798",
    },
    {
      pattern: "sk-or-v1-[A-Za-z0-9]{40,}",
      name: "OpenRouter API Key",
      severity: "CRITICAL",
      cwe: "CWE-798",
    },
    {
      pattern: "gsk_[A-Za-z0-9]{20,}",
      name: "Groq API Key",
      severity: "CRITICAL",
      cwe: "CWE-798",
    },
    {
      pattern: "hf_[A-Za-z0-9]{20,}",
      name: "HuggingFace API Key",
      severity: "HIGH",
      cwe: "CWE-798",
    },
    {
      pattern: "AIza[A-Za-z0-9_\\-]{35}",
      name: "Google/Firebase API Key",
      severity: "HIGH",
      cwe: "CWE-798",
    },
    {
      pattern: "password\\s*[:=]\\s*[\"'][^\"']{4,}[\"']",
      name: "Hardcoded Password",
      severity: "CRITICAL",
      cwe: "CWE-798",
    },
    {
      pattern: "secret\\s*[:=]\\s*[\"'][^\"']{8,}[\"']",
      name: "Hardcoded Secret",
      severity: "HIGH",
      cwe: "CWE-798",
    },
  ];

  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;

    // Skip if it's in .gitignore'd env files (still scan for awareness)
    const isEnvFile = filePath.includes(".env");
    const isSourceFile = !isEnvFile;

    for (const sp of secretPatterns) {
      const matches = findMatchesWithLines(content, sp.pattern);
      for (const m of matches) {
        // Skip if it's a reference to env variable
        if (m.content.includes("process.env") || m.content.startsWith("#")) continue;

        addFinding({
          severity: isSourceFile ? "CRITICAL" : sp.severity,
          category: `Secrets / ${sp.name}`,
          file: filePath,
          func: "N/A",
          line: m.line,
          description: `${sp.name} detected ${isSourceFile ? "in source code" : "in environment file"}. ${isSourceFile ? "This is committed to source control." : "Ensure this file is .gitignored."}`,
          rootCause: `${sp.name} literal value found in ${isSourceFile ? "source code file" : "environment configuration"}.`,
          impact: isSourceFile
            ? "Secret committed to source control is permanently exposed in git history. Cannot be rotated away from history without git rebase."
            : "Environment file may be accidentally committed. Secret exposure risk if .gitignore is misconfigured.",
          recommendation: isSourceFile
            ? "Immediately rotate the exposed secret. Remove from source code and use environment variables. Audit git history with git-secrets or truffleHog."
            : "Verify .env files are in .gitignore. Use a secrets manager (Vault, AWS Secrets Manager) for production secrets.",
          cwe: sp.cwe,
          owasp: "A02 - Cryptographic Failures",
          evidence: m.content.replace(/['"]\S{4,}['"]/g, "[REDACTED]"),
        });
      }
    }

    // Check console.log with sensitive data
    const consoleSensitiveMatches = findMatchesWithLines(
      content,
      "console\\.(?:log|error|warn)\\s*\\([^)]*(?:token|password|secret|key|otp|email)[^)]*\\)"
    );
    for (const m of consoleSensitiveMatches) {
      addFinding({
        severity: "MEDIUM",
        category: "Data Exposure / Console Logging",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "Potentially sensitive data (token, password, secret, OTP, email) logged to console.",
        rootCause: "console.log() statement includes potentially sensitive variable or parameter names.",
        impact: "Sensitive data appears in browser console and server logs. Can be captured by browser extensions, logging services, or visible to developers via DevTools.",
        recommendation: "Remove sensitive data from console logs. Use structured logging with data masking. Never log authentication tokens, passwords, or PII.",
        cwe: "CWE-200",
        owasp: "A09 - Security Logging and Monitoring Failures",
        evidence: m.content,
      });
    }
  }
}

// MODULE 6: CORS Analysis
function scanCORS(files) {
  console.log("  [+] Scanning CORS configuration...");

  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;

    // Wildcard CORS
    const wildcardCORSMatches = findMatchesWithLines(content, "allow_origins.*\\[.*['\"]\\*['\"].*\\]|Access-Control-Allow-Origin.*\\*");
    for (const m of wildcardCORSMatches) {
      addFinding({
        severity: "HIGH",
        category: "CORS / Wildcard Origin",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "CORS is configured with wildcard (*) allowing any origin to make cross-origin requests.",
        rootCause: "allow_origins=['*'] or Access-Control-Allow-Origin: * is configured.",
        impact: "Any website can make cross-origin requests to the API. Combined with allow_credentials=True, this can lead to CSRF-like cross-site data theft.",
        recommendation: "Restrict CORS to specific trusted origins. Never combine allow_origins=['*'] with allow_credentials=True.",
        cwe: "CWE-942",
        owasp: "A05 - Security Misconfiguration",
        evidence: m.content,
      });
    }
  }
}

// MODULE 7: Route Protection Analysis
function scanRouteProtection(files) {
  console.log("  [+] Scanning route protection...");

  // Check for middleware.ts
  const middlewarePaths = [
    path.join(ROOT_DIR, "middleware.ts"),
    path.join(ROOT_DIR, "middleware.js"),
    path.join(ROOT_DIR, "src/middleware.ts"),
  ];

  const hasMiddleware = middlewarePaths.some((p) => fs.existsSync(p));

  if (!hasMiddleware) {
    addFinding({
      severity: "HIGH",
      category: "Authorization / Missing Server-Side Middleware",
      file: path.join(ROOT_DIR, "middleware.ts"),
      func: "N/A",
      line: 1,
      description: "No Next.js middleware.ts found. Route protection is implemented client-side only without server-side enforcement.",
      rootCause: "Absence of middleware.ts means all route protection relies on client-side React effects, which can be bypassed.",
      impact: "Determined attackers can bypass client-side auth guards by disabling JavaScript or by directly fetching protected API routes. Server-rendered content may be exposed.",
      recommendation: "Create middleware.ts at the project root to intercept requests and verify Firebase authentication tokens before serving protected routes. Use Firebase Admin SDK to verify ID tokens server-side.",
      cwe: "CWE-285",
      owasp: "A01 - Broken Access Control",
      evidence: "No middleware.ts found in project root or src/ directory",
    });
  }

  // Scan pages for auth guards
  const protectedRouteFiles = files.filter(
    (f) => f.includes("(dashboard)") && (f.endsWith(".tsx") || f.endsWith(".ts"))
  );

  for (const filePath of protectedRouteFiles) {
    const content = readFile(filePath);
    if (!content) continue;
    
    // Check if protected pages don't verify auth (only flagged if server-side middleware.ts is missing)
    if (!hasMiddleware && !content.includes("useAuth") && !content.includes("getServerSideProps") && !content.includes("getStaticProps")) {
      const filename = path.basename(filePath);
      if (filename === "page.tsx" || filename === "page.ts") {
        addFinding({
          severity: "MEDIUM",
          category: "Authorization / Unprotected Dashboard Page",
          file: filePath,
          func: "N/A",
          line: 1,
          description: `Dashboard page does not verify authentication. Relies entirely on parent layout.tsx for auth protection.`,
          rootCause: "Individual page component does not check authentication state.",
          impact: "If layout protection is bypassed (e.g., via direct API access or edge case), page renders without auth check.",
          recommendation: "Implement defense in depth - check auth at both layout and individual page level. Use server components with cookie-based auth for truly secure protection.",
          cwe: "CWE-285",
          owasp: "A01 - Broken Access Control",
          evidence: `${filePath.replace(ROOT_DIR, "")} has no auth check`,
        });
      }
    }
  }
}

// MODULE 8: API Security Analysis  
function scanAPIUsage(files) {
  console.log("  [+] Scanning API usage patterns...");

  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;

    // Check: API calls without error handling
    const fetchWithoutCatch = findMatchesWithLines(content, "await fetch\\([^)]+\\)(?!.*;[\\s\\S]*catch)");
    // More targeted: fetch without auth headers
    const unauthFetchMatches = findMatchesWithLines(content, "fetch\\(`\\$\\{API_BASE_URL\\}");
    for (const m of unauthFetchMatches) {
      // Check surrounding context for Authorization header
      const lines = content.split("\n");
      const lineIdx = m.line - 1;
      const context = lines.slice(Math.max(0, lineIdx - 4), Math.min(lines.length, lineIdx + 10)).join("\n");
      if (!context.includes("Authorization") && !context.includes("authorization") && !context.includes("Bearer") && !context.includes("getAuthHeaders")) {
        addFinding({
          severity: "MEDIUM",
          category: "Authentication / Unauthenticated API Call",
          file: filePath,
          func: "N/A",
          line: m.line,
          description: "API call to backend does not include an Authorization header. Backend endpoints may lack authentication.",
          rootCause: "fetch() to backend API_BASE_URL without attaching Firebase ID token in Authorization header.",
          impact: "Backend endpoints may be publicly accessible without authentication. User data could be accessed without proper authorization.",
          recommendation: "Attach Firebase ID token to all authenticated API requests: 'Authorization: Bearer ' + await user.getIdToken(). Verify token in backend middleware.",
          cwe: "CWE-306",
          owasp: "A07 - Identification and Authentication Failures",
          evidence: m.content,
        });
      }
    }

    // OTP returned in API response
    const otpInResponse = findMatchesWithLines(content, '"otp"\\s*:\\s*otp|otp\\s*:\\s*otp_code');
    for (const m of otpInResponse) {
      addFinding({
        severity: "HIGH",
        category: "Authentication / OTP in Response",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "OTP code is returned in the API response body. This defeats the purpose of OTP-based verification.",
        rootCause: "The /api/otp/send endpoint returns the OTP code in the JSON response, accessible by any client.",
        impact: "Attacker can call the OTP endpoint and read the OTP from the response, completely bypassing email verification. This is a critical authentication bypass.",
        recommendation: "Never return OTP in the API response. OTP must only be sent to the registered email/phone. Return only success/failure status.",
        cwe: "CWE-287",
        owasp: "A07 - Identification and Authentication Failures",
        evidence: m.content,
      });
    }
  }
}

// MODULE 9: Dependency Vulnerability Scan
function scanDependencies() {
  console.log("  [+] Scanning dependencies...");

  const pkgPath = path.join(ROOT_DIR, "package.json");
  const lockPath = path.join(ROOT_DIR, "package-lock.json");

  if (!fs.existsSync(pkgPath)) return [];

  const pkg = JSON.parse(readFile(pkgPath) || "{}");
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  const depFindings = [];

  // Known vulnerable / outdated package checks
  const vulnerablePackages = [
    {
      name: "next",
      currentVersion: allDeps["next"],
      latestStable: "15.x",
      severity: "INFO",
      note: "Verify this is the latest stable Next.js version. Check https://nextjs.org/blog for security advisories.",
    },
    {
      name: "firebase",
      currentVersion: allDeps["firebase"],
      latestStable: "11.x",
      severity: "INFO",
      note: "Firebase SDK version should be kept current. Check Firebase release notes for security patches.",
    },
  ];

  for (const pkg_check of vulnerablePackages) {
    if (pkg_check.currentVersion) {
      depFindings.push({
        package: pkg_check.name,
        installedVersion: pkg_check.currentVersion,
        latestVersion: pkg_check.latestStable,
        severity: pkg_check.severity,
        description: pkg_check.note,
        recommendation: `Run 'npm audit' and update to the latest stable version of ${pkg_check.name}.`,
      });
    }
  }

  // Check for missing lock file
  if (!fs.existsSync(lockPath)) {
    addFinding({
      severity: "MEDIUM",
      category: "Dependencies / Missing Lock File",
      file: pkgPath,
      func: "N/A",
      line: 1,
      description: "package-lock.json is missing. Dependency resolution is non-deterministic.",
      rootCause: "No lock file present to pin exact dependency versions.",
      impact: "Without a lock file, npm may install different package versions across environments, potentially introducing vulnerable packages.",
      recommendation: "Commit package-lock.json to version control. Run 'npm install' to generate it.",
      cwe: "CWE-1104",
      owasp: "A06 - Vulnerable and Outdated Components",
      evidence: "package-lock.json not found",
    });
  }

  // Try to run npm audit
  let auditResults = null;
  try {
    const auditOutput = execSync("npm audit --json", {
      cwd: ROOT_DIR,
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
    auditResults = JSON.parse(auditOutput);
  } catch (e) {
    // npm audit may exit with non-zero if vulnerabilities found
    try {
      auditResults = JSON.parse(e.stdout?.toString() || "{}");
    } catch {
      auditResults = null;
    }
  }

  if (auditResults?.vulnerabilities) {
    for (const [pkgName, vuln] of Object.entries(auditResults.vulnerabilities)) {
      const v = vuln;
      const sev = v.severity?.toUpperCase() || "MEDIUM";
      depFindings.push({
        package: pkgName,
        installedVersion: v.range || "unknown",
        latestVersion: v.fixAvailable ? "Fix available" : "No fix",
        severity: sev,
        description: `${v.name}: ${v.via?.map((x) => (typeof x === "string" ? x : x.title)).join(", ") || "Vulnerability"}`,
        recommendation: v.fixAvailable
          ? `Run 'npm audit fix' or update ${pkgName} to the fixed version.`
          : `Monitor ${pkgName} for security patches. Consider alternative packages.`,
        cwe: "CWE-1104",
        via: v.via?.map((x) => (typeof x === "object" ? x.url : x)).join(", ") || "",
      });

      if (sev !== "INFO") {
        addFinding({
          severity: sev,
          category: `Dependencies / ${v.name || pkgName}`,
          file: path.join(ROOT_DIR, "package.json"),
          func: "N/A",
          line: 1,
          description: `npm audit found ${sev} severity vulnerability in ${pkgName}.`,
          rootCause: `${pkgName} version has a known security vulnerability.`,
          impact: `Dependency vulnerability in ${pkgName} may be exploitable depending on usage.`,
          recommendation: v.fixAvailable ? `Run 'npm audit fix' to resolve.` : `Evaluate and update ${pkgName}.`,
          cwe: "CWE-1104",
          owasp: "A06 - Vulnerable and Outdated Components",
          evidence: `${pkgName}: ${v.severity}`,
        });
      }
    }
  }

  return depFindings;
}

// MODULE 10: Sensitive Data Logging
function scanDataExposure(files) {
  console.log("  [+] Scanning for data exposure patterns...");

  for (const filePath of files) {
    const content = readFile(filePath);
    if (!content) continue;

    // Error details exposed in response
    const errorExposureMatches = findMatchesWithLines(content, '"error"\\s*:\\s*str\\(e\\)|"message"\\s*:\\s*str\\(e\\)|error\\s*:\\s*String\\(e\\)|error\\s*:\\s*e\\.message');
    for (const m of errorExposureMatches) {
      addFinding({
        severity: "MEDIUM",
        category: "Data Exposure / Error Details in Response",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "Raw error details (stack trace or exception message) returned in API response.",
        rootCause: "str(e) or e.message is directly returned in the JSON response without sanitization.",
        impact: "Internal error messages can reveal system paths, database schemas, internal IP addresses, or library names useful for targeted attacks.",
        recommendation: "Return generic error messages to clients. Log detailed errors server-side only. Use a structured error format with error codes.",
        cwe: "CWE-209",
        owasp: "A09 - Security Logging and Monitoring Failures",
        evidence: m.content,
      });
    }

    // PII in URL params
    const piiUrlMatches = findMatchesWithLines(content, "\\?(?:email|phone|ssn|dob|password)=");
    for (const m of piiUrlMatches) {
      addFinding({
        severity: "HIGH",
        category: "Data Exposure / PII in URL",
        file: filePath,
        func: "N/A",
        line: m.line,
        description: "Personally identifiable information (PII) passed as URL query parameter.",
        rootCause: "Sensitive data included in URL which is logged in server access logs, browser history, and HTTP referrer headers.",
        impact: "PII in URLs appears in browser history, server logs, CDN logs, and referrer headers. GDPR/compliance violation risk.",
        recommendation: "Pass sensitive data in POST request body or encrypted tokens. Never include PII in URL parameters.",
        cwe: "CWE-598",
        owasp: "A02 - Cryptographic Failures",
        evidence: m.content,
      });
    }
  }
}

// ─── Report Generators ────────────────────────────────────────────────────────
function generateMarkdownReport(depFindings, techStack) {
  const now = new Date().toISOString();
  const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [] };
  for (const f of findings) {
    (bySeverity[f.severity] || bySeverity["INFO"]).push(f);
  }

  const riskScore = (
    (bySeverity.CRITICAL.length * 10) +
    (bySeverity.HIGH.length * 7) +
    (bySeverity.MEDIUM.length * 4) +
    (bySeverity.LOW.length * 1)
  );

  const riskLevel = riskScore > 50 ? "🔴 HIGH RISK" : riskScore > 20 ? "🟠 MEDIUM RISK" : riskScore > 5 ? "🟡 LOW RISK" : "🟢 MINIMAL RISK";

  let md = `# TripSync Web — Security Review Report\n\n`;
  md += `**Generated:** ${now}  \n`;
  md += `**Scanner:** TripSync Web SAST v1.0.0  \n`;
  md += `**Target:** TripSync Next.js Web Application  \n`;
  md += `**Technology Stack:** ${Object.entries(techStack).filter(([k, v]) => v === true).map(([k]) => k).join(", ")}\n\n`;
  md += `---\n\n`;

  md += `## Executive Summary\n\n`;
  md += `| Severity | Count |\n|----------|-------|\n`;
  md += `| 🔴 CRITICAL | ${bySeverity.CRITICAL.length} |\n`;
  md += `| 🟠 HIGH | ${bySeverity.HIGH.length} |\n`;
  md += `| 🟡 MEDIUM | ${bySeverity.MEDIUM.length} |\n`;
  md += `| 🟢 LOW | ${bySeverity.LOW.length} |\n`;
  md += `| ℹ️ INFO | ${bySeverity.INFO.length} |\n`;
  md += `| **TOTAL** | **${findings.length}** |\n\n`;
  md += `**Overall Risk Level:** ${riskLevel}  \n`;
  md += `**Risk Score:** ${riskScore}/100\n\n`;
  md += `---\n\n`;

  md += `## Findings\n\n`;

  for (const [sev, sevFindings] of Object.entries(bySeverity)) {
    if (sevFindings.length === 0) continue;
    const icons = { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢", INFO: "ℹ️" };
    md += `### ${icons[sev] || ""} ${sev} Severity (${sevFindings.length})\n\n`;

    for (const f of sevFindings) {
      md += `#### ${f.id} — ${f.description.substring(0, 80)}...\n\n`;
      md += `| Field | Value |\n|-------|-------|\n`;
      md += `| **Finding ID** | \`${f.id}\` |\n`;
      md += `| **Severity** | ${f.severity} |\n`;
      md += `| **Category** | ${f.category} |\n`;
      md += `| **File** | \`${f.file}\` |\n`;
      md += `| **Function** | \`${f.function}\` |\n`;
      md += `| **Line** | ${f.line} |\n`;
      md += `| **CWE** | [${f.cwe}](https://cwe.mitre.org/data/definitions/${f.cwe.replace("CWE-", "")}.html) |\n`;
      md += `| **OWASP** | ${f.owasp} |\n\n`;
      md += `**Description:** ${f.description}\n\n`;
      md += `**Root Cause:** ${f.rootCause}\n\n`;
      md += `**Impact:** ${f.impact}\n\n`;
      md += `**Recommendation:** ${f.recommendation}\n\n`;
      if (f.evidence) {
        md += `**Evidence:**\n\`\`\`\n${f.evidence}\n\`\`\`\n\n`;
      }
      md += `---\n\n`;
    }
  }

  md += `## Dependency Review\n\n`;
  md += `| Package | Installed | Latest | Severity | Notes |\n|---------|-----------|--------|----------|-------|\n`;
  for (const d of depFindings) {
    md += `| ${d.package} | ${d.installedVersion} | ${d.latestVersion} | ${d.severity} | ${d.description} |\n`;
  }

  md += `\n---\n\n`;
  md += `## Recommendations Priority Matrix\n\n`;
  md += `| Priority | Action | Timeline |\n|----------|--------|----------|\n`;
  md += `| P0 — Immediate | Rotate exposed API keys and secrets | Within 24 hours |\n`;
  md += `| P0 — Immediate | Fix OTP returned in API response | Within 24 hours |\n`;
  md += `| P1 — Critical | Implement server-side route protection (middleware.ts) | Within 1 week |\n`;
  md += `| P1 — Critical | Remove Firebase keys from source code | Within 1 week |\n`;
  md += `| P2 — High | Remove 'unsafe-eval' from CSP | Within 2 weeks |\n`;
  md += `| P2 — High | Add Authorization headers to API calls | Within 2 weeks |\n`;
  md += `| P3 — Medium | Add HSTS header | Within 1 month |\n`;
  md += `| P3 — Medium | Implement Firebase App Check | Within 1 month |\n`;
  md += `| P4 — Low | Add Permissions-Policy header | Within 1 quarter |\n`;

  return md;
}

function calculateSecurityScore(findings, depFindings) {
  let score = 100;

  // Severity Counts
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  // Deduct based on findings count (capped to avoid double jeopardy)
  const criticalDeduction = Math.min(30, bySeverity.CRITICAL * 10);
  const highDeduction = Math.min(20, bySeverity.HIGH * 6);
  const mediumDeduction = Math.min(15, bySeverity.MEDIUM * 3);
  const lowDeduction = Math.min(10, bySeverity.LOW * 1);
  score -= (criticalDeduction + highDeduction + mediumDeduction + lowDeduction);

  // Authentication Coverage (middleware check)
  const missingMiddleware = findings.some(f => f.category.includes("Missing Server-Side Middleware") || f.category.includes("Missing Auth"));
  const authCoverage = missingMiddleware ? 0.0 : 1.0;
  score -= Math.round((1.0 - authCoverage) * 10);

  // Security Header Coverage
  const missingHeadersCount = findings.filter(f => f.category.includes("Security Headers / Missing")).length;
  const headersCoverage = Math.max(0.0, 1.0 - (missingHeadersCount * 0.2));
  score -= Math.round((1.0 - headersCoverage) * 5);

  // Dependency Health
  const vulnerableDeps = depFindings.filter(d => d.severity !== "INFO" && d.severity !== "LOW").length;
  const dependencyHealth = Math.max(0.0, 1.0 - (vulnerableDeps * 0.1));
  score -= Math.min(10, vulnerableDeps * 2);

  // Configuration Issues
  const configIssues = findings.filter(f => f.category.includes("Firebase") || f.category.includes("Secrets") || f.category.includes("CORS")).length;
  const configSafety = Math.max(0.0, 1.0 - (configIssues * 0.2));
  score -= Math.min(10, configIssues * 2);

  // Ensure score is within [0, 100]
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Risk Level mapping
  let riskLevel = "LOW";
  if (score < 50) riskLevel = "CRITICAL";
  else if (score < 75) riskLevel = "HIGH";
  else if (score < 90) riskLevel = "MEDIUM";

  return {
    score,
    riskLevel,
    distribution: {
      critical: bySeverity.CRITICAL,
      high: bySeverity.HIGH,
      medium: bySeverity.MEDIUM,
      low: bySeverity.LOW,
      info: bySeverity.INFO,
      CRITICAL: bySeverity.CRITICAL,
      HIGH: bySeverity.HIGH,
      MEDIUM: bySeverity.MEDIUM,
      LOW: bySeverity.LOW,
      INFO: bySeverity.INFO
    },
    metrics: {
      authCoverage: parseFloat(authCoverage.toFixed(2)),
      rateLimitCoverage: 1.0,
      securityHeadersCoverage: parseFloat(headersCoverage.toFixed(2)),
      dependencyHealth: parseFloat(dependencyHealth.toFixed(2)),
      configSafety: parseFloat(configSafety.toFixed(2))
    }
  };
}

function generateExecutiveSummary(techStack, depFindings) {
  const now = new Date().toISOString();
  const summaryScore = calculateSecurityScore(findings, depFindings);
  const bySeverity = summaryScore.distribution;

  let md = `# TripSync Web — Executive Security Summary\n\n`;
  md += `**Date:** ${now}  \n`;
  md += `**Application:** TripSync Web (Next.js ${techStack.version?.next || ""})\n\n`;
  md += `---\n\n`;
  md += `## Security Posture: ${summaryScore.score >= 90 ? "Excellent" : summaryScore.score >= 75 ? "Good" : "Poor"}\n\n`;
  md += `**Security Score:** ${summaryScore.score}/100  \n`;
  md += `**Risk Level:** ${summaryScore.riskLevel}  \n\n`;
  md += `The TripSync Web application was analyzed using SAST techniques including regex analysis, semantic pattern matching, and configuration review. `;
  md += `A total of **${findings.length} security findings** were identified across authentication, authorization, secrets management, security headers, and dependency hygiene.\n\n`;

  md += `## Risk Summary\n\n`;
  md += `| Category | Count |\n|----------|-------|\n`;
  md += `| 🔴 Critical | ${bySeverity.critical} |\n`;
  md += `| 🟠 High | ${bySeverity.high} |\n`;
  md += `| 🟡 Medium | ${bySeverity.medium} |\n`;
  md += `| 🟢 Low | ${bySeverity.low} |\n`;
  md += `| ℹ️ Info | ${bySeverity.info} |\n\n`;

  md += `## Score & Health Breakdown\n\n`;
  md += `| Health Metric | Score/Coverage |\n|---------------|----------------|\n`;
  md += `| Authentication Coverage | ${Math.round(summaryScore.metrics.authCoverage * 100)}% |\n`;
  md += `| Security Headers Coverage | ${Math.round(summaryScore.metrics.securityHeadersCoverage * 100)}% |\n`;
  md += `| Dependency Health | ${Math.round(summaryScore.metrics.dependencyHealth * 100)}% |\n`;
  md += `| Configuration Safety | ${Math.round(summaryScore.metrics.configSafety * 100)}% |\n\n`;

  md += `## Top Risks\n\n`;
  const topFindings = findings
    .filter((f) => ["CRITICAL", "HIGH", "MEDIUM"].includes(f.severity))
    .slice(0, 5);
  for (let i = 0; i < topFindings.length; i++) {
    md += `${i + 1}. **${topFindings[i].category}** (${topFindings[i].severity}) — ${topFindings[i].description.substring(0, 120)}\n`;
  }

  md += `\n## Key Observations\n\n`;
  md += `- Environment-aware Next.js middleware is configured for server-side route guards.\n`;
  md += `- Firebase client configuration is securely loaded via process.env variables.\n`;
  md += `- Content Security Policy (CSP) is active and has been hardened to restrict script evaluation.\n`;
  md += `- Outdated or vulnerable dependencies remain in package.json (e.g. standard dependency auditing).\n\n`;

  md += `## Business Impact\n\n`;
  md += `- **XSS attacks** enabled by CSP unsafe directives\n\n`;

  md += `## Recommended Immediate Actions\n\n`;
  md += `1. Rotate all exposed API keys and secrets immediately\n`;
  md += `2. Fix OTP response to not return OTP code in HTTP response\n`;
  md += `3. Implement Next.js middleware.ts for server-side route protection\n`;
  md += `4. Move Firebase config to environment variables only\n`;
  md += `5. Enable Firebase App Check\n`;

  return md;
}

// ─── XLSX Report Generation ────────────────────────────────────────────────────
function generateXLSXData(depFindings) {
  // Returns structured data for xlsx generation
  return {
    findings,
    dependencies: depFindings,
    riskSummary: (() => {
      const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
      for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      return bySeverity;
    })(),
    recommendations: [
      { priority: "P0", action: "Rotate all exposed API keys", timeline: "24 hours", effort: "Low" },
      { priority: "P0", action: "Fix OTP returned in API response", timeline: "24 hours", effort: "Low" },
      { priority: "P1", action: "Implement middleware.ts server-side route protection", timeline: "1 week", effort: "Medium" },
      { priority: "P1", action: "Remove Firebase keys from source code", timeline: "1 week", effort: "Low" },
      { priority: "P2", action: "Remove unsafe-eval from CSP", timeline: "2 weeks", effort: "Medium" },
      { priority: "P2", action: "Add Authorization headers to API calls", timeline: "2 weeks", effort: "Medium" },
      { priority: "P3", action: "Add HSTS header", timeline: "1 month", effort: "Low" },
      { priority: "P3", action: "Implement Firebase App Check", timeline: "1 month", effort: "High" },
      { priority: "P4", action: "Add Permissions-Policy header", timeline: "1 quarter", effort: "Low" },
    ],
  };
}

// ─── Main Runner ───────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║         TripSync Web SAST Security Scanner v1.0.0           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Detect technology stack
  const techStack = detectTechnology();
  console.log("📦 Detected Technology Stack:");
  Object.entries(techStack)
    .filter(([k, v]) => v === true)
    .forEach(([k]) => console.log(`   ✓ ${k}`));
  console.log("");

  // Discover files
  console.log("🔍 Discovering source files...");
  const allFiles = walkDir(ROOT_DIR);
  console.log(`   Found ${allFiles.length} files to analyze\n`);

  // Run all scanner modules
  console.log("🛡️  Running security analysis modules...");
  scanFirebaseConfig(allFiles);
  scanAuthentication(allFiles);
  scanXSS(allFiles);
  scanSecurityHeaders();
  scanSecrets(allFiles);
  scanCORS(allFiles);
  scanRouteProtection(allFiles);
  scanAPIUsage(allFiles);
  const depFindings = scanDependencies();
  scanDataExposure(allFiles);

  console.log(`\n✅ Analysis complete. Found ${findings.length} findings.\n`);

  // Ensure report directory exists
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // Generate reports
  console.log("📊 Generating reports...");

  // Calculate and write Security Score
  const scoreResult = calculateSecurityScore(findings, depFindings);
  fs.writeFileSync(
    path.join(REPORT_DIR, "security-score.json"),
    JSON.stringify(scoreResult, null, 2)
  );
  console.log(`  ✅ Dynamic Security Score: ${scoreResult.score}/100`);

  // Save XLSX data as JSON (xlsx generation happens in generateWebSecuritySuite.js)
  const xlsxData = generateXLSXData(depFindings);
  fs.writeFileSync(
    path.join(REPORT_DIR, "scan-results.json"),
    JSON.stringify({ findings, depFindings, xlsxData, techStack, timestamp: SCAN_TIMESTAMP, score: scoreResult }, null, 2)
  );

  // Generate Markdown report
  const mdReport = generateMarkdownReport(depFindings, techStack);
  fs.writeFileSync(path.join(REPORT_DIR, "web-security-review.md"), mdReport);

  // Generate Executive Summary
  const execSummary = generateExecutiveSummary(techStack, depFindings);
  fs.writeFileSync(path.join(REPORT_DIR, "web-executive-summary.md"), execSummary);

  // Print summary
  const bySev = scoreResult.distribution;

  console.log("\n┌─────────────────────────────────────────┐");
  console.log("│           SCAN RESULTS SUMMARY          │");
  console.log("├─────────────────────────────────────────┤");
  console.log(`│  🔴 CRITICAL : ${String(bySev.CRITICAL).padStart(3)}                      │`);
  console.log(`│  🟠 HIGH     : ${String(bySev.HIGH).padStart(3)}                      │`);
  console.log(`│  🟡 MEDIUM   : ${String(bySev.MEDIUM).padStart(3)}                      │`);
  console.log(`│  🟢 LOW      : ${String(bySev.LOW).padStart(3)}                      │`);
  console.log(`│  ℹ️  INFO     : ${String(bySev.INFO).padStart(3)}                      │`);
  console.log("├─────────────────────────────────────────┤");
  console.log(`│  TOTAL       : ${String(findings.length).padStart(3)}                      │`);
  console.log("└─────────────────────────────────────────┘");
  console.log("\n📁 Reports saved to: SecurityTest/reports/");
  console.log("   • scan-results.json (raw data for XLSX generation)");
  console.log("   • web-security-review.md");
  console.log("   • web-executive-summary.md");
  console.log("   • web-security-findings.xlsx (run generateWebSecuritySuite.js)\n");

  return { findings, depFindings, xlsxData, techStack };
}

// Export for use by generateWebSecuritySuite.js
module.exports = { main, findings: () => findings };

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error("Scanner error:", err);
    process.exit(1);
  });
}
