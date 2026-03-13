---
name: huntly-knowledge-base
description: Queries the user's Huntly SQLite database to search saved bookmarks, starred articles, highlights, reading history, tweets, and RSS feeds. Use when the user asks about their saved content, knowledge base, or reading history — including Chinese triggers like "我的收藏", "知识库", or "我保存了什么".
---

# Huntly Knowledge Base

Query and retrieve content from a user's personal Huntly knowledge base stored in SQLite.

## Workflow

1. **Get database path** — ask the user before any queries
2. **Determine query scope** — library content by default, or broader if requested
3. **Build and run SQL** — use the schema reference below
4. **Present results** — summarise findings with titles, sources, and dates

## Step 1: Get Database Path

Ask the user for the path to their `db.sqlite` file before proceeding. Do not auto-search.

```
"I need to access your Huntly database. What is the path to your db.sqlite file?"
```

Common locations:
- `/Users/<username>/Library/Application Support/Huntly/db.sqlite`
- `/home/<username>/.config/Huntly/db.sqlite`

## Step 2: Query Scope — Library Content First

By default, query **library content** (user actively saved), not auto-collected browsing history.

```sql
WHERE library_save_status IN (1, 2)
```

| Type | Condition | Order By |
|------|-----------|----------|
| My List | `library_save_status = 1` | `saved_at` |
| Archive | `library_save_status = 2` | `archived_at` |
| Starred | `is_starred = 1` | `starred_at` |
| Read Later | `is_read_later = 1` | `read_later_at` |

Only include `library_save_status = 0` or `NULL` when the user explicitly asks about browsing history or auto-collected content.

## Step 3: Schema Reference

### Main Table: `page`

| Field | Description |
|-------|-------------|
| `id`, `title`, `url` | Basic identifiers |
| `description`, `content` | Text content (content is HTML) |
| `author`, `author_screen_name` | Author info |
| `domain`, `site_name` | Source website |
| `library_save_status` | 0/NULL=unsaved, 1=My List, 2=Archive |
| `is_starred`, `is_read_later`, `is_mark_read` | Boolean flags |
| `connector_type` | NULL=web, 1=RSS, 2=GitHub |
| `content_type` | 0=history, 1=tweet, 2=markdown, 3=quoted tweet, 4=snippet |
| `collection_id` | FK to `collection` |
| `created_at`, `saved_at`, `starred_at`, `archived_at`, `read_later_at` | Timestamps |
| `page_json_properties` | JSON string with type-specific metadata (see below) |

### `page_json_properties` Metadata

**Tweets (`content_type=1`):** `tweetIdStr`, `userName`, `userScreeName`, `fullText`, `createdAt`, `retweetCount`, `favoriteCount`, `viewCount`, `medias[]`, `hashtags[]`, `quotedTweet`

**GitHub repos (`connector_type=2`):** `name`, `defaultBranch`, `homepage`, `stargazersCount`, `forksCount`, `topics[]`

### Related Tables

- **`page_highlight`**: `page_id`, `highlighted_text`, `created_at`
- **`connector`**: `id`, `name`, `type` (1=RSS, 2=GitHub), `subscribe_url`, `folder_id`
- **`collection`**: `id`, `name`, `parent_id`
- **`folder`**: `id`, `name` (RSS folder grouping)

## Example Queries

```sql
-- Find starred articles about a topic
SELECT title, url, starred_at FROM page
WHERE is_starred = 1 AND (title LIKE '%topic%' OR description LIKE '%topic%')
ORDER BY starred_at DESC LIMIT 10;

-- List saved tweets by a specific user
SELECT json_extract(page_json_properties, '$.fullText') AS tweet,
       json_extract(page_json_properties, '$.favoriteCount') AS likes
FROM page
WHERE content_type = 1 AND library_save_status IN (1, 2)
  AND json_extract(page_json_properties, '$.userScreeName') = 'username'
ORDER BY saved_at DESC;

-- Count saved items by source
SELECT domain, COUNT(*) AS total FROM page
WHERE library_save_status IN (1, 2)
GROUP BY domain ORDER BY total DESC LIMIT 10;
```
