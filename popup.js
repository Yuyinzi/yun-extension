// Course Autoplay Extension — Popup

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggle-btn');
  const statusEl = document.getElementById('status');
  const testBtn = document.getElementById('test-btn');

  try {
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
        await chrome.runtime.sendMessage({ type: 'TOGGLE', tabId, enabled: newState });
        currentState = newState;
        updateUI(currentState);
      } catch (e) {
        console.error('Toggle failed:', e);
        statusEl.textContent = 'Error: ' + e.message;
      }
    });

    testBtn.addEventListener('click', async () => {
      statusEl.textContent = 'Testing...';
      for (let i = 0; i < 5; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'TEST_CLICK_NEXT' });
          statusEl.textContent = 'Test triggered — check page console';
          return;
        } catch (e) {
          if (i < 4) {
            statusEl.textContent = 'Retrying test... (' + (i + 1) + ')';
            await new Promise(r => setTimeout(r, 500));
          } else {
            statusEl.textContent = 'Test failed: page not ready. Refresh the course page.';
          }
        }
      }
    });

    function updateUI(enabled) {
      if (enabled) {
        toggleBtn.textContent = 'ON';
        toggleBtn.className = 'toggle-on';
        statusEl.textContent = 'Autoplay active';
        statusEl.style.color = '#22c55e';
        testBtn.style.display = 'block';
      } else {
        toggleBtn.textContent = 'OFF';
        toggleBtn.className = 'toggle-off';
        statusEl.textContent = 'Autoplay disabled';
        statusEl.style.color = '#888';
        testBtn.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Popup initialization failed:', e);
    statusEl.textContent = 'Error: unable to query tabs';
  }
});
