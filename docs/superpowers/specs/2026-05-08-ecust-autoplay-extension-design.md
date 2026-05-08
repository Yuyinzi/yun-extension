# ECUST Course Autoplay Extension — Design Spec

**Date:** 2026-05-08
**Scope:** Chrome Extension (Manifest V3) that automatically advances to the next chapter when a course video ends on the ECUST online learning platform.

## Problem

On the ECUST online learning platform (mooc1.s.ecust.edu.cn), course videos do not auto-advance to the next chapter when they finish. The user must manually click a "next chapter" button after every video. This extension automates that click.

## Target

- **Primary domain:** `mooc1.s.ecust.edu.cn/mooc-ans/*`
- **Behavior:** When a video ends naturally, find and click the "next chapter" element on the page
- **Control:** User toggles autoplay on/off via the extension popup (toolbar icon)

## Architecture

Manifest V3 extension with four components:

| File | Type | Purpose |
|------|------|---------|
| `manifest.json` | Manifest | Permissions, host matching, content script injection, popup action, background service worker |
| `content.js` | Content Script | Injected into all matching frames. Two modes: **iframe mode** watches `<video>` and reports `ended`; **parent mode** receives "click next" command and clicks the next-chapter button |
| `background.js` | Service Worker | Maintains per-tab autoplay state. Bridges messages between iframe content script and parent content script |
| `popup/` (`popup.html`, `popup.js`, `popup.css`) | Popup | Toggle switch to enable/disable autoplay for the current tab |

**Key design decision:** Content scripts run in an isolated JavaScript world. Communication between iframe and parent goes through the background worker (`chrome.runtime.sendMessage` → `chrome.tabs.sendMessage`), not direct `postMessage` between frames.

## Data Flow

### Enabling Autoplay

```
User clicks toggle ON (popup)
  → popup.js: chrome.runtime.sendMessage({type: 'TOGGLE', tabId, enabled: true})
  → background.js: stores {tabId: {enabled: true}} in chrome.storage.session
  → background.js: chrome.tabs.sendMessage(tabId, {type: 'ENABLE_AUTOPLAY'})
  → content.js (parent frame): creates overlay indicator + starts MutationObserver
```

### Video Ends → Next Chapter

```
<video> fires 'ended' event (iframe)
  → content.js (iframe): chrome.runtime.sendMessage({type: 'VIDEO_ENDED'})
  → background.js: looks up autoplay state for sender.tab.id
  → background.js: chrome.tabs.sendMessage(tabId, {type: 'CLICK_NEXT'}, {frameId: 0})
  → content.js (parent frame): finds next button, clicks it
  → page navigates to next chapter (SPA navigation or full reload)
  → content.js re-runs / MutationObserver detects new <video>, cycle repeats
```

### Disabling Autoplay

```
User clicks toggle OFF (popup)
  → background.js: removes tab state from storage
  → background.js: sends DISABLE_AUTOPLAY to content script
  → content.js: removes overlay, detaches video listener, stops MutationObserver
```

## Components

### Content Script (`content.js`)

**Detection logic on injection:**
- If `window.self !== window.top` and a `<video>` element exists → **iframe mode**
- If `window.self === window.top` → **parent mode**

**Iframe mode:**
- Find the primary video element (largest visible `<video>`, or the one with longest duration)
- Attach `ended` event listener
- Use `MutationObserver` on `document.body` to detect if the video element is replaced (SPA behavior) and re-attach
- On `ended`: `chrome.runtime.sendMessage({type: 'VIDEO_ENDED'})`

**Parent mode:**
- On `ENABLE_AUTOPLAY`: create a small fixed-position overlay (e.g., top-right corner: "Autoplay ON")
- On `CLICK_NEXT`: attempt to find the "next chapter" button using fallback selectors:
  1. `[data-action="next"]`, `.next-btn`, `.next`
  2. Element with text content matching `/下一节|下一章|next/i`
  3. `a[href*="chapterId"]` where the chapter ID is greater than current URL's chapter ID
- On `DISABLE_AUTOPLAY`: remove overlay and stop all observers

### Background Worker (`background.js`)

**Message handlers:**
- `TOGGLE` (from popup): read `tabId` from message or query active tab. Store `{enabled: boolean}` in `chrome.storage.session` keyed by tab ID. Forward `ENABLE_AUTOPLAY` or `DISABLE_AUTOPLAY` to the tab's content script.
- `VIDEO_ENDED` (from iframe content script): read `sender.tab.id`. If autoplay is enabled for that tab, send `CLICK_NEXT` to the parent frame (`frameId: 0`) of that tab.

**Lifecycle:**
- `chrome.tabs.onRemoved`: clean up state for closed tabs
- `chrome.tabs.onUpdated`: on navigation to a non-matching URL, clean up state

### Popup (`popup.html`, `popup.js`, `popup.css`)

- Query the active tab
- Ask background for current autoplay state for that tab
- Render a toggle switch (ON/OFF)
- On change, send `TOGGLE` message to background
- Minimal styling — native-looking toggle, no external dependencies

### Manifest (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "ECUST Course Autoplay",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://mooc1.s.ecust.edu.cn/mooc-ans/*"],
  "content_scripts": [
    {
      "matches": ["https://mooc1.s.ecust.edu.cn/mooc-ans/*"],
      "js": ["content.js"],
      "all_frames": true,
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

## Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| No `<video>` found | Content script polls via MutationObserver. Overlay shows "Waiting for video..." |
| No next button found | Logs to console. Overlay shows "Next button not found — paused" |
| Last chapter (no next) | Nothing to click. Overlay shows "Course complete" after video ends |
| User manually pauses | Ignored. Only the `ended` event triggers the next action |
| Video in nested iframe | Works if nested frame URL matches the host pattern. `all_frames: true` handles this |
| SPA navigation (no full reload) | MutationObserver detects new `<video>` elements and re-attaches listeners |
| Extension disabled mid-playback | Background stops forwarding. Content script is unloaded by Chrome on navigation |
| Anti-cheat minimum watch time | Extension does **not** bypass this. It only clicks "next" when the video genuinely ends. If the platform blocks the next button, the extension shows a warning and stops |
| Multiple video elements | Targets the largest visible `<video>` or the one with the longest duration |
| Platform UI changes | Selector fallback strategy (3 attempts) provides resilience against minor DOM changes |

## Testing Strategy

Since the target site requires university SSO login, automated end-to-end testing against the real site is not feasible.

**Local mock testing:**
- Create `test-page.html` with a `<video>` element and a "Next Chapter" button
- Load the unpacked extension and verify: toggle ON → play video → video ends → next button is clicked
- Verify toggle OFF does not trigger clicks

**Popup testing:**
- Toggle on/off and verify the icon/badge updates
- Verify state persists across popup closes

**Real-site testing:**
- Load the unpacked extension in Chrome
- Log into the ECUST platform, open a course
- Enable autoplay, play a video, let it finish
- Verify automatic advancement to the next chapter

## File Structure

```
chrome-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── popup.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── test/
    └── test-page.html
```

## Non-Goals

- Bypassing watch-time requirements or anti-cheat measures
- Supporting sites other than mooc1.s.ecust.edu.cn
- Downloading or manipulating video content
- Syncing state across devices (uses `chrome.storage.session`, not `sync`)
- Chrome Web Store distribution (loaded as unpacked extension)
