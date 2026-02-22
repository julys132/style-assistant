# Replit.md

## Overview

"The Stylist" is an AI-powered personal fashion styling app built with Expo (React Native) for the frontend and Express.js for the backend. Users can manage a digital wardrobe of clothing items, request AI-generated outfit suggestions for specific occasions, and save/share styled outfits. The app includes a credit-based monetization system (credit packs and subscriptions) and supports email, Apple, and Google authentication. The AI styling is powered by OpenAI (via Replit AI Integrations) for both text-based styling advice and image generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

- **Framework**: Expo SDK 54 with expo-router for file-based routing and typed routes
- **Navigation Structure**: Three route groups:
  - `app/index.tsx` — Auth gate that redirects to login or main app
  - `app/(auth)/` — Login and registration screens (presented as modal)
  - `app/(main)/` — Tab-based main app with Wardrobe, Stylist, Outfits, Profile, and Credits screens
- **State Management**: React Context providers for Auth, Wardrobe, and Credits. React Query (`@tanstack/react-query`) for server data fetching.
- **Local Storage**: All user data (auth, wardrobe items, outfits, credits) is persisted locally via `@react-native-async-storage/async-storage`. Authentication is entirely client-side (no server-side sessions).
- **Styling**: Dark theme throughout using a centralized `constants/colors.ts`. Custom fonts: Playfair Display (headings) and Inter (body text).
- **Animations**: `react-native-reanimated` for entrance animations, `expo-haptics` for tactile feedback.
- **Image Handling**: `expo-image` for display, `expo-image-picker` for camera/gallery, `expo-file-system` and `expo-sharing` for downloads and sharing.

### Backend (Express.js)

- **Server**: Express 5 running on the same Replit deployment, serves both API routes and static web build in production.
- **API Routes** (in `server/routes.ts`):
  - `POST /api/style` — Sends wardrobe items + occasion to OpenAI for styling advice (returns JSON with description, tips, image prompt)
  - `POST /api/generate-image` — Generates outfit visualization using `gpt-image-1`
- **Replit Integrations** (in `server/replit_integrations/`):
  - `chat/` — Conversation/message CRUD backed by PostgreSQL
  - `audio/` — Voice chat with speech-to-text/text-to-speech capabilities
  - `image/` — Image generation and editing via OpenAI
  - `batch/` — Rate-limited batch processing utilities with retry logic
- **CORS**: Dynamic origin allowlist based on Replit environment variables, plus localhost support for development.
- **Build Pipeline**: 
  - Dev: Expo dev server + Express run concurrently
  - Prod: Static web export via custom `scripts/build.js`, Express serves the built files via `esbuild` bundled output

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema** (in `shared/schema.ts`): Basic `users` table with id, username, password
- **Additional Models** (in `shared/models/chat.ts`): `conversations` and `messages` tables for chat functionality
- **Storage Layer**: `server/storage.ts` provides an in-memory storage implementation (`MemStorage`) as the default, with a database-backed implementation in `server/replit_integrations/chat/storage.ts`
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)
- **Connection**: Requires `DATABASE_URL` environment variable for PostgreSQL

### Authentication

- **Current Implementation**: Fully client-side using AsyncStorage. User records (including passwords) are stored in AsyncStorage. This is a prototype/development approach, not production-ready.
- **Social Auth**: Apple Sign-In via `expo-apple-authentication`, Google Sign-In via `expo-auth-session`. Both store user data locally after authentication.
- **No server-side auth**: The Express backend has no authentication middleware. API calls are unauthenticated.

### Monetization

- **Credits System**: Client-side credit tracking with packages ($2.99-$34.99) and subscription tiers ($4.99-$19.99/month). Currently simulated — no real payment processing is integrated.
- **Each AI styling request costs 1 credit**

## External Dependencies

### AI Services (via Replit AI Integrations)
- **OpenAI Chat**: `gpt-5-mini` model for styling advice generation
- **OpenAI Image**: `gpt-image-1` for outfit visualization
- **Environment Variables**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Connected via `DATABASE_URL` environment variable, accessed through Drizzle ORM

### Key NPM Packages
- `expo` ~54.0.27 — Core framework
- `expo-router` ~6.0.17 — File-based routing
- `express` ^5.0.1 — Backend server
- `openai` ^6.22.0 — AI API client
- `drizzle-orm` ^0.39.3 — Database ORM
- `@tanstack/react-query` ^5.83.0 — Server state management
- `react-native-reanimated` — Animations
- `react-native-gesture-handler` — Gesture handling
- `react-native-keyboard-controller` — Keyboard management
- `pg` ^8.16.3 — PostgreSQL driver

### Replit Environment Variables Used
- `REPLIT_DEV_DOMAIN` — Development domain for CORS and Expo proxy
- `REPLIT_DOMAINS` — Production domains for CORS
- `REPLIT_INTERNAL_APP_DOMAIN` — Deployment domain detection
- `EXPO_PUBLIC_DOMAIN` — Client-side API URL configuration
- `DATABASE_URL` — PostgreSQL connection string