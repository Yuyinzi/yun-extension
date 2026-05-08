# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) that auto-clicks the "next chapter" button when a course video ends on an online learning platform (`mooc1.s.ecust.edu.cn`). It is loaded as an unpacked extension — not distributed through the Chrome Web Store.

## How to Run / Test

**Load the extension in Chrome:**
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select this directory (`chrome-extension/`)
5. The extension appears as "Course Autoplay"

**Test locally without logging into the real site:**
Open `test/test-page.html` in Chrome (directly, via `file://`). This page has a video and a "Next Chapter" button. Temporarily add `"file:///*"` to the `matches` array in `manifest.json` to allow the content script to inject, reload the extension, then open the test page.

For iframe-mode testing, use `test/test-parent.html` which embeds `test/test-iframe.html`.

**There is no build step, no test runner, and no package manager.** All files are plain HTML/CSS/JS.

## Architecture

The extension has four parts that communicate via Chrome extension messaging APIs:

### Content Script (`content.js`) — Runs in ALL matching frames

Injected into every frame on `mooc1.s.ecust.edu.cn/mooc-ans/*` (`all_frames: true`). It has two behavioral modes determined at injection time:

- **Iframe mode** (`window.self !== window.top`): Finds the primary `<video>` element, attaches an `ended` listener, and reports `VIDEO_ENDED` to the background worker. Uses a `MutationObserver` to re-attach if the video element is dynamically replaced (SPA behavior).

- **Parent mode** (`window.self === window.top`): Listens for three message types from the background worker: `ENABLE_AUTOPLAY` (shows overlay), `DISABLE_AUTOPLAY` (hides overlay), `CLICK_NEXT` (finds and clicks the "next chapter" button). The next-button finder uses three fallback strategies: (1) CSS selectors for common class/data patterns, (2) text-content regex matching Chinese/English labels, (3) finding the `<a>` with the next higher `chapterId` in the URL.

The content script runs in Chrome's **isolated JavaScript world**, meaning it cannot directly access page JavaScript or use `window.postMessage` to talk across frames. All cross-frame communication goes through the background worker.

### Background Worker (`background.js`) — Service worker

Maintains a per-tab autoplay state in a `Map` (not persistent storage). Its only job is message routing:

- Receives `VIDEO_ENDED` from an iframe content script → looks up whether autoplay is enabled for that tab → forwards `CLICK_NEXT` to the **parent frame** (`frameId: 0`) of the same tab.
- Receives `TOGGLE` from the popup → stores state → forwards `ENABLE_AUTOPLAY` / `DISABLE_AUTOPLAY` to all frames in the tab.
- Receives `GET_STATE` from the popup → returns the current state.

Cleans up tab state on `tabs.onRemoved` and `tabs.onUpdated` (when navigating away from the course domain).

### Popup (`popup.html` / `popup.js` / `popup.css`)

A 240px-wide toggle UI. Queries the active tab, checks if the URL matches the course domain, fetches the current autoplay state from the background worker, and sends `TOGGLE` messages when the user clicks the button.

### Message Flow (end-to-end)

```
User clicks toggle ON (popup)
  → TOGGLE → background stores state → ENABLE_AUTOPLAY → parent content script (overlay appears)

Video ends (iframe)
  → VIDEO_ENDED → background checks state → CLICK_NEXT → parent content script (clicks next button)

Page navigates to next chapter (SPA or full reload)
  → content script re-injects → if iframe: re-attaches to new video; if parent: overlay re-appears
```

## File Structure

```
manifest.json          # Manifest V3 — permissions, host matches, content_scripts, background, popup
background.js          # Service worker — state + message routing
content.js             # Content script — iframe video watcher + parent next-button clicker
popup.html             # Popup markup
popup.js               # Popup logic — toggle + state sync
popup.css              # Popup styles
icons/                 # Extension icons (16x16, 48x48, 128x128 PNG)
test/                  # Local test pages for manual verification
```

## Key Implementation Details

- **Double-injection guard:** `content.js` checks `window.__autoplayInjected` at the top to prevent duplicate listeners if the script is injected twice.
- **sendResponse safety:** The `VIDEO_ENDED` handler in `background.js` uses a `respondOnce` wrapper because `chrome.tabs.sendMessage` with a callback is async — the port must stay open (`return true`) but `sendResponse` must be called exactly once.
- **No external dependencies:** All code is vanilla JavaScript. No build tools, no bundlers, no npm.
- **Icon placeholders:** The files in `icons/` are empty placeholders created with `touch`. Before loading in Chrome, replace them with actual PNG images (any image tool works; ImageMagick `convert` is the fastest).
