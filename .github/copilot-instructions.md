# Huntly Development Guide

## Project Architecture

Huntly is a self-hosted information management tool with a **multi-module Spring Boot backend** and multiple clients:
- **Backend**: Maven multi-module Spring Boot (`app/server/`) with SQLite + Lucene
- **Web Client**: React + TypeScript + TanStack Query (`app/client/`)
- **Browser Extension**: Manifest V3 Chrome/Firefox extension (`app/extension/`)
- **Desktop**: Tauri applications (`app/tauri/`)

## Critical Development Workflows

### API-First Development Pattern
When modifying server APIs:
1. **Restart Spring Boot server** after API changes
2. **Run `yarn api-generate` in `app/client/`** to regenerate TypeScript client
3. Server must be running on localhost:8080 for OpenAPI generation

### Module Structure (Spring Boot)
- `huntly-server/`: Main Spring Boot application and REST controllers  
- `huntly-interfaces/`: DTOs and external API contracts
- `huntly-common/`: Shared utilities and base classes
- `huntly-jpa/`: Custom JPA specifications and repositories

### Package Management
- **Client**: Always use `yarn` (configured in client rules)
- **Extension**: Uses `yarn` with Webpack bundling
- **Server**: Maven with Java 11

## Key Patterns & Conventions

### Backend Patterns
- **Service Layer**: Business logic in `@Service` classes extending `BasePageService`
- **Event-Driven**: Use `EventPublisher` for decoupled processing (see `InboxChangedEvent`)
- **Repository Pattern**: Custom JPA specifications in `huntly-jpa/`
- **DTO Mapping**: Clean separation via MapStruct between entities and DTOs
- **Streaming Processing**: Server-Sent Events for real-time content processing

### Frontend Patterns  
- **State Management**: TanStack Query for server state, React hooks for local state
- **Component Structure**: Functional components with TypeScript
- **Routing**: React Router v6
- **UI Framework**: Material-UI (MUI) + Tailwind CSS
- **API Calls**: Generated TypeScript client from OpenAPI

### Browser Extension Patterns
- **Content Scripts**: Message passing between content script and background worker
- **Auto-save**: Special handling for Twitter timeline interception (`tweet_interceptor.js`)
- **Multi-browser**: Separate Firefox builds via `BROWSER=firefox` env var

## Critical Integration Points

### Content Processing Pipeline
1. **Web pages**: Boilerpipe extraction → Lucene indexing → SSE streaming
2. **Twitter content**: Intercepted via content script → background processing  
3. **RSS feeds**: Rome library parsing → scheduled fetching

### Search Architecture
- **Lucene + IK Analyzer** for Chinese text support
- **Index location**: `app/server/lucene/`
- **Full-text search** across titles, content, and metadata

### Data Storage
- **Primary DB**: SQLite at `app/server/db.sqlite`  
- **Search Index**: Lucene files in `app/server/lucene/`
- **Feed Cache**: File-based at `app/server/feed_cache/`

## Development Commands

### Quick Start
```bash
# Backend (from app/server/)
mvn clean install
java -Xms128m -Xmx1024m -jar huntly-server/target/huntly-server.jar

# Frontend (from app/client/)  
yarn install && yarn start

# Extension development (from app/extension/)
yarn install && yarn dev
```

### API Regeneration Workflow
```bash
# 1. Start server first
cd app/server && java -jar huntly-server/target/huntly-server.jar

# 2. Generate client (new terminal)
cd app/client && yarn api-generate
```

## File Locations for Common Tasks

- **REST Controllers**: `huntly-server/src/main/java/com/huntly/server/controller/`
- **Business Logic**: `huntly-server/src/main/java/com/huntly/server/service/`
- **React Pages**: `app/client/src/pages/`
- **UI Components**: `app/client/src/components/`
- **Extension Content Scripts**: `app/extension/src/content_script.tsx`
- **API DTOs**: `huntly-interfaces/src/main/java/com/huntly/interfaces/external/dto/`