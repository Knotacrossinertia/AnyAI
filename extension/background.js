// Background service worker — fetches dashboard data on alarm

const DEFAULT_API_URL = 'https://api-ext.anyai.network';
const FAST = 0.5;  // 30s — UI open, matches backend refresh
const SLOW = 5;  // minutes — badge only, no UI

let uiPorts = 0;

// Initialize on install / startup
chrome.runtime.onInstalled.addListener(() => {
  smartSetup();
  fetchData();
});

chrome.runtime.onStartup.addListener(() => {
  smartSetup();
  fetchData();
});

// Track active UI connections (popup / sidepanel)
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'ui') return;
  uiPorts++;
  if (uiPorts === 1) smartSetup();
  fetchData();
  port.onDisconnect.addListener(() => {
    uiPorts--;
    if (uiPorts === 0) smartSetup();
  });
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchDashboard') {
    fetchData();
  }
});

async function smartSetup() {
  chrome.alarms.clear('fetchDashboard');
  if (uiPorts > 0) {
    chrome.alarms.create('fetchDashboard', { periodInMinutes: FAST });
  } else {
    const { badgeCoin } = await chrome.storage.local.get(['badgeCoin']);
    if (badgeCoin && badgeCoin !== 'none') {
      chrome.alarms.create('fetchDashboard', { periodInMinutes: SLOW });
    }
    // badge off → no alarm
  }
}

async function fetchData() {
  const settings = await chrome.storage.local.get(['apiUrl']);
  const apiUrl = settings.apiUrl || DEFAULT_API_URL;

  try {
    const resp = await fetch(`${apiUrl}/api/dashboard`, {
      signal: AbortSignal.timeout(8000)
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();

    await chrome.storage.local.set({
      dashboardData: data,
      lastFetch: Date.now(),
      connectionError: null
    });

    await updateBadge(data);
  } catch (err) {
    console.error('Fetch error:', err.message);
    await chrome.storage.local.set({
      connectionError: err.message,
      lastFetch: Date.now()
    });
  }
}

// Badge — show live price or sentiment on extension icon
async function updateBadge(data) {
  const settings = await chrome.storage.local.get(['badgeCoin']);
  const coin = settings.badgeCoin || 'none';

  if (coin === 'none' || !data) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }

  if (coin === 'sentiment') {
    if (!data.sentiment) { await chrome.action.setBadgeText({ text: '' }); return; }
    const v = data.sentiment.value;
    const color = v <= 25 ? '#ef4444' : v <= 40 ? '#f97316' : v <= 60 ? '#777' : v <= 75 ? '#2DD4BF' : '#22c55e';
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
    await chrome.action.setBadgeText({ text: String(v) });
    return;
  }

  if (!data[coin]) { await chrome.action.setBadgeText({ text: '' }); return; }
  const info = data[coin];
  const price = info.price || 0;
  const color = (info.change_24h != null && info.change_24h < 0) ? '#ef4444' : '#2DD4BF';
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  await chrome.action.setBadgeText({ text: formatBadgePrice(price) });
}

function formatBadgePrice(p) {
  if (p >= 1e6) return (p / 1e6).toFixed(1) + 'M';
  if (p >= 10000) return (p / 1000).toFixed(1) + 'K';
  if (p >= 1000) return (p / 1000).toFixed(1) + 'K';
  return Math.round(p).toString();
}

// Re-update badge & polling when badgeCoin setting changes
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.badgeCoin) {
    smartSetup();
    const store = await chrome.storage.local.get(['dashboardData']);
    if (store.dashboardData) await updateBadge(store.dashboardData);
  }
});

// Listen for manual refresh requests from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'refresh') {
    fetchData().then(() => sendResponse({ ok: true }));
    return true; // async response
  }
  if (msg.action === 'updateSettings') {
    smartSetup();
    sendResponse({ ok: true });
  }
});
