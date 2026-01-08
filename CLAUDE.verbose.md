# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## For Claude Code: Quick Navigation

This file is optimized for AI-assisted development. Jump to:
- [Common Workflows](#common-workflows) - Start here for typical tasks
- [Architecture Decisions](#architecture-decisions) - Understand the "why"
- [File Locations](#file-locations) - Find what you need quickly
- [Gotchas](#gotchas--common-mistakes) - Avoid common mistakes
- [Reference](#reference) - Commands and configs

## Project Overview

Huntly is a self-hosted AI-powered information management tool with 4 platforms:
- **Backend** (Spring Boot + SQLite): Java 11, multi-module Maven, REST API
- **Web Client** (React + TypeScript): MUI + Tailwind, API-generated client
- **Browser Extension** (Manifest V3): Chrome/Firefox, auto-save functionality
- **Desktop App** (Tauri): Embeds Spring Boot server, uses web client code

Key technical decisions:
- **API-first architecture**: OpenAPI spec → generated TypeScript clients
- **SQLite**: Simple file-based database for single-user self-hosted deployment
- **Lucene**: Embedded full-text search with Chinese tokenization (IK Analyzer)
- **Multi-platform**: Shared React components where possible (client ↔ Tauri)

## Common Workflows

### Workflow 1: Adding a New API Endpoint

**When**: Adding new backend functionality that frontend needs to consume

**Steps**:
1. **Backend changes**:
   - Add method to controller in `app/server/huntly-server/src/main/java/com/huntly/server/controller/`
   - Create DTOs in `app/server/huntly-interfaces/src/main/java/com/huntly/interfaces/external/dto/` if needed
   - Implement service layer in `app/server/huntly-server/src/main/java/com/huntly/server/service/`
   - Add repository methods in `app/server/huntly-server/src/main/java/com/huntly/server/repository/` if data access needed

2. **Build backend**:
   ```bash
   cd app/server
   ./mvnw clean install -pl huntly-server -am
   ```

3. **Start backend** (required for API generation):
   ```bash
   ./mvnw spring-boot:run -pl huntly-server -am
   ```

4. **Regenerate API client** (in new terminal):
   ```bash
   cd app/client
   yarn api-generate
   ```
   This pulls from `http://localhost:8080/v3/api-docs` and generates TypeScript client in `src/api/`

5. **Implement frontend**:
   - Import and use generated API from `app/client/src/api/api.ts`
   - Add React components in `app/client/src/components/` or pages in `app/client/src/pages/`
   - Tauri automatically gets updates (shares client code)

6. **Extension** (if needed):
   - Extension doesn't use generated client (bundle size reasons)
   - Update `app/extension/src/services.ts` manually with fetch calls
   - Follow same API contract as backend

**Affected Platforms**: Backend ✓, Client ✓, Extension (manual), Tauri ✓

**Common Pitfalls**:
- Forgetting to run backend before `yarn api-generate` → Stale or failed generation
- Editing `app/client/src/api/api.ts` directly → Changes overwritten on next generation
- Not restarting backend after controller changes → Old API spec served

### Workflow 2: Modifying Database Schema

**When**: Adding fields, new entities, or relationships

**Steps**:
1. **Update or create entity** in `app/server/huntly-jpa/src/main/java/.../entity/`:
   ```java
   @Entity
   @Table(name = "my_table")
   public class MyEntity extends BaseEntity {
       @Column(name = "new_field")
       private String newField;
       // getters/setters
   }
   ```
   Hibernate will auto-update schema on next run (`ddl-auto: update` in application.yml)

2. **Update repository** if new queries needed:
   ```java
   public interface MyRepository extends JpaRepository<MyEntity, Long> {
       List<MyEntity> findByNewField(String newField);
   }
   ```

3. **Create/update DTOs** in `app/server/huntly-interfaces/src/main/java/.../dto/`:
   ```java
   @Data
   public class MyDto {
       private Long id;
       private String newField;
   }
   ```

4. **Create MapStruct mapper** in `app/server/huntly-server/src/main/java/.../mapper/` if needed:
   ```java
   @Mapper(componentModel = "spring")
   public interface MyMapper {
       MyDto toDto(MyEntity entity);
       MyEntity toEntity(MyDto dto);
   }
   ```

5. **Follow "Adding API Endpoint" workflow** to expose changes via REST API

**Note**: SQLite schema updates automatically via Hibernate. No manual migrations needed for development.

### Workflow 3: Extension Feature Development

**When**: Adding or modifying browser extension behavior

**Steps**:
1. **Identify component type**:
   - **Background** (service worker): `app/extension/src/background.ts` - Message handling, API calls, no DOM access
   - **Content script** (page interaction): `app/extension/src/content_script.tsx` - Early page load, can access DOM
   - **Web clipper** (content extraction): `app/extension/src/web_clipper.tsx` - Late page load, uses Readability
   - **Popup** (extension UI): `app/extension/src/popup.tsx` - React UI, shows when clicking extension icon
   - **Options** page: `app/extension/src/options.tsx` - Settings/configuration UI

2. **Implement changes**:
   - Use message passing for background ↔ content communication:
     ```typescript
     // Content → Background
     chrome.runtime.sendMessage({ type: 'ACTION_TYPE', payload: data });

     // Background → Content
     chrome.tabs.sendMessage(tabId, { type: 'ACTION_TYPE', payload: data });
     ```
   - Update `public/manifest.json` if permissions needed
   - For Firefox compatibility, also update `public/manifest-firefox.json`

3. **Build**:
   ```bash
   cd app/extension
   yarn watch  # Development with auto-rebuild
   # or
   yarn build  # Production build
   ```

4. **Test**:
   - **Chrome**: chrome://extensions → Enable Developer Mode → Load unpacked → select `dist/`
   - **Firefox**: `yarn build:firefox` → about:debugging → Load Temporary Add-on → select `dist_firefox/manifest.json`

**Affected Platforms**: Extension only (unless backend API changes needed)

**Common Pitfalls**:
- Trying to access DOM from background worker → Use content script instead
- Assuming persistent background page → Manifest V3 uses service worker (can be terminated)
- Forgetting Firefox build for cross-browser compatibility

### Workflow 4: Multi-Platform UI Change

**When**: Adding UI feature that appears in both web and desktop apps

**Steps**:
1. **Implement in web client**:
   ```bash
   cd app/client
   ```
   - Create React components in `src/components/`
   - Use MUI for standard components, Tailwind for custom styling
   - Use TanStack Query for API state:
     ```typescript
     const { data, isLoading } = useQuery({
       queryKey: ['resource', id],
       queryFn: async () => {
         const api = new ResourceApi();
         const response = await api.getResource(id);
         return response.data.data;
       }
     });
     ```
   - Test with `yarn start` (proxies to localhost:8080)

2. **Tauri automatically includes**:
   - Tauri bundles the client build via Vite
   - Test desktop integration with `yarn tauri dev`
   - Verify native features (system tray, etc.) work correctly

3. **Extension needs separate implementation**:
   - Extension has limited UI (popup, options pages only)
   - Cannot share all client components (different build systems)
   - Implement simplified version in `app/extension/src/`
   - Share TypeScript types/models where possible

**Affected Platforms**: Client ✓, Tauri ✓, Extension (separate impl)

**Note**: Don't assume automatic code sharing across all platforms. Always verify each platform independently.

## Architecture Decisions

### Why API-First?

Backend generates OpenAPI spec → TypeScript client auto-generated → Type-safe frontend

**Benefits**:
- Type safety across backend-frontend boundary
- No manual API typing or Axios wrapper code
- API changes automatically reflected in TypeScript types
- Swagger UI for API documentation and testing

**Trade-offs**:
- Backend must be running for client generation
- Extension doesn't use generated client (bundle size, fetch-based instead)
- Generated code can be verbose

**How it works**:
1. Springfox scans Spring controllers and generates OpenAPI spec at `/v3/api-docs`
2. `yarn api-generate` pulls spec and runs openapi-generator-cli
3. TypeScript Axios client generated in `app/client/src/api/api.ts`

### Why SQLite?

Single-file database for self-hosted single-user application

**Benefits**:
- Zero configuration (no separate DB server)
- Easy backup (just copy `db.sqlite` file)
- Portable across platforms (same file works on Windows/Mac/Linux)
- Perfect for personal self-hosted use case

**Trade-offs**:
- Not suitable for multiple concurrent users
- Requires write locking (connection pool size: 1)
- Limited to ~1TB data (more than enough for personal use)

**Configuration** (application.yml):
```yaml
spring.datasource.url: jdbc:sqlite:${huntly.dataDir:}db.sqlite?date_class=TEXT
spring.datasource.hikari.maximum-pool-size: 1  # SQLite single writer
```

### Why Lucene?

Embedded full-text search with Chinese text tokenization

**Benefits**:
- No external service (Elasticsearch, etc.) needed
- IK Analyzer provides excellent Chinese text segmentation
- Fast search across article content
- Index stored as files (easy backup with data directory)

**Trade-offs**:
- Index directory grows with content
- Requires rebuilding index if corrupted
- Less feature-rich than Elasticsearch

**Location**: `app/server/huntly-server/lucene/` (gitignored runtime directory)

### Why Multi-Module Maven?

Separation of concerns across Maven modules

**Modules**:
- `huntly-common`: Shared utilities, base classes, exceptions
- `huntly-interfaces`: DTOs and API contracts (no implementation dependencies)
- `huntly-jpa`: JPA entities, repositories, specifications (data access layer)
- `huntly-server`: Main application (controllers, services, configuration)

**Benefits**:
- Clear dependency boundaries
- DTOs can be shared without pulling in implementation
- Repository layer isolated from business logic
- Easier to test individual layers

**Build order**: common → interfaces → jpa → server

## Platform-Specific Guides

### Backend (Spring Boot)

**Directory Structure**:
```
app/server/huntly-server/src/main/java/com/huntly/server/
├── controller/         # REST endpoints (@RestController)
├── service/            # Business logic
├── repository/         # Data access (extends JpaRepository)
├── domain/
│   ├── mapper/         # MapStruct mappers
│   └── vo/             # View objects (internal DTOs)
├── config/             # Spring configuration
├── connector/          # External integrations (GitHub, etc.)
├── security/           # Authentication/authorization
└── event/              # Application events
```

**Key Patterns**:
- Controllers return `ApiResult<T>` wrapper for consistent response structure
- Services use `@Transactional` for database operations
- MapStruct for entity ↔ DTO conversion (compile-time safe)
- Custom JPA specifications for complex queries in `huntly-jpa` module

**Configuration**: `app/server/huntly-server/src/main/resources/application.yml`
- Database: `huntly.dataDir` for data directory (defaults to working directory)
- JWT: `huntly.jwtSecret` and `huntly.jwtExpirationDays` (default 365)
- Port: `server.port` (default 8080)

**Example Controller Pattern**:
```java
@RestController
@RequestMapping("/api/resource")
public class ResourceController {

    @Autowired
    private ResourceService service;

    @PostMapping
    public ApiResult<ResourceDto> create(@Valid @RequestBody CreateRequest request) {
        ResourceDto result = service.create(request);
        return ApiResult.ok(result);
    }
}
```

### Web Client (React)

**Directory Structure**:
```
app/client/src/
├── api/                # Generated API client (DO NOT EDIT)
├── components/         # Reusable React components
├── pages/              # Page-level components (routed)
├── contexts/           # React contexts (global state)
├── hooks/              # Custom React hooks
├── domain/             # Domain logic
├── interfaces/         # TypeScript interfaces
└── common/             # Utilities and helpers
```

**Key Patterns**:
- TanStack Query for server state management (replaces Redux)
- MUI components for standard UI elements
- Tailwind CSS for custom styling (preflight disabled for MUI compatibility)
- react-markdown with remark-gfm for content rendering

**API Usage**:
```typescript
import { PageApi } from './api/api';

// Client pre-configured with proxy base URL
const pageApi = new PageApi();
const response = await pageApi.getPageById(id);
const data = response.data.data; // Unwrap ApiResult
```

**Development**:
- Proxy to backend configured in package.json: `"proxy": "http://localhost:8080"`
- Backend must be running for API calls to work in dev mode
- Build creates static files that can be served from backend

### Browser Extension

**Directory Structure**:
```
app/extension/src/
├── background.ts           # Service worker (message handling, no DOM)
├── content_script.tsx      # Page interaction (early load)
├── web_clipper.tsx         # Content extraction (late load)
├── tweet_interceptor.ts    # Twitter timeline monitoring
├── popup.tsx               # Extension popup UI
├── options.tsx             # Settings page
├── services.ts             # API calls (fetch-based)
├── storage.ts              # Chrome storage API wrapper
└── model/                  # Type definitions
```

**Key Patterns**:
- Message passing for cross-context communication (background ↔ content)
- Chrome storage API for syncing settings across devices
- Mozilla Readability for clean article content extraction
- Manual API calls with fetch (no generated client)

**Manifest V3 Considerations**:
- Service worker replaces persistent background page
- Can be terminated anytime → Use chrome.storage for persistence
- Content scripts run in isolated JavaScript world → Message passing required
- Limited synchronous APIs → Most operations are async

**Development**:
```bash
yarn watch          # Auto-rebuild for Chrome on file changes
yarn build:firefox  # Firefox-specific build (uses manifest-firefox.json)
```

**Multi-Browser Support**:
- `BROWSER=firefox` environment variable switches builds
- Separate manifests for Chrome/Firefox compatibility
- Same codebase, different output directories (dist/ vs dist_firefox/)

### Desktop App (Tauri)

**Directory Structure**:
```
app/tauri/
├── src/                    # Frontend (Vite + React)
│   ├── App.tsx
│   ├── components/
│   └── types/
├── src-tauri/              # Rust backend
│   ├── src/                # Rust source code
│   ├── tauri.conf.json     # Tauri configuration
│   ├── Cargo.toml          # Rust dependencies
│   └── server_bin/         # Embedded Spring Boot JAR + JRE
│       ├── huntly-server.jar
│       └── jre11/
├── vite.config.ts
└── package.json
```

**Key Patterns**:
- Embeds Spring Boot JAR in application bundle
- Vite dev server on fixed port 1420 for Tauri integration
- System tray integration for background operation
- Rust backend provides native OS integration

**Development**:
```bash
yarn tauri dev      # Runs Vite dev server + Tauri window
```

**Build Process**:
1. Frontend built with Vite → static files
2. Rust compiled with embedded resources (Spring Boot JAR, JRE)
3. Platform-specific installer created (DMG, MSI, AppImage, etc.)

**Important**: Server binary must exist in `server_bin/` before building. Run backend build first if missing.

## File Locations

### Backend
```
Controllers:     app/server/huntly-server/src/main/java/com/huntly/server/controller/
Services:        app/server/huntly-server/src/main/java/com/huntly/server/service/
Repositories:    app/server/huntly-server/src/main/java/com/huntly/server/repository/
Entities:        app/server/huntly-jpa/src/main/java/com/huntly/jpa/entity/
DTOs:            app/server/huntly-interfaces/src/main/java/com/huntly/interfaces/external/dto/
Mappers:         app/server/huntly-server/src/main/java/com/huntly/server/domain/mapper/
Config:          app/server/huntly-server/src/main/resources/application.yml
AI Shortcuts:    app/server/huntly-server/src/main/resources/config/default-shortcuts.json
```

### Frontend
```
API Client:      app/client/src/api/api.ts (GENERATED - DO NOT EDIT)
Components:      app/client/src/components/
Pages:           app/client/src/pages/
Contexts:        app/client/src/contexts/
Hooks:           app/client/src/hooks/
```

### Extension
```
Background:      app/extension/src/background.ts
Content Script:  app/extension/src/content_script.tsx
Web Clipper:     app/extension/src/web_clipper.tsx
Popup:           app/extension/src/popup.tsx
Manifest:        app/extension/public/manifest.json
Services:        app/extension/src/services.ts (API calls)
```

### Configuration Files
```
Spring Boot:     app/server/huntly-server/src/main/resources/application.yml
Maven POM:       app/server/pom.xml (parent)
Client Package:  app/client/package.json
Extension Pkg:   app/extension/package.json
Tauri Config:    app/tauri/src-tauri/tauri.conf.json
Docker:          docker-compose.yml
```

### Runtime Data (gitignored)
```
Database:        app/server/huntly-server/db.sqlite
Lucene Index:    app/server/huntly-server/lucene/
Feed Cache:      app/server/huntly-server/feed_cache/
```

## Common Patterns & Conventions

### Backend Patterns

**1. Controller Pattern**:
```java
@RestController
@RequestMapping("/api/resource")
public class ResourceController {

    @Autowired
    private ResourceService service;

    @PostMapping
    public ApiResult<ResourceDto> create(@Valid @RequestBody CreateRequest request) {
        // @Valid triggers automatic validation
        ResourceDto result = service.create(request);
        return ApiResult.ok(result);
    }

    @GetMapping("/{id}")
    public ApiResult<ResourceDto> getById(@PathVariable Long id) {
        ResourceDto result = service.getById(id);
        return ApiResult.ok(result);
    }
}
```

**2. Service Pattern**:
```java
@Service
public class ResourceService {

    @Autowired
    private ResourceRepository repository;

    @Autowired
    private ResourceMapper mapper;

    @Transactional
    public ResourceDto create(CreateRequest request) {
        Entity entity = mapper.toEntity(request);
        entity = repository.save(entity);
        return mapper.toDto(entity);
    }
}
```

**3. MapStruct Mapper**:
```java
@Mapper(componentModel = "spring")
public interface ResourceMapper {
    ResourceDto toDto(Entity entity);
    Entity toEntity(CreateRequest request);

    @Mapping(target = "id", ignore = true)
    void updateEntity(UpdateRequest request, @MappingTarget Entity entity);
}
```

### Frontend Patterns

**1. Query with TanStack Query**:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: async () => {
    const api = new ResourceApi();
    const response = await api.getResource(id);
    return response.data.data; // Unwrap ApiResult<T>
  }
});
```

**2. Mutation with Optimistic Updates**:
```typescript
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: async (request: CreateRequest) => {
    const api = new ResourceApi();
    return api.createResource(request);
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['resource']);
  }
});
```

**3. MUI + Tailwind Styling**:
```tsx
// MUI for standard components
<Button variant="contained" color="primary">
  Click Me
