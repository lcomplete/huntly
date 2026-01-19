---
name: Huntly Knowledge Base
description: This skill should be used when the user asks about their saved content, bookmarks, starred articles, highlights, reading history, tweets, or knowledge base in Huntly sqlite database. Triggers include "我的收藏", "知识库", "我保存了什么", "my bookmarks", "my library", "what did I save".
---

# Huntly Knowledge Base

Access user's personal knowledge base stored in Huntly via SQLite database.

## REQUIRED: Get Database Path First

**STOP immediately after this skill triggers. Ask the user for the database path before ANY action.**
```
"I need to access your Huntly database. What is the path to your db.sqlite file?"
Examples:
- /Users/username/Library/Application Support/Huntly/db.sqlite
- ~/Library/Application Support/Huntly/db.sqlite
- /home/username/.config/Huntly/db.sqlite"
```
**DO NOT proceed with any queries until you have the database path.**
**DO NOT auto-search for the file.**

---

## Core Rule: Library Content First

By default, query **Library content** (user actively saved), not auto-collected content.

**Library Filter:**

```sql
WHERE library_save_status IN (1, 2) 
```

| Type | Condition | Order By |
|------|-----------|----------|
| My List | `library_save_status = 1` | `saved_at` |
| Archive | `library_save_status = 2` | `archived_at` |
| Starred | `is_starred = 1` | `starred_at` |
| Read Later | `is_read_later = 1` | `read_later_at` |

---

## Main Table: `page`

| Field | Description |
|-------|-------------|
| `id`, `title`, `url` | Basic identifiers |
| `description`, `content` | Text content (content is HTML) |
| `author`, `author_screen_name` | Author info |
| `domain`, `site_name` | Source website info |
| `thumb_url` | Thumbnail image URL |
| `library_save_status` | 0/NULL=unsaved, 1=My List, 2=Archive |
| `is_starred`, `is_read_later`, `is_mark_read` | Boolean flags |
| `connector_type` | NULL=web, 1=RSS, 2=GitHub |
| `connector_id` | FK → connector |
| `content_type` | 0=history, 1=tweet, 2=markdown, 3=quoted tweet, 4=snippet |
| `collection_id` | FK → collection |
| `created_at`, `saved_at`, `starred_at`, `archived_at`, `read_later_at` | Timestamps |
| `highlight_count` | Statistics |
| `page_json_properties` | JSON string with extra data (see below) |

### `page_json_properties` Field

JSON string containing type-specific metadata:

**For tweets (`content_type=1`):** `TweetProperties`
- `tweetIdStr`, `userIdStr`, `userName`, `userScreeName`, `userProfileImageUrl`
- `fullText`, `createdAt`
- `quoteCount`, `replyCount`, `retweetCount`, `favoriteCount`, `viewCount`
- `medias[]` (mediaUrl, type, videoInfo), `hashtags[]`, `urls[]`, `userMentions[]`
- `quotedTweet`, `retweetedTweet` (nested TweetProperties)
- `card` (title, description, imageUrl, url, domain)

**For GitHub repos (`connector_type=2`):** `GithubRepoProperties`
- `name`, `nodeId`, `defaultBranch`, `homepage`
- `stargazersCount`, `forksCount`, `watchersCount`
- `topics[]`, `updatedAt`

## Related Tables

- **`page_highlight`**: `page_id`, `highlighted_text`, `created_at`
- **`connector`**: `id`, `name`, `type` (1=RSS, 2=GitHub), `subscribe_url`, `folder_id`
- **`collection`**: `id`, `name`, `parent_id`
- **`folder`**: `id`, `name` (RSS folder organization)
