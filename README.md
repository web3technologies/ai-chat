User Chat App

Project Requirements:
  - Any number of users can exist.
  - Chats can be DMs or group chats, always containing a minimum of two users.
  - An AI agent is present in every chat.
  - Users may only access chats where they are members.
  - The agent should automatically decide whether it should respond to a user message.
  - The agent learns useful information about users and can use it in future conversations.
  - The agent is present in every chat, but should only answer when it is appropriate.

## Getting Started

First, run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```


1. Generate migrations for prisma: pnpm db:generate
2. pnpm build
3. pnpm start