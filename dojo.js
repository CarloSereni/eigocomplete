/* ============================================================
   dojo.js — 道場（師範と戦う検定）と入門テスト
   ・index.html の本体スクリプトより前に読み込む（関数は呼ばれたときに本体の変数を使う）
   ・設定（範囲の割り振り・合格ライン）は、すぐ下の DOJO_DEF / DOJO_RULE だけ直せばよい
   ============================================================ */

/* ---- 設定1：級・段の数と、どの単語帳をどの順に割り振るか ----
   kyu＝級の数（15なら15級→1級）、dan＝段の数（初段→十段）。
   low は「級」に、high は「段」に割り振る単語帳（['b2'] ＝ b2全体、['b5',1,8] ＝ b5のUnit 1〜8）。
   low／high の中は並んだ順に、語数が均等になるように級・段へ切り分ける。 */
const DOJO_DEF = {
  w: { label:'単語', kyu:15, dan:10,
       low:  [['b1'],['b9'],['b2'],['b11']],        // 15級〜1級：中学修了〜大学合格必須
       high: [['b3'],['b4'],['b6'],['b7']] },       // 初段〜十段：難関大学突破〜英検1級・TOEIC990
  i: { label:'熟語', kyu:10, dan:10,
       low:  [['b10'],['b5',1,8]],                  // 10級〜1級
       high: [['b5',9,17],['b8']] }                 // 初段〜十段
};
/* ---- 設定2：問題数・合格ライン・制限時間 ----
   n＝問題数、need＝合格に必要な正解数、sec＝1問の制限秒数、enRatio＝英→日の割合（残りは日→英の例文穴埋め） */
const DOJO_RULE = {
  kyu:   { n:20, need:16, sec:15, enRatio:0.75 },   // 級：20問中16問（80%）
  dan:   { n:30, need:25, sec:12, enRatio:0.60 },   // 段：30問中25問（約83%）
  place: { n:6,  need:5,  sec:15, en:4 }            // 入門テスト：1ステップ6問中5問（英→日4問・日→英2問）
};
const DOJO_OWN_RATIO = 0.7;   // 検定の出題のうち、その級・段の範囲から出す割合（残りはそれより下の範囲の復習）
const DOJO_DAN = ['初段','二段','三段','四段','五段','六段','七段','八段','九段','十段'];
const DOJO_MASTERS = [
  {n:'門前の小僧', e:'🐥', say:'まずは基本から。かかってこい！'},
  {n:'見習い師範', e:'🥋', say:'基礎は大事じゃ。油断するでないぞ。'},
  {n:'若師範',     e:'🐯', say:'ここからが本番。ついて来られるかな？'},
  {n:'師範代',     e:'🦊', say:'ほう、なかなかやるな。次はどうかな。'},
  {n:'師範',       e:'🐉', say:'道場の師範、いざ尋常に勝負！'},
  {n:'大師範',     e:'🦅', say:'生半可な覚え方では通さぬぞ。'},
  {n:'範士',       e:'🐘', say:'語彙の深さを見せてもらおう。'},
  {n:'鬼の師範',   e:'👹', say:'ここから先は容赦せぬ！'},
  {n:'老師',       e:'🧙', say:'長き修行の成果、見せてみよ。'},
  {n:'伝説の大師範', e:'🏯', say:'頂への最後の関門じゃ。全力で来い！'}
];

/* ---- 記録（store.dojo）の整え。index.html の normStore から呼ぶ ---- */
function normDojo(d){
  d = (d && typeof d==='object' && !Array.isArray(d)) ? d : {};
  ['w','i'].forEach(function(t){
    const x = (d[t] && typeof d[t]==='object') ? d[t] : {};
    d[t] = {
      rank: Math.max(0, parseInt(x.rank,10)||0),      // 検定に合格した最高の級・段（0＝未認定）
      prov: Math.max(0, parseInt(x.prov,10)||0),      // 入門テストによる仮認定
      passed: (x.passed && typeof x.passed==='object' && !Array.isArray(x.passed)) ? x.passed : {},   // {段階番号:合格日}
      place: (x.place && typeof x.place==='object') ? x.place : null                                  // 最後の入門テスト {s,d}
    };
  });
  d.hist = Array.isArray(d.hist) ? d.hist.filter(function(h){ return h && typeof h==='object'; }).slice(-60) : [];
  return d;
}

