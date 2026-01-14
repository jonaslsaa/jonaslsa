# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm prisma generate  # Regenerate Prisma client after schema changes
pnpm prisma db push   # Push schema changes to database
```

## Architecture

Personal website (jonaslsa.com) built with the T3 Stack. Hosted on Vercel with MySQL on Railway.

### Client-Server Communication

All API calls use **tRPC** (no REST). Type-safe end-to-end with Zod validation.

**Server-side** (`src/server/trpc/`):
- Routers in `router/` - one per feature (shorten, paste, blip, translate, bypass)
- `publicProcedure` - rate-limited (16 req/10s via Upstash Redis)
- `protectedProcedure` - requires NextAuth session
- Prisma accessed via `ctx.prisma`

**Client-side**:
```typescript
const mutation = trpc.router.procedure.useMutation();
mutation.mutate(input, { onSuccess, onError });

const { data } = trpc.router.procedure.useQuery(input);
```

### Key Structure

- `src/pages/` - Next.js Pages Router (not App Router)
- `src/components/` - React components grouped by feature
- `src/server/trpc/router/` - tRPC routers
- `prisma/schema.prisma` - Database schema

### Features

- **Link shortener** (`/s`) - shorten URLs with random slugs
- **Pastebin** (`/paste`) - code sharing with syntax highlighting
- **Blip** (`/blip`) - real-time map of Norwegian police incidents

### Patterns

- Tailwind for all styling (dark theme, sky-blue accents)
- `useRef` for form inputs, `useState` for UI state
- Client-side validation then tRPC mutation
- SuperJSON transformer for Dates/complex types
- SSR disabled (`ssr: false` in tRPC config)
