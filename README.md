# Guess It!

A browser game where you guess things! Make an estimate, lock it in, and find out how close you got, then build a better instinct one puzzle at a time.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=000)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=fff)](#)
[![Fastify](https://img.shields.io/badge/Fastify-4-000000?logo=fastify&logoColor=fff)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=fff)](#)
[![Status](https://img.shields.io/badge/status-active-brightgreen)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](#)

## Features

- Daily puzzle with three estimation questions
- Symmetric ratio scoring
- Reveal with score, direction, band and rank
- Log-scale guess distribution chart
- Napkin math behind the real answer
- Streaks and achievements
- Public profiles with avatars and badges
- Generate your own question sets
- Real-time duels over WebSockets
- Friends and notifications
- Daily, weekly and all-time leaderboard
- Email and password or Hack Club OAuth accounts
- Anonymous play, migrated when you sign up
- Dark and light mode
- Responsive design

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, React Router, Motion, Fastify 4, Prisma 5, PostgreSQL, Zod, Google GenAI, Sharp, WebSockets, Vitest

## Preview

Landing page: <img alt="Landing page" src="screenshots/01-landing.png" />

Make a guess: <img alt="Question page with a guess input" src="screenshots/09-play.png" />

Results: <img alt="Reveal page with score and distribution chart" src="screenshots/10-reveal.png" />

## Getting Started

Clone the repo:

```
git clone https://github.com/akisarke/guess-it.git
```

Open the project folder:

```
cd guess-it
```

Install dependencies and build the shared package:

```
npm install
npm run build -w shared
```

Create your environment file:

```
cp server/.env.example server/.env
```

Set at least a `DATABASE_URL` and a `SESSION_SECRET` (32+ random characters, for example from `openssl rand -base64 48`).

Set up the database and start the app:

```
npx prisma migrate deploy --schema server/src/prisma/schema.prisma
npm run seed -w server
npm run dev
```

Then navigate to [http://localhost:5173](http://localhost:5173) OR visit [my site](https://guessit.akisarke.xyz). The client proxies `/api` and `/uploads` to the server on port 3001.

## Project structure

```
guess-it/
├── client
  ├── public
  ├── src
    ├── components
    ├── hooks
    ├── lib
    ├── pages
    ├── test
├── server
  ├── src
    ├── errors
    ├── jobs
    ├── middleware
    ├── prisma
    ├── routes
    ├── security
    ├── services
  ├── .env.example
├── shared
├── screenshots
├── package.json
├── README.md
```

## How It Works

1. The player opens the landing page and starts today's puzzle
2. An anonymous session is created so play can begin without an account
3. The player types an estimate and locks it in
4. The answer is revealed with the score, direction, band and a distribution chart
5. Streaks, badges and leaderboard standings are updated
6. Signing up migrates the anonymous session to a real account

## Scoring

Each guess is scored as a symmetric ratio against the real answer, so guessing too high and too low are penalised equally. 1.0x is exact, lower is better.

```js
score = Math.max(guess / answer, answer / guess)
```

| Band   | Score       |
|--------|-------------|
| Close  | up to 1.5x  |
| Medium | up to 3.0x  |
| Far    | above 3.0x  |

## Tests

```
npm test
```

## License

This project is licensed under the MIT License.
