# EDGEFINDER / SWING LAB — after-close swing scanner

A deployable, static research website for **3–10 trading-day long and short** stock setups. It keeps the earlier EDGEFINDER six-factor score (trend 25, momentum 20, relative strength 20, volume/pressure 15, structure 10, risk 10), then applies separate gates before marking **TRIGGER**. No brokerage connection or live execution.

## First-time setup (GitHub Pages)

1. Create a **public** repository on [GitHub](https://github.com/new) named `edgefinder-swing` with default branch **`main`**. GitHub Pages on the free plan requires a public repository. Be aware that a public GitHub Pages website and committed market-data snapshots are **not private**.
2. Upload the **contents** of this ZIP into the repository root, keeping hidden `.github/workflows/daily-scan.yml`, `config/watchlist.json`, and `data/market.json`. Easiest with GitHub Desktop or `git` (commands below); the GitHub web upload UI may hide dotfiles.
3. Go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Go to **Actions → EDGEFINDER after-close daily scan → Run workflow** once. The workflow downloads daily history, builds `data/market.json`, commits it, and deploys the website. The initial placeholder screen shows **no fake prices** until this first run succeeds.
5. Open `https://YOUR-GITHUB-USERNAME.github.io/edgefinder-swing/`. The website is responsive on phone and desktop.

```sh
# Alternative to a web upload, after creating the GitHub repo above:
unzip edgefinder_swing_website.zip -d edgefinder-swing
cd edgefinder-swing
git init -b main
git add .
git commit -m "Initial EDGEFINDER website"
git remote add origin https://github.com/YOUR-GITHUB-USERNAME/edgefinder-swing.git
git push -u origin main
```

**Nightly schedule:** Monday–Friday at **5:40 p.m. America/New_York**, after the U.S. regular close. GitHub Actions can run late or occasionally skip a scheduled run; a manual Run workflow is the fallback. In inactive public repositories, scheduled runs may also be disabled after 60 days. An unofficial feed can fail. Holidays/weekends retain the most recent available session. The dashboard always prints its latest data date and any feed gaps.

**Refresh Scan:** Reloads the latest successfully published `data/market.json` and recalculates rankings in your browser. It **does not** run a live Yahoo/TradingView query or force the nightly GitHub job to execute. For an out-of-cycle new market scan, use **Actions → Run workflow**. Neither normal page viewing nor Refresh Scan uses ChatGPT tokens.

## Change the scan universe

Edit `config/watchlist.json` on GitHub (tickers as a JSON list; default ~104 tickers) and commit. That automatically triggers a new run. Benchmark instruments are downloaded separately, including SPY, QQQ, key sector ETFs, VIX, VVIX, and the dollar index where available. The dollar-index fallback, if needed, is **DX futures**, explicitly labeled a proxy. Adding a symbol on a page cannot make the static site retrieve it; update this repository's watchlist.

## How scores and triggers work

* **Long/short direction:** the higher of independently evaluated directional scores for that instrument. Separate ranked long and short tables, each with previous session direction/score, state, sector leadership, CMF flow proxy, SPY/sector relative strength, last-day move, price since last confirmed trigger, and hypothetical next-session breakout/stop/target levels.
* **Market permission:** SPY must be bullish (`close > EMA50 > EMA200`) for a new long trigger, or bearish (`close < EMA50 < EMA200`) for a new short trigger. Mixed SPY = no new confirmed trigger.
* **TRIGGER:** strict aligned 20/50/200 EMA trend, favorable 20-day momentum and stock-vs-SPY relative performance, breakout of the **prior 10-session** high/low on the closing bar, SPY market permission, synchronized SPY bar, 1.1x relative volume, risk distance no greater than 10%, non-extreme RSI and total factor score >=75.
* **SETUP / WATCH:** may be useful to monitor but are **not** confirmed signals; high score alone never implies a trade. The trigger level is the prior 10-session high/low plus/minus 0.1%; stop is the further of 1.8 ATR from breakout entry or recent 5-session extreme; target 2R.
* **CMF (20):** a *price-and-volume pressure proxy*. A positive CMF is *not proof of institutional capital flowing in*.
* **Backtest button:** replays recorded daily bars with entry next session open, stop/2R/10-session exit, stop-first ambiguity, only one position per ticker at a time. Hypothetical results exclude fees, slippage, borrow costs, signal execution latency, corporate-action artifacts and cross-portfolio exposure. Survivorship bias may inflate findings. The model is **not proven profitable**.

## Market data and rights

Provider: `yfinance`, which downloads Yahoo Finance's unofficial historical daily adjusted OHLCV. No TradingView API is used. This can be rate-limited or break; macro series and newer tickers may not have the needed history. The script fails rather than replacing a good snapshot with one missing SPY. Existing figures are explicitly dated and missing instruments are never filled with invented values.

**Data licensing:** Yahoo's API and `yfinance` are intended for personal research use; review their terms before hosting, displaying, or redistributing market data on a public site. For a compliant public/commercial service, replace the feed with an appropriately licensed EOD provider. A free GitHub Pages website is publicly accessible, not password-protected.

## Development (optional)

```sh
pip install -r requirements.txt
python scripts/update_data.py      # downloads EOD market history; needs internet access
python -m http.server 8000          # visit http://localhost:8000
```

The initial committed `data/market.json` is intentionally an **empty placeholder**; no synthetic or guessed market prices are shipped.

## Deployment reliability changes
The original six-factor scoring, thresholds, levels, and swing holding modes are unchanged. Data extraction now requires 210 bars (the existing UI minimum), excludes unfinished daily bars using the NYSE calendar plus a 30-minute publication buffer, and rejects stale SPY snapshots. Failed attempts publish a separate scan-status.json warning while preserving the last usable market snapshot; the Actions run is marked failed after publishing. Only public website assets are deployed. Schedule: 17:40 America/New_York weekdays, with automatic daylight saving adjustment. Refresh re-fetches saved JSON without AI or API keys.

Free Yahoo data is unofficial, can be throttled or missing, is intended for personal research, and carries no uptime or redistribution guarantee. Review provider terms before redistributing data. GitHub scheduled runs may be delayed or disabled after 60 days of repository inactivity. Regular snapshot commits normally keep this repository active. No demonstrated win rate or high-probability guarantee is implied by scores.
