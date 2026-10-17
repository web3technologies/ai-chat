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

Start Postgres, then run the app locally:

```bash
docker compose up db -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm install` also generates the Prisma client. `pnpm db:generate` is there in case that step was skipped. The client is written to `src/backend/db/prisma/generated` and is not committed.

`pnpm db:seed` creates sam, jordan, and alex.

### Docker Compose

Start Postgres and the app. The container reads `OPENAI_API_KEY` from `.env`, applies migrations, and seeds the users above.

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
6. Tailwind CSS

### How it works

1. A user will sign in or sign up returning a bearer token based on JWT that is stored in the browser's local storage.
2. A user then can create a chat with 1 or many users.
3. The user will send a message routing through the api, checking with the agent if it should respond and store a memory about the user.
4. The frontend will use long polling to refresh the chat list and the open conversation.
5. Memories can be managed by the user.

## Assumptions

1. Anyone can start a DM or group with any user. There is no friend graph.
2. A DM between the same two people is reused. A group needs a name.
3. The agent is one shared user, present in every chat, and stays quiet unless it can help.
4. Memories are plain text rows on a user, not embeddings. The same fact can be stored again in different words.
5. Users can list, edit, and delete only their own memories.
6. No email verification. Seeded users share one password.
7. If the model call fails or the key is missing, the human message still stays saved.
8. The token lives in localStorage, so the API is Authorization: Bearer, not a cookie.
9. Chat messages are sent to the model as written. There is no prompt-injection handling.

## Tradeoffs

1. The model runs inside the send request, so the button waits, instead of answering later over the poll.
2. Exact text match for memories, instead of embeddings, which is why similar facts stack up.
3. gpt-4o-mini for both the reply decision and memory extraction, instead of a faster or cheaper model for one of them.
4. The whole transcript is sent every time, instead of a window or a summary.
5. 404 for a chat you are not in, so the API does not reveal that the chat exists.

## With more time

- Use openrouter or something that would act really fast.
- Embed the chat messages. Right now all memories get passed to the agent and using embeddings and vector search we can limit the context we pass to the chat.
- Configure oauth instead of username signup.
- Create relationships between users, add friends, delete friends etc.
- Websockets for instant message updates instead of 2 second long polling.
- Model optimization. The app hardcodes gpt-4o-mini but maybe we could find better models.
- CI/CD using github actions to make updates to tests.
- Better memory dedup. Right now there is no dedup on memory so we get this stacked up. I would add embeddings and make lookups and see if we already having something similar.

### Code quality

- I dont like our backend services requiring the request objects. I would refactor to extract the data out of the request first.
- Create db repositories and have them called within services instead of direct ORM calls inside of backend services.

## How I used AI

I used Cursor, and instead of asking Cursor to build the entire app, I created files and stub code that would later be filled in by the AI. This allows me to better understand the codebase and prevent slop code from growing.

I stubbed the files first so I understood the structure. Each feature was a small plan: I reviewed it, let Cursor implement it, then cleaned up anything I would not want to maintain.

After it completed writing the code, I would then review each diff in the editor, and then test the features and updates in the browser.

For refactors, I highlighted the code and asked Cursor to make that change.

The unit tests were written after the codebase had been "completed". I asked cursor to write unit tests for the important items I thought needed to be tested.
