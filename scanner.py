"""Daily research scanner. Yahoo/yfinance is unofficial and may be unavailable.
Not licensed exchange market data. No brokerage integration or orders.
"""
import json
import math
from datetime import datetime, timezone
from pathlib import Path

SYMBOLS = [
    'RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN','ITC','LT',
    'BHARTIARTL','AXISBANK','KOTAKBANK','HINDUNILVR','MARUTI','TITAN',
    'SUNPHARMA','NTPC','POWERGRID','TATASTEEL','JSWSTEEL','BAJFINANCE',
    'ADANIPORTS','ULTRACEMCO','ONGC','WIPRO','HCLTECH'
]


def compute(bars):
    """bars: sequence of (date, open, high, low, close, volume)."""
    if len(bars) < 80:
        raise ValueError('Fewer than 80 sessions')
    closes = [float(b[4]) for b in bars]
    if not all(math.isfinite(c) and c > 0 for c in closes):
        raise ValueError('Invalid prices')

    def ema(n):
        prev = sum(closes[:n])/n
        for c in closes[n:]:
            prev = c*2/(n+1)+prev*(1-2/(n+1))
        return prev

    n = 14
    diffs = [closes[i]-closes[i-1] for i in range(1,len(closes))]
    gain = sum(max(d,0) for d in diffs[:n])/n
    loss = sum(max(-d,0) for d in diffs[:n])/n
    for d in diffs[n:]:
        gain = (gain*13+max(d,0))/14
        loss = (loss*13+max(-d,0))/14
    rsi = 100 if loss==0 else 100-100/(1+gain/loss)
    e20,e50 = ema(20),ema(50)
    close = closes[-1]
    mom = (close/closes[-11]-1)*100
    setup = close>e20>e50 and 50<=rsi<=70 and mom>0
    # Indicative levels, NOT orders. Actual fills may gap/slip beyond stop.
    quantity = min(int(5000//close),int(100//(close*.03)),int(10000//close))
    return dict(date=str(bars[-1][0]),close=round(close,2),ema20=round(e20,2),ema50=round(e50,2),
                rsi=round(rsi,2),momentum10pct=round(mom,2),setup=bool(setup),
                stop=round(close*.97,2),target=round(close*1.06,2),quantity=max(0,quantity))


def fetch_bars(symbol):
    import yfinance as yf
    df = yf.Ticker(symbol+'.NS').history(period='9mo', interval='1d', auto_adjust=True)
    if df.empty:
        raise ValueError('No prices returned')
    df = df.dropna(subset=['Open','High','Low','Close','Volume'])
    return [(str(index.date()), float(row['Open']), float(row['High']), float(row['Low']),float(row['Close']), float(row['Volume'])) for index,row in df.iterrows()]


def run():
    results=[]; errors=[]
    for sym in SYMBOLS:
        try:
            result=compute(fetch_bars(sym))
            result['symbol']=sym
            results.append(result)
            print(sym, result['date'], 'SETUP' if result['setup'] else 'No setup')
        except Exception as exc:
            errors.append({'symbol':sym,'error':str(exc)[:160]})
            print(sym, 'UNAVAILABLE', str(exc)[:160])
    # Do not publish a misleading successful scan if most data failed.
    status='ok' if len(results)>=20 else 'partial' if results else 'unavailable'
    obj={'schema':1,'generated_at_utc':datetime.now(timezone.utc).isoformat(timespec='seconds'),
         'source':'Yahoo Finance via yfinance (unofficial, personal research, best-effort)',
         'status':status,'count':len(results),'requested':len(SYMBOLS),
         'results':sorted(results,key=lambda r:(not r['setup'],-r['momentum10pct'])),
         'errors':errors}
    Path('daily_signals.json').write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('Published status:',status,'count:',len(results))


if __name__=='__main__':
    run()
