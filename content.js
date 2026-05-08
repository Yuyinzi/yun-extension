(function() {
  'use strict';

  if (window.__autoplayInjected) return;
  window.__autoplayInjected = true;

  const IS_IFRAME = window.self !== window.top;

  console.log(`[Course Autoplay] injected. iframe=${IS_IFRAME}`);

  if (IS_IFRAME) return;

  let autoplayEnabled = false;
  let overlayEl = null;
  let hasClickedNext = false;

  function createOverlay(text) {
    if (overlayEl) { overlayEl.textContent = text || 'Autoplay ON'; return; }
    overlayEl = document.createElement('div');
    overlayEl.id = 'autoplay-overlay';
    overlayEl.style.cssText = `
      position:fixed;top:16px;right:16px;z-index:999999;
      background:#22c55e;color:#fff;padding:8px 14px;
      border-radius:6px;font-family:sans-serif;font-size:13px;
      font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.2);
      pointer-events:none;
    `;
    overlayEl.textContent = text || 'Autoplay ON';
    document.body.appendChild(overlayEl);
  }

  function removeOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function isVisible(el) {
    return el && el.offsetParent !== null;
  }

  function findNextButton() {
    const selectors = [
      '#right1','[id^="right"]','.orientationright',
      '[onclick*="PCount.next"]','[data-action="next"]',
      '.next-btn','.next','.ans-next','.nextjob',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    const pat = /下一节|下一章|next chapter|continue/i;
    for (const el of document.querySelectorAll('a,button,span,div')) {
      if (isVisible(el) && pat.test(el.textContent.trim())) return el;
    }
    return null;
  }

  function clickNext() {
    if (!autoplayEnabled || hasClickedNext) return;

    const btn = findNextButton();
    if (btn) {
      hasClickedNext = true;
      console.log('[Course Autoplay] Clicking next button:', btn);
      createOverlay('Advancing...');
      btn.click();

      // Reset after 5 seconds — by then the new page should have loaded
      setTimeout(() => {
        hasClickedNext = false;
        console.log('[Course Autoplay] Reset after navigation');
        if (autoplayEnabled) createOverlay('Autoplay ON');
      }, 5000);
    } else {
      console.warn('[Course Autoplay] Next button not found');
      createOverlay('Next button not found');
    }
  }

  // Recursively check all nested iframes for video end signals
  function checkFrames(win) {
    for (const iframe of win.document.querySelectorAll('iframe')) {
      try {
        const doc = iframe.contentDocument;
        if (!doc) continue;
        if (doc.querySelector('.vjs-ended, .vjs-play-control.vjs-ended')) {
          console.log('[Course Autoplay] Detected .vjs-ended in iframe');
          return true;
        }
        const v = doc.querySelector('video');
        if (v && v.ended) {
          console.log('[Course Autoplay] Detected video.ended in iframe');
          return true;
        }
        if (doc.querySelector('iframe')) {
          const nested = checkFrames(iframe.contentWindow);
          if (nested) return true;
        }
      } catch (e) {}
    }
    return false;
  }

  // Poll every 2 seconds
  setInterval(() => {
    if (!autoplayEnabled || hasClickedNext) return;
    if (checkFrames(window)) clickNext();
  }, 2000);

  // Watch for ans-job-finished (backup signal)
  new MutationObserver(() => {
    if (!autoplayEnabled || hasClickedNext) return;
    const tasks = document.querySelectorAll('.ans-job-finished');
    for (const task of tasks) {
      if (task.querySelector('iframe[src*="/video/"], iframe[src*="ananas"]')) {
        console.log('[Course Autoplay] Detected ans-job-finished');
        clickNext();
        return;
      }
    }
  }).observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });

  // Message handler
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    console.log('[Course Autoplay] received:', msg);
    if (msg.type === 'ENABLE_AUTOPLAY') {
      autoplayEnabled = true;
      hasClickedNext = false;
      createOverlay();
      reply({ ok:true });
    }
    if (msg.type === 'DISABLE_AUTOPLAY') {
      autoplayEnabled = false;
      removeOverlay();
      reply({ ok:true });
    }
    if (msg.type === 'CLICK_NEXT' || msg.type === 'TEST_CLICK_NEXT') {
      if (msg.type === 'TEST_CLICK_NEXT') {
        console.log('[Course Autoplay] TEST: forcing click next');
        hasClickedNext = false;
      }
      clickNext();
      reply({ ok:true });
    }
    return false;
  });

  // Sync state on injection — retry if background isn't ready yet
  function syncState(attempt) {
    attempt = attempt || 1;
    chrome.runtime.sendMessage({ type:'GET_STATE', tabId:null }, (r) => {
      if (chrome.runtime.lastError) {
        if (attempt < 10) {
          console.log('[Course Autoplay] State sync failed, retrying (' + attempt + ')...');
          setTimeout(() => syncState(attempt + 1), 500);
        } else {
          console.log('[Course Autoplay] State sync gave up after 10 retries');
        }
        return;
      }
      if (r?.enabled) {
        console.log('[Course Autoplay] State sync: autoplay is ON');
        autoplayEnabled = true;
        hasClickedNext = false;
        createOverlay();
      } else {
        console.log('[Course Autoplay] State sync: autoplay is OFF');
      }
    });
  }
  syncState();
})();
