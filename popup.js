// Course Autoplay Extension — Popup

document.addEventListener('DOMContentLoaded', async () => {
  const toggleInput = document.getElementById('toggle-input');
  const switchLabel = document.getElementById('switch-label');
  const statusEl = document.getElementById('status');
  const signalDot = document.getElementById('signal-dot');
  const testBtn = document.getElementById('test-btn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusEl.textContent = 'no tab';
      statusEl.className = 'status-value error';
      switchLabel.style.pointerEvents = 'none';
      switchLabel.style.opacity = '0.4';
      return;
    }

    const tabId = tab.id;
    const isCoursePage = tab.url && tab.url.includes('mooc1.s.ecust.edu.cn/mooc-ans');

    if (!isCoursePage) {
      statusEl.textContent = 'not on course page';
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
        statusEl.textContent = 'error';
        statusEl.className = 'status-value error';
        toggleInput.checked = currentState;
      }
    });

    testBtn.addEventListener('click', async () => {
      statusEl.textContent = 'testing...';
      statusEl.className = 'status-value';
      for (let i = 0; i < 5; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'TEST_CLICK_NEXT' });
          statusEl.textContent = 'test sent';
          statusEl.className = 'status-value active';
          setTimeout(() => {
            if (currentState) {
              statusEl.textContent = 'armed';
              statusEl.className = 'status-value active';
            }
          }, 1500);
          return;
        } catch (e) {
          if (i < 4) {
            statusEl.textContent = 'retry ' + (i + 1) + '/4';
            await new Promise(r => setTimeout(r, 500));
          } else {
            statusEl.textContent = 'failed — refresh page';
            statusEl.className = 'status-value error';
          }
        }
      }
    });

    function updateUI(enabled) {
      toggleInput.checked = enabled;
      if (enabled) {
        statusEl.textContent = 'armed';
        statusEl.className = 'status-value active';
        signalDot.classList.add('active');
        testBtn.style.display = 'block';
      } else {
        statusEl.textContent = 'standby';
        statusEl.className = 'status-value';
        signalDot.classList.remove('active');
        testBtn.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Popup initialization failed:', e);
    statusEl.textContent = 'init error';
    statusEl.className = 'status-value error';
  }
});
