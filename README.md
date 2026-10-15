# Tasks — Minimalist To-Do Application

An intentionally minimal, poetic to-do application designed with literary typography, a serene washi paper aesthetic, and deliberate omission of non-essentials.

---

## ✨ Features & Capabilities

- **Focused Categories (Now & Later)**:
  - Streamlined down to two essential categories: **Now** (immediate intentions) and **Later** (future intentions).
  - Displayed in clean sequence: **Now**, **Later**, and **All**.
- **Tactile Swipeable Pages**:
  - **Swipe or drag horizontally** across 3 pages: **Page 1 (Now)** → **Page 2 (Later)** → **Page 3 (All)**.
  - Category tabs at the top track your active view with an ink underline and task count.
  - Keyboard navigation via <kbd>Alt</kbd> + <kbd>→</kbd> / <kbd>Alt</kbd> + <kbd>←</kbd> or simply clicking tabs.
- **Collapsible Intention Creation via Title Button**:
  - Instead of a permanent text input taking up space, a minimal <kbd>＋</kbd> button sits directly beside the title **Tasks**.
  - Clicking <kbd>＋</kbd> (or pressing <kbd>/</kbd> or <kbd>＋</kbd>) smoothly reveals the input line with automatic focus.
  - Submitting a task or pressing <kbd>Esc</kbd> / clicking <kbd>✕</kbd> closes the input seamlessly.
- **Contextual Task Creation**:
  - Adding a task while on **Now** automatically files it under Now; adding while on **Later** files it under Later.
  - Supports quick hashtag syntax from anywhere (e.g. `Read chapter 4 #Later` or `Buy tea #Now`).
- **1-Click Category Assignment**:
  - Click on the category pill (<kbd>▾</kbd>) next to any task to move it between **Now** and **Later**.
- **Tag Collection Filter Menu (replaces old completion filters)**:
  - Dynamic washi-tape tag ribbon right below the input collects all tags present across your tasks.
  - Features an **All** button plus interactive tag buttons (`#focus 1`, `#wellness 1`, `#design 1`, etc.).
  - Clicking any tag filters tasks in your active chapter and updates the **Now / Later / All** tab badges to show exactly how many tasks match that tag in each section.
  - Clicking **All** (or re-clicking the active tag) immediately restores the full view.
  - Discrete `Clear done` button to clear completed tasks at any time.
- **Drag & Drop Task Reordering**:
  - Reorder tasks intuitively with a discreet 6-dot stationery grip handle (`⠿`).
  - Supports both desktop dragging (HTML5 drag-and-drop) and mobile touch dragging.
  - Real-time sumi-ink insertion hairline indicates precise placement above or below target tasks.
  - Automatically preserves task order within **Now**, **Later**, and **All** pages, synchronizing instantly to `localStorage`.
- **Custom Tags**:
  - Add custom tags to any task with the inline <kbd>＋tag</kbd> button.
  - Remove tags at any time with the discrete <kbd>×</kbd> button on each tag chip.
  - Type hashtags anywhere in your task title (e.g. `Draft proposal #work #urgent`) for auto-tagging.
  - Edit all tags at once by double-clicking any task.
- **Prominent Literary Typography**: Large, legible task titles (~19px / `1.22rem`) using high-contrast editorial serifs (*Newsreader*, *Cormorant Garamond*, *Georgia*).
- **Single Ink Hairline & Washi Paper Canvas**:
  - A single, elegant hairline sits directly below the title header, filling subtly with sumi ink as tasks are completed.
  - Warm cream paper texture (`#F8F6EE`) with a subtle 16px dot-grid overlay and sumi-ink palette.
- **Ink Strikethrough Animation**: Fluid, brush-drawn strikethrough upon task completion with sumi-ink fill checkbox.
- **Google Drive Cloud Storage & Cross-Device Sync**:
  - Save and synchronize your intentions privately in your personal Google Drive account.
  - **Least-Privilege Security**: Uses the restricted `drive.file` scope — the app can **only** read and write its own `tasks_data.json` file. It has **zero access** to any of your other Drive files, docs, or folders.
  - **Stay Signed In**: Uses Google Identity Services (GIS) with silent background token refresh (`prompt: ''`), so you do not need to log in every time you visit.
  - **Local-First Speed**: Instant offline loading from `localStorage` with non-blocking background synchronization.
- **Persistent & Offline-Ready**: Automatically synchronizes all tasks, tags, and categories to browser `localStorage` and Google Drive.

---

## ⌨️ Controls & Shortcuts

| Action | Control / Shortcut |
| :--- | :--- |
| **Reorder Tasks** | Drag and drop via the 6-dot grip handle (`⠿`) or task row |
| **Add Intention** | Click <kbd>＋</kbd> next to "Tasks" or press <kbd>/</kbd> or <kbd>＋</kbd> |
| **Close Add Window** | Press <kbd>Escape</kbd> or click <kbd>✕</kbd> |
| **Swipe Pages** | Touch swipe, trackpad swipe, mouse drag, or click category tabs |
| **Next / Prev Page** | <kbd>Alt</kbd> + <kbd>→</kbd> / <kbd>Alt</kbd> + <kbd>←</kbd> |
| **Inline Hashtags** | Type `#Now`, `#Later`, or `#tag` in task input (e.g. `Draft spec #Later #urgent`) |
| **Filter by Tag** | Click any tag button in the tag ribbon or on a task chip; click <kbd>All</kbd> to reset |
| **Switch Category** | Click on the category pill (<kbd>▾</kbd>) next to any task |
| **Add Tag Inline** | Click <kbd>＋tag</kbd> beneath any task, type name, and press <kbd>Enter</kbd> |
| **Remove Tag** | Click <kbd>×</kbd> on any tag chip |
| **Edit Task, Category & Tags**| Double-click any task to edit title, category dropdown, and tags |
| **Cancel Edit / Modal** | Press <kbd>Escape</kbd> |
| **Toggle Task** | Click anywhere on the task row or checkbox |

---

## 🚀 How to Run

### Option 1: Direct File Launch
Double-click [`index.html`](file:///c:/Users/leuch/Documents/git/task_manager/index.html) in your file explorer.

### Option 2: Local Python Server
Run in the project directory:
```bash
py -m http.server 8000
```
Then visit:
```
http://localhost:8000
```

---

## ☁️ Google Drive Cloud Sync Setup

Tasks synchronizes your intentions to a personal file (`tasks_data.json`) in your Google Drive using least-privilege permissions.

### Quick Setup (2 Minutes):
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `Tasks`).
2. Navigate to **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.
3. Go to **APIs & Services → OAuth consent screen**:
   - Choose **External**, enter an app name (e.g. *Tasks*), and add your Google email as a **Test User**.
4. Go to **Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:8000` (for local development)
     - `https://sweetgingkolove.github.io` (for GitHub Pages)
5. Copy your **Client ID** (looks like `123456789-xyz.apps.googleusercontent.com`).
6. In **Tasks**, click the **Drive** pill in the top header, paste your Client ID, and click **Save & Connect**.
7. Google will prompt authorization once — from then on, your session stays active automatically via silent token renewal!
