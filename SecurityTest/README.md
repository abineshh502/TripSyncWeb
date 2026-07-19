# TripSync Web — Security Test Module

## Overview

This module provides production-ready **Static Application Security Testing (SAST)** for the TripSync Next.js web application. It uses a hybrid analysis pipeline (Semantic → Regex) to detect real security vulnerabilities traced directly to source code.

## Structure

```
SecurityTest/
├── config/
│   └── security-rules.json     # Scanner rules, OWASP/CWE mappings
├── scripts/
│   ├── webScanner.js           # Core SAST engine (10 analysis modules)
│   └── generateWebSecuritySuite.js  # Report orchestrator (XLSX + Markdown)
├── reports/
│   ├── web-security-findings.xlsx   # Excel workbook (4 sheets)
│   ├── web-security-review.md       # Detailed findings report
│   ├── web-executive-summary.md     # Management summary
│   └── scan-results.json            # Raw scan data
└── README.md
```

## Technology Detection

The scanner auto-detects:
- ✅ Next.js (detected via package.json)
- ✅ React
- ✅ TypeScript
- ✅ TailwindCSS
- ✅ Firebase (client SDK)
- ✅ Zod, React Hook Form

## Analysis Modules

| Module | Checks |
|--------|--------|
| **Firebase Security** | Hardcoded config, exposed API keys, missing App Check |
| **Authentication** | Token storage, JWT validation, session management |
| **Authorization** | Route protection, middleware, client-side-only guards |
| **XSS** | dangerouslySetInnerHTML, eval(), innerHTML assignment |
| **Security Headers** | CSP, HSTS, X-Frame-Options, Permissions-Policy |
| **Secrets** | API keys, passwords, tokens in source code |
| **CORS** | Wildcard origins, credentials with wildcard |
| **API Security** | Missing auth headers, OTP in response |
| **Dependencies** | npm audit integration, outdated packages |
| **Data Exposure** | Error leakage, PII in URLs, console logging |

## Running the Scanner

### Full Suite (Recommended)
```bash
# From TripSyncWeb directory
node SecurityTest/scripts/generateWebSecuritySuite.js
```

### Scanner Only
```bash
node SecurityTest/scripts/webScanner.js
```

### Install xlsx dependency (for Excel output)
```bash
npm install xlsx --save-dev
```

## Output Reports

### `web-security-findings.xlsx`
| Sheet | Contents |
|-------|----------|
| Security Findings | All findings with ID, severity, file, line, CWE, OWASP |
| Dependency Review | Package versions, vulnerability status |
| Risk Summary | Severity breakdown, category analysis, risk score |
| Recommendations | Prioritized action plan with timelines |

### `web-security-review.md`
Full findings report with evidence, root cause, impact, and recommendations.

### `web-executive-summary.md`
Management-level summary: risk posture, top risks, business impact.

## Finding Schema

Every finding contains:

| Field | Description |
|-------|-------------|
| Finding ID | Unique ID (WEB-XXXX) |
| Severity | CRITICAL / HIGH / MEDIUM / LOW / INFO |
| Category | Module/Sub-category |
| File | Relative path to affected file |
| Function | Affected function or component |
| Line | Line number |
| Description | Human-readable finding description |
| Root Cause | Technical root cause |
| Impact | Security impact |
| Recommendation | Specific remediation steps |
| CWE | CWE identifier |
| OWASP | OWASP Top 10 2021 mapping |
| Evidence | Code snippet (sanitized) |

## OWASP Top 10 Coverage

| ID | Category | Covered |
|----|----------|---------|
| A01 | Broken Access Control | ✅ |
| A02 | Cryptographic Failures | ✅ |
| A03 | Injection (XSS) | ✅ |
| A04 | Insecure Design | ✅ |
| A05 | Security Misconfiguration | ✅ |
| A06 | Vulnerable Components | ✅ |
| A07 | Auth Failures | ✅ |
| A08 | Software Integrity | ✅ |
| A09 | Logging Failures | ✅ |

## Isolation

This module is **completely isolated** from application source code:
- No imports from `src/`
- No modifications to application files
- Read-only file system access
- Separate `node_modules` not required (uses parent project's)

## CI/CD Integration

```yaml
# .github/workflows/security.yml
- name: Run Web Security Scan
  run: node TripSyncWeb/SecurityTest/scripts/generateWebSecuritySuite.js
  
- name: Upload Security Reports
  uses: actions/upload-artifact@v3
  with:
    name: web-security-reports
    path: TripSyncWeb/SecurityTest/reports/
```