</Button>

// Tailwind for custom styling
<div className="flex items-center gap-4 p-4 rounded-lg bg-gray-100">
  <span className="text-lg font-bold">Title</span>
</div>
```

### Extension Patterns

**1. Message Passing**:
```typescript
// Content Script → Background
chrome.runtime.sendMessage({
  type: 'SAVE_PAGE',
  payload: { url, title, content }
});

// Background → Content Script
chrome.tabs.sendMessage(tabId, {
  type: 'EXTRACT_CONTENT',
  payload: {}
});
```

**2. Chrome Storage**:
```typescript
// Save settings
await chrome.storage.sync.set({ apiKey: 'value' });

// Load settings
const { apiKey } = await chrome.storage.sync.get('apiKey');

// Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.apiKey) {
    console.log('API key changed:', changes.apiKey.newValue);
  }
});
```

## Gotchas & Common Mistakes

### Critical Mistakes to Avoid

**1. DON'T edit `app/client/src/api/api.ts` directly**
- It's auto-generated from OpenAPI spec
- Changes will be overwritten on next `yarn api-generate`
- Edit backend controller instead, then regenerate

**2. DON'T forget to run backend before API generation**
- Generation pulls from `http://localhost:8080/v3/api-docs`
- Backend not running → Generation fails or pulls stale spec
- Always: Start backend → Wait for startup → Run `yarn api-generate`

