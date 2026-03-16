document.addEventListener('DOMContentLoaded', async () => {
  chrome.runtime.connect({ name: 'ui' });

  // Detect side panel mode
  if (new URLSearchParams(location.search).has('sidepanel')) {
    document.body.classList.add('sidepanel');
  }

  await initI18n();
  loadData();
  initTooltip();

  // Pin button → open side panel
  document.getElementById('pin-btn').addEventListener('click', async () => {
    const win = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: win.id });
    window.close();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.dashboardData || changes.connectionError || changes.visibleCoins) loadData();
    if (changes.lang) initI18n().then(() => loadData());
  });

  // Settings panel toggle
  const dashboard = document.getElementById('dashboard');
  const settingsPanel = document.getElementById('settings-panel');

  document.getElementById('settings-btn').addEventListener('click', async () => {
    dashboard.style.display = 'none';
    settingsPanel.style.display = '';
    document.getElementById('opt-lang').value = getLang();
    const store = await chrome.storage.local.get(['badgeCoin', 'visibleCoins']);
    document.getElementById('opt-badge').value = store.badgeCoin || 'none';
    // Sync coin checkboxes
    const visible = store.visibleCoins || ['btc', 'eth', 'bnb', 'sol'];
    document.querySelectorAll('.coin-toggle input').forEach(cb => {
      cb.checked = visible.includes(cb.value);
    });
    applyI18n();
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    settingsPanel.style.display = 'none';
    dashboard.style.display = '';
  });

  // Language: instant apply + save
  document.getElementById('opt-lang').addEventListener('change', (e) => {
    setLang(e.target.value);
    loadData(); // refresh dashboard text
  });

  // Badge coin: instant save
  document.getElementById('opt-badge').addEventListener('change', (e) => {
    chrome.storage.local.set({ badgeCoin: e.target.value });
  });

  // Coin visibility: instant save + refresh
  document.querySelectorAll('.coin-toggle input').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('.coin-toggle input:checked')].map(el => el.value);
      chrome.storage.local.set({ visibleCoins: checked });
    });
  });

  // Open site link in new tab
  document.getElementById('site-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: e.currentTarget.href });
  });
});

async function loadData() {
  const store = await chrome.storage.local.get(['dashboardData', 'lastFetch', 'connectionError', 'visibleCoins']);

  const statusEl = document.getElementById('status');
  if (store.connectionError) {
    statusEl.className = 'status offline';
    statusEl.innerHTML = `<span class="dot"></span> ${t('offline')}`;
  } else {
    statusEl.className = 'status';
    statusEl.innerHTML = '';
  }

  const data = store.dashboardData;
  if (!data) return;

  // Apply coin visibility
  const visible = store.visibleCoins || ['btc', 'eth', 'bnb', 'sol'];
  document.querySelectorAll('.card[data-coin]').forEach(card => {
    card.style.display = visible.includes(card.dataset.coin) ? '' : 'none';
  });

  if (data.btc) renderCoin('btc', data.btc);
  if (data.eth) renderCoin('eth', data.eth);
  if (data.bnb) renderCoin('bnb', data.bnb);
  if (data.sol) renderCoin('sol', data.sol);
  if (data.sentiment) renderSentiment(data.sentiment);
  renderGlobal(data.global);
}

