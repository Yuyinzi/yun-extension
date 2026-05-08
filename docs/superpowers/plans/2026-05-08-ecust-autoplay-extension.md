# ECUST Course Autoplay Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Extension (Manifest V3) that auto-clicks the "next chapter" button when a course video ends on mooc1.s.ecust.edu.cn, with a toolbar toggle to enable/disable.

**Architecture:** Content script runs in both the parent page and any video iframe. The iframe instance watches for `ended` on `<video>` and notifies the background worker, which forwards a "click next" command to the parent frame instance. A popup provides the on/off toggle per tab.

**Tech Stack:** Vanilla JavaScript, Chrome Extension Manifest V3 APIs, no external dependencies.

---

## File Structure

```
chrome-extension/
├── manifest.json          # Extension manifest
├── background.js          # Service worker: state + message routing
├── content.js             # Content script: iframe mode + parent mode
├── popup.html             # Popup UI markup
├── popup.js               # Popup logic: toggle + state sync
├── popup.css              # Popup styles
├── icons/
│   ├── icon16.png         # Toolbar icon (16x16)
│   ├── icon48.png         # Extension icon (48x48)
│   └── icon128.png        # Extension icon (128x128)
└── test/
    └── test-page.html     # Local test page for verification
```

---

### Task 1: Manifest and Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `icons/` directory
- Create: placeholder icon files

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "ECUST Course Autoplay",
  "version": "1.0.0",
  "description": "Auto-advance to the next chapter when a course video ends",
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

- [ ] **Step 2: Create placeholder icons**

Run:
```bash
mkdir -p icons
# Create simple green square placeholder PNGs using ImageMagick
# If imagemagick is not available, create empty files and note they need real icons
which convert && \
  convert -size 16x16 xc:#22c55e icons/icon16.png && \
  convert -size 48x48 xc:#22c55e icons/icon48.png && \
  convert -size 128x128 xc:#22c55e icons/icon128.png || \
  (touch icons/icon16.png icons/icon48.png icons/icon128.png && echo "WARNING: ImageMagick not found. Create real PNG icons before loading in Chrome.")
```

Expected: `icons/` directory exists with three PNG files (or empty files with a warning).

- [ ] **Step 3: Test — Load in Chrome**