**3. DON'T commit runtime data files**
- `db.sqlite` - database with user data (gitignored)
- `lucene/` - search index (gitignored)
- `feed_cache/` - RSS cache (gitignored)
- These are in .gitignore, but verify before commits

**4. DON'T assume shared React components across platforms**
- Client and Tauri share code (Tauri bundles client via Vite)
- Extension has completely separate React implementation
- Changing client components doesn't automatically update extension
- Always test each platform independently

**5. DON'T skip Maven module build order**
- Modules depend on each other: common → interfaces → jpa → server
- Use `-am` flag to build dependencies: `./mvnw install -pl huntly-server -am`
- Without `-am`, build may fail with "cannot find symbol" errors

### Port Conflicts

**Default Ports**:
- Backend: 8080 (Spring Boot)
- Client dev: 3000 (react-scripts)
- Tauri frontend: 1420 (Vite, fixed)

**Check and kill processes**:
```bash
# Check what's using port 8080
lsof -i :8080

# Kill process by PID
kill -9 <PID>

# Or find and kill Spring Boot
ps aux | grep huntly-server
kill -9 <PID>
```

### Database Locking

**SQLite Limitations**:
- Only one writer at a time
- Connection pool size: 1 (configured in application.yml)
- Multiple backend instances with same database → Lock errors

