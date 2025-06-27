# Article AI Shortcuts 配置说明

## 目录结构

```
config/
├── default-shortcuts.json    # 快捷键配置文件
└── shortcuts/               # 提示词模板文件夹
    ├── article-summary.md
    ├── translate-to-chinese.md
    ├── line-by-line-translation.md
    ├── extract-key-points.md
    ├── technical-analysis.md
    └── action-items.md
```

## 使用方法

### 1. 添加新的快捷键

1. 在 `shortcuts/` 文件夹下创建一个新的 `.md` 文件，例如 `my-shortcut.md`
2. 在文件中编写提示词内容，支持完整的 Markdown 格式
3. 在 `default-shortcuts.json` 中添加快捷键配置：

```json
{
  "name": "我的快捷键",
  "description": "快捷键的描述",
  "file": "my-shortcut.md",
  "enabled": true,
  "sortOrder": 7
}
```

### 2. 修改现有快捷键

直接编辑对应的 `.md` 文件即可，修改会在服务重启后生效。

### 3. 配置说明

- `name`: 快捷键名称（必需）
- `description`: 快捷键描述（必需）
- `file`: 对应的 Markdown 文件名（必需）
- `enabled`: 是否启用（可选，默认 true）
- `sortOrder`: 排序顺序（必需）

## 优势

1. **编辑方便**：使用 Markdown 文件编辑器可以更方便地编写和预览提示词
2. **版本控制**：每个提示词都是独立文件，便于版本控制和比较
3. **格式支持**：支持完整的 Markdown 格式，包括代码块、列表、表格等
4. **可维护性**：提示词与配置分离，结构清晰

## 注意事项

1. 修改配置后需要重启服务才能生效
2. 文件名必须与 JSON 配置中的 `file` 字段完全匹配
3. 如果文件加载失败，系统会回退到 JSON 中的 `content` 字段（如果有的话） 