/* ---- 級・段の名前・範囲 ---- */
function dojoK(t){ return DOJO_DEF[t].kyu + DOJO_DEF[t].dan; }
function dojoStageName(t,s){
  const def = DOJO_DEF[t];
  return s<=def.kyu ? (def.kyu-s+1)+'級' : DOJO_DAN[s-def.kyu-1];
}
function dojoEff(t){ const d=store.dojo[t]; return Math.max(d.rank, d.prov); }
function dojoRankLabel(t){
  const d=store.dojo[t], e=dojoEff(t);
  return e===0 ? '未認定' : dojoStageName(t,e)+(d.rank<e?'（仮）':'');
}
function dojoSummary(){ return '単語 '+dojoRankLabel('w')+'　熟語 '+dojoRankLabel('i'); }
function dojoMaster(t,s){ return DOJO_MASTERS[Math.min(DOJO_MASTERS.length-1, Math.floor((s-1)*DOJO_MASTERS.length/dojoK(t)))]; }

let _dojoCache = {};
function dojoBuild(t){
  if(_dojoCache[t]) return _dojoCache[t];
  const def = DOJO_DEF[t];
  const grp = function(g){
    const out=[];
    g.forEach(function(e){
      const id=e[0], D=bookData(id);
      bookUnitsAvail(id).forEach(function(u){
        if(e[1] && u<e[1]) return;
        if(e[2] && u>e[2]) return;
        D[u].forEach(function(r){ out.push(makeWord(id,u,r)); });
      });
    });
    return out;
  };
  const low=grp(def.low), high=grp(def.high), all=low.concat(high), idx={};
  all.forEach(function(w,i){ idx[w.no]=i; });
  _dojoCache[t] = {all:all, L:low.length, H:high.length, idx:idx};
  return _dojoCache[t];
}
function dojoRange(t,s){   // その級・段の語の範囲 [from, to)（all の添字）
  const def=DOJO_DEF[t], c=dojoBuild(t);
  if(s<=def.kyu) return [Math.floor((s-1)*c.L/def.kyu), Math.floor(s*c.L/def.kyu)];
  const d=s-def.kyu;
  return [c.L+Math.floor((d-1)*c.H/def.dan), c.L+Math.floor(d*c.H/def.dan)];
}
function dojoWhere(w){ return '第'+bookPos('b'+Math.floor(w.no/100000))+'冊 Unit '+w.unit+' No.'+w.bn; }
function dojoRangeText(t,s){
  const c=dojoBuild(t), r=dojoRange(t,s), a=c.all[r[0]], b=c.all[r[1]-1];
  if(!a||!b) return '';
  const ba=Math.floor(a.no/100000), bb=Math.floor(b.no/100000);
  const bs=function(w){ return '第'+bookPos('b'+Math.floor(w.no/100000))+'冊'; };
  if(ba===bb) return bs(a)+' Unit '+a.unit+(a.unit===b.unit?'':'〜'+b.unit);
  return bs(a)+' Unit '+a.unit+' 〜 '+bs(b)+' Unit '+b.unit;
}

/* ---- 問題づくり ---- */
function dojoOpts(c,w,dir){
  const i=c.idx[w.no];
  const pool=c.all.slice(Math.max(0,i-120), Math.min(c.all.length,i+120)).filter(function(x){ return x.no!==w.no && x.e!==w.e && x.jm!==w.jm; });
  const same=pool.filter(function(x){ return x.pos===w.pos; });
  const src=same.length>=3 ? same : pool;
  const txt=function(o){ return dir==='en2ja' ? o.jm : o.e; };
  const seen=new Set([txt(w)]), picked=[];
  shuffleArr(src.slice()).forEach(function(x){
    if(picked.length>=3) return;
    const tx=txt(x);
    if(seen.has(tx)) return;
    seen.add(tx); picked.push(x);
  });
  return shuffleArr([w].concat(picked)).map(function(o){ return {no:o.no, text:txt(o)}; });
}
function dojoMakeQs(t,s,rule,ownOnly){
  const c=dojoBuild(t), rg=dojoRange(t,s);
  const own=c.all.slice(rg[0],rg[1]), below=c.all.slice(0,rg[0]), n=rule.n;
  const used=new Set();
  const take=function(arr,k){
    const r=shuffleArr(arr.filter(function(w){ return !used.has(w.no); })).slice(0,Math.max(0,k));
    r.forEach(function(w){ used.add(w.no); });
    return r;
  };
  let nOwn = (ownOnly || !below.length) ? n : Math.round(n*DOJO_OWN_RATIO);
  let picks = take(own, nOwn);
  if(picks.length<n) picks = picks.concat(take(below.length?below:c.all, n-picks.length));
  if(picks.length<n) picks = picks.concat(take(c.all, n-picks.length));
  picks = shuffleArr(picks);
  const nEn = rule.en!=null ? rule.en : Math.round(n*rule.enRatio);
  const dirs = shuffleArr(Array.from({length:picks.length}, function(_,i){ return i<nEn ? 'en2ja' : 'ja2en'; }));
  return picks.map(function(w,i){
    const dir=dirs[i];
    return {w:w, dir:dir, k:Math.floor(Math.random()*2), opts:dojoOpts(c,w,dir)};
  });
}