**Solution**:
- Close all backend instances before starting new one
- Don't run multiple servers pointing to same `db.sqlite`
- Delete `db.sqlite.lock` file if exists and no process is running

### Extension Gotchas

**1. Service Worker Lifecycle (Manifest V3)**:
- Background worker can be terminated anytime by browser
- Don't rely on global variables for state
- Use `chrome.storage` for persistence across worker restarts

**2. Content Script Isolation**:
- Content scripts run in isolated JavaScript context
- Can access DOM but not page's JavaScript variables
- Can't call page's functions directly
- Use `window.postMessage` for page ↔ content script communication if needed

**3. Manifest Differences**:
- Chrome uses `manifest.json`
- Firefox uses `manifest-firefox.json` with some differences
- Build separately: `yarn build` (Chrome) vs `yarn build:firefox`

### Tauri Gotchas

**1. Embedded Server Binary**:
- Must build backend JAR separately: `cd app/server && ./mvnw clean install`
- Copy JAR to `app/tauri/src-tauri/server_bin/`
- Wrong or missing JAR → App launches but server doesn't start

**2. Fixed Vite Port**:
- Tauri expects Vite on port 1420 (configured in vite.config.ts)
- Don't change port without updating Tauri config
- Port conflict → Dev mode won't work

**3. System Tray Icons**:
- Requires platform-specific icon formats in `src-tauri/icons/`
- Missing icons → Tray doesn't appear on some platforms
- Use Tauri icon generator to create all required formats