function renderCoin(prefix, coin) {
  // Prices — both equal weight
  const bnEl = document.getElementById(`${prefix}-bn-price`);
  const cbEl = document.getElementById(`${prefix}-cb-price`);
  const bnArrow = document.getElementById(`${prefix}-bn-arrow`);
  const cbArrow = document.getElementById(`${prefix}-cb-arrow`);
  const diffEl = document.getElementById(`${prefix}-diff`);

  const bnPrice = coin.price || 0;
  bnEl.textContent = bnPrice ? formatPrice(bnPrice) : '—';

  if (coin.premium && coin.premium.cb != null) {
    const cbPrice = coin.premium.cb;
    cbEl.textContent = formatPrice(cbPrice);

    // Arrow on the higher price
    if (cbPrice > bnPrice) {
      cbArrow.textContent = '\u25B2'; // ▲
      cbArrow.className = 'arrow up';
      bnArrow.textContent = '';
      bnArrow.className = 'arrow';
    } else if (bnPrice > cbPrice) {
      bnArrow.textContent = '\u25B2';
      bnArrow.className = 'arrow up';
      cbArrow.textContent = '';
      cbArrow.className = 'arrow';
    } else {
      bnArrow.textContent = '';
      bnArrow.className = 'arrow';
      cbArrow.textContent = '';
      cbArrow.className = 'arrow';
    }

    // Diff line below
    const diff = coin.premium.diff;
    const pct = coin.premium.pct;
    const sign = diff >= 0 ? '+' : '';
    diffEl.textContent = `${sign}${formatDiff(diff)} (${sign}${pct.toFixed(2)}%)`;
    diffEl.className = 'diff-line ' + (diff >= 0 ? 'up' : 'down');
  } else {
    cbEl.textContent = '—';
    bnArrow.textContent = '';
    bnArrow.className = 'arrow';
    cbArrow.textContent = '';
    cbArrow.className = 'arrow';
    diffEl.textContent = '—';
    diffEl.className = 'diff-line neutral';
  }

  // 24h change badge
  const changeEl = document.getElementById(`${prefix}-change`);
  if (coin.change_24h != null) {
    const ch = coin.change_24h;
    const sign = ch >= 0 ? '+' : '';
    changeEl.textContent = `${sign}${ch.toFixed(2)}%`;
    changeEl.className = 'change-badge ' + (ch > 0 ? 'up' : ch < 0 ? 'down' : 'neutral');
  } else {
    changeEl.textContent = '—';
    changeEl.className = 'change-badge neutral';
  }

  // 24h volume
  const volEl = document.getElementById(`${prefix}-vol`);
  if (coin.volume_24h != null) {
    volEl.textContent = formatOI(coin.volume_24h);
    volEl.className = 'data-value neutral';
  } else {
    volEl.textContent = '—';
    volEl.className = 'data-value neutral';
  }

  // Funding rate
  const frEl = document.getElementById(`${prefix}-fr`);
  if (coin.funding_rate != null) {
    const fr = coin.funding_rate * 100;
    frEl.textContent = fr.toFixed(3) + '%';
    frEl.className = 'data-value ' + (fr >= 0 ? 'positive' : 'negative');
  } else {
    frEl.textContent = '—';
    frEl.className = 'data-value neutral';
  }

  // Open interest
  const oiEl = document.getElementById(`${prefix}-oi`);
  if (coin.open_interest != null) {
    oiEl.textContent = formatOI(coin.open_interest);
    oiEl.className = 'data-value neutral';
  } else {
    oiEl.textContent = '—';
    oiEl.className = 'data-value neutral';
  }

  // TD Sequential
  renderTD(`${prefix}-td-1h`, coin.td ? coin.td['1h'] : null);
  renderTD(`${prefix}-td-4h`, coin.td ? coin.td['4h'] : null);
  renderTD(`${prefix}-td-1d`, coin.td ? coin.td['1d'] : null);

  // Ratios
  renderRatio(`${prefix}-ls`, coin.ls_ratio);
  renderRatio(`${prefix}-topls`, coin.top_ls_ratio);
  renderRatio(`${prefix}-taker`, coin.taker_buy_sell);
}