/* ---- 戦いの進行 ---- */
let dojoS = null;      // 今の戦い
let dojoP = null;      // 入門テストの途中経過
let dojoRes = null;    // 結果画面に出す内容
let dojoT = 'w';       // 級・段の一覧で開いている種類（w＝単語／i＝熟語）

function dojoStopTimer(){ if(dojoS){ if(dojoS.timer){ clearInterval(dojoS.timer); dojoS.timer=null; } } }
function dojoStartQ(){
  const S=dojoS; dojoStopTimer();
  if(!S || S.ans!==null) return;
  S.left=S.sec; S.t0=Date.now();
  S.timer=setInterval(function(){
    const left=Math.max(0, S.sec-(Date.now()-S.t0)/1000); S.left=left;
    const b=document.getElementById('djBar'), s=document.getElementById('djSec');
    if(b){ b.style.width=(left/S.sec*100)+'%'; b.classList.toggle('low', left<4); }
    if(s) s.textContent=Math.ceil(left);
    if(left<=0){ dojoStopTimer(); dojoAnswer(-1); }
  },100);
}
function dojoStartCert(t,s,fromResult){
  const def=DOJO_DEF[t], c=dojoBuild(t);
  if(c.all.length<200){ alert('この道場に必要な単語データが足りません。'); return; }
  const rule = DOJO_RULE[s<=def.kyu ? 'kyu' : 'dan'];
  const qs=dojoMakeQs(t,s,rule,false);
  dojoS={mode:'cert', t:t, s:s, rule:rule, qs:qs, i:0, ok:0, ng:0, need:rule.need, maxMiss:qs.length-rule.need,
         sec:rule.sec, left:rule.sec, timer:null, nt:null, ans:null, log:[]};
  nav('dojoBattle', !fromResult);
  dojoStartQ();
}
function dojoStartPlace(t){
  if(dojoBuild(t).all.length<200){ alert('この道場に必要な単語データが足りません。'); return; }
  dojoP={t:t, lo:0, hi:dojoK(t), trace:[]};
  dojoPlaceStep();
}
function dojoPlaceStep(){
  const P=dojoP, mid=Math.ceil((P.lo+P.hi)/2), rule=DOJO_RULE.place;
  const qs=dojoMakeQs(P.t,mid,rule,true);
  dojoS={mode:'place', t:P.t, s:mid, rule:rule, qs:qs, i:0, ok:0, ng:0, need:rule.need, maxMiss:qs.length-rule.need,
         sec:rule.sec, left:rule.sec, timer:null, nt:null, ans:null, log:[]};
  if(screen==='dojoBattle') render(); else nav('dojoBattle');
  dojoStartQ();
}
function dojoAnswer(j){
  const S=dojoS;
  if(!S || S.ans!==null) return;
  dojoStopTimer();
  const q=S.qs[S.i], ok=(j>=0 && q.opts[j].no===q.w.no);
  S.ans={j:j, ok:ok};
  if(ok) S.ok++; else S.ng++;
  S.log.push({w:q.w, dir:q.dir, ok:ok, pick: j>=0 ? q.opts[j].text : '（時間切れ）'});
  if(S.mode==='cert'){   // 検定の結果は、クイズと同じく「覚えた／また後で」の判定と学習数に反映する（入門テストは反映しない）
    try{ recordTest(q.w.no,q.dir,ok); if(ok) touchWord(q.w.no,q.dir); saveStore(); }catch(e){}
  }
  renderDojoBattle();
  if(ok){
    const idx=S.i;
    S.nt=setTimeout(function(){ if(dojoS===S && screen==='dojoBattle' && S.i===idx && S.ans) dojoNext(); }, 1000);
  }
}
function dojoNext(){
  const S=dojoS;
  if(!S || S.ans===null) return;
  clearTimeout(S.nt);
  const win=S.ok>=S.need, lose=S.ng>S.maxMiss;
  if(win||lose){ dojoFinish(win); return; }
  S.i++; S.ans=null;
  renderDojoBattle();
  dojoStartQ();
}
function dojoPushHist(h){
  store.dojo.hist.push(h);
  while(store.dojo.hist.length>60) store.dojo.hist.shift();
}
function dojoFinish(win){
  const S=dojoS, t=S.t;
  if(S.mode==='cert'){
    const d=store.dojo[t];
    if(win){ d.passed[S.s]=todayKey(); if(S.s>d.rank) d.rank=S.s; }
    dojoPushHist({t:t, k:'c', s:S.s, d:todayKey(), ok:S.ok, ng:S.ng, p:win?1:0});
    saveStore();
    dojoRes={kind:'cert', t:t, s:S.s, win:win, ok:S.ok, ng:S.ng, need:S.need, n:S.rule.n, log:S.log};
    nav('dojoResult', false);
  } else {
    const P=dojoP;
    P.trace.push({s:S.s, ok:S.ok, ng:S.ng, win:win});
    if(win) P.lo=S.s; else P.hi=S.s-1;
    if(P.lo>=P.hi) dojoPlaceDone(); else dojoPlaceStep();
  }
}
function dojoPlaceDone(){
  const P=dojoP, t=P.t, est=P.lo, d=store.dojo[t];
  d.place={s:est, d:todayKey()};
  d.prov=Math.max(0, est-1);   // 診断し直したら仮認定も更新（正式な認定 rank は下がらない）
  const ok=P.trace.reduce(function(a,x){ return a+x.ok; },0), ng=P.trace.reduce(function(a,x){ return a+x.ng; },0);
  dojoPushHist({t:t, k:'p', s:est, d:todayKey(), ok:ok, ng:ng});
  saveStore();
  dojoRes={kind:'place', t:t, est:est, trace:P.trace};
  nav('dojoResult', false);
}
function dojoOpenBook(id,u){
  openBook(id);
  if(isAvail(u)){ fcCfg.unit=u; quizCfg.unitFrom=u; quizCfg.unitTo=u; listUnit=u; }
}