## Testing

### Backend Testing

**Unit Tests** (JUnit 5 + AssertJ):
```bash
cd app/server
./mvnw test                    # Run all tests
./mvnw test -pl huntly-server  # Run server tests only
```

**Example Test**:
```java
@Test
void shouldCreateResource() {
    CreateRequest request = new CreateRequest();
    request.setName("Test");

    ResourceDto result = service.create(request);

    assertThat(result).isNotNull();
    assertThat(result.getName()).isEqualTo("Test");
}
```

**Manual API Testing**:
- Swagger UI: http://localhost:8080/swagger-ui/
- OpenAPI spec: http://localhost:8080/v3/api-docs
- Test endpoints directly in Swagger UI with "Try it out"

### Client Testing

**Component Tests** (React Testing Library + Jest):
```bash
cd app/client
yarn test                      # Run in watch mode
yarn test --coverage           # With coverage report
```

**Example Test**:
```typescript
test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

**Manual Testing**:
```bash
yarn start  # Proxies to localhost:8080 for API calls
```

### Extension Testing

**Unit Tests** (Jest + ts-jest):
```bash
cd app/extension
yarn test
```

**Manual Testing**:
1. Build extension:
   ```bash
   yarn build        # Chrome
   yarn build:firefox  # Firefox
   ```

2. Load in browser:
   - **Chrome**: chrome://extensions → Developer Mode → Load unpacked → `dist/`
   - **Firefox**: about:debugging → This Firefox → Load Temporary Add-on → `dist_firefox/manifest.json`

3. Test functionality:
   - Right-click on page → "Save to Huntly"
   - Click extension icon → Popup should open
   - Visit Twitter → Timeline interception should work

### Tauri Testing

**Manual Testing**:
```bash
cd app/tauri
yarn tauri dev  # Launches app with dev server
```

**Verify**:
- Window opens correctly
- System tray icon appears
- Embedded server starts (check backend logs)
- Frontend connects to embedded server

**Build Testing**:
```bash
yarn tauri build  # Creates platform-specific installer
```

## Troubleshooting

### Maven Build Fails

**Symptoms**: Compilation errors, "cannot find symbol", missing dependencies

**Solutions**:
```bash
# 1. Check Java version (need 11+)
java -version

