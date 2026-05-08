// Course Autoplay Extension — Popup

const _ = chrome.i18n.getMessage.bind(chrome.i18n);

document.addEventListener('DOMContentLoaded', async () => {
  // Set static text from locale strings
  const titleEl = document.getElementById('popup-title');
  if (titleEl) titleEl.textContent = _('popupTitle');
  const subtitleEl = document.getElementById('popup-subtitle');
  if (subtitleEl) subtitleEl.textContent = _('popupSubtitle');
  const labelAutoEl = document.getElementById('label-autoplay');
  if (labelAutoEl) labelAutoEl.textContent = _('labelAutoplay');
  const labelStatusEl = document.getElementById('label-status');
  if (labelStatusEl) labelStatusEl.textContent = _('labelStatus');

  const toggleInput = document.getElementById('toggle-input');
  const switchLabel = document.getElementById('switch-label');
  const statusEl = document.getElementById('status');
  const signalDot = document.getElementById('signal-dot');
  const testBtn = document.getElementById('test-btn');
  if (testBtn) testBtn.textContent = _('btnTest');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusEl.textContent = _('statusNoTab');
      statusEl.className = 'status-value error';
      switchLabel.style.pointerEvents = 'none';
      switchLabel.style.opacity = '0.4';
      return;
    }

    const tabId = tab.id;
    const isCoursePage = tab.url && tab.url.includes('mooc1.s.ecust.edu.cn/mooc-ans');

    if (!isCoursePage) {
      statusEl.textContent = _('statusNotCoursePage');
      statusEl.className = 'status-value error';
      switchLabel.style.pointerEvents = 'none';
      switchLabel.style.opacity = '0.4';
      return;
    }

    let currentState = false;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE', tabId });
      currentState = response?.enabled || false;
    } catch (e) {
      console.warn('Failed to get state:', e);
    }

    updateUI(currentState);

    toggleInput.addEventListener('change', async () => {
      const newState = toggleInput.checked;
      try {
        await chrome.runtime.sendMessage({ type: 'TOGGLE', tabId, enabled: newState });
        currentState = newState;
        updateUI(currentState);
      } catch (e) {
        console.error('Toggle failed:', e);
        statusEl.textContent = _('statusError');
        statusEl.className = 'status-value error';
        toggleInput.checked = currentState;
      }
    });

    testBtn.addEventListener('click', async () => {
      statusEl.textContent = _('statusTesting');
      statusEl.className = 'status-value';
      for (let i = 0; i < 5; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'TEST_CLICK_NEXT' });
          statusEl.textContent = _('statusTestSent');
          statusEl.className = 'status-value active';
          setTimeout(() => {
            if (currentState) {
              statusEl.textContent = _('statusArmed');
              statusEl.className = 'status-value active';
            }
          }, 1500);
          return;
        } catch (e) {
          if (i < 4) {
            statusEl.textContent = _('statusTestRetry', [(i + 1).toString()]);
            await new Promise(r => setTimeout(r, 500));
          } else {
            statusEl.textContent = _('statusTestFailed');
            statusEl.className = 'status-value error';
          }
        }
      }
    });

    function updateUI(enabled) {
      toggleInput.checked = enabled;
      if (enabled) {
        statusEl.textContent = _('statusArmed');
        statusEl.className = 'status-value active';
        signalDot.classList.add('active');
        testBtn.style.display = 'block';
      } else {
        statusEl.textContent = _('statusStandby');
        statusEl.className = 'status-value';
        signalDot.classList.remove('active');
        testBtn.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Popup initialization failed:', e);
    statusEl.textContent = _('statusInitError');
    statusEl.className = 'status-value error';
  }
});
