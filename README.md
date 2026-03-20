# Draftly MVP

Web-based writing platform focused on proving human authorship through process data, not final-text analysis.

## Stack
- Frontend: React + TypeScript + Vite
- Editor: Slate.js
- Backend: Node.js + Express
- DB: PostgreSQL
- Auth: Email/password with JWT

## Structure
```
root/
├─ client/    # React + Slate editor
├─ server/    # Express API + auth + session storage
```

## Getting Started
1) `cd client && npm install` (or pnpm/yarn)  
2) `cd server && npm install`  
3) Run dev servers:
   - Client: `npm run dev`
   - Server: `npm run dev`

## MVP Focus
- Secure editor that captures writing sessions
- Event-based tracking (keyboard/clipboard) without raw keystroke logging
- Basic revision history and exportable proof report
