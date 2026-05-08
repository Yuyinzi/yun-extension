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

    function updateUI(enabled) {
      toggleInput.checked = enabled;
      if (enabled) {
        statusEl.textContent = _('statusArmed');
        statusEl.className = 'status-value active';
        signalDot.classList.add('active');
      } else {
        statusEl.textContent = _('statusStandby');
        statusEl.className = 'status-value';
        signalDot.classList.remove('active');
      }
    }
  } catch (e) {
    console.error('Popup initialization failed:', e);
    statusEl.textContent = _('statusInitError');
    statusEl.className = 'status-value error';
  }
});
