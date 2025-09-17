# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Huntly is a self-hosted information management tool with multiple client options. It provides RSS feeds, web page archiving, Twitter content saving, full-text search, and integrations with external services like GitHub.

The project consists of:
- **Backend**: Java Spring Boot application (`app/server/`)
- **Web Client**: React TypeScript application (`app/client/`)
- **Browser Extension**: Chrome/Firefox extension (`app/extension/`)
- **Desktop Apps**: Electron (`app/electron/`) and Tauri (`app/tauri/`) applications

## Development Commands

### Backend (Spring Boot)
```bash
# Navigate to server directory
cd app/server

# Build with Maven
mvn clean install

# Run server (default port 8080)
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

# Start development server
yarn start

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

### Desktop Applications

#### Electron
```bash
cd app/electron
yarn install
# Check package.json for available scripts
```

#### Tauri
```bash
cd app/tauri
yarn install
# Check package.json for available scripts
```

## Architecture

### Backend Architecture
- **Spring Boot** application with modular Maven structure
- **Multi-module project**: huntly-server, huntly-interfaces, huntly-common, huntly-jpa
- **Database**: SQLite with JPA/Hibernate
- **Search**: Apache Lucene with IK Analyzer for Chinese text
- **RSS Processing**: Rome library for feed parsing
- **Content Extraction**: Boilerpipe for article content extraction
- **API Documentation**: Swagger/OpenAPI

Key modules:
- `huntly-server/`: Main Spring Boot application
- `huntly-interfaces/`: DTOs and external interfaces
- `huntly-common/`: Shared utilities and base classes
- `huntly-jpa/`: Custom JPA specifications and repositories

### Frontend Architecture
- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **TanStack Query** for API state management
- **React Router** for navigation
- **Tailwind CSS** for styling
- **OpenAPI Generated Client** for backend communication

### Browser Extension Architecture
- **Manifest V3** Chrome extension
- **TypeScript** with Webpack bundling
- **React** for popup and options pages
- **Content Scripts** for page interaction
- **Background Service Worker** for message handling
- **Auto-save functionality** for web pages and Twitter content

### Key Features
- **Content Processing**: Streaming content processing with shortcuts
- **Article Preview**: Real-time preview during processing
- **Tweet Saving**: Special handling for Twitter content
- **Full-text Search**: Lucene-based search across all content
- **RSS Feeds**: Automated feed fetching and caching
- **External Connectors**: GitHub integration for stars management

## Database & Data Storage
- **Primary DB**: SQLite (`app/server/db.sqlite`)
- **Feed Cache**: File-based caching (`app/server/feed_cache/`)
- **Lucene Index**: Search index (`app/server/lucene/`)

## Configuration Files
- **Spring Boot**: `application.yml` in server resources
- **TypeScript**: Multiple `tsconfig.json` files for different modules
- **Webpack**: Separate configs for extension dev/prod builds
- **Tailwind**: Shared config across client and extension

## Testing
- **Backend**: Maven Surefire plugin for Java tests
- **Extension**: Jest with TypeScript support
- **Client**: React Testing Library with Jest

## Common Patterns
- **API Controllers**: REST endpoints in `controller/` package
- **Service Layer**: Business logic in `service/` package  
- **Repository Pattern**: JPA repositories with custom specifications
- **DTO Mapping**: Clean separation between internal entities and external DTOs
- **Event-Driven**: Application events for decoupled processing
- **Streaming**: Server-Sent Events for real-time content processing