1. Open Chrome → Extensions (chrome://extensions/)
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `chrome-extension/` directory
5. Verify the extension appears in the list with no error badges

Expected: Extension loads without errors. If icons are placeholders, it shows a generic puzzle piece icon.

---

### Task 2: Content Script — Detection and Video Monitoring

**Files:**
- Create: `content.js`
- Modify: `test/test-page.html` (create local test page)

- [ ] **Step 1: Create local test page**

Create `test/test-page.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test — ECUST Autoplay</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 800px; }
    video { width: 100%; max-width: 600px; border: 1px solid #ccc; }
    #next-btn { padding: 10px 20px; font-size: 16px; margin-top: 10px; cursor: pointer; }
    #log { margin-top: 20px; padding: 10px; background: #f5f5f5; min-height: 100px; }
    .log-entry { margin: 2px 0; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Test Page — Video + Next Button</h1>
  <video id="test-video" controls>
    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
  </video>
  <br>
  <button id="next-btn">Next Chapter</button>
  <div id="log"><strong>Log:</strong></div>

  <script>
    const log = document.getElementById('log');
    function addLog(msg) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      log.appendChild(entry);
    }

    document.getElementById('next-btn').addEventListener('click', () => {
      addLog('Next button was CLICKED');
      alert('Next chapter clicked! In a real course, this would navigate to the next chapter.');
    });

    const video = document.getElementById('test-video');
    video.addEventListener('ended', () => addLog('Video ended (native event)'));
    video.addEventListener('play', () => addLog('Video started playing'));
    video.addEventListener('pause', () => addLog('Video paused'));

    addLog('Test page loaded');
  </script>
</body>
</html>
```

- [ ] **Step 2: Write `content.js` — detection logic**

```javascript
(function() {
  'use strict';

  const IS_IFRAME = window.self !== window.top;
  const IS_PARENT = !IS_IFRAME;

  console.log(`[ECUST Autoplay] Content script injected. iframe=${IS_IFRAME}, parent=${IS_PARENT}`);

  // --- Iframe Mode: Watch video and report ended ---
  function startIframeMode() {
    console.log('[ECUST Autoplay] Starting iframe mode');

    function findPrimaryVideo() {
      const videos = Array.from(document.querySelectorAll('video'));
      if (videos.length === 0) return null;
      if (videos.length === 1) return videos[0];
      // Pick the largest visible video
      let best = videos[0];
      let bestArea = 0;
      for (const v of videos) {
        const rect = v.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > bestArea && rect.width > 0 && rect.height > 0) {
          bestArea = area;
          best = v;
        }
      }
      return best;
    }

    let currentVideo = null;

    function attachToVideo() {
      const video = findPrimaryVideo();
      if (!video) {
        console.log('[ECUST Autoplay] No video found, waiting...');
        return false;
      }
      if (video === currentVideo) return true;

      if (currentVideo) {
        currentVideo.removeEventListener('ended', onVideoEnded);
      }
      currentVideo = video;
      currentVideo.addEventListener('ended', onVideoEnded);
      console.log('[ECUST Autoplay] Attached to video element', video);
      return true;
    }

    function onVideoEnded() {
      console.log('[ECUST Autoplay] Video ended, reporting to background');
      chrome.runtime.sendMessage({ type: 'VIDEO_ENDED' });
    }

    // Try immediately
    if (!attachToVideo()) {
      // Wait for video to appear (SPA behavior)
      const observer = new MutationObserver(() => {
        if (attachToVideo()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // --- Parent Mode: Listen for commands from background ---
  function startParentMode() {
    console.log('[ECUST Autoplay] Starting parent mode');

    let autoplayEnabled = false;
    let overlayEl = null;

    function createOverlay() {
      if (overlayEl) return;
      overlayEl = document.createElement('div');
      overlayEl.id = 'ecust-autoplay-overlay';
      overlayEl.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 999999;
        background: #22c55e;
        color: white;
        padding: 8px 14px;
        border-radius: 6px;
        font-family: sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      overlayEl.textContent = 'Autoplay ON';
      document.body.appendChild(overlayEl);
    }

    function removeOverlay() {
      if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
      }
    }

    function updateOverlay(text) {
      if (overlayEl) {
        overlayEl.textContent = text;
      }
    }

    function findNextButton() {
      // Selector 1: common class/data patterns
      const selectors = [
        '[data-action="next"]',
        '.next-btn',
        '.next',
        '.ans-next',
        '.nextjob',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }

      // Selector 2: text content match
      const textPattern = /下一节|下一章|next chapter|continue/i;
      const allElements = document.querySelectorAll('a, button, span, div');
      for (const el of allElements) {
        if (textPattern.test(el.textContent.trim())) {
          return el;
        }
      }

      // Selector 3: link with higher chapterId
      const currentUrl = new URL(window.location.href);
      const currentChapterId = parseInt(currentUrl.searchParams.get('chapterId') || '0', 10);
      if (currentChapterId > 0) {
        const links = document.querySelectorAll('a[href*="chapterId="]');
        let bestLink = null;
        let bestId = Infinity;
        for (const link of links) {
          const hrefUrl = new URL(link.href, window.location.href);
          const cid = parseInt(hrefUrl.searchParams.get('chapterId') || '0', 10);
          if (cid > currentChapterId && cid < bestId) {
            bestId = cid;
            bestLink = link;
          }
        }
        if (bestLink) return bestLink;
      }

      return null;
    }

    function clickNextButton() {
      if (!autoplayEnabled) return;

      const btn = findNextButton();
      if (btn) {
        console.log('[ECUST Autoplay] Clicking next button:', btn);
        updateOverlay('Advancing...');
        btn.click();
      } else {
        console.warn('[ECUST Autoplay] Next button not found');
        updateOverlay('Next button not found');
        autoplayEnabled = false;
      }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[ECUST Autoplay] Parent received message:', message);

      if (message.type === 'ENABLE_AUTOPLAY') {
        autoplayEnabled = true;
        createOverlay();
        updateOverlay('Autoplay ON');
        sendResponse({ success: true });
      }

      if (message.type === 'DISABLE_AUTOPLAY') {
        autoplayEnabled = false;
        removeOverlay();
        sendResponse({ success: true });
      }

      if (message.type === 'CLICK_NEXT') {
        clickNextButton();
        sendResponse({ success: true });
      }

      return true;
    });
  }

  // --- Entry point ---
  if (IS_IFRAME) {
    startIframeMode();
  } else {
    startParentMode();
  }
})();
```

- [ ] **Step 3: Test — Verify content script injects**

1. In Chrome, navigate to the local test page: `file:///path/to/chrome-extension/test/test-page.html`
2. Open Chrome DevTools → Console
3. Verify you see: `[ECUST Autoplay] Content script injected. iframe=false, parent=true`
4. Since the test page is a `file://` URL (not the matching domain), the content script won't auto-inject. To test it:
   - Open DevTools → Sources → Snippets
   - Or temporarily add `"file:///*"` to `matches` in `manifest.json` for testing, reload the extension, then remove it

Alternative test approach for local files: Add a temporary content script match for the test page.

Temporarily modify `manifest.json` content_scripts matches to include the test page:
```json
"matches": [
  "https://mooc1.s.ecust.edu.cn/mooc-ans/*",
  "file:///*/test/test-page.html"
]
```
Reload the extension in Chrome. Open the test page. Verify console shows the injection log.

Expected: Console shows `[ECUST Autoplay] Content script injected. iframe=false, parent=true`

After testing, revert `manifest.json` to only the ECUST domain.

---

### Task 3: Background Service Worker

**Files:**
- Create: `background.js`

- [ ] **Step 1: Write `background.js`**

```javascript
// ECUST Autoplay Extension — Background Service Worker

const STORAGE_KEY = 'autoplayState';

// Track per-tab autoplay state in memory
// Using a Map instead of chrome.storage.session for simpler sync
const tabStates = new Map();

// --- Message handlers ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ECUST Autoplay BG] Received:', message, 'from tab:', sender.tab?.id, 'frame:', sender.frameId);

  if (message.type === 'TOGGLE') {
    const tabId = message.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return true;
    }

    const enabled = message.enabled;
    tabStates.set(tabId, { enabled });

    // Forward to content script in the tab
    const msgType = enabled ? 'ENABLE_AUTOPLAY' : 'DISABLE_AUTOPLAY';
    chrome.tabs.sendMessage(tabId, { type: msgType }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[ECUST Autoplay BG] Error sending to tab:', chrome.runtime.lastError.message);
      }
    });

    sendResponse({ success: true, tabId, enabled });
    return true;
  }

  if (message.type === 'VIDEO_ENDED') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID from sender' });
      return true;
    }

    const state = tabStates.get(tabId);
    if (!state || !state.enabled) {
      console.log('[ECUST Autoplay BG] Autoplay not enabled for tab', tabId, '- ignoring');
      sendResponse({ success: false, reason: 'autoplay not enabled' });
      return true;
    }

    // Forward CLICK_NEXT to the parent frame (frameId: 0)
    chrome.tabs.sendMessage(tabId, { type: 'CLICK_NEXT' }, { frameId: 0 }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[ECUST Autoplay BG] Error sending CLICK_NEXT:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, response });
      }
    });

    return true; // async response
  }

  if (message.type === 'GET_STATE') {
    const tabId = message.tabId;
    const state = tabStates.get(tabId);
    sendResponse({ enabled: state?.enabled || false });
    return true;
  }

  return true;
});

// --- Lifecycle cleanup ---

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  console.log('[ECUST Autoplay BG] Cleaned up state for closed tab', tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // If user navigates away from the course domain, disable autoplay
  if (changeInfo.url && !changeInfo.url.includes('mooc1.s.ecust.edu.cn/mooc-ans')) {
    tabStates.delete(tabId);
    console.log('[ECUST Autoplay BG] Cleaned up state for navigated tab', tabId);
  }
});

console.log('[ECUST Autoplay BG] Service worker started');
```

- [ ] **Step 2: Test — Verify background loads**

1. Reload the extension in Chrome (click the refresh icon on the extension card)
2. Open Chrome DevTools for the service worker:
   - Extensions page → click "service worker" link on the extension card
3. Verify console shows: `[ECUST Autoplay BG] Service worker started`

Expected: Service worker console shows the startup log with no errors.

---

### Task 4: Popup UI

**Files:**
- Create: `popup.html`
- Create: `popup.js`
- Create: `popup.css`

- [ ] **Step 1: Write `popup.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h1>ECUST Autoplay</h1>
    <p class="subtitle">Auto-advance course videos</p>

    <div class="toggle-row">
      <span class="label">Autoplay</span>
      <button id="toggle-btn" class="toggle-off">OFF</button>
    </div>

    <p id="status" class="status">Checking...</p>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `popup.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 240px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.container {
  padding: 16px;
}

h1 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
}