function renderTD(elId, td) {
  const el = document.getElementById(elId);
  if (!td) {
    el.textContent = '—';
    el.className = 'td-val neutral';
    return;
  }

  const buy = t('buy');
  const sell = t('sell');

  if (td.buy_signal) { el.textContent = `${buy}13\u2605`; el.className = 'td-val signal'; return; }
  if (td.sell_signal) { el.textContent = `${sell}13\u2605`; el.className = 'td-val signal-sell'; return; }
  if (td.buy_cd_active && td.buy_cd > 0) { el.textContent = `${buy}C${td.buy_cd}`; el.className = 'td-val buy'; return; }
  if (td.sell_cd_active && td.sell_cd > 0) { el.textContent = `${sell}C${td.sell_cd}`; el.className = 'td-val sell'; return; }

  if (td.sell_setup > 0) {
    let text = `${sell}${td.sell_setup}`;
    let cls = 'td-val sell';
    if (td.sell_setup === 9 && td.perfected) { text += '!'; cls += ' perfected'; }
    el.textContent = text; el.className = cls; return;
  }
  if (td.buy_setup > 0) {
    let text = `${buy}${td.buy_setup}`;
    let cls = 'td-val buy';
    if (td.buy_setup === 9 && td.perfected) { text += '!'; cls += ' perfected'; }
    el.textContent = text; el.className = cls; return;
  }

  el.textContent = '—';
  el.className = 'td-val neutral';
}

function renderRatio(elId, ratio) {
  const el = document.getElementById(elId);
  if (ratio == null) {
    el.textContent = '—';
    el.className = 'data-value neutral';
    return;
  }
  el.textContent = ratio.toFixed(2);
  el.className = 'data-value ' + (ratio >= 1 ? 'positive' : 'negative');
}

function renderSentiment(s) {
  const fill = document.getElementById('sentiment-fill');
  const text = document.getElementById('sentiment-text');
  fill.style.width = s.value + '%';

  const levels = [
    [25, '#ef4444', 's_extreme_fear'],
    [40, '#f97316', 's_fear'],
    [60, '#777',    's_neutral'],
    [75, '#2DD4BF', 's_greed'],
    [100,'#22c55e', 's_extreme_greed'],
  ];
  const [, color, key] = levels.find(([max]) => s.value <= max) || levels[2];
  fill.style.background = color;
  text.style.color = color;
  text.textContent = `${s.value} ${t(key)}`;
}

function renderGlobal(g) {
  const card = document.getElementById('global-card');
  if (!g) { card.style.display = 'none'; return; }
  card.style.display = '';

  const mcapEl = document.getElementById('global-mcap');
  const volEl = document.getElementById('global-vol');
  const btcDomEl = document.getElementById('global-btc-dom');
  const ethDomEl = document.getElementById('global-eth-dom');

  mcapEl.textContent = formatLargeNum(g.total_market_cap);
  if (g.market_cap_change_24h != null) {
    const ch = g.market_cap_change_24h;
    mcapEl.className = 'data-value ' + (ch >= 0 ? 'positive' : 'negative');
  }

  volEl.textContent = formatLargeNum(g.total_volume_24h);
  btcDomEl.textContent = g.btc_dominance.toFixed(1) + '%';
  ethDomEl.textContent = g.eth_dominance.toFixed(1) + '%';
}

function formatLargeNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  return n.toFixed(0);
}

function formatPrice(p) {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDiff(d) {
  const abs = Math.abs(d);
  return abs >= 1 ? abs.toFixed(1) : abs.toFixed(2);
}

function formatOI(oi) {
  if (oi >= 1e9) return (oi / 1e9).toFixed(1) + 'B';
  if (oi >= 1e6) return (oi / 1e6).toFixed(1) + 'M';
  if (oi >= 1e3) return (oi / 1e3).toFixed(0) + 'K';
  return oi.toFixed(0);
}

function initTooltip() {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  document.body.appendChild(tip);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    tip.textContent = target.dataset.tooltip;
    tip.style.opacity = '1';

    const rect = target.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;

    // Position above element, keep within popup bounds
    let left = rect.left;
    let top = rect.top - tipH - 6;
    if (left + tipW > 370) left = 370 - tipW;
    if (left < 10) left = 10;
    if (top < 4) top = rect.bottom + 6;

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  });

  document.addEventListener('mouseout', (e) => {
    const from = e.target.closest('[data-tooltip]');
    const to = e.relatedTarget?.closest?.('[data-tooltip]');
    if (from && from !== to) tip.style.opacity = '0';
  });
}
