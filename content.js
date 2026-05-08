(function() {
  'use strict';

  if (window.__autoplayInjected) return;
  window.__autoplayInjected = true;

  const IS_IFRAME = window.self !== window.top;

  console.log(`[Course Autoplay] injected. iframe=${IS_IFRAME}`);

  if (IS_IFRAME) return;

  let autoplayEnabled = false;
  let overlayEl = null;
  let hideTimeout = null;
  let hasClickedNext = false;
  let hasClickedPlay = false;

  const _ = (typeof chrome !== 'undefined' && chrome.i18n)
    ? chrome.i18n.getMessage.bind(chrome.i18n)
    : (key) => key;

  function createOverlay(text) {
    if (overlayEl) {
      updateOverlay(text || _('overlayOn'));
      return;
    }
    overlayEl = document.createElement('div');
    overlayEl.id = 'autoplay-indicator';
    overlayEl.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:999999;
      display:flex;align-items:center;gap:8px;
      padding:8px 14px;
      background:rgba(20,22,24,0.85);backdrop-filter:blur(12px);
      border:1px solid rgba(232,168,56,0.35);border-radius:24px;
      font-family:'SF Pro Display',-apple-system,sans-serif;font-size:12px;
      font-weight:500;color:#e8a838;letter-spacing:0.2px;
      box-shadow:0 4px 24px rgba(0,0,0,0.4),0 0 0 1px rgba(232,168,56,0.1);
      pointer-events:auto;cursor:default;
      transition:opacity 0.4s ease,transform 0.4s cubic-bezier(0.34,1.56,0.64,1);
      opacity:0;transform:translateY(12px) scale(0.95);
    `;
    overlayEl.innerHTML = `
      <span style="width:6px;height:6px;border-radius:50%;background:#e8a838;box-shadow:0 0 6px rgba(232,168,56,0.6);animation:pulse 2s ease-in-out infinite;display:inline-block;"></span>
      <span id="autoplay-indicator-text">${text || _('overlayOn')}</span>
    `;
    // Inject pulse keyframe if not present
    if (!document.getElementById('autoplay-indicator-styles')) {
      const style = document.createElement('style');
      style.id = 'autoplay-indicator-styles';
      style.textContent = `
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(overlayEl);
    // Trigger entrance animation
    requestAnimationFrame(() => {
      overlayEl.style.opacity = '1';
      overlayEl.style.transform = 'translateY(0) scale(1)';
    });
    // Auto-hide after 5s
    scheduleHide();
    // Show on hover
    overlayEl.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
      overlayEl.style.opacity = '1';
      overlayEl.style.transform = 'translateY(0) scale(1)';
    });
    overlayEl.addEventListener('mouseleave', scheduleHide);
  }

  function updateOverlay(text) {
    if (!overlayEl) return;
    const txt = overlayEl.querySelector('#autoplay-indicator-text');
    if (txt) txt.textContent = text;
    overlayEl.style.opacity = '1';
    overlayEl.style.transform = 'translateY(0) scale(1)';
    scheduleHide();
  }

  function scheduleHide() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      if (overlayEl && autoplayEnabled) {
        overlayEl.style.opacity = '0';
        overlayEl.style.transform = 'translateY(12px) scale(0.95)';
      }
    }, 5000);
  }

  function removeOverlay() {
    if (hideTimeout) clearTimeout(hideTimeout);
    if (overlayEl) {
      overlayEl.style.opacity = '0';
      overlayEl.style.transform = 'translateY(12px) scale(0.95)';
      setTimeout(() => {
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
      }, 400);
    }
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
      createOverlay(_('overlayAdvancing'));
      btn.click();

      // Reset after 5 seconds — by then the new page should have loaded
      setTimeout(() => {
        hasClickedNext = false;
        console.log('[Course Autoplay] Reset after navigation');
        if (autoplayEnabled) createOverlay(_('overlayOn'));
      }, 5000);
    } else {
      console.warn('[Course Autoplay] Next button not found');
      createOverlay(_('overlayNotFound'));
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

  // Recursively find and click the big play button in nested iframes
  function findAndClickPlayButton(win) {
    for (const iframe of win.document.querySelectorAll('iframe')) {
      try {
        const doc = iframe.contentDocument;
        if (!doc) continue;
        const btn = doc.querySelector('.vjs-big-play-button');
        if (btn && isVisible(btn)) {
          console.log('[Course Autoplay] Clicking big play button');
          btn.click();
          return true;
        }
        // Also check the video element's paused state as a hint
        const video = doc.querySelector('video');
        if (video && video.paused && !hasClickedPlay) {
          // Try clicking the video itself if no big play button but video is paused
          const playBtn = doc.querySelector('.vjs-play-control, .vjs-big-play-button');
          if (playBtn && isVisible(playBtn)) {
            console.log('[Course Autoplay] Clicking play control');
            playBtn.click();
            return true;
          }
        }
        if (doc.querySelector('iframe')) {
          const nested = findAndClickPlayButton(iframe.contentWindow);
          if (nested) return true;
        }
      } catch (e) {}
    }
    return false;
  }

  // Poll every 2 seconds for video end → click next
  setInterval(() => {
    if (!autoplayEnabled || hasClickedNext) return;
    if (checkFrames(window)) clickNext();
  }, 2000);

  // Poll every 3 seconds for big play button → click play
  setInterval(() => {
    if (!autoplayEnabled) return;
    if (findAndClickPlayButton(window)) {
      hasClickedPlay = true;
      // Reset after 10s in case user goes back to a previous video
      setTimeout(() => { hasClickedPlay = false; }, 10000);
    }
  }, 3000);

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
      hasClickedPlay = false;
      createOverlay();
      reply({ ok:true });
    }
    if (msg.type === 'DISABLE_AUTOPLAY') {
      autoplayEnabled = false;
      removeOverlay();
      reply({ ok:true });
    }
    if (msg.type === 'CLICK_NEXT') {
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
        hasClickedPlay = false;
        createOverlay();
      } else {
        console.log('[Course Autoplay] State sync: autoplay is OFF');
      }
    });
  }
  syncState();
})();
