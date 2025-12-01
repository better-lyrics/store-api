# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Local development with wrangler
npm run deploy       # Deploy to Cloudflare Workers
npm run db:init      # Initialize remote D1 database schema
npm run db:init:local # Initialize local D1 database schema
```

## Architecture

Cloudflare Workers API for a theme store (Better Lyrics). Built with Hono framework.

**Storage:**

- **KV**: Install counts and rate limiting (`installs:{themeId}`, `ratelimit:*`)
- **D1**: Ratings database with upsert by device ID (`odid`)

**Endpoints:**

- `POST /api/install/:themeId` - Track install (IP rate-limited, 1/day/theme)
- `POST /api/rate/:themeId` - Submit rating (IP rate-limited, requires `{rating, odid}`)
- `GET /api/rating/:themeId` - Get rating stats
- `GET /api/stats` - Aggregated stats for all themes

**Key patterns:**

- IP-based rate limiting using `CF-Connecting-IP` header only (must be behind Cloudflare)
- CORS allows Chrome extensions (`chrome-extension://`) and localhost
- All routes return typed `ErrorResponse` for failures

### koop_first

- Code must be built for reuse, not just to "make it work."

### naming_and_readability

- All class, method, and variable names must be descriptive and intention-revealing.
- Avoid vague names like data, info, helper, or temp.

### scalability_mindset

- Always code as if someone else will scale this.
- Include extension points (e.g., protocol conformance, dependency injection) from day one.

### commands

- NEVER RUN `build` OR `test` COMMANDS. IF YOU NEED TO, PROMPT THE USER TO DO IT INSTEAD.

### comments

- never write inline comments unless absolutely essential.

### package_manager

- Always use `npm` as the package manager, never use `pnpm` or `yarn`.

### documentation

- Provide implementation overviews directly in the terminal, not as separate documentation files.
- Only create documentation files (.md, README updates) when explicitly requested by the user.
- After completing implementation tasks, provide a brief summary of what was implemented and how it works in the terminal output.
