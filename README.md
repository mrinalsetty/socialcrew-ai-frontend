# SocialCrew AI Frontend

Next.js frontend for **SocialCrew AI**, a human-first AI content studio where a small AI team collaborates with the user in a group-chat style interface.

This frontend is designed to feel like a real conversation with:

- a strategist,
- a creator,
- an analyst,
- and the user.

Instead of a plain chatbot or static dashboard, the app presents the experience as a polished team discussion with live suggestions, follow-up chat, post previews, and optional voice playback.

---

## What the frontend does

The frontend allows the user to:

- choose a platform
- enter one content idea
- start a human-style team conversation
- watch multiple AI teammates discuss strategy, creation, and analysis
- review 5 post suggestions
- see shared hashtags
- ask follow-up questions to one, multiple, or all agents
- replay the conversation with voice
- browse campaign history

---

## Core UX

The application is designed as a **group conversation** rather than a standard prompt-response interface.

### Team members in the UI

- **You**
- **Strategy agent**
- **Creator agent**
- **Analyst agent**

### Experience highlights

- user messages appear on the **left**
- agent messages appear on the **right**
- voice is **enabled by default**
- the conversation feels more like a WhatsApp / group-chat thread
- suggestions are shown as platform-themed preview cards
- the layout is responsive and mobile friendly

---

## Main Features

- **Next.js App Router frontend**
- **Dark neon visual theme**
- **Responsive layout**
- **Human-style group chat UI**
- **Voice playback using browser speech synthesis**
- **Backend live status badge**
- **Clickable backend status badge**
- **Follow-up messaging**
- **Campaign history**
- **Platform-specific suggestion previews**
- **Replay / stop voice controls**
- **Backend dashboard route**

---

## Supported Platforms

The frontend currently supports:

- LinkedIn
- YouTube
- Facebook
- X
- Instagram
- Threads

Each platform is displayed with its own visual preview style.

---

## Application Routes

### `/`

Main SocialCrew AI experience

This includes:

- platform picker
- topic input
- voice controls
- live team chat
- follow-up chat
- suggestions panel
- campaign history
- analyst snapshot

### `/backend`

Frontend backend dashboard page

This includes:

- backend status
- architecture summary
- stack details
- health info
- quick backend links
- wake-server action
- navigation back to the main app

---

## Tech Stack

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**

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
