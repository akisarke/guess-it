# Guess It!

A browser game where you guess things built with React, Vite, Tailwind, Fastify, Prisma, PostgreSQL and Google Gemini AI

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=000)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=fff)](#)
[![Fastify](https://img.shields.io/badge/Fastify-4-000000?logo=fastify&logoColor=fff)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=fff)](#)
[![Status](https://img.shields.io/badge/status-active-brightgreen)](#)
[![License](https://img.shields.io/badge/license-MIT-blue)](#)

## Features

* Daily puzzle with three questions
* Reveal with score, direction, band and rank
* Napkin math
* Streaks and badges
* Public profiles with avatars and badges
* Generate your own question sets
* Duels
* Friends and notifications
* Leaderboard
* Anonymous play
* and much more...

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, React Router, Motion, Fastify 4, Prisma 5, PostgreSQL, Zod, Google GenAI, Sharp, WebSockets, Vitest

## Preview
Landing page:
<img alt="Landing page" src="screenshots/01-landing.png" />

Make a guess:
<img alt="Question page with a guess input" src="screenshots/09-play.png" />

Results:
<img alt="Reveal page with score and distribution chart" src="screenshots/10-reveal.png" />

## Getting Started

Clone the repo:
```bash
git clone https://github.com/akisarke/guess-it.git
```
Open the project folder:
```bash
cd guess-it
```
Install dependencies and build the shared package:
```bash
npm install
npm run build -w shared
```
Create your environment file:
```bash
cp server/.env.example server/.env
```
Set at least a `DATABASE_URL` and a `SESSION_SECRET` (32+ random characters).

Set up the database and start the app:
```bash
npx prisma migrate deploy --schema server/src/prisma/schema.prisma
npm run seed -w server
npm run dev
```
Then navigate to [http://localhost:5173](http://localhost:5173) or visit [my site](https://guessit.akisarke.xyz).

## Project structure
```text
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

1. The player starts the puzzle
2. The questions start with an anonymous account
3. The player types a number and guesses
4. The player gets the awnser with a graph and how far they were
5. The players profile (if made) gets updated

## Scoring

Each guess is scored as a symmetric ratio against the real answer, so guessing too high and too low are penalised equally. 1.0x is exact, lower is better

## License

This project is licensed under the MIT License.
