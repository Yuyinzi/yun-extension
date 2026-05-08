// Course Autoplay Extension — Background Service Worker

const STORAGE_KEY = 'autoplayTabs';

const ICON_DEFAULT = {
  16: 'icons/icon16.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

const ICON_ACTIVE = {
  16: 'icons/icon16-active.png',
  48: 'icons/icon48-active.png',
  128: 'icons/icon128-active.png',
};

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

async function updateIcon(tabId, enabled) {
  try {
    await chrome.action.setIcon({
      tabId,
      path: enabled ? ICON_ACTIVE : ICON_DEFAULT,
    });
  } catch (e) {
    console.warn('[Course Autoplay BG] Failed to set icon:', e.message);
  }
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
    updateIcon(tabId, enabled);

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
  updateIcon(tabId, false);
  console.log('[Course Autoplay BG] Cleaned up tab', tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && !changeInfo.url.includes('mooc1.s.ecust.edu.cn/mooc-ans')) {
    deleteTabState(tabId);
    updateIcon(tabId, false);
    console.log('[Course Autoplay BG] Cleaned up navigated tab', tabId);
  }
});

// Also sync icon when a tab is activated (user switches tabs)
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const state = await getTabState(tabId);
  updateIcon(tabId, state.enabled);
});

console.log('[Course Autoplay BG] Service worker started');