/* ---- 画面：道場のトップ ---- */
function dojoStatCard(t){
  const d=store.dojo[t], K=dojoK(t), e=dojoEff(t), def=DOJO_DEF[t];
  const next = e<K ? dojoStageName(t,e+1) : '';
  const pct = Math.round(e/K*100);
  return '<div class="dj-card">'
    + '<div class="dj-card-h"><span class="dj-type">'+def.label+'の道場</span>'
    + '<span class="dj-rank">'+(e===0?'未認定':dojoStageName(t,e))+(e>0&&d.rank<e?'<small>仮認定</small>':'')+'</span></div>'
    + '<div class="dj-prog"><div style="width:'+pct+'%"></div></div>'
    + '<div class="subnote">'+dojoStageName(t,1)+' 〜 '+dojoStageName(t,K)+'（全'+K+'段階）'
    + (e>=K ? '　🏯 最高位に到達！' : '　次の挑戦：'+next)+'</div>'
    + '<button class="startbtn" onclick="dojoT=\''+t+'\';nav(\'dojoLadder\')">'+(e>=K?'検定の一覧を見る':'検定に挑む（'+next+'）')+'</button>'
    + '</div>';
}
function renderDojo(){
  titleEl.textContent='道場';
  const histRows = store.dojo.hist.slice().reverse().slice(0,8).map(function(h){
    const lab = DOJO_DEF[h.t].label, nm = h.s>0 ? dojoStageName(h.t,h.s) : '15級未満';
    const what = h.k==='p' ? '入門テスト → '+nm+'相当' : nm+'の検定　'+(h.p?'<b class="dj-ok">合格</b>':'<b class="dj-ng">不合格</b>')+'（正解'+h.ok+'・不正解'+h.ng+'）';
    return '<tr><td>'+esc(h.d)+'</td><td>'+lab+'</td><td>'+what+'</td></tr>';
  }).join('');
  const w=DOJO_RULE.kyu, dn=DOJO_RULE.dan;
  main.innerHTML =
    '<div class="hero"><div class="eyebrow">DOJO</div><h2>🥋 道場</h2><p>師範と戦って、あなたの語彙力を認定します</p></div>'
    + dojoStatCard('w') + dojoStatCard('i')
    + '<div class="setup-block"><h3>入門テスト（どこから始めるか診断）</h3>'
    + '<div class="subnote" style="margin:0 0 10px">6問ずつ、問題のやさしさを変えながら答えていきます（約30問・全体で5ステップ）。結果から、実力の目安とおすすめの開始位置（第◯冊 Unit ◯）を教えます。診断のあとは、1つ下の級・段までを「仮認定」にします。</div>'
    + '<div style="display:flex;gap:8px"><button class="startbtn" style="flex:1" onclick="dojoStartPlace(\'w\')">単語を診断</button>'
    + '<button class="startbtn" style="flex:1;background:var(--ok)" onclick="dojoStartPlace(\'i\')">熟語を診断</button></div></div>'
    + '<div class="setup-block"><h3>検定のルール</h3><div class="dj-rules">'
    + '<div>・師範と1問ずつ戦います。正解すると師範にダメージ、不正解・時間切れだと自分にダメージ。</div>'
    + '<div>・<b>級</b>：'+w.n+'問中'+w.need+'問正解で合格（1問'+w.sec+'秒）。<b>段</b>：'+dn.n+'問中'+dn.need+'問正解で合格（1問'+dn.sec+'秒）。</div>'
    + '<div>・出題の約'+Math.round(DOJO_OWN_RATIO*100)+'％はその級・段の範囲、残りはそれより下の範囲の復習です。</div>'
    + '<div>・挑戦できるのは、今の認定の1つ上まで。もっと上から始めたいときは入門テストを受けてください。</div>'
    + '<div>・検定の答えは「覚えた／また後で」の判定と学習数にも反映されます（入門テストは反映しません）。</div>'
    + '</div></div>'
    + (histRows ? '<div class="setup-block"><h3>最近の記録</h3><table class="dj-hist"><tbody>'+histRows+'</tbody></table></div>' : '')
    + '<div class="footer-note">認定の記録は進捗データに含まれ、「データ管理」の書き出し・読み込みにも入ります。</div>';
}

