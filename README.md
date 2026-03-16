# AnyAI Radar — Chrome Extension

**AnyAI Radar** is the official browser extension for [AnyAI](https://anyai.network), a non-custodial AI auto-trading platform for crypto markets.

Monitor real-time market data at a glance — prices, funding rates, open interest, sentiment, and TD Sequential signals — all powered by AnyAI's trading intelligence engine.

## Features

- **Multi-Exchange Prices** — Binance & Coinbase side-by-side with premium tracking
- **Funding Rates & Open Interest** — spot derivatives pressure in real time
- **Long/Short Ratios** — global and top-trader positioning from Binance Futures
- **Taker Buy/Sell Ratio** — detect aggressive order flow shifts
- **TD Sequential** — 1H / 4H / 1D countdown and setup signals
- **Market Sentiment Index** — fear & greed gauge from on-chain and social data
- **Global Market Stats** — total market cap, 24h volume, BTC & ETH dominance
- **Multi-Language** — English, 中文, 日本語, 한국어, Tiếng Việt, Bahasa Indonesia
- **Side Panel Mode** — pin AnyAI Radar as a persistent sidebar while you trade
- **Badge Price** — show live BTC/ETH/BNB/SOL price on the extension icon

## Supported Assets

BTC, ETH, BNB, SOL — configurable via settings.

## Install

1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `extension/` folder
5. AnyAI Radar icon appears in your toolbar

## Tech Stack

- **Manifest V3** Chrome Extension
- Vanilla JS — zero dependencies, fast popup load
- CSS custom properties design system
- Chrome Side Panel API
- i18n with 6 languages

## About AnyAI

[AnyAI](https://anyai.network) is a non-custodial AI auto-trading platform. Your API keys stay on your device, and AnyAI connects directly to exchanges on your behalf. The platform features multi-agent decision systems, unified risk control, and low-latency execution across crypto markets.

Learn more at [anyai.network](https://anyai.network).

## License

MIT
