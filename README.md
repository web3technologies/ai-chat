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


Architecture:

Tech Stack:
1. Next JS Stack
2. Postgres DB
3. OpenAI model provider
4. JWT auth
5. Docker Compose
6. Tailwind CSS

How it works:
1. A user will sign in or sign up returning a bearer token based on JWT that is stored in the browsers local storage.
2. A user then can create a chat with 1 or many users
3. The user will send a message routing through the api, checking with the agent if it should respond and store a memory about the user
4. The frontend will use long polling to 
5. Memories can be managed by the user

Assumptions:
1. Anyone can start a DM or group with any user. There is no friend graph.
2. A DM between the same two people is reused. A group needs a name.
3. The agent is one shared user, present in every chat, and stays quiet unless it can help.
4. Memories are plain text rows on a user, not embeddings. The same fact can be stored again in different words.
5. Users can list, edit, and delete only their own memories.
6. No email verification. Seeded users share one password. 
7. If the model call fails or the key is missing, the human message still stays saved.
8. The token lives in localStorage, so the API is Authorization: Bearer, not a cookie.

Tradeoffs:
1. The model runs inside the send request, so the button waits, instead of answering later over the poll.
2. Exact text match for memories, instead of embeddings, which is why similar facts stack up.
gpt-4o-mini for both the reply decision and memory extraction, instead of a faster or cheaper model for one of them.
3. The whole transcript is sent every time, instead of a window or a summary.
404 for a chat you are not in, so the API does not reveal that the chat exists.


Use openrouter or something that would act really fast
embed the chat messages
configure oauth instead of username signup
create relationships between users, add friends, delete friends etc
websockets for instant message updates instead of 2 second long polling
model optimization. the app hardcodes gpt-4o-mini but maybe we could find betterm models
CI/CD using github actions to make updates to tests
better memory dedup. right now there is no dedup on memory so we get this stacked up. I would add embeddings and make lookups and see if we already having something similar.
code quality:
- I dont like our backend services requiring the request objects. I would refactor to extract the data out of the request first.
- Create db repositories and have them called within services instead of direct ORM calls inside of backend services.