# 2. Clean build everything
cd app/server
./mvnw clean install

# 3. Module dependency issues - build in order
./mvnw clean install -pl huntly-common
./mvnw clean install -pl huntly-interfaces
./mvnw clean install -pl huntly-jpa
./mvnw clean install -pl huntly-server -am
```

**Still failing?**
- Delete `~/.m2/repository/com/huntly/` (cached modules)
- Run `./mvnw clean install` again

### Backend Won't Start

**Port 8080 already in use**:
```bash
# Find process using port 8080
lsof -i :8080

# Kill it
kill -9 <PID>

# Or use custom port
./mvnw spring-boot:run -pl huntly-server -am -Dserver.port=8088
```

**Database locked error**:
- Close all backend instances
- Check no other process has `db.sqlite` open
- Delete `db.sqlite.lock` file if exists:
  ```bash
  cd app/server/huntly-server
  rm db.sqlite.lock
  ```

**Missing dependencies**:
```bash
./mvnw clean install
```

**Lucene initialization error**:
- Delete `lucene/` directory and restart:
  ```bash
  cd app/server/huntly-server
  rm -rf lucene/
  ```

### API Generation Fails

**Backend not running**:
```bash
# Terminal 1: Start backend
cd app/server
./mvnw spring-boot:run -pl huntly-server -am

# Wait for "Started HuntlyServerApplication"

