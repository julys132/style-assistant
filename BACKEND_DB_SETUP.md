# Backend + Database Setup

## 1) Configure environment
1. Copy `.env.example` to `.env`.
2. Fill in required values:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `EXPO_PUBLIC_API_BASE_URL`
   - `GEMINI_API_KEY` (if you use styling endpoints)
   - Stripe keys (only if you use payments)

## 2) Start PostgreSQL
```bash
npm run db:up
```

## 3) Apply schema
```bash
npm run db:push
```

## 4) Start backend API
```bash
npm run backend:dev
```

## 5) Start Expo app
```bash
npm run expo:dev
```

## Useful commands
```bash
npm run db:logs
npm run db:down
```
