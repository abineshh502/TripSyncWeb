# TripSync Web — Security Review Report

**Generated:** 2026-07-19T17:28:16.115Z  
**Scanner:** TripSync Web SAST v1.0.0  
**Target:** TripSync Next.js Web Application  
**Technology Stack:** nextjs, react, typescript, tailwindcss, firebase, reactHookForm, zod, framerMotion

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 0 |
| 🟠 HIGH | 0 |
| 🟡 MEDIUM | 5 |
| 🟢 LOW | 0 |
| ℹ️ INFO | 2 |
| **TOTAL** | **7** |

**Overall Risk Level:** 🟡 LOW RISK  
**Risk Score:** 20/100

---

## Findings

### 🟡 MEDIUM Severity (5)

#### WEB-0001 — Route protection is implemented client-side only using useEffect. This creates a...

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0001` |
| **Severity** | MEDIUM |
| **Category** | Authorization / Client-Side Auth Guard |
| **File** | `/src/app/(dashboard)/layout.tsx` |
| **Function** | `DashboardLayout` |
| **Line** | 19 |
| **CWE** | [CWE-285](https://cwe.mitre.org/data/definitions/285.html) |
| **OWASP** | A01 - Broken Access Control |

**Description:** Route protection is implemented client-side only using useEffect. This creates a brief window where protected content may flash before redirect.

**Root Cause:** Authentication guard uses useEffect + router.push pattern which runs after initial render. A fast network or cached response could expose protected routes momentarily.

**Impact:** Protected page content may briefly flash to unauthenticated users. Does not provide true server-side protection. Search engine crawlers could index protected content.

**Recommendation:** Implement server-side auth using Next.js middleware (middleware.ts) to redirect unauthenticated users before any content is served. Use Firebase Admin to verify tokens in middleware.

**Evidence:**
```
useEffect-based auth guard in \src\app\(dashboard)\layout.tsx
```

---

#### WEB-0002 — Route protection is implemented client-side only using useEffect. This creates a...

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0002` |
| **Severity** | MEDIUM |
| **Category** | Authorization / Client-Side Auth Guard |
| **File** | `/src/app/(dashboard)/trips/[id]/page.tsx` |
| **Function** | `DashboardLayout` |
| **Line** | 63 |
| **CWE** | [CWE-285](https://cwe.mitre.org/data/definitions/285.html) |
| **OWASP** | A01 - Broken Access Control |

**Description:** Route protection is implemented client-side only using useEffect. This creates a brief window where protected content may flash before redirect.

**Root Cause:** Authentication guard uses useEffect + router.push pattern which runs after initial render. A fast network or cached response could expose protected routes momentarily.

**Impact:** Protected page content may briefly flash to unauthenticated users. Does not provide true server-side protection. Search engine crawlers could index protected content.

**Recommendation:** Implement server-side auth using Next.js middleware (middleware.ts) to redirect unauthenticated users before any content is served. Use Firebase Admin to verify tokens in middleware.

**Evidence:**
```
useEffect-based auth guard in \src\app\(dashboard)\trips\[id]\page.tsx
```

---

#### WEB-0003 — Content Security Policy includes 'unsafe-inline' which allows inline scripts and...

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0003` |
| **Severity** | MEDIUM |
| **Category** | Security Headers / CSP unsafe-inline |
| **File** | `/next.config.ts` |
| **Function** | `headers()` |
| **Line** | 39 |
| **CWE** | [CWE-693](https://cwe.mitre.org/data/definitions/693.html) |
| **OWASP** | A05 - Security Misconfiguration |

**Description:** Content Security Policy includes 'unsafe-inline' which allows inline scripts and styles.

**Root Cause:** CSP script-src or style-src contains 'unsafe-inline', weakening XSS protections.

**Impact:** Inline script injection is possible. Reduces effectiveness of CSP as an XSS mitigation layer.

**Recommendation:** Use nonce-based or hash-based CSP instead of 'unsafe-inline'. Implement Next.js nonce generation for inline scripts.

**Evidence:**
```
'unsafe-inline' found in Content-Security-Policy
```

---

#### WEB-0004 — API call to backend does not include an Authorization header. Backend endpoints ...

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0004` |
| **Severity** | MEDIUM |
| **Category** | Authentication / Unauthenticated API Call |
| **File** | `/src/services/api.ts` |
| **Function** | `N/A` |
| **Line** | 394 |
| **CWE** | [CWE-306](https://cwe.mitre.org/data/definitions/306.html) |
| **OWASP** | A07 - Identification and Authentication Failures |

**Description:** API call to backend does not include an Authorization header. Backend endpoints may lack authentication.

**Root Cause:** fetch() to backend API_BASE_URL without attaching Firebase ID token in Authorization header.

**Impact:** Backend endpoints may be publicly accessible without authentication. User data could be accessed without proper authorization.

**Recommendation:** Attach Firebase ID token to all authenticated API requests: 'Authorization: Bearer ' + await user.getIdToken(). Verify token in backend middleware.

**Evidence:**
```
const response = await fetch(`${API_BASE_URL}/otp/send`, {
```

---

#### WEB-0005 — API call to backend does not include an Authorization header. Backend endpoints ...

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0005` |
| **Severity** | MEDIUM |
| **Category** | Authentication / Unauthenticated API Call |
| **File** | `/src/services/api.ts` |
| **Function** | `N/A` |
| **Line** | 413 |
| **CWE** | [CWE-306](https://cwe.mitre.org/data/definitions/306.html) |
| **OWASP** | A07 - Identification and Authentication Failures |

**Description:** API call to backend does not include an Authorization header. Backend endpoints may lack authentication.

**Root Cause:** fetch() to backend API_BASE_URL without attaching Firebase ID token in Authorization header.

**Impact:** Backend endpoints may be publicly accessible without authentication. User data could be accessed without proper authorization.

**Recommendation:** Attach Firebase ID token to all authenticated API requests: 'Authorization: Bearer ' + await user.getIdToken(). Verify token in backend middleware.

**Evidence:**
```
const response = await fetch(`${API_BASE_URL}/otp/verify`, {
```

---

### ℹ️ INFO Severity (2)

#### WEB-0006 — npm audit found MODERATE severity vulnerability in next....

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0006` |
| **Severity** | MODERATE |
| **Category** | Dependencies / next |
| **File** | `/package.json` |
| **Function** | `N/A` |
| **Line** | 1 |
| **CWE** | [CWE-1104](https://cwe.mitre.org/data/definitions/1104.html) |
| **OWASP** | A06 - Vulnerable and Outdated Components |

**Description:** npm audit found MODERATE severity vulnerability in next.

**Root Cause:** next version has a known security vulnerability.

**Impact:** Dependency vulnerability in next may be exploitable depending on usage.

**Recommendation:** Run 'npm audit fix' to resolve.

**Evidence:**
```
next: moderate
```

---

#### WEB-0007 — npm audit found MODERATE severity vulnerability in postcss....

| Field | Value |
|-------|-------|
| **Finding ID** | `WEB-0007` |
| **Severity** | MODERATE |
| **Category** | Dependencies / postcss |
| **File** | `/package.json` |
| **Function** | `N/A` |
| **Line** | 1 |
| **CWE** | [CWE-1104](https://cwe.mitre.org/data/definitions/1104.html) |
| **OWASP** | A06 - Vulnerable and Outdated Components |

**Description:** npm audit found MODERATE severity vulnerability in postcss.

**Root Cause:** postcss version has a known security vulnerability.

**Impact:** Dependency vulnerability in postcss may be exploitable depending on usage.

**Recommendation:** Run 'npm audit fix' to resolve.

**Evidence:**
```
postcss: moderate
```

---

## Dependency Review

| Package | Installed | Latest | Severity | Notes |
|---------|-----------|--------|----------|-------|
| next | 16.2.9 | 15.x | INFO | Verify this is the latest stable Next.js version. Check https://nextjs.org/blog for security advisories. |
| firebase | ^12.14.0 | 11.x | INFO | Firebase SDK version should be kept current. Check Firebase release notes for security patches. |
| next | 9.3.4-canary.0 - 16.3.0-canary.5 | Fix available | MODERATE | next: postcss |
| postcss | <8.5.10 | Fix available | MODERATE | postcss: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output |

---

## Recommendations Priority Matrix

| Priority | Action | Timeline |
|----------|--------|----------|
| P0 — Immediate | Rotate exposed API keys and secrets | Within 24 hours |
| P0 — Immediate | Fix OTP returned in API response | Within 24 hours |
| P1 — Critical | Implement server-side route protection (middleware.ts) | Within 1 week |
| P1 — Critical | Remove Firebase keys from source code | Within 1 week |
| P2 — High | Remove 'unsafe-eval' from CSP | Within 2 weeks |
| P2 — High | Add Authorization headers to API calls | Within 2 weeks |
| P3 — Medium | Add HSTS header | Within 1 month |
| P3 — Medium | Implement Firebase App Check | Within 1 month |
| P4 — Low | Add Permissions-Policy header | Within 1 quarter |