# Terminal 2: Generate API
cd app/client
yarn api-generate
```

**Verify OpenAPI endpoint accessible**:
```bash
curl http://localhost:8080/v3/api-docs
# Should return JSON API spec
```

**Stale generated files**:
```bash
cd app/client/src/api
rm *.ts
cd ../..
yarn api-generate
```

**openapi-generator-cli not installed**:
```bash
cd app/client
yarn install  # Installs @openapitools/openapi-generator-cli
```

### Extension Build Issues

**Webpack errors**:
```bash
cd app/extension
rm -rf dist dist_firefox
yarn clean
yarn install
yarn build
```

**Manifest syntax errors**:
- Check `public/manifest.json` is valid JSON
- Verify all referenced files exist in `dist/js/` after build
- For Firefox, check `public/manifest-firefox.json`

**Module not found errors**:
```bash
rm -rf node_modules yarn.lock
yarn install
```

**Chrome won't load extension**:
- Check Chrome console in chrome://extensions for errors
- Verify manifest version is 3
- Check all required files are in `dist/` directory

### Tauri Build Issues

**Server binary not found**:
```bash
# Build backend JAR first
cd app/server
./mvnw clean install

# Copy to Tauri directory
cp huntly-server/target/huntly-server-*.jar \
   ../tauri/src-tauri/server_bin/huntly-server.jar
```

**Frontend build fails**:
```bash
cd app/tauri
rm -rf node_modules dist
yarn install
yarn build  # Build frontend first
yarn tauri build
```

**Rust compilation errors**:
- Check Rust installed: `rustc --version`
- Update Rust: `rustup update`
- Clean Cargo cache: `cd src-tauri && cargo clean`

**System tray not appearing**:
- Check icons exist in `src-tauri/icons/`
- Platform-specific icon formats required
- Verify `tauri.conf.json` systemTray configuration

## Reference

### Development Commands

#### Backend (Spring Boot)
```bash
cd app/server

# Build all modules
./mvnw clean install

# Build specific module with dependencies
./mvnw clean install -pl huntly-server -am

# Run server (default port 8080)
./mvnw spring-boot:run -pl huntly-server -am

# Run with custom port
./mvnw spring-boot:run -pl huntly-server -am -Dserver.port=8088

# Run built JAR directly
java -Xms128m -Xmx1024m -jar huntly-server/target/huntly-server.jar

# Run tests
./mvnw test
```

#### Web Client (React)
```bash
cd app/client

# Install dependencies
yarn install

# Start dev server (proxies to localhost:8080)
yarn start
# or
yarn dev

# Generate API client (backend must be running)
yarn api-generate

# Build for production
yarn build

# Run tests
yarn test
```

#### Browser Extension
```bash
cd app/extension

# Install dependencies
yarn install

# Development build with watch
yarn dev
yarn watch

# Production build
yarn build

# Firefox builds
yarn watch:firefox
yarn build:firefox

# Run tests
yarn test

# Code formatting
yarn style

# Clean build artifacts
yarn clean
```

#### Desktop Application (Tauri)
```bash
cd app/tauri

# Install dependencies
yarn install

# Development mode (Vite + Tauri)
yarn tauri dev

# Build frontend only
yarn build

# Build desktop application (creates installer)
yarn tauri build
```

#### Docker
```bash
# Run with docker-compose (recommended)
docker-compose up -d

# View logs
docker-compose logs -f huntly

# Stop
docker-compose down

# Build local image
docker build -t huntly-local -f Dockerfile .

# Run local image
docker run -d -p 8088:80 -v ~/data/huntly:/data huntly-local
```

### Technology Stack

#### Backend
- **Java**: 11+
- **Spring Boot**: 2.6.14
- **Database**: SQLite with JPA/Hibernate
- **Search**: Apache Lucene 9.4.1 + IK Analyzer 9.0.0
- **RSS**: Rome 1.18.0
- **Content Extraction**: Boilerpipe 1.2.2, Mozilla Readability
- **API Docs**: Springfox 3.0.0 (OpenAPI/Swagger)
- **Security**: Spring Security + JWT (jjwt 0.11.5)
- **Mapping**: MapStruct 1.5.2.Final
- **Build**: Maven 3.6+

#### Frontend
- **React**: 18.2.0
- **TypeScript**: 4.4.2+
- **UI**: Material-UI (MUI) 5.8.2
- **Styling**: Tailwind CSS 3.0.24
- **State**: TanStack Query 4.10.3
- **Router**: React Router 6.4.0
- **Markdown**: react-markdown 10.1.0 + remark-gfm 4.0.1
- **API Client**: OpenAPI Generator (typescript-axios)
- **HTTP**: Axios 0.27.2
- **Forms**: Formik 2.2.9 + Yup 0.32.11
- **Build**: react-scripts 5.0.1
- **Package Manager**: Yarn 1.22.19

#### Extension
- **TypeScript**: 4.4.3
- **React**: 18.2.0
- **Build**: Webpack 5
- **UI**: Material-UI 5.11.14
- **Styling**: Tailwind CSS 3.3.2
- **Content**: Mozilla Readability 0.4.2
- **Testing**: Jest 27.2.1 + ts-jest
- **Manifest**: Version 3

#### Desktop
- **Tauri**: 2.0.0
- **Rust**: Latest stable
- **Frontend**: Vite 4.0.0 + React 18.2.0
- **UI**: Material-UI 5.11.15
- **Styling**: Tailwind CSS 3.3.1
- **Plugins**: autostart, dialog, fs, updater, shell, store

### Configuration Files

```
Backend:
  app/server/pom.xml                                      # Parent Maven config
  app/server/huntly-server/pom.xml                        # Server module config
  app/server/huntly-server/src/main/resources/application.yml  # Spring Boot config

