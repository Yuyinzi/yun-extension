# Course Autoplay

> **This project is for learning purposes only.**

A Chrome Extension (Manifest V3) that automatically advances to the next chapter when a course video ends on an online learning platform.

## What it does

When watching course videos, this extension detects when a video finishes and clicks the "next chapter" button for you.

## How to use

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder
4. On a course page, click the extension icon and toggle **ON**
5. The extension stays active until you toggle **OFF**

## Files

- `manifest.json` — Extension configuration
- `content.js` — Detects video end and clicks next
- `background.js` — Manages toggle state
- `popup.html/js/css` — Toggle UI
- `test/` — Local test pages for development

## Learning goals

This project demonstrates:
- Chrome Extension Manifest V3 architecture
- Content scripts, background service workers, and popup communication
- Cross-frame DOM access and MutationObservers
- Message passing between extension components

## Disclaimer

This is an educational project created for learning browser extension development.
