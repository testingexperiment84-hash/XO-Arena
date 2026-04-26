# 🔒 Security Policy

## Supported Versions

The following versions of **XO Arena** are currently receiving security updates:

| Version | Supported          |
|---------|--------------------|
| 1.1.1   | ✅ Actively supported |
| < 1.0   | ❌ No longer supported |

> We strongly recommend always running the latest stable release.

---

## 🚨 Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in XO Arena, **please do not open a public GitHub issue.** Public disclosure of security bugs puts all users at risk.

### How to Report

1. **Email us directly** at: `security@xo-arena.com`
   *(Replace with your actual security contact email)*

2. **Include the following in your report:**
   - A clear description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact or attack scenario
   - Any relevant screenshots, logs, or proof-of-concept code

3. **Encrypt sensitive reports** using our PGP key *(optional but appreciated for critical issues)*

### Response Timeline

| Stage                        | Timeframe         |
|------------------------------|-------------------|
| Acknowledgement of report    | Within **48 hours**   |
| Initial assessment           | Within **5 business days** |
| Patch or mitigation released | Within **30 days** (critical issues prioritized) |
| Public disclosure (coordinated) | After patch is live |

We follow **responsible disclosure** — we'll work with you to understand the issue and release a fix before any public announcement.

---

## 🛡️ Security Best Practices for Users

If you are self-hosting or forking XO Arena, please follow these guidelines:

- **Keep dependencies up to date** — run `npm audit` regularly and fix reported issues
- **Use HTTPS** in all production deployments
- **Do not expose development servers** (`npm run dev`) on public networks
- **Review environment variables** — never commit `.env` files or API keys to version control
- **Enable Content Security Policy (CSP)** headers on your server

---

## 🔍 Scope

The following are **in scope** for security reports:

- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Remote Code Execution (RCE)
- Authentication or session vulnerabilities (if applicable)
- Data exposure or leakage
- Dependency vulnerabilities with a known exploit path

The following are **out of scope:**

- Vulnerabilities in third-party services or CDN providers
- Issues that require physical access to a user's device
- Social engineering attacks
- Reports with no realistic attack vector
- Bugs that do not have a security impact (use the regular issue tracker instead)

---

## 🧰 Dependency Security

XO Arena uses automated tooling to monitor dependencies:

- **`npm audit`** — run locally to check for known vulnerabilities
- **Dependabot / Renovate** — automated pull requests for dependency updates *(if enabled in your repo)*

To manually audit:

```bash
npm audit
npm audit fix
```

For high-severity issues that can't be auto-fixed:

```bash
npm audit fix --force
```

> ⚠️ Review `--force` fixes carefully as they may include breaking changes.

---

## 🏅 Acknowledgements

We sincerely thank all security researchers and contributors who help keep XO Arena safe. Responsible disclosures will be credited in our release notes (with your permission).

---

## 📄 License

This security policy is part of the XO Arena project and is governed by the project's [MIT License](LICENSE).

---

<div align="center">
  🔐 <strong>Security is a shared responsibility.</strong> Thank you for helping keep XO Arena safe for everyone.
</div>
