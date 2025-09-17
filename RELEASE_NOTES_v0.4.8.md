# Huntly v0.4.8 Release Notes

## ✨ New Features

### 📝 Text Highlighting System
- **Article Text Highlighting**: Introduced comprehensive text highlighting functionality allowing users to highlight important content in articles
- **Highlight Management**: Full support for creating, editing, and deleting personal highlights
- **Highlight Persistence**: All highlights are saved and synchronized across sessions
- **Visual Indicators**: Highlighted text is visually distinguished with clear markers
- **Highlight Navigation**: Easy navigation and management of all user highlights

## 📖 Documentation Updates
- Updated README documentation to reflect new highlighting features
- Enhanced feature descriptions in both English and Chinese documentation
- Updated version information across all components

## 🔧 Technical Improvements
- Backend support for highlight storage and retrieval
- Frontend components for highlight creation and management
- Database schema updates to support highlight functionality
- API endpoints for highlight operations

---

## 📦 Download Assets

The following assets are available for download:

- **huntly-server-0.4.8.jar** - Server application JAR file (requires Java 11)
- **huntly-client-0.4.8.zip** - Web client build files
- **huntly-browser-extension-0.4.8.zip** - Browser extension for Chrome/Firefox

## 🚀 Installation & Usage

### Server
```bash
java -Xms128m -Xmx1024m -jar huntly-server-0.4.8.jar
```

### Browser Extension
1. Download the `huntly-browser-extension-0.4.8.zip`
2. Extract the files
3. Load as unpacked extension in Chrome/Firefox

### Web Client
1. Download and extract `huntly-client-0.4.8.zip`
2. Serve the files using a web server
3. Configure to point to your Huntly server instance

## 📋 System Requirements

- **Java 11** or higher for server
- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **Node.js 18+** for development (optional)

## 🔗 Full Changelog

**Full Changelog**: https://github.com/lcomplete/huntly/compare/v0.4.7...v0.4.8

---

## 💫 About Huntly

Huntly is a self-hosted information management tool that helps you:
- Subscribe to and read RSS feeds
- Automatically save browsed pages for later reading
- Manage Twitter timeline content
- Search across all your saved content
- **Highlight and annotate important text** (NEW!)
- Use AI-powered article shortcuts for translation and summarization

For more information, visit the [project repository](https://github.com/lcomplete/huntly) or check out the [English documentation](README.en.md).