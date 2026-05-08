// Course Autoplay Extension — Background Service Worker

const STORAGE_KEY = 'autoplayTabs';

async function getTabState(tabId) {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  const tabs = result[STORAGE_KEY] || {};
  return tabs[tabId] || { enabled: false };
}

async function setTabState(tabId, enabled) {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  const tabs = result[STORAGE_KEY] || {};
  tabs[tabId] = { enabled, updatedAt: Date.now() };
  await chrome.storage.session.set({ [STORAGE_KEY]: tabs });
}

async function deleteTabState(tabId) {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  const tabs = result[STORAGE_KEY] || {};
  delete tabs[tabId];
  await chrome.storage.session.set({ [STORAGE_KEY]: tabs });
}

// --- Message handlers ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Course Autoplay BG] Received:', message);

  if (message.type === 'TOGGLE') {
    const tabId = message.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID' });
      return false;
    }

    const enabled = message.enabled;
    setTabState(tabId, enabled);

    const msgType = enabled ? 'ENABLE_AUTOPLAY' : 'DISABLE_AUTOPLAY';
    chrome.tabs.sendMessage(tabId, { type: msgType }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Course Autoplay BG] Error sending to tab:', chrome.runtime.lastError.message);
      }
    });

    sendResponse({ success: true, tabId, enabled });
    return false;
  }

  if (message.type === 'GET_STATE') {
    const tabId = message.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ enabled: false });
      return false;
    }
    getTabState(tabId).then(state => {
      sendResponse({ enabled: state.enabled });
    });
    return true; // async response
  }

  return false;
});

// --- Lifecycle cleanup ---

chrome.tabs.onRemoved.addListener((tabId) => {
  deleteTabState(tabId);
  console.log('[Course Autoplay BG] Cleaned up tab', tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && !changeInfo.url.includes('mooc1.s.ecust.edu.cn/mooc-ans')) {
    deleteTabState(tabId);
    console.log('[Course Autoplay BG] Cleaned up navigated tab', tabId);
  }
});

console.log('[Course Autoplay BG] Service worker started');
