# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Huntly is a self-hosted AI-powered information management tool with multiple client options. It provides AI content processing, RSS feeds, web page archiving, Twitter content saving, full-text search, and integrations with external services like GitHub.

The project consists of:
- **Backend**: Java Spring Boot application (`app/server/`)
- **Web Client**: React TypeScript application (`app/client/`)
- **Browser Extension**: Chrome/Firefox extension with Manifest V3 (`app/extension/`)
- **Desktop App**: Tauri application with Vite + React frontend (`app/tauri/`)

## Development Commands

### Backend (Spring Boot)
```bash
# Navigate to server directory
cd app/server

# Run server in dev mode (Primary Development Mode)
# Checks dependencies and rebuilds if necessary, then runs the server
# Options:
#   --task  : Enable connector tasks (default: disabled)
#   --sql   : Show SQL logs (default: disabled)
./start-dev.sh

# Build with Maven wrapper
./mvnw clean install

# Run server via Maven directly
./mvnw spring-boot:run -pl huntly-server -am

# Or run the built JAR
java -Xms128m -Xmx1024m -jar huntly-server/target/huntly-server.jar

# Run with custom port
java -Xms128m -Xmx1024m -jar huntly-server/target/huntly-server.jar --server.port=80
```

### Web Client (React)
```bash
# Navigate to client directory
cd app/client

# Install dependencies
yarn install

# Start development server (proxies to localhost:8080)
yarn start
# or
yarn dev

# Build for production
yarn build

# Run tests
yarn test

# Generate API client from OpenAPI
yarn api-generate
```

### Browser Extension
```bash
# Navigate to extension directory
cd app/extension

# Install dependencies
yarn install

# Development build with watch
yarn dev
yarn watch

# Production build
yarn build

# Firefox-specific builds
yarn watch:firefox
yarn build:firefox

# Run tests
yarn test

# Code formatting
yarn style
```

### Desktop Application (Tauri)
```bash
cd app/tauri
yarn install

# Development mode (runs Vite + Tauri)
yarn tauri dev

# Build frontend only
yarn build

# Build desktop application
yarn tauri build
```

### Docker
```bash
# Run with docker-compose (recommended)
docker-compose up -d

# Build local image
docker build -t huntly-local -f Dockerfile .
```

## Architecture

### Backend Architecture
- **Spring Boot 2.6** application with modular Maven structure
- **Java 11** minimum requirement
- **Multi-module project**: huntly-server, huntly-interfaces, huntly-common, huntly-jpa
- **Database**: SQLite with JPA/Hibernate
- **Search**: Apache Lucene 9.4 with IK Analyzer for Chinese text tokenization
- **RSS Processing**: Rome library for feed parsing
- **Content Extraction**: Boilerpipe and Mozilla Readability for article content extraction
- **API Documentation**: Springfox/Swagger/OpenAPI

Key modules:
- `huntly-server/`: Main Spring Boot application with controllers and services
- `huntly-interfaces/`: DTOs and API interfaces
- `huntly-common/`: Shared utilities and base classes
- `huntly-jpa/`: JPA entities, repositories, and custom specifications

### Frontend Architecture
- **React 18** with TypeScript
- **Material-UI (MUI) v5** for UI components
- **TanStack Query v4** for API state management
- **React Router v6** for navigation
- **Tailwind CSS** for styling
- **OpenAPI Generator** for backend API client generation
- **react-markdown** with remark-gfm for Markdown rendering

### Browser Extension Architecture
- **Manifest V3** Chrome/Firefox extension
- **TypeScript** with Webpack bundling
- **React 18** for popup and options pages
- **Mozilla Readability** for content extraction
- **Content Scripts** for page interaction
- **Background Service Worker** for message handling
- **Auto-save functionality** for web pages and Twitter/X content

### Desktop App Architecture (Tauri)
- **Tauri** for native desktop wrapper
- **Vite** for frontend bundling
- **React 18** with TypeScript
- **System tray** integration
- **Embedded JRE** for running the Spring Boot server locally

### Key Features
- **AI Content Processing**: Streaming content processing with configurable shortcuts for summarization, translation, etc.
- **Article Preview**: Real-time preview during AI processing
- **Tweet Saving**: Special handling for Twitter/X with thread reconstruction
- **Full-text Search**: Lucene-based search with Chinese tokenization support
- **RSS Feeds**: Automated feed fetching with file-based caching
- **External Connectors**: GitHub integration for syncing starred repositories

## Database & Data Storage
- **Primary DB**: SQLite (`app/server/huntly-server/db.sqlite`)
- **Feed Cache**: File-based caching (`app/server/huntly-server/feed_cache/`)
- **Lucene Index**: Full-text search index (`app/server/huntly-server/lucene/`)

## Configuration Files
- **Spring Boot**: `application.yml` in `app/server/huntly-server/src/main/resources/`
- **AI Shortcuts**: `config/default-shortcuts.json` for AI processing shortcuts
- **TypeScript**: Multiple `tsconfig.json` files for different modules
- **Webpack**: Separate configs in `app/extension/webpack/` for dev/prod builds
- **Tailwind**: Individual configs in client, extension, and tauri apps
- **Tauri**: `src-tauri/tauri.conf.json` for desktop app configuration

## Testing
- **Backend**: Maven Surefire plugin with JUnit 5 and AssertJ
- **Extension**: Jest with ts-jest for TypeScript support
- **Client**: React Testing Library with Jest (via react-scripts)

## Common Patterns
- **API Controllers**: REST endpoints in `controller/` package
- **Service Layer**: Business logic in `service/` package
- **Repository Pattern**: JPA repositories with custom specifications in `huntly-jpa`
- **DTO Mapping**: MapStruct for entity-DTO conversion
- **Event-Driven**: Application events for decoupled processing
- **Streaming**: Server-Sent Events for real-time AI content processing