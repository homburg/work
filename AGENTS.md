# AGENTS.md

This file provides guidance to AI coding agents (like Amp) when working with code in this repository.

## Repository Structure

This is a monorepo containing multiple projects:

- **`actions/cross-repo-sync/`** - GitHub Action for syncing files across repositories
  - Built with Effect-TS and Node.js native TypeScript support (`--experimental-strip-types`)
  - Main logic in `src/program.ts`, `src/Core.ts`, `src/Git.ts`

- **`apps/catch-up/`** - React Native mobile app built with Expo
  - Uses Expo Router for navigation
  - Includes PostHog analytics and session replay
  - Components in `components/` directory, UI primitives in `components/ui/`
  - Path alias: `@/*` maps to root directory

- **`apps/srv/`** - Next.js web application
  - Uses Next.js 15 with Turbopack
  - Built with Effect-TS for backend logic (see `src/sys.tsx`)
  - Includes OpenTelemetry instrumentation via `@vercel/otel`
  - Tailwind CSS 4.x for styling

- **`apps/hello-github-app/`** - TanStack Start web application
  - Uses TanStack Start and React 19 with Vite
  - Heavy integration of Effect-TS ecosystem (Cluster, Workflow, SQL, Platform)
  - OpenTelemetry instrumentation
  - File-based routing in `src/routes`

- **`apps/hello-dotnet-core-web/`** - .NET Core web application
  - Part of Visual Studio solution (`work.sln`)

## Common Commands

### Root Level
```bash
# Build the .NET solution
dotnet build work.sln

# Restore .NET dependencies
dotnet restore work.sln
```

### GitHub Action (cross-repo-sync)
```bash
cd actions/cross-repo-sync
yarn typecheck          # Type check without emitting files
yarn start              # Run the action locally
yarn test               # Run tests
yarn test:watch         # Run tests in watch mode
yarn test:update        # Update test snapshots
```

### Expo App (catch-up)
```bash
cd apps/catch-up
yarn start              # Start Expo development server
yarn android            # Run on Android
yarn ios                # Run on iOS
yarn web                # Run on web
yarn test               # Run Jest tests
yarn lint               # Run Expo linter
```

### Next.js App (srv)
```bash
cd apps/srv
yarn dev                # Start development server with Turbopack
yarn build              # Build for production
yarn start              # Start production server
yarn lint               # Run ESLint
```

### Hello GitHub App (hello-github-app)
```bash
cd apps/hello-github-app
yarn dev                # Start development server (Vite)
yarn build              # Build for production
```

### .NET App (hello-dotnet-core-web)
```bash
cd apps/hello-dotnet-core-web
dotnet build            # Build the project
dotnet run              # Run the application
dotnet test             # Run tests (if any)
```

## Version Control

- **but (GitButler)**: Used for version control operations. Prefer `but` commands over standard `git` commands where applicable.
- **Virtual Branches**: Work is managed using GitButler's virtual branches.

## Key Technologies

- **TypeScript**: All JavaScript projects use strict TypeScript configuration
- **Effect-TS**: Used in cross-repo-sync and srv for functional error handling
- **Yarn 4.x**: Package manager for JavaScript/TypeScript projects
- **.NET Core**: For C# web applications
- **Expo/React Native**: For mobile development (catch-up app)
- **Next.js 15**: For web applications (srv app) with Turbopack
- **TanStack Start**: For full-stack React applications (hello-github-app)
- **React 19**: Used in hello-github-app

## Code Style & Conventions

### TypeScript Projects
- Use strict TypeScript mode
- Follow functional programming patterns with Effect-TS where applicable
- Use ESM modules (`"type": "module"`)
- Path aliases: `@/*` in catch-up app maps to root directory

### .NET Projects
- Follow standard C# conventions
- Part of Visual Studio solution structure

## Testing

- **cross-repo-sync**: Node.js native test runner with snapshot testing for Effect traces
- **catch-up**: Jest with `jest-expo` preset
- **srv**: No test configuration currently
- **.NET**: Use `dotnet test` command

## Architecture Notes

### cross-repo-sync Action
- Uses Effect-TS for composable error handling and dependency injection
- Service-oriented architecture with `Core` (GitHub Actions SDK wrapper) and `Git` (Git CLI wrapper) services
- Program logic in `src/program.ts` processes sync paths and orchestrates git operations
- Tests use snapshot testing for trace validation
- Node.js native TypeScript execution (no build step required for development)

### catch-up App
- File-based routing via Expo Router in `app/` directory
- Components in `components/` directory including UI primitives in `components/ui/`
- Uses React Navigation for tab navigation
- PostHog integration for analytics and session replay
- Strict TypeScript configuration with path aliases

### srv App
- Next.js app with source in `src/app/` directory
- Effect-TS used for backend logic (see `src/sys.tsx`)
- OpenTelemetry integration via `@vercel/otel`
- Tailwind CSS 4.x for styling

### hello-github-app
- TanStack Start application using Vite
- File-based routing in `src/routes`
- Extensive use of Effect-TS ecosystem (Cluster, Workflow, SQL)
- OpenTelemetry integration

## GitHub Workflows

Located in `.github/workflows/`:
- `test-action.yml` - Tests the cross-repo-sync action
- `test-cross-repo-sync.yml` - End-to-end testing of sync functionality
- `type-check.yml` - TypeScript type checking

## Development Requirements

- Node.js 20+ for cross-repo-sync (native TypeScript support)
- .NET Core SDK for C# projects
- Yarn 4.x for JavaScript/TypeScript projects



