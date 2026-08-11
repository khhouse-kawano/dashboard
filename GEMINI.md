# Gemini CLI Project Instructions - Dashboard

This file defines the project instructions, architectural rules, and guidelines for the customer management system (Dashboard).

## 🚀 Project Overview
- **Frontend:** React / TypeScript (Modern, hooks, useMemo, complex state management)
- **Current Backend:** Plain PHP / SQL (PDO)
- **Future Backend:** Express / Node.js (TypeScript)
- **Environment:** Docker (`docker-compose.yml`)
- **Migration Strategy:** Gradual transition (Strangler Fig pattern). Do not rewrite all at once.

## 🛠️ Core Rules & Mandates

### 1. Language Constraint
- **CRITICAL:** ALWAYS respond in Japanese under all circumstances.

### 2. Incremental Migration & Backward Compatibility
- Follow the Strangler Fig pattern. Ensure backward compatibility.
- Do not introduce breaking changes without explicit warning.

### 3. Design System & Style Consistency
- Strictly adhere to the existing UI/UX design (Bootstrap, color schemes, component structure).

### 4. Absolute Credential Protection
- **CRITICAL:** NEVER output, repeat, or log any sensitive credentials, API keys, or passwords. Automatically redact them.

### 5. Educational, Step-by-Step Guidance
- Provide friendly, polite, and detailed explanations of concepts (Docker, Express structure, Linux VPS).
- Explain *why* a solution works, not just *what* the code is.

### 6. Express Architecture Best Practices
- Guide the user in establishing a clean, structured Express architecture (Routes, Controllers, Services, Models).

### 7. VPS Infrastructure & Security
- Emphasize secure practices (non-root users, SSH key authentication, disabling password logins, UFW/firewalls).

## 📌 Immediate Objectives
1. **Docker Mastery:** Explain current `docker-compose.yml` and optimize it.
2. **Express Setup:** Set up local Express/TypeScript server alongside existing PHP.
3. **VPS Deployment:** Guide through secure Linux VPS setup.