/* ---- 画面：級・段の一覧 ---- */
function renderDojoLadder(){
  const t=dojoT, def=DOJO_DEF[t], K=dojoK(t), d=store.dojo[t], e=dojoEff(t);
  titleEl.textContent=def.label+'の検定';
  const rows=[];
  for(let s=1;s<=K;s++){
    const m=dojoMaster(t,s), kind=s<=def.kyu?'kyu':'dan', r=DOJO_RULE[kind];
    const rg=dojoRange(t,s), cnt=rg[1]-rg[0];
    const passed=!!d.passed[s], prov=!passed && s<=d.prov, locked=s>e+1, isNext=(s===e+1);
    const status = passed ? '<span class="dj-st ok">✓ 合格 '+esc(d.passed[s])+'</span>'
                 : prov ? '<span class="dj-st prov">仮認定</span>'
                 : locked ? '<span class="dj-st lock">🔒</span>' : '';
    rows.push('<div class="dj-row'+(isNext?' next':'')+(locked?' locked':'')+'" '+(isNext?'id="djNext"':'')+'>'
      + '<div class="dj-em">'+m.e+'</div>'
      + '<div class="dj-tx"><b>'+dojoStageName(t,s)+'</b> '+status
      + '<span>'+esc(dojoRangeText(t,s))+'（'+cnt+(t==='i'?'個':'語')+'）</span>'
      + '<span>'+r.n+'問中'+r.need+'問・'+r.sec+'秒／問　師範：'+m.n+'</span></div>'
      + (locked ? '' : '<button class="dj-go" onclick="dojoStartCert(\''+t+'\','+s+')">'+(passed?'再挑戦':'挑戦')+'</button>')
      + '</div>');
  }
  main.innerHTML =
    '<div class="hero" style="padding-bottom:12px"><div class="eyebrow">'+def.label+'の道場</div>'
    + '<h2>'+(e===0?'未認定':dojoRankLabel(t))+'</h2>'
    + '<p>'+(e>=K?'最高位に到達しています':'次は「'+dojoStageName(t,e+1)+'」に挑戦できます')+'</p></div>'
    + rows.join('')
    + '<div class="footer-note">合格した級・段より下の範囲は、再挑戦しても認定は下がりません。<br>上から始めたいときは、道場トップの「入門テスト」を受けてください。</div>';
  const el=document.getElementById('djNext');
  if(el) setTimeout(function(){ el.scrollIntoView({block:'center'}); },40);
}

