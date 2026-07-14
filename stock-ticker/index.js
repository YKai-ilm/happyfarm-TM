// 伺服器端股價發布器：用「秘密種子」算價，寫進 Firestore market/live
// 前端只讀這份資料，拿不到秘密就算不出未來走勢 → 預測器失效
const admin = require("firebase-admin");

const SECRET = process.env.STOCK_SECRET || "";
if (!SECRET) { console.error("缺少 STOCK_SECRET"); process.exit(1); }
let sa;
try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ""); }
catch (e) { console.error("FIREBASE_SERVICE_ACCOUNT 不是合法 JSON"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const STOCKS = [
  { code: "HAPPY", name: "開心農場控股", base: 10, vol: 0.011 },
  { code: "COW",   name: "金牧畜產",     base: 10, vol: 0.015 },
  { code: "SEED",  name: "豐收種苗",     base: 10, vol: 0.019 },
  { code: "CLOUD", name: "雲端科技",     base: 10, vol: 0.023 },
  { code: "SUN",   name: "暖陽能源",     base: 10, vol: 0.016 },
  { code: "STORM", name: "雷雨重工",     base: 10, vol: 0.029 },
  { code: "HONEY", name: "蜜豐食品",     base: 10, vol: 0.012 },
];
const STOCK_EPOCH = Date.UTC(2026, 5, 1) / 86400000;
const SESSION_MIN = 892;
const r2 = (x) => Math.round(x * 100) / 100;

function stkHash(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
function stkRng(seed){ let a=seed>>>0; return function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
// 種子都摻入 SECRET → 沒有秘密就無法重現
function seedStr(parts){ return SECRET + "" + parts; }

function stockClose(stock, dayNum, cache){
  const key = "c" + stock.code + ":" + dayNum;
  if (cache[key] != null) return cache[key];
  let price = stock.base;
  for (let d = STOCK_EPOCH + 1; d <= dayNum; d++){
    const rr = stkRng(stkHash(seedStr(stock.code + "|" + d)));
    let ret = (rr()*2-1) * (stock.vol*2.0);
    if (rr() > 0.88){ const dir = ret>=0?1:-1; ret = dir*(0.06 + rr()*0.045); }
    ret = Math.max(-0.10, Math.min(0.10, ret));
    price = Math.max(1, price*(1+ret));
  }
  cache[key] = price; return price;
}
function stockOpenPrice(stock, dayNum, cache){
  const prev = stockClose(stock, dayNum-1, cache);
  const prev2 = stockClose(stock, dayNum-2, cache);
  const yReturn = prev2>0 ? (prev/prev2 - 1) : 0;
  const jitter = (stkRng(stkHash(seedStr("open"+stock.code+dayNum)))()*2-1)*0.01;
  let gap = yReturn*0.8 + jitter;
  gap = Math.max(-0.04, Math.min(0.04, gap));
  return prev*(1+gap);
}
function stockPath(stock, dayNum, cache){
  const key = "p" + stock.code + ":" + dayNum;
  if (cache[key]) return cache[key];
  const open = stockOpenPrice(stock, dayNum, cache);
  const close = stockClose(stock, dayNum, cache);
  const prevC = stockClose(stock, dayNum-1, cache);
  const limHi = prevC*1.1, limLo = prevC*0.9;
  const N = SESSION_MIN;
  const rng = stkRng(stkHash(seedStr("path"+stock.code+dayNum)));
  const noise=[0]; let acc=0;
  for (let i=1;i<=N;i++){ acc += (rng()*2-1)*stock.vol; noise.push(acc); }
  const end = noise[N]; const path=[];
  for (let i=0;i<=N;i++){
    const lin = open + (close-open)*(i/N);
    const bridged = noise[i] - end*(i/N);
    path.push(Math.max(limLo, Math.min(limHi, lin + open*bridged)));
  }
  cache[key]=path; return path;
}
// 台北時間(UTC+8) 的盤別與日期編號，對齊前端
function taipei(nowMs){ return new Date(nowMs + 8*3600*1000); }
function dayNumTaipei(nowMs){ const t=taipei(nowMs); return Math.floor(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate())/86400000); }
function sessionIndexNow(nowMs){
  const t=taipei(nowMs); const mod=t.getUTCHours()*60+t.getUTCMinutes();
  if (mod < 540) return { state:"pre", idx:0 };
  if (mod <= 805) return { state:"open", idx: mod-540 };
  if (mod < 810) return { state:"closed", idx:265 };
  if (mod <= 1135) return { state:"open", idx: 266 + (mod-810) };
  if (mod < 1140) return { state:"closed", idx:591 };
  if (mod <= 1440) return { state:"open", idx: 592 + (mod-1140) };
  return { state:"open", idx: SESSION_MIN };
}

async function main(){
  const nowMs = Date.now();
  const dayNum = dayNumTaipei(nowMs);
  const s = sessionIndexNow(nowMs);
  const cache = {};
  const stocks = {};
  for (const st of STOCKS){
    const prevClose = stockClose(st, dayNum-1, cache);
    let open=null, now=prevClose, hi=prevClose, lo=prevClose, path=[];
    if (s.state !== "pre"){
      const full = stockPath(st, dayNum, cache);
      const shown = Math.min(s.idx, SESSION_MIN);
      open = full[0]; now = full[shown];
      const seg = full.slice(0, shown+1);   // 只發到「現在」為止，未來走勢不外洩
      hi = Math.max.apply(null, seg); lo = Math.min.apply(null, seg);
      path = seg.map(r2);   // 完整每分鐘路徑(索引=盤中分鐘)，前端圖表用
    }
    stocks[st.code] = { open: open==null?null:r2(open), now:r2(now), hi:r2(hi), lo:r2(lo), prevClose:r2(prevClose), path };
  }
  await db.collection("market").doc("live").set({
    dayNum, session: s.state, idx: s.idx,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    stocks,
  });
  console.log("published dayNum=" + dayNum + " session=" + s.state + " idx=" + s.idx);
}
main().then(()=>process.exit(0)).catch((e)=>{ console.error(e); process.exit(1); });
