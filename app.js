'use strict';
const $=id=>document.getElementById(id), money=n=>'₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2});
const KEY='swing-paper-v1';let state;try{state=JSON.parse(localStorage.getItem(KEY))}catch(e){}if(!state||typeof state.cash!=='number')state={cash:10000,holdings:{},trades:[],realized:0};
const save=()=>{localStorage.setItem(KEY,JSON.stringify(state));render()};
let scannerMarks={}, scannerDate='';
function currentMark(symbol){const h=state.holdings[symbol];if(!h)return null; const manual=h.manualMark; const scan=scannerMarks[symbol]; if(manual && (!scan || manual.updatedAt>=scan.updatedAt))return manual;return scan||manual||null;}
function riskPlan(h){const stop=Number.isFinite(+h.stop)&&+h.stop>0?+h.stop:h.avg*.97;const target=Number.isFinite(+h.target)&&+h.target>0?+h.target:h.avg*1.06;return {stop,target};}
function riskPreview(){const price=Number($('buyPrice').value),qty=Number($('buyQty').value),stop=Number($('buyStop').value)||price*.97; $('buyRiskPreview').textContent=price>0&&Number.isInteger(qty)&&qty>0&&stop>0&&stop<price?'Planned downside to stop: '+money((price-stop)*qty)+' (excluding gaps/fees). Stops are NOT executed automatically.':'Enter a valid price, quantity and stop below entry. No automatic stop execution.';}
['buyPrice','buyQty','buyStop'].forEach(id=>$(id).addEventListener('input',riskPreview));
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('main section').forEach(s=>s.classList.toggle('hidden',s.id!==b.dataset.tab))});
function render(){
 let invested=0, market=0, known=0, totalRisk=0;
 const cards=Object.entries(state.holdings).map(([s,h])=>{
  invested+=h.qty*h.avg;
  const plan=riskPlan(h), mark=currentMark(s);
  const markValue=mark?mark.price:h.avg;
  market+=h.qty*markValue;
  if(mark)known++;
  totalRisk+=Math.max(0,(h.avg-plan.stop)*h.qty);
  const unreal=mark?(mark.price-h.avg)*h.qty:null;
  const status=mark?(mark.price<=plan.stop?'STOP LEVEL REACHED':mark.price>=plan.target?'TARGET LEVEL REACHED':'Inside levels'):'No recent mark';
  const isStale=mark&&((Date.now()-Date.parse(mark.date+'T23:59:59+05:30'))>4*86400000);
  return `<div class="card" style="margin-top:10px"><strong>${escapeHtml(s)} · ${h.qty} shares</strong><p>Average ${money(h.avg)} · Cost ${money(h.qty*h.avg)}<br>Stop <span class="red">${money(plan.stop)}</span> · Target <span class="green">${money(plan.target)}</span></p><p>${mark?'Reference '+money(mark.price)+' ('+escapeHtml(mark.date)+', '+escapeHtml(mark.source)+')'+(isStale?' · STALE':''):'No dated price available'}<br>${unreal===null?'Unrealized P/L unavailable':'Unrealized P/L '+money(unreal)}<br><strong>${status}</strong></p><small>Alert only. Verify in broker app; no automatic trade.</small></div>`;
 }).join('')||'No holdings';
 $('cash').textContent=money(state.cash);
 $('equity').textContent=money(state.cash+market);
 $('positionsCount').textContent=Object.keys(state.holdings).length;
 $('realized').textContent=money(state.realized);
 $('holdings').innerHTML=cards;
 const estimatedUnreal=market-invested;
 $('riskSummary').innerHTML=`<div class="grid"><p>Open cost<br><strong>${money(invested)}</strong></p><p>Estimated equity*<br><strong>${money(state.cash+market)}</strong></p><p>Unrealized P/L*<br><strong>${known===Object.keys(state.holdings).length?money(estimatedUnreal):'Incomplete marks'}</strong></p><p>Planned stop exposure<br><strong>${money(totalRisk)}</strong></p></div>`;
 $('markInfo').textContent=`*${known}/${Object.keys(state.holdings).length} holdings with dated price marks. Missing quotes use cost; estimated equity is not live or executable. Stops can gap beyond the reference level. Fees and taxes excluded.`;
 const options=Object.keys(state.holdings).map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
 const prevSell=$('sellSymbol').value,prevMark=$('markSymbol').value;
 $('sellSymbol').innerHTML=options;$('markSymbol').innerHTML=options;
 if(state.holdings[prevSell])$('sellSymbol').value=prevSell;
 if(state.holdings[prevMark])$('markSymbol').value=prevMark;
 $('history').innerHTML=state.trades.slice(-30).reverse().map(t=>`<p><small>${escapeHtml(t.date)} · ${escapeHtml(t.side)} ${escapeHtml(t.symbol)} · ${t.qty} @ ${money(t.price)}${t.pnl===undefined?'':' · P/L '+money(t.pnl)}</small></p>`).join('')||'No trades';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function validSymbol(s){return /^[A-Z0-9._-]{1,25}$/.test(s)}
$('buyBtn').onclick=()=>{
 const symbol=$('buySymbol').value.trim().toUpperCase(),price=Number($('buyPrice').value),qty=Number($('buyQty').value);
 let stop=Number($('buyStop').value)||price*.97,target=Number($('buyTarget').value)||price*1.06;
 if(!validSymbol(symbol)||!(price>0)||!Number.isSafeInteger(qty)||qty<1)return $('buyMsg').textContent='Enter valid symbol, price and whole-share quantity.';
 if(!(stop>0&&stop<price&&target>price))return $('buyMsg').textContent='Stop must be below entry, target above entry.';
 if(qty*price>state.cash+1e-7)return $('buyMsg').textContent='Insufficient paper cash.';
 if((price-stop)*qty>100+1e-7)return $('buyMsg').textContent='Planned stop exposure exceeds ₹100. Lower quantity or change risk plan.';
 if(qty*price>5000+1e-7)return $('buyMsg').textContent='Maximum purchase size is ₹5,000.';
 let h=state.holdings[symbol]||{qty:0,avg:0};
 const newQty=h.qty+qty, oldCost=h.qty*h.avg;
 h.avg=(oldCost+price*qty)/newQty;
 h.stop=h.qty>0?Math.min(riskPlan(h).stop,stop):stop;
 h.target=h.qty>0?Math.max(riskPlan(h).target,target):target;
 h.qty=newQty;
 if((h.avg-h.stop)*h.qty>100+1e-7||h.avg*h.qty>5000+1e-7)return $('buyMsg').textContent='Total holding would exceed ₹100 planned stop exposure or ₹5,000 holding limit.';
 state.holdings[symbol]=h;state.cash-=qty*price;
 state.trades.push({date:new Date().toISOString().slice(0,10),side:'BUY',symbol,qty,price,stop,target});
 $('buyMsg').textContent='Paper buy recorded with reference stop/target. No real or automatic orders.';save();
};
$('sellBtn').onclick=()=>{let symbol=$('sellSymbol').value,h=state.holdings[symbol],price=Number($('sellPrice').value),qty=Number($('sellQty').value);if(!h||!(price>0)||!Number.isSafeInteger(qty)||qty<1||qty>h.qty)return $('sellMsg').textContent='Check symbol, price and available quantity.';let pnl=(price-h.avg)*qty;h.qty-=qty;if(!h.qty)delete state.holdings[symbol];state.cash+=price*qty;state.realized+=pnl;state.trades.push({date:new Date().toISOString().slice(0,10),side:'SELL',symbol,qty,price,pnl});$('sellMsg').textContent='Paper sell recorded. No real order placed.';save()};
$('markBtn').onclick=()=>{const symbol=$('markSymbol').value,price=Number($('markPrice').value);if(!state.holdings[symbol]||!(price>0))return $('markMsg').textContent='Select a holding and enter a valid verified price.';
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
 state.holdings[symbol].manualMark={price,date,source:'manual',updatedAt:Date.now()};$('markMsg').textContent='Paper price updated. Not a live feed or real order.';save();};
$('resetBtn').onclick=()=>{if(confirm('Erase all virtual trades and reset to ₹10,000?')){state={cash:10000,holdings:{},trades:[],realized:0};save()}};
function parseCSV(text){let lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/),heads=lines.shift().split(',').map(x=>x.trim().toLowerCase().replace(/^"|"$/g,''));let required=['date','open','high','low','close','volume'];if(!required.every(k=>heads.includes(k)))throw Error('Missing CSV headers: '+required.filter(k=>!heads.includes(k)).join(', '));let data=lines.filter(Boolean).map(line=>{let parts=line.split(',');let row={};required.forEach(k=>row[k]=parts[heads.indexOf(k)].trim().replace(/^"|"$/g,''));for(let k of required.slice(1))row[k]=Number(row[k]);if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||required.slice(1).some(k=>!Number.isFinite(row[k]))||row.close<=0||row.open<=0||row.low<=0||row.high<Math.max(row.open,row.close,row.low)||row.low>Math.min(row.open,row.close)||row.volume<0)throw Error('Invalid OHLCV row '+row.date);return row});data.sort((a,b)=>a.date.localeCompare(b.date));if(data.length<80)throw Error('Need at least 80 daily rows');if(new Set(data.map(x=>x.date)).size!==data.length)throw Error('Duplicate dates found');return data}
function ema(values,n){let out=[],k=2/(n+1),prev=null;values.forEach((v,i)=>{if(i===n-1)prev=values.slice(0,n).reduce((a,b)=>a+b,0)/n;else if(i>=n)prev=v*k+prev*(1-k);out.push(i<n-1?null:prev)});return out}
function rsi(values,n=14){let out=Array(values.length).fill(null),gain=0,loss=0;for(let i=1;i<values.length;i++){let d=values[i]-values[i-1],g=Math.max(d,0),l=Math.max(-d,0);if(i<=n){gain+=g;loss+=l;if(i===n){gain/=n;loss/=n;out[i]=loss===0?100:100-100/(1+gain/loss)}}else{gain=(gain*(n-1)+g)/n;loss=(loss*(n-1)+l)/n;out[i]=loss===0?100:100-100/(1+gain/loss)}}return out}
function indicators(data){let c=data.map(x=>x.close),e20=ema(c,20),e50=ema(c,50),r=rsi(c);return data.map((x,i)=>({...x,ema20:e20[i],ema50:e50[i],rsi:r[i],momentum:i>=10?c[i]/c[i-10]-1:null,signal:i>=50&&c[i]>e20[i]&&e20[i]>e50[i]&&r[i]>=50&&r[i]<=70&&c[i]>c[i-10]}))}
function backtest(rows){let cash=10000,pos=null,trades=[],equityPeak=10000,maxDD=0;for(let i=51;i<rows.length;i++){let d=rows[i],prior=rows[i-1];if(pos){let exit=null,reason='';if(d.open<=pos.stop){exit=d.open;reason='gap stop'}else if(d.open>=pos.target){exit=d.open;reason='gap target'}else if(d.low<=pos.stop){exit=pos.stop;reason='stop'}else if(d.high>=pos.target){exit=pos.target;reason='target'}else if(i-pos.entryIndex>=10){exit=d.close;reason='time'}if(exit!==null){cash+=pos.qty*exit;trades.push({entry:pos.entryDate,exit:d.date,qty:pos.qty,pnl:(exit-pos.entry)*pos.qty,reason});pos=null}}if(!pos&&prior.signal){let price=d.open,qty=Math.min(Math.floor(5000/price),Math.floor(100/(price*.03)),Math.floor(cash/price));if(qty>0){cash-=qty*price;pos={entry:price,qty,stop:price*.97,target:price*1.06,entryDate:d.date,entryIndex:i}}}let eq=cash+(pos?pos.qty*d.close:0);equityPeak=Math.max(equityPeak,eq);maxDD=Math.max(maxDD,(equityPeak-eq)/equityPeak)}let last=rows.at(-1),final=cash+(pos?pos.qty*last.close:0);return {final,returnPct:(final/10000-1)*100,trades,open:!!pos,maxDD:maxDD*100}}
$('analyzeBtn').onclick=async()=>{try{let file=$('csvFile').files[0];if(!file)throw Error('Choose a CSV file');if(file.size>5e6)throw Error('CSV exceeds 5MB');let symbol=$('csvSymbol').value.trim().toUpperCase();if(!validSymbol(symbol))throw Error('Invalid symbol');let rows=indicators(parseCSV(await file.text())),last=rows.at(-1),bt=backtest(rows);$('dataMsg').textContent=`Loaded ${rows.length} candles for ${symbol}. Last candle: ${last.date}.`;$('signalOutput').innerHTML=`<h2>${escapeHtml(symbol)}: ${last.signal?'<span class="green">SETUP DETECTED</span>':'<span class="muted">NO SETUP</span>'}</h2><p>Data date: ${last.date} · Close: ${money(last.close)}<br>EMA20: ${money(last.ema20)} · EMA50: ${money(last.ema50)}<br>RSI14: ${last.rsi.toFixed(1)} · 10-day momentum: ${(last.momentum*100).toFixed(2)}%</p><p>${last.signal?'Research setup only. Consider next-session price and manual verification.':'No entry under the current rules.'}</p><p class="muted">No prediction, live quote, or order. This is a rule-based signal, not trained AI.</p>`;$('buySymbol').value=symbol;$('buyPrice').value=last.close.toFixed(2);$('buyQty').value=Math.max(0,Math.min(Math.floor(5000/last.close),Math.floor(100/(last.close*.03)),Math.floor(state.cash/last.close)));$('backtestOutput').innerHTML=`<div class="grid"><p>Final equity<br><strong>${money(bt.final)}</strong></p><p>Return<br><strong>${bt.returnPct.toFixed(2)}%</strong></p><p>Closed trades<br><strong>${bt.trades.length}</strong></p><p>Max drawdown<br><strong>${bt.maxDD.toFixed(2)}%</strong></p></div><p>Win rate: ${bt.trades.length?(100*bt.trades.filter(t=>t.pnl>0).length/bt.trades.length).toFixed(1)+'%':'N/A'} · Open at end: ${bt.open?'Yes':'No'}</p><p class="muted">In-sample historical simulation. No fees/slippage; no forward validation. Results are not forecasts.</p>`}catch(e){$('dataMsg').textContent='Error: '+e.message}};
render();if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

