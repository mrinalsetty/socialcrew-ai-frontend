---

# SocialCrew AI Frontend

Next.js frontend for **SocialCrew AI**, a multi-agent social content workspace.

This frontend is designed to feel more like an **agentic product workspace** than a chatbot.

It currently includes:
- one main content input
- platform switching
- left sidebar history
- Enter-to-submit
- visible multi-agent workflow
- backend live status
- backend dashboard access

---

## Features

- **Next.js App Router frontend**
- **Dark neon UI**
- **Sidebar history** similar to ChatGPT-style navigation
- **Enter key submits generation**
- **Clickable backend status badge**
  - opens backend dashboard
- **Backend dashboard page** at `/backend`
- **Visible agent workflow**
  - Strategy Agent
  - Creator Agent
  - Analyst Agent
- **Platform-aware generation**
- **Responsive layout**

---

## Tech Stack

- **Next.js**
- **TypeScript**
- **Tailwind CSS**

---

## Main UX

This version is optimized for:

- founders
- personal brands
- small business operators

The main app keeps the workflow light:

- select a platform
- type a topic
- press Enter or click Generate
- review strategy, content options, and analyst recommendation

Instead of asking users to fill many fields every time, the frontend provides a more focused workflow and uses sensible defaults.

---

## Supported Platforms

The frontend supports generation for:

- LinkedIn
- YouTube
- Facebook
- X
- Instagram
- Threads

---

## Routes

### `/`

Main app

Includes:

- platform selector
- topic input
- sidebar history
- agent workflow panel
- strategy section
- creator section
- analyst section

### `/backend`

Backend dashboard page

Includes:

- backend online/offline status
- service info
- architecture
- stack
- model info
- health JSON
- **Wake Up Server** button
- link back to the main app

---

## Project Structure

```text
app/
  page.tsx
  backend/
    page.tsx

lib/
  api.ts

types/
  index.ts
```