Frontend:
  app/client/package.json                                 # Client dependencies
  app/client/tsconfig.json                                # TypeScript config
  app/client/tailwind.config.js                           # Tailwind config

Extension:
  app/extension/package.json                              # Extension dependencies
  app/extension/tsconfig.json                             # TypeScript config
  app/extension/public/manifest.json                      # Chrome manifest
  app/extension/public/manifest-firefox.json              # Firefox manifest
  app/extension/webpack/webpack.common.js                 # Webpack config
  app/extension/tailwind.config.js                        # Tailwind config

Tauri:
  app/tauri/package.json                                  # Tauri frontend dependencies
  app/tauri/tsconfig.json                                 # TypeScript config
  app/tauri/vite.config.ts                                # Vite config
  app/tauri/src-tauri/Cargo.toml                          # Rust dependencies
  app/tauri/src-tauri/tauri.conf.json                     # Tauri config
  app/tauri/tailwind.config.js                            # Tailwind config

Docker:
  docker-compose.yml                                      # Docker Compose config
  Dockerfile                                              # Container build config

CI/CD:
  .github/workflows/*.yml                                 # GitHub Actions workflows
```

### Environment Variables

**Backend** (application.yml or command line):
```yaml
huntly:
  dataDir: /data/              # Data directory (defaults to working dir)
  luceneDir: /data/lucene/     # Lucene index directory (optional)
  jwtSecret: <base64-secret>   # JWT signing key
  jwtExpirationDays: 365       # JWT expiry in days

server:
  port: 8080                   # HTTP port

spring:
  datasource:
    url: jdbc:sqlite:${huntly.dataDir:}db.sqlite?date_class=TEXT
```

**Docker** (docker-compose.yml or Dockerfile):
```yaml
JAVA_ARGS: "-Xms128m -Xmx1024m"           # JVM heap size
VM_ARGS: "-Duser.timezone=GMT+08"         # JVM arguments
PROFILE: "default"                        # Spring profile
PORT: 80                                  # Server port
```

**Extension** (build time):
```bash
BROWSER=firefox  # Build for Firefox instead of Chrome
```

### URLs

**Development**:
- Backend: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui/
- OpenAPI spec: http://localhost:8080/v3/api-docs
- Client dev server: http://localhost:3000 (proxies to 8080)
- Tauri dev frontend: http://127.0.0.1:1420

**Production** (Docker):
- Default: http://localhost:8088 (mapped from container port 80)
- Configurable via docker-compose.yml port mapping

---

## For Claude Code: Summary

### Most Important Workflows
1. **API-first development**: Backend → generate → frontend (always in this order)
2. **Multi-platform impact**: Client change → affects Tauri, check extension separately
3. **Build order**: Maven modules must build in dependency order (use `-am` flag)

### Most Common Mistakes
1. Editing generated API client (`app/client/src/api/api.ts`) → regenerate instead
2. Forgetting to run backend before API generation → start backend first
3. Assuming all platforms share code → verify each independently

### Quick Decision Making
- **Backend change?** → Regenerate API clients after
- **UI change?** → Implement in client, check if Tauri needs testing, extension needs separate impl
- **Entity change?** → Update entity → DTO → mapper → controller → regenerate API
- **New endpoint?** → Follow API-first workflow completely
- **Extension change?** → Identify component type (background/content/popup) first

### When in Doubt
1. Check [Common Workflows](#common-workflows) for step-by-step guides
2. Verify multi-platform impact before implementing
3. Run tests in affected modules before committing
4. Use Swagger UI to verify backend changes work correctly