/* ---- 画面：戦い ---- */
function dojoHearts(n,total,cls){
  let h=''; for(let i=0;i<total;i++) h+='<span class="dj-h '+cls+(i<n?'':' off')+'">'+(cls==='me'?'♥':'■')+'</span>';
  return h;
}
function renderDojoBattle(){
  const S=dojoS;
  if(!S){ goHome(); return; }
  const t=S.t, m=dojoMaster(t,S.s), q=S.qs[S.i], w=q.w, A=S.ans;
  const place=S.mode==='place';
  titleEl.textContent = place ? '入門テスト' : dojoStageName(t,S.s)+'の検定';
  const stepNo = place && dojoP ? dojoP.trace.length+1 : 0;
  const head = place
    ? '<div class="dj-place">診断 ステップ'+stepNo+'（目安：'+dojoStageName(t,S.s)+'あたりの範囲）</div>'
    : '';
  const meTotal=S.maxMiss+1, meLeft=Math.max(0,meTotal-S.ng), bossLeft=Math.max(0,S.need-S.ok);
  const bar = '<div class="dj-hud"><div class="dj-boss"><div class="dj-boss-n">'+m.e+' '+(place?'試験官':m.n)+'</div>'
    + '<div class="dj-hp"><div style="width:'+(bossLeft/S.need*100)+'%"></div></div>'
    + '<div class="dj-hp-t">残り '+bossLeft+' / '+S.need+'</div></div>'
    + '<div class="dj-me"><div class="dj-boss-n">あなた</div><div>'+dojoHearts(meLeft,meTotal,'me')+'</div></div></div>';
  let stem;
  if(q.dir==='en2ja'){
    stem='<div class="stem">'+esc(w.e)+' '+spkBtn(w.e)+(w.ipa?'<span class="stem-read">['+esc(w.ipa)+']</span>':'')+'</div><div class="subnote" style="margin:0 0 4px">意味を選んでください</div>';
  } else {
    const x=w.x[q.k];
    stem='<div class="cloze"><div class="cz-ja">'+jaHtml(x[1])+'</div><div class="cz-en">'+(A ? exFilled(x,A.ok) : exBlank(x,false))+'</div></div>';
  }
  const opts=q.opts.map(function(o,j){
    let cls='dj-opt';
    if(A){ cls+=' done'; if(o.no===w.no) cls+=' correct'; else if(j===A.j) cls+=' wrong'; }
    return '<button class="'+cls+'" '+(A?'disabled':'onclick="dojoAnswer('+j+')"')+'>'+esc(o.text)+'</button>';
  }).join('');
  let fb='';
  if(A){
    const win=S.ok>=S.need, lose=S.ng>S.maxMiss;
    const lab = win ? '結果を見る' : lose ? '結果を見る' : '次の問題へ';
    fb='<div class="dj-fb '+(A.ok?'ok':'ng')+'"><div class="dj-fb-h">'+(A.ok?'○ 正解！':(A.j<0?'× 時間切れ':'× 不正解'))
      +(win?'　師範を倒した！':lose?'　力尽きた…':'')+'</div>'
      + '<div><b>'+esc(w.e)+'</b> '+spkBtn(w.e)+(w.ipa?' <span class="ipa">['+esc(w.ipa)+']</span>':'')+'</div>'
      + '<div class="dj-fb-ja">'+esc(w.ja)+'</div>'
      + '<button class="dj-next" onclick="dojoNext()">'+lab+'</button></div>';
  }
  main.innerHTML = head + bar
    + '<div class="dj-qno">Q'+(S.i+1)+' / '+S.qs.length+'</div>'
    + '<div class="dj-timer"><div id="djBar" class="dj-bar" style="width:'+(A?0:(S.left/S.sec*100))+'%"></div><span id="djSec">'+Math.ceil(S.left)+'</span></div>'
    + '<div class="quiz-item" style="margin-top:8px">'+stem+'<div class="dj-opts">'+opts+'</div></div>'
    + fb
    + (S.i===0 && !A && S.ng===0 && S.ok===0 ? '<div class="dj-say">'+m.e+' 「'+(place?'まずは力試しじゃ。気楽にいけ。':m.say)+'」</div>' : '');
}