// Public, delayed research snapshot; NEVER submits orders to a broker.
async function loadDailyScanner(){
  const status=$('scanStatus'), cards=$('scanCards');
  status.textContent='Fetching latest scheduled research snapshot…';
  try{
    const response=await fetch('./daily_signals.json?t='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('No daily scan published yet (HTTP '+response.status+'). Run the GitHub Action first.');
    const data=await response.json();
    if(!Array.isArray(data.results)||data.schema!==1)throw Error('Unexpected scan format');
    const generated=Date.parse(data.generated_at_utc);
    if(!Number.isFinite(generated))throw Error('Missing scan timestamp');
    const ageDays=(Date.now()-generated)/86400000;
    scannerMarks={};for(const r of data.results){if(validSymbol(String(r.symbol))&&Number.isFinite(Number(r.close))&&Number(r.close)>0&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)){scannerMarks[r.symbol]={price:Number(r.close),date:r.date,source:'EOD scan',updatedAt:Date.parse(r.date+'T23:59:59+05:30')};}}render();
    const candidates=data.results.filter(r=>r.setup&&r.quantity>0).slice(0,5);
    let heading=`Generated ${new Date(generated).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})} IST. ${data.count}/${data.requested} symbols loaded.`;
    if(data.status!=='ok')heading+=' WARNING: '+data.status+' data coverage.';
    if(ageDays>3||ageDays<-.1)heading+=' STALE or clock mismatch: do NOT treat as current signal.';
    const lastDates=[...new Set(data.results.map(r=>r.date))].sort();
    heading+=' Latest candle: '+(lastDates.at(-1)||'unavailable')+'.';
    status.textContent=heading;
    cards.innerHTML='';
    if(!candidates.length){cards.textContent='No qualifying swing setups in this scan. No trade is also a valid outcome.';return;}
    for(const r of candidates){
      const el=document.createElement('div');el.className='card';
      const h=document.createElement('h3');h.textContent=r.symbol+' · Setup detected';el.appendChild(h);
      const details=document.createElement('p');
      details.textContent=`Data ${r.date} | Last adjusted close ${money(r.close)} | RSI ${r.rsi} | 10d momentum ${r.momentum10pct}% | Indicative stop ${money(r.stop)} | target ${money(r.target)} | max paper qty ${r.quantity}`;
      el.appendChild(details);
      const note=document.createElement('small');note.textContent='Not a buy instruction. Re-check live BoB eTrade price, liquidity and corporate actions before deciding.';el.appendChild(note);
      const btn=document.createElement('button');btn.className='secondary';btn.textContent='Fill paper ticket';btn.style.marginTop='10px';
      btn.onclick=()=>{
        const qty=Math.min(r.quantity,Math.floor(state.cash/r.close));
        $('buySymbol').value=r.symbol;
        $('buyPrice').value=Number(r.close).toFixed(2);
        $('buyQty').value=qty;
        $('buyStop').value=Number(r.stop).toFixed(2);
        $('buyTarget').value=Number(r.target).toFixed(2);
        riskPreview();
        $('buyMsg').textContent=qty>0
          ? 'Paper ticket filled for '+r.symbol+'. Review details below, then press Record Paper Buy if you want to simulate a trade. No real order.'
          : 'Insufficient paper cash for this symbol. No simulated order placed.';
        const ticket=$('buySymbol').closest('.card');
        ticket.style.outline='2px solid #61d6aa';
        ticket.style.outlineOffset='3px';
        ticket.scrollIntoView({behavior:'smooth',block:'start'});
        setTimeout(()=>{ticket.style.outline='';ticket.style.outlineOffset='';},4000);
      };
      el.appendChild(document.createElement('br'));el.appendChild(btn);cards.appendChild(el);
    }
  }catch(err){status.textContent='Scanner unavailable: '+err.message+' Existing CSV analysis and paper trade features still work.';cards.textContent='';}
}
$('refreshScanner').onclick=loadDailyScanner;
loadDailyScanner();