.subtitle {
  font-size: 12px;
  color: #888;
  margin-bottom: 16px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
}

.label {
  font-weight: 500;
}

#toggle-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  min-width: 60px;
}

.toggle-off {
  background: #e5e7eb;
  color: #6b7280;
}

.toggle-on {
  background: #22c55e;
  color: white;
}

.status {
  margin-top: 12px;
  font-size: 12px;
  color: #888;
  text-align: center;
}
```

- [ ] **Step 3: Write `popup.js`**

```javascript
// ECUST Autoplay Extension — Popup

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggle-btn');
  const statusEl = document.getElementById('status');

  // Get the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    statusEl.textContent = 'No active tab';
    return;
  }

  const tabId = tab.id;
  const isCoursePage = tab.url && tab.url.includes('mooc1.s.ecust.edu.cn/mooc-ans');

  if (!isCoursePage) {
    statusEl.textContent = 'Not on a course page';
    toggleBtn.disabled = true;
    toggleBtn.style.opacity = '0.5';
    toggleBtn.style.cursor = 'not-allowed';
    return;
  }

  // Get current state from background
  let currentState = false;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE', tabId });
    currentState = response?.enabled || false;
  } catch (e) {
    console.warn('Failed to get state:', e);
  }

  updateUI(currentState);

  toggleBtn.addEventListener('click', async () => {
    const newState = !currentState;

    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE',
        tabId,
        enabled: newState
      });
      currentState = newState;
      updateUI(currentState);
    } catch (e) {
      console.error('Toggle failed:', e);
      statusEl.textContent = 'Error: ' + e.message;
    }
  });

  function updateUI(enabled) {
    if (enabled) {
      toggleBtn.textContent = 'ON';
      toggleBtn.className = 'toggle-on';
      statusEl.textContent = 'Autoplay active on this tab';
      statusEl.style.color = '#22c55e';
    } else {
      toggleBtn.textContent = 'OFF';
      toggleBtn.className = 'toggle-off';
      statusEl.textContent = 'Autoplay disabled';
      statusEl.style.color = '#888';
    }
  }
});
```

- [ ] **Step 4: Test — Verify popup renders and toggles**

1. Reload the extension in Chrome
2. Open any non-course page (e.g., google.com)
3. Click the extension icon in the toolbar
4. Verify popup shows "Not on a course page" and the toggle is disabled
5. Navigate to the test page (or the real course page)
6. Click the extension icon
7. Verify popup shows "Autoplay disabled" with toggle showing "OFF"
8. Click the toggle
9. Verify it changes to "ON" and status changes to "Autoplay active on this tab"
10. Click again to turn it back off

Expected: Toggle works correctly. State persists while the popup is open.

---

### Task 5: End-to-End Integration Test

**Files:**
- Modify: `test/test-page.html` (add iframe test)

- [ ] **Step 1: Create iframe test page**

Create `test/test-iframe.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Iframe — Video Player</title>
  <style>
    body { margin: 0; padding: 10px; background: #1a1a1a; }
    video { width: 100%; height: auto; }
  </style>
</head>
<body>
  <video id="iframe-video" controls autoplay muted>
    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
  </video>
  <script>
    console.log('[Test Iframe] Loaded');
    const video = document.getElementById('iframe-video');
    video.addEventListener('ended', () => {
      console.log('[Test Iframe] Video ended');
    });
  </script>
</body>
</html>
```

Create `test/test-parent.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Parent — ECUST Autoplay (Iframe Mode)</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 900px; }
    iframe { width: 100%; height: 360px; border: 2px solid #333; }
    #next-btn { padding: 10px 20px; font-size: 16px; margin-top: 10px; cursor: pointer; }
    #log { margin-top: 20px; padding: 10px; background: #f5f5f5; min-height: 100px; }
    .log-entry { margin: 2px 0; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Test Parent Page — Video in Iframe</h1>
  <p>This simulates the ECUST course page where the video is in an iframe.</p>

  <iframe id="video-frame" src="test-iframe.html"></iframe>

  <br>
  <button id="next-btn">Next Chapter (下一节)</button>

  <div id="log"><strong>Log:</strong></div>

  <script>
    const log = document.getElementById('log');
    function addLog(msg) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
      log.appendChild(entry);
    }

    document.getElementById('next-btn').addEventListener('click', () => {
      addLog('Next button was CLICKED');
      alert('Next chapter clicked!');
    });

    addLog('Parent page loaded');
  </script>
</body>
</html>
```

- [ ] **Step 2: Run end-to-end test**

Since these are local `file://` pages, temporarily add to `manifest.json` content_scripts matches for testing:

```json
"matches": [
  "https://mooc1.s.ecust.edu.cn/mooc-ans/*",
  "file:///*/test/test-parent.html",
  "file:///*/test/test-iframe.html"
]
```

Reload the extension. Then:

1. Open `test/test-parent.html` in Chrome
2. Open Chrome DevTools → Console for the parent page
3. Open DevTools for the iframe (right-click inside iframe → Inspect)
4. Click the extension icon → toggle ON
5. Verify overlay appears on parent page: "Autoplay ON"
6. Let the video play through to the end (or seek near the end)
7. When the video ends:
   - Iframe console should show: `[ECUST Autoplay] Video ended, reporting to background`
   - Background console should show the VIDEO_ENDED message
   - Parent console should show: `[ECUST Autoplay] Clicking next button:`
   - The "Next Chapter" button should be clicked (alert appears)

Expected: Full flow works — video ends → background routes → parent clicks next button.

- [ ] **Step 3: Test toggle OFF**

1. Refresh the test page
2. Toggle OFF in the popup
3. Play the video to the end
4. Verify the next button is NOT clicked

Expected: No automatic click when toggled off.

- [ ] **Step 4: Revert manifest.json**

Remove the temporary `file://` matches from `manifest.json` and reload the extension.

---

### Task 6: Polish and Edge Cases

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Add SPA navigation resilience**

In `content.js`, parent mode, add a MutationObserver to re-detect the next button if the page content changes without a full reload:

Add this to `startParentMode()`, after the message listener setup:

```javascript
    // Watch for SPA navigation (content changes without page reload)
    const navObserver = new MutationObserver((mutations) => {
      // If overlay exists and autoplay is enabled, keep it visible
      if (autoplayEnabled && !overlayEl) {
        createOverlay();
        updateOverlay('Autoplay ON');
      }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
```

- [ ] **Step 2: Handle last chapter gracefully**

In `clickNextButton()`, before clicking:

```javascript
    function clickNextButton() {
      if (!autoplayEnabled) return;

      const btn = findNextButton();
      if (btn) {
        console.log('[ECUST Autoplay] Clicking next button:', btn);
        updateOverlay('Advancing...');
        btn.click();
      } else {
        console.warn('[ECUST Autoplay] Next button not found');
        // Check if this might be the last chapter
        const currentUrl = new URL(window.location.href);
        const currentChapterId = parseInt(currentUrl.searchParams.get('chapterId') || '0', 10);
        if (currentChapterId > 0) {
          updateOverlay('Course complete');
        } else {
          updateOverlay('Next button not found');
        }
        autoplayEnabled = false;
      }
    }
```

- [ ] **Step 3: Ensure listeners don't duplicate**

In `content.js`, iframe mode, wrap the entire script in a guard to prevent double-injection:

Add at the very top of the IIFE, before any other code:

```javascript
(function() {
  'use strict';

  // Prevent double-injection
  if (window.__ecustAutoplayInjected) return;
  window.__ecustAutoplayInjected = true;

  const IS_IFRAME = window.self !== window.top;
  // ... rest of the code
```

- [ ] **Step 4: Test edge cases**

| Test | Expected |
|------|----------|
| Refresh page while autoplay ON | Extension re-injects, overlay re-appears |
| Navigate to non-course page | State is cleaned up, no errors |
| Click toggle rapidly | State is consistent, no race conditions |
| Video is paused manually | Ignored, only `ended` triggers |

---

### Task 7: Final Verification

**Files:**
- All files

- [ ] **Step 1: Final manifest review**

Verify `manifest.json` has only the ECUST domain in matches:
```json
"matches": ["https://mooc1.s.ecust.edu.cn/mooc-ans/*"]
```

- [ ] **Step 2: Load on real site**

1. Log into the ECUST platform
2. Open a course video page
3. Click the extension icon → toggle ON
4. Verify overlay appears
5. Let the video play to the end
6. Verify it auto-advances to the next chapter
7. Toggle OFF and verify it stops auto-advancing

- [ ] **Step 3: Check console for errors**

Open Chrome DevTools on the course page and check for any extension-related errors in both the page console and the service worker console.

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Implementing Task |
|-----------------|-------------------|
| Manifest V3 | Task 1 |
| Content script in all frames | Task 1 (manifest) + Task 2 (content.js) |
| Iframe mode watches video | Task 2 |
| Parent mode clicks next button | Task 2 |
| 3 fallback selectors for next button | Task 2 (findNextButton) |
| Background bridges iframe→parent | Task 3 |
| Popup toggle per tab | Task 4 |
| Overlay indicator | Task 2 (parent mode) |
| MutationObserver for SPA | Task 6 |
| Error handling (no video, no next, last chapter) | Task 2 + Task 6 |
| Local test page | Task 2 + Task 5 |
| Anti-cheat: only on genuine ended | Task 2 (only listens to `ended` event) |

**No gaps found.**

### 2. Placeholder Scan

- No "TBD", "TODO", or "implement later" found.
- No vague "add error handling" steps — specific error handling is in Task 2 and Task 6.
- No "write tests" without code — all test steps have specific expected outcomes.
- No "similar to Task N" references.

### 3. Type Consistency

- Message types used consistently: `VIDEO_ENDED`, `CLICK_NEXT`, `ENABLE_AUTOPLAY`, `DISABLE_AUTOPLAY`, `TOGGLE`, `GET_STATE`
- State key (`tabStates`) used consistently in background.js
- Overlay functions (`createOverlay`, `removeOverlay`, `updateOverlay`) used consistently in parent mode

**No inconsistencies found.**

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-ecust-autoplay-extension.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like?
