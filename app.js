const WORD_BANK = `amber almost always among answer around autumn awake balance become before begin beneath better between breathe bright bring build calm candle careful carry certain change clear close color come common complete continue corner create curious daily dance deep desire different discover drift early easy echo else empty enough evening every exact example explore face fall family far favorite feel field find finish first flower follow forest forget forward fresh friend gentle get give glow golden good grace green ground grow guess habit half happen happy harbor harmony have heart hello hidden higher hope horizon house idea imagine improve inside instead journey kind kindness know laugh learn leave light listen little live long look lovely lower lucid make many meaning memory moment moon morning mountain move music mystery nearby never night noise notice ocean often open orange order other outside page paper pause peace people perfect perhaps place planet play pleasant pocket poetry possible practice present quiet quick radiate read ready real reason remember rest rhythm right river room run say season second see sense settle shadow shape share shimmer simple sing slow small soft some song space speak spend spirit still story stream subtle summer sure sweet take tender than thank thing think thought through time tiny together tomorrow touch travel true try turn type under understand unique until use usual value various velvet vision wait warm watch water way we welcome well whatever whole whisper wild window wonder word work world write yellow yesterday young`.split(/\s+/);
const $ = (id) => document.getElementById(id);
const wordsEl = $('words'), input = $('typingInput'), timerEl = $('timer'), progress = $('progress'), card = $('testCard'), hint = $('startHint'), status = $('testStatus'), caret = $('caret'), wordArea = $('wordArea');
let targetWords=[], typedWords=[''], started=false, finished=false, remaining=30, timerId=null, backspaces=0, totalKeys=0, correctKeys=0, wpmSamples=[], sampleTimer=null, previousSampleChars=0, restartArmed=false;
function makeWords(){const arr=[];let last=-1;for(let i=0;i<95;i++){let n=Math.floor(Math.random()*WORD_BANK.length);if(n===last)n=(n+17)%WORD_BANK.length;arr.push(WORD_BANK[n]);last=n}return arr}
function init(){clearInterval(timerId);clearInterval(sampleTimer);targetWords=makeWords();typedWords=[''];started=false;finished=false;remaining=30;backspaces=0;totalKeys=0;correctKeys=0;wpmSamples=[];previousSampleChars=0;timerEl.textContent='30';timerEl.classList.remove('urgent');progress.style.width='0%';$('results').hidden=true;$('results').classList.remove('show');card.style.display='';hint.classList.remove('gone');status.setAttribute('aria-label','ready');wordArea.scrollTop=0;input.value='';card.classList.remove('active');render(true);}
// Keep word nodes stable; render every input character, including overflow.
function render(instant=false){
  const currentIndex=typedWords.length-1;
  while(wordsEl.children.length<targetWords.length){
    const node=document.createElement('span');
    node.className='word';
    wordsEl.append(node);
  }
  while(wordsEl.children.length>targetWords.length)wordsEl.lastElementChild.remove();
  targetWords.forEach((word,wi)=>{
    const node=wordsEl.children[wi];
    const typed=typedWords[wi]||'';
    const committed=wi<currentIndex;
    node.className='word'+(wi===currentIndex?' current':'')+(committed&&typed!==word?' error':'');
    const signature=JSON.stringify([word,typed,committed]);
    if(node.dataset.signature===signature)return;
    node.dataset.signature=signature;
    node.textContent='';
    for(let ci=0;ci<Math.max(word.length,typed.length);ci++){
      const letter=document.createElement('span');
      letter.className='char';
      letter.textContent=ci<word.length?word[ci]:typed[ci];
      if(ci>=word.length)letter.classList.add('incorrect','extra');
      else if(ci<typed.length){
        letter.classList.add(typed[ci]===word[ci]?'correct':'incorrect');
        if(typed[ci]!==word[ci])letter.title='Typed '+typed[ci]+'; expected '+word[ci];
      }else if(committed)letter.classList.add('missed');
      node.append(letter);
    }
  });
  const curr=wordsEl.children[currentIndex];
  if(curr){
    const bounds=curr.getBoundingClientRect(), viewport=wordArea.getBoundingClientRect();
    const padding=parseFloat(getComputedStyle(wordArea).paddingTop)||0;
    const lineHeight=parseFloat(getComputedStyle(wordsEl).lineHeight)||40;
    if(bounds.bottom>viewport.bottom-padding){
      wordArea.scrollTop+=bounds.bottom-(viewport.bottom-padding)+lineHeight;
    }else if(bounds.top<viewport.top+padding){
      wordArea.scrollTop=Math.max(0,wordArea.scrollTop+bounds.top-viewport.top-padding);
    }
  }
  placeCaret(instant);
}
function placeCaret(instant=false){
  const index=typedWords.length-1;
  const current=wordsEl.children[index];
  if(!current||!current.children.length)return;
  const count=typedWords[index].length;
  const after=count>=current.children.length;
  const target=current.children[after?current.children.length-1:count];
  const rect=target.getBoundingClientRect(), area=wordArea.getBoundingClientRect();
  // The caret is inside the scrolling area: restore content coordinates.
  const x=(after?rect.right:rect.left)-area.left+wordArea.scrollLeft;
  const height=Math.max(22,rect.height*.8);
  const y=rect.top-area.top+wordArea.scrollTop+(rect.height-height)/2;
  caret.style.height=height+'px';
  caret.classList.toggle('no-transition',instant);
  caret.style.transform='translate3d('+x+'px,'+y+'px,0)';
  if(instant)requestAnimationFrame(()=>caret.classList.remove('no-transition'));
}
function begin(){if(started||finished)return;started=true;card.classList.add('active');hint.classList.add('gone');status.setAttribute('aria-label','test in progress');timerId=setInterval(()=>{remaining--;timerEl.textContent=remaining;progress.style.width=((30-remaining)/30*100)+'%';if(remaining<=5)timerEl.classList.add('urgent');if(remaining<=0)finish()},1000);sampleTimer=setInterval(sampleWpm,3000)}
function sampleWpm(){const correct=typedWords.reduce((sum,w,i)=>sum+[...(w||'')].filter((c,j)=>c===(targetWords[i]&&targetWords[i][j])).length,0);const delta=Math.max(0,correct-previousSampleChars);wpmSamples.push(Math.round(delta/5/0.05));previousSampleChars=correct}
function handleBackspace(wholeWord=false){
  if(finished||!started)return;
  backspaces++;
  const index=typedWords.length-1;
  if(typedWords[index].length){
    typedWords[index]=wholeWord?'':typedWords[index].slice(0,-1);
  }else if(index>0){
    typedWords.pop();
    if(wholeWord)typedWords[typedWords.length-1]='';
  }
  render();
}
function advanceWord(){
  if(finished||!typedWords[typedWords.length-1].length)return;
  // Commit with Space regardless of errors; duplicate spaces do not skip words.
  totalKeys++;
  correctKeys++;
  typedWords.push('');
  if(typedWords.length>=targetWords.length)targetWords.push(...makeWords());
  render();
}
function handleCharacter(ch){
  if(finished||ch.length!==1)return;
  if(!started)begin();
  const wi=typedWords.length-1,ci=typedWords[wi].length;
  totalKeys++;
  if(ch===targetWords[wi][ci])correctKeys++;
  typedWords[wi]+=ch;
  render();
}
function finish(){if(finished)return;finished=true;clearInterval(timerId);clearInterval(sampleTimer);remaining=0;timerEl.textContent='0';progress.style.width='100%';card.classList.remove('active');const correctChars=typedWords.reduce((sum,w,i)=>sum+[...(w||'')].filter((c,j)=>c===(targetWords[i]&&targetWords[i][j])).length,0);const wpm=Math.round(correctChars/5/.5);const accuracy=totalKeys?Math.round(correctKeys/totalKeys*100):0;const mean=wpmSamples.reduce((a,b)=>a+b,0)/(wpmSamples.length||1);const variance=wpmSamples.reduce((a,b)=>a+(b-mean)**2,0)/(wpmSamples.length||1);const consistency=wpmSamples.length>1?Math.max(0,Math.round(100-Math.sqrt(variance)/(mean||1)*100)):0;$('resultWpm').innerHTML=`${wpm}<span> wpm</span>`;$('resultAccuracy').textContent=accuracy+'%';$('resultConsistency').textContent=consistency+'%';$('resultBackspaces').textContent=backspaces;drawChart(wpmSamples.length?wpmSamples:[0]);$('resultNote').textContent=wpm>=70?'Your fingers know the way. Keep that rhythm.':wpm>=40?'A lovely pace. Let it settle in.':'A little more practice, a little more flow.';$('results').hidden=false;$('results').classList.add('show');status.setAttribute('aria-label','test complete');setTimeout(()=>$('results').scrollIntoView({behavior:'smooth',block:'nearest'}),180)}
function drawChart(samples){const vals=samples.slice();if(vals.length===1)vals.push(vals[0]);const max=Math.max(20,...vals),min=0,w=600,h=140,pad=8;const pts=vals.map((v,i)=>({x:pad+(w-2*pad)*i/(vals.length-1),y:h-pad-(v-min)/(max-min)*(h-2*pad)}));const d=pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');$('chartLine').setAttribute('d',d);$('chartArea').setAttribute('d',`${d} L ${pts[pts.length-1].x} ${h} L ${pts[0].x} ${h} Z`);$('chartPoints').innerHTML=pts.map(p=>`<circle class="chart-point" cx="${p.x}" cy="${p.y}" r="3.5"/>`).join('')}
$('wordArea').addEventListener('click',()=>input.focus());
input.addEventListener('click',()=>input.focus());
window.addEventListener('keydown',e=>{
  if(e.key==='Tab'){
    e.preventDefault();restartArmed=true;input.focus();return;
  }
  if(e.key==='Enter'&&restartArmed){
    e.preventDefault();restartArmed=false;init();input.focus();return;
  }
  if(e.key!=='Enter')restartArmed=false;
  const focus=document.activeElement;
  const typingContext=focus===input||focus===wordArea||focus===document.body||focus===document.documentElement;
  if(!typingContext)return;
  if(e.key==='Backspace'){
    e.preventDefault();handleBackspace(e.ctrlKey||e.altKey||e.metaKey);input.focus();return;
  }
  if(e.key===' '&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
    e.preventDefault();advanceWord();input.focus();return;
  }
  if(e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
    e.preventDefault();handleCharacter(e.key);input.focus();
  }
});
$('restart').addEventListener('click',()=>{init();input.focus()});
$('tryAgain').addEventListener('click',()=>{init();input.focus();wordArea.scrollIntoView({behavior:'smooth',block:'center'})});
init();

window.addEventListener('resize',()=>render(true));
if(document.fonts)document.fonts.ready.then(()=>render(true));
