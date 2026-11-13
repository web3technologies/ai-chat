# Agentic Chat

![AI Chat system diagram](docs/AIChat%20System%20Diagram.png)

## Project features

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
> **The agent answers when you address it, and when you continue its last reply.** A correction like "nope, try again" counts. It stays quiet while people talk to each other. Try `Agent, where should we go get food?`

### Development

Start Postgres, Kafka, and Redis, then run the app locally. Copy `.env.example` to `.env` so the app reaches Kafka on `localhost:9094`. The relay publishes each saved message to Kafka. Fanout pushes those records to Redis, and the realtime process delivers them to the browser. The chat consumer asks the agent after each saved human message. The memory consumer stores facts from each saved human message. Leave `DATABASE_READ_URL` unset to read chat history from the primary.

```bash
docker compose up db kafka redis -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm relay
pnpm fanout
pnpm consume
pnpm consume:memories
pnpm realtime
```

`pnpm install` also generates the Prisma client. `pnpm db:generate` is there in case that step was skipped. The client is written to `src/backend/db/prisma/generated` and is not committed.

`pnpm db:seed` creates sam, jordan, and alex.

### Docker Compose

Start Postgres, a streaming replica, PgBouncer, Redis, Kafka, the app, the outbox relay, fanout, the agent consumer, the memory consumer, and the realtime socket. The app container reads `OPENAI_API_KEY` from `.env`, applies migrations, and seeds the users above. The app, the relay, and both consumers use the primary through PgBouncer. Chat list and history use the replica. The realtime socket subscribes to Redis and reads membership from the replica. The relay, fanout, and both consumers read `chat.messages`. The realtime service listens on port 3001.

```bash
docker compose up --build
```

The app listens on port 3000.

### Kubernetes

`pnpm dev` and Docker Compose stay available. This path runs the same image on a local k3s cluster. Traefik round-robins HTTP across two backend pods. The socket stays on port 3001. The script installs kubectl, Helm, or k3d when a command is missing. Docker has to be installed already.

```bash
./k8s.sh
```

The app listens on http://localhost:3000. Sockets stay on ws://localhost:3001.

## Architecture

### Tech stack

1. Next JS Stack
2. Postgres DB
3. PgBouncer
4. OpenAI model provider
5. JWT auth
6. Docker Compose
7. k3s and Helm
8. Kafka
9. Redis
10. WebSockets
11. Tailwind CSS

### How it works

1. A user will sign in or sign up returning a bearer token based on JWT that is stored in the browser's local storage.
2. A user then can create a chat with 1 or many users.
3. The user will send a message routing through the api. A chat consumer decides whether the agent should respond. A memory consumer stores facts from each saved human message.
4. A saved message and its outbox row commit together. The relay publishes that payload to Kafka, fanout pushes it to Redis, and the browser receives it on the WebSocket.
5. Memories can be managed by the user.

