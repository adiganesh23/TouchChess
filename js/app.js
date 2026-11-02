(function(){
const FILES='abcdefgh';
const SQUARES=[];for(let r=8;r>=1;r--)for(const f of FILES)SQUARES.push(f+r);
const NAMES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const GLYPH={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const VALUE={p:100,n:320,b:330,r:500,q:900,k:0};
const COLOR={w:'White',b:'Black'};
const PAT={p:[40],n:[40,70,40],b:[40,70,40,70,40],r:[180],q:[180,90,180],k:[180,90,180,90,180],
  empty:[8],check:[350,120,350],success:[60,50,60,50,220],error:[220],edge:[15,40,15]};
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const DEFAULTS={speech:false,rate:1,sound:false,haptics:true,flash:true,contrast:false,letters:false,coords:true,hints:true,calm:false,cpu:'gentle',opponent:'cpu'};
const settings=Object.assign({},DEFAULTS);
try{Object.assign(settings,JSON.parse(localStorage.getItem('tpc-settings')||'{}'))}catch(e){}
function save(){try{localStorage.setItem('tpc-settings',JSON.stringify(settings))}catch(e){}}
let done={};try{done=JSON.parse(localStorage.getItem('tpc-done')||'{}')}catch(e){}
function saveDone(){try{localStorage.setItem('tpc-done',JSON.stringify(done))}catch(e){}}

const S={game:new Chess(),selected:null,focus:'e2',flipped:false,last:null,lesson:null,step:0,hint:null,busy:false};
const $=id=>document.getElementById(id);
const boardEl=$('board'),srP=$('sr-polite'),srA=$('sr-alert'),banner=$('banner'),logEl=$('log');
const cells={};

/* ---------- Lessons ---------- */
const LESSONS=[
 {id:'map',title:'The board map',tag:'Start here',intro:'Every square has a name. The letter is the file, a to h from left to right. The number is the rank, 1 to 8 from White toward Black.',
  steps:[{type:'find',fen:START,target:'e4',goal:'Find the square e4, in the middle of the board: file e, rank 4.'},
         {type:'find',fen:START,target:'a8',goal:'Find a8, the far left corner. A black rook stands there.'},
         {type:'find',fen:START,target:'h1',goal:'Find h1, the near right corner. A white rook stands there.'},
         {type:'find',fen:START,target:'d5',goal:'Find d5. It is one of the four centre squares.'}]},
 {id:'rook',title:'The rook',tag:'Piece',piece:'r',intro:'The rook moves in straight lines along files and ranks, as far as it likes, until something is in the way.',
  steps:[{fen:'7k/8/8/8/8/8/8/R3K3 w - - 0 1',from:'a1',to:'a7',goal:'Move the rook from a1 straight up the a-file to a7.'},
         {fen:'7k/8/8/8/8/8/8/R3K3 w - - 0 1',from:'a1',to:'d1',goal:'Move the rook from a1 sideways along rank 1 to d1.'}]},
 {id:'bishop',title:'The bishop',tag:'Piece',piece:'b',intro:'The bishop moves diagonally, as far as it likes. It always stays on squares of one colour.',
  steps:[{fen:'7k/8/8/8/8/8/8/2B1K3 w - - 0 1',from:'c1',to:'g5',goal:'Move the bishop from c1 up and to the right, to g5.'},
         {fen:'7k/8/8/8/8/8/8/2B1K3 w - - 0 1',from:'c1',to:'a3',goal:'Move the bishop from c1 up and to the left, to a3.'}]},
 {id:'queen',title:'The queen',tag:'Piece',piece:'q',intro:'The queen combines the rook and the bishop. She moves in any straight line or diagonal.',
  steps:[{fen:'7k/8/8/8/3Q4/8/8/4K3 w - - 0 1',from:'d4',to:'a7',goal:'Move the queen from d4 diagonally to a7.'},
         {fen:'7k/8/8/8/3Q4/8/8/4K3 w - - 0 1',from:'d4',to:'g1',goal:'Move the queen from d4 diagonally down to g1.'}]},
 {id:'knight',title:'The knight',tag:'Piece',piece:'n',intro:'The knight moves in an L shape: two squares one way, then one square to the side. It is the only piece that can jump over others.',
  steps:[{fen:'7k/8/8/8/8/8/PPP5/1N2K3 w - - 0 1',from:'b1',to:'a3',goal:'The knight on b1 is behind its pawns. Jump it over them to a3.'},
         {fen:'7k/8/8/8/4N3/8/8/4K3 w - - 0 1',from:'e4',to:'f6',goal:'From e4, jump the knight two up and one right, to f6.'}]},
 {id:'pawn',title:'The pawn',tag:'Piece',piece:'p',intro:'Pawns move straight forward one square, or two on their first move. They capture one square diagonally forward.',
  steps:[{fen:'7k/8/8/8/8/8/4P3/4K3 w - - 0 1',from:'e2',to:'e4',goal:'The pawn on e2 has not moved yet. Push it two squares to e4.'},
         {fen:'7k/8/8/8/3p4/4P3/8/4K3 w - - 0 1',from:'e3',to:'d4',goal:'A black pawn is on d4. Capture it diagonally with your pawn from e3.'},
         {fen:'7k/3P4/8/8/8/8/8/4K3 w - - 0 1',from:'d7',to:'d8',goal:'Your pawn on d7 is one step from the far side. Move it to d8 and it becomes a queen.'}]},
 {id:'king',title:'The king',tag:'Piece',piece:'k',intro:'The king moves one square in any direction. Keep him safe: if he is attacked and cannot escape, the game is lost.',
  steps:[{fen:'7k/8/8/8/8/8/8/4K3 w - - 0 1',from:'e1',to:'d2',goal:'Move the king one square diagonally from e1 to d2.'},
         {fen:'7k/8/8/8/4K3/8/8/8 w - - 0 1',from:'e4',to:'e5',goal:'Move the king one square forward from e4 to e5.'}]},
 {id:'mate',title:'Your first checkmate',tag:'Goal of the game',intro:'Checkmate means the enemy king is attacked and has no way out. That wins the game.',
  steps:[{type:'mate',fen:'6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',from:'a1',to:'a8',goal:'The black king on g8 is trapped behind its own pawns. Find a checkmate with your rook on a1.'},
         {type:'mate',fen:'k7/4Q3/1K6/8/8/8/8/8 w - - 0 1',from:'e7',to:'b7',goal:'Your king on b6 guards b7 and a7. Find a checkmate with the queen on e7.'}]}
];

/* ---------- Feedback channels ---------- */
let audioCtx=null;
function ctx(){if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}return audioCtx}
function tone(sq,piece){
  if(!settings.sound||settings.calm)return;const a=ctx();if(!a)return;
  const scale=[0,2,4,5,7,9,11,12];const r=+sq[1]-1,f=FILES.indexOf(sq[0]);
  const o=a.createOscillator(),g=a.createGain();o.type=piece?'triangle':'sine';
  o.frequency.value=261.63*Math.pow(2,scale[r]/12);
  g.gain.setValueAtTime(0.0001,a.currentTime);g.gain.exponentialRampToValueAtTime(piece?0.22:0.12,a.currentTime+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+(piece?0.22:0.12));
  let node=g;if(a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=(f-3.5)/3.5;g.connect(p);node=p}
  o.connect(g);node.connect(a.destination);o.start();o.stop(a.currentTime+0.25);
}
function buzz(p){if(!settings.haptics||!p||!navigator.vibrate)return;try{navigator.vibrate(p)}catch(e){}}
function say(t,force){if((!settings.speech&&!force)||!('speechSynthesis' in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.rate=settings.calm?Math.min(settings.rate,0.9):settings.rate;speechSynthesis.speak(u)}catch(e){}}
function flash(){if(!settings.flash||settings.calm)return;const w=$('boardWrap');w.classList.add('flash');clearTimeout(flash.t);flash.t=setTimeout(()=>w.classList.remove('flash'),1400)}
function logAdd(t,level){const li=document.createElement('li');li.dataset.level=level;const n=new Date();const tm=document.createElement('time');tm.textContent=n.toTimeString().slice(0,5);li.append(tm,document.createTextNode(t));logEl.prepend(li);while(logEl.children.length>50)logEl.lastChild.remove()}
function announce(text,level='info',opt={}){
  const region=level==='alert'?srA:srP;region.textContent='';setTimeout(()=>{region.textContent=text},60);
  banner.textContent=text;banner.dataset.level=level;logAdd(text,level);
  if(opt.speak!==false)say(text);
  if(level==='alert'){flash();buzz(opt.haptic||PAT.check)}
  else if(level==='error'){flash();buzz(opt.haptic||PAT.error)}
  else if(level==='success')buzz(opt.haptic||PAT.success);
  else if(opt.haptic)buzz(opt.haptic);
}

/* ---------- Board ---------- */
const isLight=sq=>(FILES.indexOf(sq[0])+(+sq[1]))%2===0;
function buildBoard(){
  boardEl.innerHTML='';const order=S.flipped?[...SQUARES].reverse():SQUARES;
  for(let r=0;r<8;r++){const row=document.createElement('div');row.className='row';row.setAttribute('role','row');
    for(let c=0;c<8;c++){const sq=order[r*8+c];const cell=document.createElement('div');
      cell.id='sq-'+sq;cell.className='sq '+(isLight(sq)?'light':'dark');cell.setAttribute('role','gridcell');cell.dataset.sq=sq;
      cell.addEventListener('click',()=>{setFocus(sq,false,false);activate(sq)});
      row.appendChild(cell);cells[sq]=cell}
    boardEl.appendChild(row)}
  render();
}
function pieceName(p){return p?`${COLOR[p.color].toLowerCase()} ${NAMES[p.type]}`:'empty'}
function render(){
  const g=S.game;const tg=(S.selected&&settings.hints)?g.moves({square:S.selected,verbose:true}).map(m=>m.to):[];
  const inCheck=g.in_check(),turn=g.turn();
  for(const sq of SQUARES){const cell=cells[sq],p=g.get(sq);
    const isT=tg.includes(sq),isLast=!!(S.last&&(S.last.from===sq||S.last.to===sq)),chk=!!(inCheck&&p&&p.type==='k'&&p.color===turn);
    cell.classList.toggle('sel',S.selected===sq);cell.classList.toggle('last',isLast);cell.classList.toggle('check',chk);cell.classList.toggle('hint',S.hint===sq);
    cell.tabIndex=sq===S.focus?0:-1;
    let h='';if(settings.coords)h+=`<span class="co" aria-hidden="true">${sq}</span>`;
    if(p)h+=settings.letters?`<span class="pl ${p.color}" aria-hidden="true">${p.type.toUpperCase()}</span>`:`<span class="pc ${p.color}" aria-hidden="true">${GLYPH[p.type]}︎</span>`;
    if(isT)h+=`<span class="dot${p?' cap':''}" aria-hidden="true"></span>`;
    cell.innerHTML=h;
    let l=`${sq}, ${pieceName(p)}`;if(S.selected===sq)l+=', picked up';if(isT)l+=p?', you can capture here':', you can move here';if(chk)l+=', in check';if(isLast)l+=', part of last move';if(S.hint===sq)l+=', hint';
    cell.setAttribute('aria-label',l)}
  $('modePill').textContent=S.lesson?'Lesson':(settings.opponent==='cpu'?'vs computer':'Two players');
  $('oppPanel').hidden=!!S.lesson;
}
function setFocus(sq,moveFocus=true,feedback=true){
  S.focus=sq;for(const s of SQUARES)cells[s].tabIndex=s===sq?0:-1;
  if(moveFocus)cells[sq].focus();
  if(feedback){const p=S.game.get(sq);buzz(p?PAT[p.type]:PAT.empty);tone(sq,p);if(settings.speech)say(`${sq}, ${pieceName(p)}`)}
}
function canControl(color){const t=S.game.turn();if(S.lesson)return color==='w';if(settings.opponent==='cpu')return color==='w'&&t==='w';return color===t}
function listTargets(sq){const ms=S.game.moves({square:sq,verbose:true});return ms.length?ms.map(m=>m.to+(m.captured?` capturing ${NAMES[m.captured]}`:'')).join(', '):null}
function activate(sq){
  if(S.busy)return announce('One moment, the computer is thinking.','info');
  const g=S.game,p=g.get(sq);
  if(S.lesson&&curStep().type==='find')return findCheck(sq);
  if(!S.lesson&&g.game_over())return announce(`The game is over. ${gameState().text} Choose New game to play again.`,'info');
  if(S.selected){
    if(S.selected===sq){S.selected=null;render();return announce(`Put the ${NAMES[p.type]} back on ${sq}.`,'info')}
    const legal=g.moves({square:S.selected,verbose:true}).find(m=>m.to===sq);
    if(legal)return makeMove(S.selected,sq);
    if(p&&canControl(p.color))return select(sq);
    const from=S.selected,fp=g.get(from);
    return announce(`The ${NAMES[fp.type]} on ${from} cannot go to ${sq}. ${listTargets(from)?'It can go to '+listTargets(from)+'.':''}`,'error');
  }
  if(p&&canControl(p.color))return select(sq);
  if(p)return announce(`${sq}, ${pieceName(p)}. That is not your piece to move right now.`,'info',{haptic:PAT[p.type]});
  announce(`${sq} is empty.`,'info',{haptic:PAT.empty});
}
function select(sq){
  S.selected=sq;render();const p=S.game.get(sq);const t=listTargets(sq);
  announce(`Picked up ${pieceName(p)} on ${sq}. ${t?'It can go to '+t+'.':'It has no legal moves right now.'}`,'info',{haptic:PAT[p.type]});
}
function describeMove(m){
  const who=COLOR[m.color];
  if(m.flags.includes('k'))return `${who} castles on the king side.`;
  if(m.flags.includes('q'))return `${who} castles on the queen side.`;
  let t=`${who} ${NAMES[m.piece]} from ${m.from} to ${m.to}`;
  if(m.captured)t+=`, captures ${m.color==='w'?'black':'white'} ${NAMES[m.captured]}`;
  if(m.flags.includes('e'))t+=' en passant';
  if(m.promotion)t+=`, becomes a ${NAMES[m.promotion]}`;
  return t+'.';
}
function gameState(){
  const g=S.game,t=g.turn();
  if(g.in_checkmate())return{text:`Checkmate. ${COLOR[t==='w'?'b':'w']} wins.`,level:'alert',over:true};
  if(g.in_stalemate())return{text:'Stalemate. The game is a draw.',level:'alert',over:true};
  if(g.in_threefold_repetition())return{text:'Draw by repetition.',level:'alert',over:true};
  if(g.insufficient_material())return{text:'Draw. Neither side has enough pieces to checkmate.',level:'alert',over:true};
  if(g.in_draw())return{text:'Draw by the fifty-move rule.',level:'alert',over:true};
  if(g.in_check())return{text:`${COLOR[t]} is in check.`,level:'alert'};
  return{text:`${COLOR[t]} to move.`,level:'info'};
}
function announceMove(m,byCpu){
  const st=gameState();const lead=byCpu?'Computer: ':'';
  announce(`${lead}${describeMove(m)} ${st.text}`,st.level,{haptic:st.level==='info'?PAT[m.piece]:null});
}
function makeMove(from,to,promo){
  const g=S.game,piece=g.get(from);let promotion=promo;
  if(!promotion&&piece&&piece.type==='p'&&(to[1]==='8'||to[1]==='1'))promotion='q';
  if(S.lesson)return lessonMove(from,to,promotion);
  const m=g.move({from,to,promotion});
  if(!m)return announce(`${from} to ${to} is not a legal move.`,'error');
  S.selected=null;S.last=m;S.hint=null;S.focus=to;render();announceMove(m,false);
  if(!g.game_over()&&settings.opponent==='cpu'&&g.turn()==='b'){
    S.busy=true;setTimeout(()=>{const r=cpuPick();if(r){const mm=g.move({from:r.from,to:r.to,promotion:r.promotion||'q'});S.last=mm;render();announceMove(mm,true)}S.busy=false},settings.calm?1300:700);
  }
}
function tryMove(from,to,promo){
  if(S.busy)return announce('One moment, the computer is thinking.','info');
  const p=S.game.get(from);
  if(!p)return announce(`There is no piece on ${from}.`,'error');
  if(!canControl(p.color))return announce(`The ${pieceName(p)} on ${from} is not yours to move right now.`,'error');
  const legal=S.game.moves({square:from,verbose:true}).find(m=>m.to===to);
  if(!legal){const t=listTargets(from);return announce(`The ${NAMES[p.type]} on ${from} cannot go to ${to}. ${t?'It can go to '+t+'.':'It has no legal moves.'}`,'error')}
  setFocus(to,false,false);makeMove(from,to,promo);
}

/* ---------- Computer opponent ---------- */
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function material(g){let s=0;for(const sq of SQUARES){const p=g.get(sq);if(p)s+=(p.color==='b'?1:-1)*VALUE[p.type]}return s}
function cpuPick(){
  const g=S.game,moves=shuffle(g.moves({verbose:true}));if(!moves.length)return null;
  if(settings.cpu==='gentle'){const caps=moves.filter(m=>m.captured);return (caps.length&&Math.random()<0.6)?caps.sort((a,b)=>VALUE[b.captured]-VALUE[a.captured])[0]:moves[0]}
  let best=moves[0],bestS=-Infinity;
  for(const m of moves){g.move(m);let s;
    if(g.in_checkmate())s=1e6;else if(g.in_draw())s=0;else{let worst=Infinity;for(const r of g.moves({verbose:true})){g.move(r);const v=g.in_checkmate()?-1e6:material(g);g.undo();if(v<worst)worst=v}s=worst===Infinity?0:worst}
    g.undo();if(s>bestS){bestS=s;best=m}}
  return best;
}

/* ---------- Lessons ---------- */
const curStep=()=>S.lesson.steps[S.step];
function dirText(from,to){
  const df=FILES.indexOf(to[0])-FILES.indexOf(from[0]),dr=(+to[1])-(+from[1]);const parts=[];
  if(df)parts.push(`${Math.abs(df)} ${Math.abs(df)===1?'file':'files'} to the ${df>0?'right':'left'}`);
  if(dr)parts.push(`${Math.abs(dr)} ${Math.abs(dr)===1?'rank':'ranks'} ${dr>0?'up':'down'}`);
  return parts.join(' and ');
}
function startLesson(id){
  S.lesson=LESSONS.find(l=>l.id===id);S.step=0;show('play');loadStep(true);
}
function loadStep(first){
  const st=curStep();S.game.load(st.fen);S.selected=null;S.last=null;S.hint=null;S.busy=false;
  S.focus=st.type==='find'?'a1':st.from;
  $('lessonCard').hidden=false;$('lcNext').hidden=true;$('lcHint').hidden=false;$('lcRepeat').hidden=false;
  $('lcEyebrow').textContent=`${S.lesson.tag} · step ${S.step+1} of ${S.lesson.steps.length}`;
  $('lcTitle').textContent=S.lesson.title;$('lcGoal').textContent=st.goal;
  $('lcSteps').innerHTML=S.lesson.steps.map((_,i)=>`<span class="${i<=S.step?'on':''}"></span>`).join('');
  render();
  announce((first?`${S.lesson.title}. ${S.lesson.intro} `:'')+st.goal,'info');
  setTimeout(()=>cells[S.focus].focus(),50);
}
function findCheck(sq){
  const st=curStep();
  if(sq===st.target){S.hint=sq;render();announce(`Yes, that is ${sq}. Well found.`,'success');S.busy=true;setTimeout(nextStep,1600)}
  else announce(`That is ${sq}. ${st.target} is ${dirText(sq,st.target)} from here.`,'error');
}
function lessonMove(from,to,promotion){
  const st=curStep(),g=S.game;const m=g.move({from,to,promotion});
  if(!m)return announce('That move is not legal here.','error');
  S.last=m;S.selected=null;S.focus=to;S.hint=null;render();
  const ok=st.type==='mate'?g.in_checkmate():(from===st.from&&to===st.to);
  if(ok){announce(`${describeMove(m)} ${g.in_checkmate()?'Checkmate! ':''}Correct.`,'success');S.busy=true;setTimeout(nextStep,1800)}
  else{announce(`${describeMove(m)} That is a legal move, but not the goal. Try again: ${st.goal}`,'error');S.busy=true;setTimeout(()=>{g.undo();S.last=null;S.focus=from;S.busy=false;render()},1500)}
}
function nextStep(){
  S.busy=false;
  if(S.step<S.lesson.steps.length-1){S.step++;return loadStep(false)}
  done[S.lesson.id]=true;saveDone();renderLessons();
  const idx=LESSONS.indexOf(S.lesson),nxt=LESSONS[idx+1];
  $('lcEyebrow').textContent='Lesson complete';$('lcGoal').textContent=nxt?`Next up: ${nxt.title}.`:'You finished every lesson. Try a game against the computer.';
  $('lcSteps').innerHTML=S.lesson.steps.map(()=>'<span class="on"></span>').join('');
  $('lcHint').hidden=true;$('lcRepeat').hidden=true;$('lcNext').hidden=!nxt;$('lcNext').textContent=nxt?`Start: ${nxt.title}`:'';
  announce(`Lesson complete: ${S.lesson.title}. ${nxt?'Next up: '+nxt.title+'.':'You finished every lesson.'}`,'success');
}
function hint(){
  if(!S.lesson)return announce('Hints are for lessons. In a game, pick up a piece to hear where it can go.','info');
  const st=curStep();const target=st.type==='find'?st.target:st.to;
  if(st.type==='find'){S.hint=target;render();return announce(`${target} is ${dirText(S.focus,target)} from ${S.focus}. It is now outlined in yellow.`,'info')}
  if(!S.selected){S.hint=st.from;render();return announce(`Start by picking up the piece on ${st.from}. You are on ${S.focus}; ${st.from} is ${dirText(S.focus,st.from)||'right here'}.`,'info')}
  S.hint=target;render();announce(`Move it to ${target}, ${dirText(st.from,target)} from ${st.from}.`,'info');
}
function exitLesson(){S.lesson=null;$('lessonCard').hidden=true;newGame()}

/* ---------- Commands ---------- */
function describeBoard(){
  const g=S.game,out={w:{},b:{}};
  for(const sq of SQUARES){const p=g.get(sq);if(p)(out[p.color][p.type]=out[p.color][p.type]||[]).push(sq)}
  const side=c=>['k','q','r','b','n','p'].filter(t=>out[c][t]).map(t=>{const l=out[c][t];return `${l.length>1?NAMES[t]+'s':NAMES[t]} ${l.join(' ')}`}).join('; ')||'no pieces';
  announce(`White: ${side('w')}. Black: ${side('b')}. ${gameState().text}`,'info');
}
function lastMove(){if(!S.last)return announce('No moves yet.','info');announce('Last move: '+describeMove(S.last),'info')}
function attackers(sq){
  const g=S.game,res=[];
  for(const c of ['w','b']){
    const parts=g.fen().split(' ');parts[1]=c;parts[3]='-';const t=new Chess();if(!t.load(parts.join(' ')))continue;
    const target=t.get(sq);if(target&&target.color===c){t.remove(sq);t.put({type:'p',color:c==='w'?'b':'w'},sq)}
    else if(!target)t.put({type:'p',color:c==='w'?'b':'w'},sq);
    for(const m of t.moves({verbose:true}))if(m.to===sq)res.push(`${COLOR[c].toLowerCase()} ${NAMES[m.piece]} on ${m.from}`);
  }
  const uniq=[...new Set(res)];
  announce(uniq.length?`${sq} is attacked by ${uniq.join(', ')}.`:`Nothing attacks ${sq}.`,'info');
}
function listMoves(sq){const p=S.game.get(sq);if(!p)return announce(`${sq} is empty.`,'info');const t=listTargets(sq);
  announce(`${pieceName(p)} on ${sq}: ${t?'can go to '+t:'no legal moves'}${p.color!==S.game.turn()?' when it is '+COLOR[p.color]+"'s turn":''}.`,'info')}
function undo(){
  if(S.lesson){S.busy=false;return loadStep(false)}
  if(S.busy)return;const g=S.game;if(!g.history().length)return announce('Nothing to undo.','info');
  g.undo();if(settings.opponent==='cpu'&&g.turn()==='b'&&g.history().length)g.undo();
  const h=g.history({verbose:true});S.last=h[h.length-1]||null;S.selected=null;render();announce(`Move taken back. ${gameState().text}`,'info');
}
function newGame(){S.game.reset();S.selected=null;S.last=null;S.hint=null;S.busy=false;S.focus='e2';render();
  announce(settings.opponent==='cpu'?'New game. You play White against the computer. Your move.':'New game for two players. White moves first.','info')}
const HELP='Type a move like e4, Nf3 or e2 e4. Other commands: board, last, moves g1, attacks e4, undo, hint, new.';
function runCommand(raw){
  const t=raw.trim(),low=t.toLowerCase();
  if(['board','describe','d'].includes(low))return describeBoard();
  if(['last','l'].includes(low))return lastMove();
  if(low==='undo')return undo();
  if(['help','?'].includes(low))return announce(HELP,'info');
  if(['hint','h'].includes(low))return hint();
  if(['new','new game'].includes(low))return S.lesson?exitLesson():newGame();
  let mm=low.match(/^moves?\s+([a-h][1-8])$/);if(mm)return listMoves(mm[1]);
  mm=low.match(/^attacks?\s+([a-h][1-8])$/);if(mm)return attackers(mm[1]);
  if(/^[a-h][1-8]$/.test(low)&&S.lesson&&curStep().type==='find'){setFocus(low,false,true);return findCheck(low)}
  mm=low.match(/^([a-h][1-8])\s*(?:-|x|to|\s)?\s*([a-h][1-8])\s*=?([qrbn])?$/);if(mm)return tryMove(mm[1],mm[2],mm[3]);
  const tmp=new Chess(S.game.fen());
  let m=tmp.move(t,{sloppy:true});
  if(!m&&/^[nbrqk]/i.test(t))m=tmp.move(t[0].toUpperCase()+t.slice(1),{sloppy:true});
  if(!m&&/^o-o(-o)?$|^0-0(-0)?$/i.test(t))m=tmp.move(t.toUpperCase().replace(/0/g,'O'),{sloppy:true});
  if(m)return tryMove(m.from,m.to,m.promotion);
  if(/^[a-h][1-8]$/.test(low)){setFocus(low,true,true);const p=S.game.get(low);return announce(`${low}, ${pieceName(p)}.`,'info',{speak:true})}
  announce(`I did not understand "${t}". ${HELP}`,'error');
}

/* ---------- Views ---------- */
function show(v){
  for(const id of ['play','learn','options'])$('view-'+id).hidden=id!==v;
  document.querySelectorAll('nav.tabs button').forEach(b=>{if(b.dataset.view===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  window.scrollTo(0,0);
}
document.querySelectorAll('nav.tabs button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));

function renderLessons(){
  $('lessons').innerHTML='';
  LESSONS.forEach((l,i)=>{const d=document.createElement('article');d.className='lesson';
    d.innerHTML=`<div class="top"><h3>${i+1}. ${l.title}</h3><span class="badge${done[l.id]?' done':''}">${done[l.id]?'Done':l.steps.length+' steps'}</span></div><p>${l.intro}</p>`;
    const b=document.createElement('button');b.className='btn'+(done[l.id]?'':' primary');b.type='button';b.textContent=done[l.id]?'Practise again':'Start lesson';
    b.setAttribute('aria-label',`${b.textContent}: ${l.title}`);b.addEventListener('click',()=>startLesson(l.id));d.appendChild(b);$('lessons').appendChild(d)});
}
function renderFeel(){
  const desc={p:'1 short',n:'2 short',b:'3 short',r:'1 long',q:'2 long',k:'3 long'};
  $('feel').innerHTML='';
  ['p','n','b','r','q','k'].forEach(t=>{const b=document.createElement('button');b.type='button';b.className='btn';
    b.innerHTML=`<span class="g" aria-hidden="true">${GLYPH[t]}︎</span><span>${NAMES[t][0].toUpperCase()+NAMES[t].slice(1)}<small>${desc[t]}</small></span>`;
    b.setAttribute('aria-label',`${NAMES[t]}: ${desc[t]} vibration`);
    b.addEventListener('click',()=>{const prev=settings.haptics;settings.haptics=true;buzz(PAT[t]);settings.haptics=prev;say(`${NAMES[t]}. ${desc[t]}.`,true);banner.textContent=`${NAMES[t]}: ${desc[t]} vibration`});
    $('feel').appendChild(b)});
}
const OPTS=[
 {k:'speech',t:'Speak announcements aloud',d:'Uses your phone’s own voice. Leave this off if you already use VoiceOver or TalkBack, which read everything for you.',tags:['Blind','Low vision','Reading support']},
 {k:'rate',type:'range',t:'Voice speed',d:'How fast the voice talks.',tags:['Blind','Processing']},
 {k:'sound',t:'Square tones',d:'Each rank plays a higher note, from rank 1 low to rank 8 high. Files pan from your left ear (a) to your right ear (h). Squares with a piece sound brighter.',tags:['Blind']},
 {k:'haptics',t:'Vibration patterns',d:'Feel each piece as you move across the board: pawn 1 short, knight 2 short, bishop 3 short, rook 1 long, queen 2 long, king 3 long. Check is a strong double buzz. Works on Android; iPhones do not allow vibration from web apps.',tags:['Deafblind','Blind']},
 {k:'flash',t:'Visual alerts',d:'Check, checkmate and wrong moves flash the board edge and turn the banner red. Every sound is also written in Captions.',tags:['Deaf','Hard of hearing']},
 {k:'contrast',t:'High-contrast board',d:'Yellow and deep blue squares, with outlined pieces that stand out on either colour.',tags:['Low vision']},
 {k:'letters',t:'Letters instead of piece shapes',d:'Shows K, Q, R, B, N and P in bold circles. White pieces are white circles, black pieces are black circles.',tags:['Low vision','Learning']},
 {k:'coords',t:'Square names on every square',d:'Prints e4, f5 and so on in the corner of each square, so you never have to count.',tags:['Learning','Low vision']},
 {k:'hints',t:'Show where a piece can go',d:'After you pick up a piece, its legal squares get a dot, and captures get a dashed ring.',tags:['Learning']},
 {k:'calm',t:'Calm mode',d:'Softer colours, no flashing, no tones, slower voice and a slower computer opponent.',tags:['Sensory sensitivity','Autism','ADHD']},
 {k:'cpu',type:'select',t:'Computer strength',d:'Gentle mostly plays at random. Thinking looks two moves ahead and keeps its pieces safe.',tags:['Everyone'],choices:[['gentle','Gentle'],['think','Thinking']]}
];
function renderOpts(){
  const box=$('opts');box.innerHTML='';
  OPTS.forEach(o=>{const d=document.createElement('div');d.className='opt';const id='opt-'+o.k;let ctl;
    if(o.type==='range')ctl=`<input type="range" id="${id}" min="0.6" max="1.6" step="0.1" value="${settings.rate}" aria-describedby="${id}-d">`;
    else if(o.type==='select')ctl=`<select id="${id}" aria-describedby="${id}-d">${o.choices.map(([v,l])=>`<option value="${v}"${settings[o.k]===v?' selected':''}>${l}</option>`).join('')}</select>`;
    else ctl=`<span class="switch"><input type="checkbox" role="switch" id="${id}" aria-describedby="${id}-d"${settings[o.k]?' checked':''}><span></span></span>`;
    d.innerHTML=`<h3><label for="${id}">${o.t}</label></h3>${ctl}<p id="${id}-d">${o.d}</p><div class="tags" aria-label="Helps">${o.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`;
    box.appendChild(d);
    const el=$(id);el.addEventListener(o.type==='range'?'input':'change',()=>{
      settings[o.k]=o.type==='range'?+el.value:o.type==='select'?el.value:el.checked;save();applySettings();
      if(o.k==='haptics'&&el.checked)buzz(PAT.n);if(o.k==='sound'&&el.checked)tone('e4',true);if(o.k==='speech'&&el.checked)say('Speech is on.',true);if(o.k==='rate')say('This is the voice speed.',true)})});
  const tests=document.createElement('div');tests.className='actions';
  tests.innerHTML='<button class="btn" type="button" id="tVib">Test vibration</button><button class="btn" type="button" id="tVoice">Test voice</button><button class="btn" type="button" id="tTone">Test tones</button>';
  box.appendChild(tests);
  $('tVib').onclick=()=>{if(!navigator.vibrate){banner.textContent='This device or browser does not support vibration.';return}const p=settings.haptics;settings.haptics=true;buzz(PAT.check);settings.haptics=p};
  $('tVoice').onclick=()=>say('Knight from g1 to f3. Black to move.',true);
  $('tTone').onclick=()=>{const p=settings.sound,c=settings.calm;settings.sound=true;settings.calm=false;['a1','c3','e5','h8'].forEach((s,i)=>setTimeout(()=>tone(s,i%2),i*260));setTimeout(()=>{settings.sound=p;settings.calm=c},1200)};
}
function applySettings(){
  document.body.classList.toggle('contrast',settings.contrast);
  document.body.classList.toggle('letters',settings.letters);
  document.body.classList.toggle('calm',settings.calm);
  $('oppCpu').checked=settings.opponent==='cpu';$('oppHuman').checked=settings.opponent==='human';
  render();
}

/* ---------- Wire up ---------- */
boardEl.addEventListener('keydown',e=>{
  const k=e.key;let f=FILES.indexOf(S.focus[0]),r=+S.focus[1];const d=S.flipped?-1:1;
  if(k==='ArrowUp')r+=d;else if(k==='ArrowDown')r-=d;else if(k==='ArrowRight')f+=d;else if(k==='ArrowLeft')f-=d;
  else if(k==='Enter'||k===' '){e.preventDefault();return activate(S.focus)}
  else if(k==='Escape'){if(S.selected){S.selected=null;render();announce('Piece put back.','info')}return}
  else if(k==='m'||k==='M')return listMoves(S.focus);
  else if(k==='a'||k==='A')return attackers(S.focus);
  else if(k==='d'||k==='D')return describeBoard();
  else if(k==='l'||k==='L')return lastMove();
  else if(k==='h'||k==='H')return hint();
  else return;
  e.preventDefault();
  if(f<0||f>7||r<1||r>8){buzz(PAT.edge);return announce('Edge of the board.','info',{speak:true})}
  setFocus(FILES[f]+r,true,true);
});
$('cmdForm').addEventListener('submit',e=>{e.preventDefault();const v=$('cmdInput').value;if(!v.trim())return;$('cmdInput').value='';runCommand(v)});
$('bDescribe').onclick=describeBoard;$('bLast').onclick=lastMove;$('bUndo').onclick=undo;
$('bFlip').onclick=()=>{S.flipped=!S.flipped;buildBoard();announce(S.flipped?'Board flipped. Black is now at the bottom.':'Board flipped. White is now at the bottom.','info')};
$('bNew').onclick=()=>S.lesson?exitLesson():newGame();
document.querySelectorAll('input[name=opp]').forEach(r=>r.addEventListener('change',()=>{settings.opponent=r.value;save();newGame()}));
$('lcHint').onclick=hint;$('lcRepeat').onclick=()=>announce(curStep().goal,'info');
$('lcExit').onclick=exitLesson;
$('lcNext').onclick=()=>{const i=LESSONS.indexOf(S.lesson);if(LESSONS[i+1])startLesson(LESSONS[i+1].id)};

buildBoard();renderLessons();renderFeel();renderOpts();applySettings();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
logAdd('Welcome. You play White. Tap a piece, use the arrow keys, or type a move like e4.','info');
banner.dataset.level='info';
})();