/* ---- 画面：結果 ---- */
function dojoStartBtns(t,s,primaryLabel){
  const c=dojoBuild(t), w=c.all[dojoRange(t,s)[0]];
  if(!w) return '';
  const id='b'+Math.floor(w.no/100000);
  return '<button class="startbtn" onclick="dojoOpenBook(\''+id+'\','+w.unit+')">'+primaryLabel+'：'+esc(bookInfo(id).name)+' Unit '+w.unit+' から始める</button>';
}
function renderDojoResult(){
  const R=dojoRes;
  if(!R){ goHome(); return; }
  titleEl.textContent = R.kind==='place' ? '診断結果' : '検定結果';
  const t=R.t, def=DOJO_DEF[t], K=dojoK(t);
  if(R.kind==='place'){
    const est=R.est, c=dojoBuild(t);
    const rows=R.trace.map(function(x,i){
      return '<tr><td>'+(i+1)+'</td><td>'+dojoStageName(t,x.s)+'</td><td>'+x.ok+'/'+(x.ok+x.ng)+'</td><td>'+(x.win?'<b class="dj-ok">○</b>':'<b class="dj-ng">×</b>')+'</td></tr>';
    }).join('');
    let title, msg, btns='';
    if(est===0){
      title=dojoStageName(t,1)+'に届かず';
      msg='最初の単語帳の最初から始めるのがおすすめです。基礎から固めましょう。';
      btns=dojoStartBtns(t,1,'おすすめ');
    } else if(est>=K){
      title=dojoStageName(t,K)+'相当';
      msg='この道場の最高位まで答えられました。検定で正式に認定を取りましょう。苦手な語は単語マップの「要復習」で見直せます。';
    } else {
      title=dojoStageName(t,est)+'相当';
      msg='「'+dojoStageName(t,est)+'」までは答えられました。次の「'+dojoStageName(t,est+1)+'」の範囲から始めるのがおすすめです（約30問の診断なので、前後1段階ほどの誤差があります）。';
      btns=dojoStartBtns(t,est+1,'おすすめ');
      if(est>=2) btns+='<div style="height:8px"></div>'+dojoStartBtns(t,est,'少し前から固めるなら').replace('class="startbtn"','class="startbtn" style="background:var(--ink2)"');
    }
    const eff=dojoEff(t);
    main.innerHTML =
      '<div class="dj-res"><div class="dj-res-k">'+def.label+'の診断結果</div><div class="dj-res-big">'+esc(title)+'</div></div>'
      + '<div class="dj-fb ok" style="margin-top:0">'+esc(msg)+'</div>'
      + '<div class="subnote" style="margin:10px 0 14px">'+(eff>0?'仮認定「'+dojoStageName(t,eff)+'」を設定しました。検定は「'+(eff<K?dojoStageName(t,eff+1):dojoStageName(t,K))+'」から挑戦できます。':'検定は「'+dojoStageName(t,1)+'」から挑戦できます。')+'</div>'
      + btns
      + '<div style="height:10px"></div>'
      + '<button class="startbtn" style="background:var(--ink2)" onclick="dojoT=\''+t+'\';nav(\'dojoLadder\')">'+def.label+'の検定に進む</button>'
      + '<div class="setup-block" style="margin-top:20px"><h3>診断の経過</h3><table class="dj-hist"><thead><tr><th>#</th><th>範囲</th><th>正解</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    window.scrollTo(0,0);
    return;
  }
  /* 検定の結果 */
  const nm=dojoStageName(t,R.s), m=dojoMaster(t,R.s);
  const missed=R.log.filter(function(x){ return !x.ok; });
  const rows=missed.map(function(x){
    return '<tr><td><b>'+esc(x.w.e)+'</b> '+spkBtn(x.w.e)+'</td><td>'+esc(x.w.jm)+'</td><td>'+esc(x.pick)+'</td></tr>';
  }).join('');
  let next='';
  if(R.win){
    next = R.s<K
      ? '<button class="startbtn" onclick="dojoStartCert(\''+t+'\','+(R.s+1)+',true)">次の「'+dojoStageName(t,R.s+1)+'」に挑戦</button>'
      : '<div class="dj-fb ok" style="margin-top:0">🏯 '+def.label+'の道場の最高位に到達しました。おめでとうございます！</div>';
  } else {
    next = '<button class="startbtn" onclick="dojoStartCert(\''+t+'\','+R.s+',true)">もう一度「'+nm+'」に挑戦（問題は入れ替わります）</button>';
  }
  main.innerHTML =
    '<div class="dj-res '+(R.win?'win':'lose')+'"><div style="font-size:44px">'+(R.win?'🏆':m.e)+'</div>'
    + '<div class="dj-res-k">'+def.label+'の検定 '+esc(nm)+'</div>'
    + '<div class="dj-res-big">'+(R.win?'合格！':'不合格')+'</div>'
    + '<div class="subnote">正解 '+R.ok+'問 ／ 不正解・時間切れ '+R.ng+'問（合格ライン：'+R.n+'問中'+R.need+'問）</div></div>'
    + (R.win ? '<div class="dj-fb ok" style="margin-top:0">'+m.e+' 「見事じゃ。'+esc(nm)+'、認定する！」</div>'
             : '<div class="dj-fb ng" style="margin-top:0">'+m.e+' 「まだまだ修行が足りぬな。間違えた語を見直して出直してこい。」</div>')
    + '<div style="height:12px"></div>' + next
    + '<div style="height:10px"></div>'
    + '<button class="startbtn" style="background:var(--ink2)" onclick="goBack()">級・段の一覧へ戻る</button>'
    + (rows ? '<div class="setup-block" style="margin-top:20px"><h3>間違えた語（「また後で」に追加済み）</h3><div style="overflow-x:auto"><table class="dj-hist"><thead><tr><th>単語</th><th>意味</th><th>あなたの答え</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>' : '');
  window.scrollTo(0,0);
}

/* ---- 画面の切り替えから呼ばれる入口（index.html の render() から） ---- */
function renderDojoScreen(){
  if(screen==='dojo') renderDojo();
  else if(screen==='dojoLadder') renderDojoLadder();
  else if(screen==='dojoBattle') renderDojoBattle();
  else if(screen==='dojoResult') renderDojoResult();
}

