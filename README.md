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

### Development

Start Postgres, then run the app locally:

```bash
docker compose up db -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm db:seed` creates sam, jordan, and alex. They share `SEED_PASSWORD` from `.env`.

### Docker Compose

Build and run Postgres and the app together. The container applies migrations on startup.

```bash
docker compose up --build
```

The app listens on port 3000. Add `OPENAI_API_KEY` to the `backend` service environment in `docker-compose.yaml` if the agent should reply inside that container.

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

## Tradeoffs

1. The model runs inside the send request, so the button waits, instead of answering later over the poll.
2. Exact text match for memories, instead of embeddings, which is why similar facts stack up.
3. gpt-4o-mini for both the reply decision and memory extraction, instead of a faster or cheaper model for one of them.
4. The whole transcript is sent every time, instead of a window or a summary.
5. 404 for a chat you are not in, so the API does not reveal that the chat exists.

## With more time

- Use openrouter or something that would act really fast.
- Embed the chat messages.
- Configure oauth instead of username signup.
- Create relationships between users, add friends, delete friends etc.
- Websockets for instant message updates instead of 2 second long polling.
- Model optimization. The app hardcodes gpt-4o-mini but maybe we could find better models.
- CI/CD using github actions to make updates to tests.
- Better memory dedup. Right now there is no dedup on memory so we get this stacked up. I would add embeddings and make lookups and see if we already having something similar.

### Code quality

- I dont like our backend services requiring the request objects. I would refactor to extract the data out of the request first.
- Create db repositories and have them called within services instead of direct ORM calls inside of backend services.
