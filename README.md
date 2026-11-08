# User Chat App

## Project requirements

- Any number of users can exist.
- Chats can be DMs or group chats, always containing a minimum of two users.
- An AI agent is present in every chat.
- Users may only access chats where they are members.
- The agent should automatically decide whether it should respond to a user message.
- The agent learns useful information about users and can use it in future conversations.
- The agent is present in every chat, but should only answer when it is appropriate.

## Getting started

Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.

Sign in as `sam` with password `password`. jordan and alex use the same password.

> [!IMPORTANT]
> **Address the agent by name to get a reply.** It answers that message only, and stays quiet while people talk to each other. Try `Agent, where should we go get food?`

### Development

Start Postgres and Kafka, then run the app locally. Copy `.env.example` to `.env` so the app reaches Kafka on `localhost:9094`. The consumer process asks the agent after each saved message. The realtime process pushes each saved message to the browser.

```bash
docker compose up db kafka -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm consume
pnpm realtime
```

`pnpm install` also generates the Prisma client. `pnpm db:generate` is there in case that step was skipped. The client is written to `src/backend/db/prisma/generated` and is not committed.

`pnpm db:seed` creates sam, jordan, and alex.

### Docker Compose

Start Postgres, Kafka, the app, the agent consumer, and the realtime socket. The app container reads `OPENAI_API_KEY` from `.env`, applies migrations, and seeds the users above. The consumer uses the same image and reads `chat.messages`. The realtime service listens on port 3001.

```bash
docker compose up --build
```

The app listens on port 3000.

## Architecture

### Tech stack

1. Next JS Stack
2. Postgres DB
3. OpenAI model provider
4. JWT auth
5. Docker Compose
6. Kafka
7. WebSockets
8. Tailwind CSS

### How it works

1. A user will sign in or sign up returning a bearer token based on JWT that is stored in the browser's local storage.
2. A user then can create a chat with 1 or many users.
3. The user will send a message routing through the api, checking with the agent if it should respond and store a memory about the user.
4. The frontend opens a WebSocket and receives each saved message as soon as it is committed.
5. Memories can be managed by the user.