/* ---- 見た目 ---- */
(function(){
  const st=document.createElement('style');
  st.textContent = `
.dj-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 14px 12px;margin-bottom:12px;box-shadow:var(--shadow);}
.dj-card-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}
.dj-type{font-size:13px;color:var(--sub);font-weight:700;letter-spacing:.04em;}
.dj-rank{font-family:var(--serif);font-size:30px;font-weight:700;color:var(--accent);}
.dj-rank small{font-size:11px;color:var(--sub);margin-left:6px;font-family:inherit;font-weight:400;}
.dj-prog{height:8px;background:var(--line);border-radius:6px;overflow:hidden;margin-bottom:6px;}
.dj-prog>div{height:100%;background:var(--accent);}
.dj-card .startbtn{margin-top:10px;}
.dj-rules{font-size:12.5px;line-height:1.7;color:var(--ink2);}
.dj-hist{width:100%;border-collapse:collapse;font-size:12.5px;}
.dj-hist td,.dj-hist th{padding:6px 5px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;}
.dj-hist th{color:var(--sub);font-weight:400;font-size:11.5px;}
.dj-ok{color:var(--ok);} .dj-ng{color:var(--accent);}
.dj-row{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;}
.dj-row.next{border-color:var(--accent);box-shadow:0 0 0 2px rgba(166,50,31,.15);}
.dj-row.locked{opacity:.5;}
.dj-em{font-size:26px;width:34px;text-align:center;flex-shrink:0;}
.dj-tx{flex:1;min-width:0;}
.dj-tx b{font-size:16px;font-family:var(--serif);}
.dj-tx span{display:block;font-size:11.5px;color:var(--sub);margin-top:1px;}
.dj-tx .dj-st{display:inline;font-size:11px;margin-left:6px;}
.dj-st.ok{color:var(--ok);} .dj-st.prov{color:var(--keep);} .dj-st.lock{color:var(--sub);}
.dj-go{flex-shrink:0;border:none;border-radius:9px;background:var(--accent);color:#fff;font-size:13px;font-weight:700;padding:10px 14px;cursor:pointer;}
.dj-hud{display:flex;gap:12px;align-items:flex-start;margin:4px 0 8px;}
.dj-boss{flex:1;}
.dj-me{text-align:right;}
.dj-boss-n{font-size:12.5px;font-weight:700;margin-bottom:3px;}
.dj-hp{height:12px;background:var(--line);border-radius:7px;overflow:hidden;}
.dj-hp>div{height:100%;background:var(--accent);transition:width .25s;}
.dj-hp-t{font-size:11px;color:var(--sub);margin-top:2px;}
.dj-h{font-size:17px;margin-left:2px;}
.dj-h.me{color:var(--accent);} .dj-h.off{color:var(--line2);}
.dj-place{font-size:12px;color:var(--sub);text-align:center;margin-bottom:4px;}
.dj-qno{font-size:11.5px;color:var(--sub);margin-top:4px;}
.dj-timer{display:flex;align-items:center;gap:8px;}
.dj-timer>span{font-size:13px;font-weight:700;width:22px;text-align:right;color:var(--ink2);}
.dj-timer{height:12px;}
.dj-bar{height:8px;background:var(--ok);border-radius:5px;flex:1;transition:none;}
.dj-bar.low{background:var(--accent);}
.dj-opts{margin-top:8px;}
.dj-opt{display:block;width:100%;text-align:left;margin-top:8px;padding:12px 12px;border:1px solid var(--line2);background:#fff;border-radius:10px;font-size:14.5px;color:var(--ink);cursor:pointer;font-family:inherit;line-height:1.45;}
.dj-opt.done{cursor:default;}
.dj-opt.correct{border-color:var(--ok);background:var(--ok-bg);}
.dj-opt.wrong{border-color:var(--accent);background:#fbe9e6;}
.dj-fb{margin-top:12px;padding:12px;border-radius:12px;font-size:13.5px;line-height:1.6;}
.dj-fb.ok{background:var(--ok-bg);border:1px solid var(--ok);}
.dj-fb.ng{background:#fbe9e6;border:1px solid var(--accent);}
.dj-fb-h{font-weight:700;margin-bottom:4px;}
.dj-fb-ja{margin:2px 0 8px;}
.dj-next{display:block;width:100%;border:none;border-radius:10px;background:var(--ink);color:#fff;padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:6px;}
.dj-say{text-align:center;font-size:13px;color:var(--ink2);margin-top:14px;}
.dj-res{text-align:center;padding:14px 0 10px;}
.dj-res-k{font-size:12.5px;color:var(--sub);letter-spacing:.06em;}
.dj-res-big{font-family:var(--serif);font-size:34px;font-weight:700;margin:2px 0 6px;}
.dj-res.win .dj-res-big{color:var(--ok);}
.dj-res.lose .dj-res-big{color:var(--accent);}
`;
  document.head.appendChild(st);
})();
