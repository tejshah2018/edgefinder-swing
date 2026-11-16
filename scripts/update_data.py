#!/usr/bin/env python3
"""Publish completed daily OHLCV snapshots for the static EDGEFINDER website.

Research-only, unofficial Yahoo Finance feed (via yfinance); respect data-use terms.
Do not replace a usable previous snapshot if the primary SPY data is unavailable.
"""
from __future__ import annotations
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf
import exchange_calendars as xcals

ROOT = Path(__file__).resolve().parents[1]
WATCH = json.loads((ROOT / 'config/watchlist.json').read_text())
BENCHMARKS = ['SPY','QQQ','SMH','XLK','XLF','XLY','XLC','XLV','XLE','XLP','XLI','XLB','XLU','XLRE','^VIX','^VVIX','DX-Y.NYB']
SYMBOLS = list(dict.fromkeys(BENCHMARKS + WATCH))
OUTPUT = ROOT / 'data/market.json'
MIN_BARS = 210


def completed_session(now=None):
    now = pd.Timestamp(now or datetime.now(timezone.utc))
    cal = xcals.get_calendar("XNYS")
    sessions = cal.sessions_in_range((now - pd.Timedelta(days=15)).date(), now.date())
    return max(s for s in sessions if cal.session_close(s) + pd.Timedelta(minutes=30) <= now).strftime("%Y-%m-%d")


def pick_frame(frame: pd.DataFrame, ticker: str, batch: list[str]) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame()
    if isinstance(frame.columns, pd.MultiIndex):
        for level in (0,1):
            if ticker in frame.columns.get_level_values(level):
                return frame.xs(ticker, axis=1, level=level)
        return pd.DataFrame()
    return frame if len(batch) == 1 else pd.DataFrame()


def extract_rows(df: pd.DataFrame, min_bars: int = MIN_BARS) -> list[dict]:
    keys = ('Open','High','Low','Close','Volume')
    if df.empty or any(k not in df for k in keys):
        return []
    df = df.loc[:,list(keys)].dropna(subset=['Open','High','Low','Close']).copy()
    if df.empty:
        return []
    cutoff = completed_session()
    rows = []
    for dt, r in df.iterrows():
        try:
            date = pd.Timestamp(dt).strftime('%Y-%m-%d')
            if date > cutoff:
                continue
            o,h,l,c = (float(r[k]) for k in keys[:4])
            v = float(r['Volume']) if pd.notna(r['Volume']) else 0
            if not all(math.isfinite(x) for x in (o,h,l,c,v)):
                continue
            if min(o,h,l,c) <= 0 or v < 0 or h < max(o,c) or l > min(o,c):
                continue
            rows.append({'date': date,'o':round(o,5),'h':round(h,5),'l':round(l,5),'c':round(c,5),'v':round(v)})
        except (TypeError, ValueError):
            continue
    return rows[-520:] if len(rows)>=min_bars else []


def fetch(batch: list[str], retries: int=2) -> tuple[dict[str,list[dict]],list[str]]:
    result = {}
    for attempt in range(retries):
        try:
            df = yf.download(tickers=batch, period='2y', interval='1d', group_by='ticker',
                             auto_adjust=True, progress=False, threads=4, timeout=22,
                             multi_level_index=True)
            if df is None:
                df = pd.DataFrame()
            for symbol in batch:
                if symbol in result:
                    continue
                rows = extract_rows(pick_frame(df,symbol,batch), 30 if symbol in ('^VIX','^VVIX','DX-Y.NYB','DX=F') else MIN_BARS)
                if rows:
                    result[symbol] = rows
            if len(result)==len(batch):
                break
        except Exception as exc:
            print(f'WARNING batch attempt {attempt+1}: {str(exc)[:140]}')
        if attempt+1 < retries:
            time.sleep(3)
    return result, [s for s in batch if s not in result]


def run() -> None:
    output: dict[str,list[dict]]={}
    missing=[]
    # Smaller batches improve resilience when the unofficial provider throttles large calls.
    chunk=12
    for i in range(0,len(SYMBOLS),chunk):
        batch=SYMBOLS[i:i+chunk]
        fetched,err=fetch(batch)
        output.update(fetched); missing.extend(err)
        print(f'{i+len(batch)}/{len(SYMBOLS)} requested; {len(output)} available',flush=True)
        if i+chunk<len(SYMBOLS):time.sleep(0.7)

    # Dollar index fallback is a FUTURES proxy, never label it as the identical spot series.
    fallback_used=False
    if 'DX-Y.NYB' not in output:
        fetched,_=fetch(['DX=F'])
        if 'DX=F' in fetched:
            output['DX=F']=fetched['DX=F']
            fallback_used=True
    spy=output.get('SPY',[])
    if len(spy)<MIN_BARS:
        raise RuntimeError('SPY data failed; previous snapshot retained to avoid publishing an invalid scan')
    primary_date=spy[-1]['date']
    expected = completed_session()
    if primary_date != expected:
        raise RuntimeError(f'SPY is stale: received {primary_date}, expected {expected}; previous snapshot retained')
    # Do not contaminate a completed-close report with bars newer than SPY's latest bar.
    output={s:[r for r in rows if r['date'] <= primary_date] for s,rows in output.items()}
    output={s:rows for s,rows in output.items() if rows}
    # A symbol that did not update alongside SPY is not actionable at the new scan date.
    lagging=sorted(s for s,rows in output.items() if rows[-1]['date'] != primary_date)
    meta={
      'status':'ok' if not missing and not lagging else 'partial',
      'generated_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
      'source':'Yahoo Finance daily adjusted OHLCV via yfinance (unofficial research feed)',
      'data_date':primary_date,
      'expected_session':expected,
      'total_requested':len(SYMBOLS),
      'total_downloaded':len(output),
      'stock_universe':len(WATCH),
      'benchmark_count':len(BENCHMARKS),
      'dxy_symbol':'DX=F' if fallback_used else 'DX-Y.NYB',
      'dxy_is_futures_proxy':fallback_used,
      'lagging_symbols':lagging,
      'missing_symbols':sorted(missing),
    }
    record={'meta':meta,'symbols':output,'watchlist':WATCH,'errors':sorted(missing)}
    OUTPUT.parent.mkdir(exist_ok=True,parents=True)
    temp=OUTPUT.with_suffix('.json.tmp')
    temp.write_text(json.dumps(record,separators=(',',':'),allow_nan=False))
    os.replace(temp,OUTPUT)
    print(f'Wrote {OUTPUT}, as of {primary_date}, {len(output)} symbols, {len(lagging)} lagging; DXY futures proxy={fallback_used}')

if __name__=='__main__':
    status = {'attempted_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds')}
    try:
        status['expected_session'] = completed_session()
        run()
        status['status'] = 'success'
    except Exception as exc:
        status.update(status='failed', error=str(exc))
        raise
    finally:
        (ROOT / 'data/scan-status.json').write_text(json.dumps(status))
