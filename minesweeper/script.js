// ── State ──────────────────────────────────────────────────────────────────
let selectedShape = 'square';
let selectedDiff  = 'easy';
let grid = [];         // {mine, revealed, flagged, count, active}
let COLS, ROWS;
let activeCells = new Set();  // "row,col"
let mineCount = 0;
let flagCount = 0;
let timerInterval = null;
let seconds = 0;
let gameOver = false;
let firstClick = true;
let longPressTimer = null;

// ── Difficulty ─────────────────────────────────────────────────────────────
const DIFF = {
  easy:   { mineRate: 0.12 },
  medium: { mineRate: 0.18 },
  hard:   { mineRate: 0.26 },
};

// ── Best Time (saved in localStorage) ──────────────────────────────────────
// NEW FEATURE: each shape + difficulty combo gets its own saved best time.
// localStorage only stores text, so we convert to/from numbers ourselves.

function bestTimeKey(){
  return `minesweeper-best-${selectedShape}-${selectedDiff}`;
}

function getBestTime(){
  try {
    const saved = localStorage.getItem(bestTimeKey());
    return saved === null ? null : Number(saved);
  } catch (e) {
    return null; // localStorage can be blocked (e.g. private browsing)
  }
}

function saveBestTime(secs){
  try {
    localStorage.setItem(bestTimeKey(), String(secs));
  } catch (e) {
    // If saving fails, the game still works - we just don't remember the time.
  }
}

function updateBestDisplay(){
  const best = getBestTime();
  document.getElementById('best-val').textContent = best === null ? '--' : best;
}

// ── Shape Generators ───────────────────────────────────────────────────────
// Each returns a Set of "row,col" strings that are ACTIVE

function key(r,c){ return `${r},${c}`; }

function shapeSquare(size){
  const cells = new Set();
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) cells.add(key(r,c));
  return { cells, rows: size, cols: size };
}

function shapeDiamond(size){
  const cells = new Set();
  const half = Math.floor(size/2);
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    if(Math.abs(r-half)+Math.abs(c-half) <= half) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

function shapeCross(size){
  const cells = new Set();
  const third = Math.floor(size/3);
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    const inVert = c>=third && c<size-third;
    const inHoriz= r>=third && r<size-third;
    if(inVert||inHoriz) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

function shapeRing(size){
  const cells = new Set();
  const half = Math.floor(size/2);
  const inner = Math.floor(size/4);
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    const d = Math.abs(r-half)+Math.abs(c-half);
    if(d<=half && d>inner) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

function shapeTriangle(size){
  const cells = new Set();
  for(let r=0;r<size;r++){
    const width = Math.round((r+1)*(size/(size)));
    const start = Math.floor((size-width)/2);
    for(let c=start;c<start+width;c++) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

function shapeHexagon(size){
  const cells = new Set();
  const half = Math.floor(size/2);
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    const dr = Math.abs(r-half);
    const dc = Math.abs(c-half);
    if(dc <= half - Math.floor(dr/2)) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

function shapeSpiral(size){
  const cells = new Set();
  const half = size/2;
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    const dr = r - half + 0.5;
    const dc = c - half + 0.5;
    const dist = Math.sqrt(dr*dr+dc*dc);
    const angle = (Math.atan2(dr,dc) + Math.PI) / (2*Math.PI);
    const spiral = (dist / (half) - angle * 0.9) % 1;
    if(spiral < 0.45 && dist < half*0.98) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

function shapePlusRing(size){
  const cells = new Set();
  const half = Math.floor(size/2);
  const ring  = Math.floor(size/3);
  const arm   = Math.floor(size/5);
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    const dc = Math.abs(c-half);
    const dr = Math.abs(r-half);
    const dist = Math.sqrt((r-half)**2+(c-half)**2);
    const onRing = dist>=ring-1 && dist<=ring+1;
    const onVert = dc<=arm;
    const onHoriz= dr<=arm;
    if(onRing||onVert||onHoriz) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

const SHAPES = {
  square:   shapeSquare,
  diamond:  shapeDiamond,
  cross:    shapeCross,
  ring:     shapeRing,
  triangle: shapeTriangle,
  hexagon:  shapeHexagon,
  spiral:   shapeSpiral,
  plus_ring:shapePlusRing,
};

const SHAPE_SIZES = {
  easy: 13, medium: 17, hard: 21,
};

// ── UI Selection ───────────────────────────────────────────────────────────
function selectShape(btn){
  document.querySelectorAll('#shape-buttons .btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  selectedShape = btn.dataset.shape;
  updateBestDisplay(); // show the best time for this shape
}

function selectDiff(btn){
  document.querySelectorAll('#diff-buttons .btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  selectedDiff = btn.dataset.diff;
  updateBestDisplay(); // show the best time for this difficulty
}

// ── Game Init ──────────────────────────────────────────────────────────────
function startGame(){
  clearInterval(timerInterval);
  seconds = 0;
  flagCount = 0;
  gameOver = false;
  firstClick = true;
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('timer-val').textContent = '00';

  const size = SHAPE_SIZES[selectedDiff];
  const { cells, rows, cols } = SHAPES[selectedShape](size);
  ROWS = rows; COLS = cols;
  activeCells = cells;

  // Build grid
  grid = [];
  for(let r=0;r<ROWS;r++){
    grid[r] = [];
    for(let c=0;c<COLS;c++){
      grid[r][c] = { mine:false, revealed:false, flagged:false, count:0,
                     active: cells.has(key(r,c)) };
    }
  }

  mineCount = 0;
  updateHUD();
  updateBestDisplay();
  renderBoard();
}

function placeMines(firstR, firstC){
  const rate = DIFF[selectedDiff].mineRate;
  const safe = new Set();
  // Safe zone: 1-cell radius around first click
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    const rr=firstR+dr, cc=firstC+dc;
    if(rr>=0&&rr<ROWS&&cc>=0&&cc<COLS) safe.add(key(rr,cc));
  }
  activeCells.forEach(k=>{
    if(safe.has(k)) return;
    const [r,c] = k.split(',').map(Number);
    if(Math.random()<rate){ grid[r][c].mine=true; mineCount++; }
  });
  // Compute neighbor counts
  activeCells.forEach(k=>{
    const [r,c] = k.split(',').map(Number);
    if(grid[r][c].mine) return;
    let cnt=0;
    neighbors(r,c).forEach(([nr,nc])=>{ if(grid[nr][nc].mine) cnt++; });
    grid[r][c].count = cnt;
  });
  updateHUD();
}

function neighbors(r,c){
  const res=[];
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(dr===0&&dc===0) continue;
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&grid[nr][nc].active) res.push([nr,nc]);
  }
  return res;
}

// ── Rendering ──────────────────────────────────────────────────────────────
function renderBoard(){
  const board = document.getElementById('board');
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${COLS}, 32px)`;
  board.style.gridTemplateRows    = `repeat(${ROWS}, 32px)`;

  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    const cellData = grid[r][c];

    if(!cellData.active){
      cell.classList.add('inactive');
    } else if(cellData.revealed){
      cell.classList.add('revealed');
      if(cellData.mine){
        cell.classList.add('mine-revealed');
        cell.innerHTML = '<span class="mine-icon">💥</span>';
      } else if(cellData.count>0){
        cell.classList.add(`n${cellData.count}`);
        cell.textContent = cellData.count;
      }
    } else if(cellData.flagged){
      cell.classList.add('flagged');
      cell.innerHTML = '<span class="flag-icon">⚑</span>';
    } else {
      cell.classList.add('hidden');
    }

    if(cellData.active && !gameOver){
      cell.addEventListener('click', ()=>handleClick(r,c));
      cell.addEventListener('contextmenu', e=>{ e.preventDefault(); handleFlag(r,c); });
      // Long press for mobile
      cell.addEventListener('touchstart', e=>{ e.preventDefault(); longPressTimer=setTimeout(()=>handleFlag(r,c),450); }, {passive:false});
      cell.addEventListener('touchend',   ()=>clearTimeout(longPressTimer));
      cell.addEventListener('touchmove',  ()=>clearTimeout(longPressTimer));
    }

    board.appendChild(cell);
  }
}

function cellIndex(r,c){ return r*COLS+c; }

function getCellEl(r,c){
  return document.getElementById('board').children[cellIndex(r,c)];
}

function updateCell(r,c){
  const cellData = grid[r][c];
  const el = getCellEl(r,c);
  if(!el||!cellData.active) return;
  el.className = 'cell';
  el.innerHTML = '';
  if(cellData.revealed){
    el.classList.add('revealed');
    if(cellData.mine){
      el.classList.add('mine-revealed');
      el.innerHTML='<span class="mine-icon">💥</span>';
    } else if(cellData.count>0){
      el.classList.add(`n${cellData.count}`);
      el.textContent=cellData.count;
    }
  } else if(cellData.flagged){
    el.classList.add('flagged');
    el.innerHTML='<span class="flag-icon">⚑</span>';
  } else {
    el.classList.add('hidden');
  }
}

// ── Interaction ────────────────────────────────────────────────────────────
function handleClick(r,c){
  if(gameOver) return;
  const cell = grid[r][c];
  if(cell.revealed||cell.flagged) return;

  if(firstClick){
    firstClick=false;
    placeMines(r,c);
    startTimer();
  }

  if(cell.mine){ revealMine(r,c); return; }
  flood(r,c);
  checkWin();
}

function handleFlag(r,c){
  if(gameOver) return;
  const cell = grid[r][c];
  if(cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  cell.flagged ? sfxFlag() : sfxUnflag();
  updateCell(r,c);
  updateHUD();
}

function flood(r,c){
  const stack = [[r,c]];
  const visited = new Set();
  let emptyCells = 0;
  let numberedCells = [];
  while(stack.length){
    const [cr,cc] = stack.pop();
    const k = key(cr,cc);
    if(visited.has(k)) continue;
    visited.add(k);
    const cell = grid[cr][cc];
    if(!cell.active||cell.revealed||cell.flagged||cell.mine) continue;
    cell.revealed=true;
    updateCell(cr,cc);
    if(cell.count===0){
      emptyCells++;
      neighbors(cr,cc).forEach(([nr,nc])=>stack.push([nr,nc]));
    } else {
      numberedCells.push(cell.count);
    }
  }
  // Play sounds
  if(emptyCells > 1){
    sfxFlood(emptyCells + numberedCells.length);
    // Play the highest number tone after flood settles
    if(numberedCells.length){
      const maxN = Math.max(...numberedCells);
      setTimeout(()=> sfxNumber(maxN), Math.min(emptyCells,12)*28 + 60);
    }
  } else if(numberedCells.length){
    sfxNumber(numberedCells[0]);
  } else {
    sfxReveal();
  }
}

function revealMine(r,c){
  gameOver=true;
  clearInterval(timerInterval);
  sfxExplosion();
  grid[r][c].revealed=true;
  const el=getCellEl(r,c);
  el.className='cell mine-hit';
  el.innerHTML='<span class="mine-icon">💣</span>';
  // Reveal all mines with delay
  let i=0;
  activeCells.forEach(k=>{
    const [mr,mc]=k.split(',').map(Number);
    if(grid[mr][mc].mine&&!(mr===r&&mc===c)){
      setTimeout(()=>{
        grid[mr][mc].revealed=true;
        updateCell(mr,mc);
      }, 50*i++);
    }
  });
  setTimeout(()=>showOverlay(false), 50*i+400);
}

function checkWin(){
  let unrevealed=0;
  activeCells.forEach(k=>{
    const [r,c]=k.split(',').map(Number);
    if(!grid[r][c].revealed&&!grid[r][c].mine) unrevealed++;
  });
  if(unrevealed===0){
    gameOver=true;
    clearInterval(timerInterval);
    sfxVictory();

    // NEW: check whether this win beats the saved best time
    const best = getBestTime();
    const isNewBest = (best === null || seconds < best);
    if(isNewBest){
      saveBestTime(seconds);
      updateBestDisplay();
    }

    showOverlay(true, isNewBest);
  }
}

// ── Overlay ────────────────────────────────────────────────────────────────
function showOverlay(win, isNewBest = false){
  const box   = document.getElementById('overlay-box');
  const title = document.getElementById('overlay-title');
  const sub   = document.getElementById('overlay-sub');
  box.className   = 'overlay-box ' + (win?'':'lose');
  title.className = 'overlay-title ' + (win?'win':'lose');
  if(win){
    title.textContent='YOU WIN!';
    sub.textContent  =`Sector secured in ${seconds}s. ${mineCount} mines neutralized.`;
    if(isNewBest) sub.textContent += ' NEW BEST TIME!';
  } else {
    title.textContent='GAME OVER';
    sub.textContent  =`Signal lost. ${seconds}s elapsed.`;
  }
  document.getElementById('overlay').classList.add('show');
}

// ── HUD ────────────────────────────────────────────────────────────────────
function updateHUD(){
  document.getElementById('mines-val').textContent = String(mineCount).padStart(2,'0');
  document.getElementById('flags-val').textContent = String(flagCount).padStart(2,'0');
}

function startTimer(){
  timerInterval=setInterval(()=>{
    seconds++;
    document.getElementById('timer-val').textContent=String(seconds).padStart(2,'0');
  },1000);
}

// ── Audio Engine ───────────────────────────────────────────────────────────
let audioCtx = null;
let muted = false;

function getCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function toggleMute(){
  muted = !muted;
  const btn = document.getElementById('btn-mute');
  btn.textContent = muted ? '🔇 SFX' : '🔊 SFX';
  btn.classList.toggle('muted', muted);
}

// Utility: create a gain node that auto-disconnects
function makeGain(ctx, val){
  const g = ctx.createGain();
  g.gain.setValueAtTime(val, ctx.currentTime);
  g.connect(ctx.destination);
  return g;
}

// Short sine/square blip
function playTone(freq, type, duration, volume, attack=0.005, decay=0.05){
  if(muted) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.01);
}

// White-noise burst
function playNoise(duration, volume, highpass=200){
  if(muted) return;
  const ctx = getCtx();
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<bufSize;i++) data[i] = Math.random()*2-1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + duration);
}

// ── Sound Events ───────────────────────────────────────────────────────────

// Soft click when revealing an empty cell
function sfxReveal(){
  playTone(420, 'sine', 0.08, 0.18, 0.003, 0.07);
}

// Slightly pitched tone per number (1=low, 8=high)
function sfxNumber(n){
  const freqs = [0, 280, 320, 380, 440, 520, 620, 740, 880];
  playTone(freqs[n] || 300, 'triangle', 0.12, 0.22, 0.004, 0.10);
}

// Flood reveal: cascading soft ticks
function sfxFlood(cellCount){
  if(muted) return;
  const ticks = Math.min(cellCount, 12);
  for(let i=0;i<ticks;i++){
    setTimeout(()=> playTone(380 + i*18, 'sine', 0.06, 0.12, 0.002, 0.05), i * 28);
  }
}

// Flag planted
function sfxFlag(){
  playTone(600, 'square', 0.05, 0.15, 0.003, 0.04);
  setTimeout(()=> playTone(900, 'square', 0.05, 0.10, 0.003, 0.04), 55);
}

// Flag removed
function sfxUnflag(){
  playTone(900, 'square', 0.05, 0.12, 0.003, 0.04);
  setTimeout(()=> playTone(600, 'square', 0.05, 0.08, 0.003, 0.04), 55);
}

// Explosion
function sfxExplosion(){
  if(muted) return;
  const ctx = getCtx();
  // Low boom
  playNoise(1.2, 0.5, 30);
  // Sub thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(0.6, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.65);
  // High crack
  setTimeout(()=> playNoise(0.08, 0.3, 2000), 20);
}

// Victory fanfare — rising arpeggio
function sfxVictory(){
  if(muted) return;
  const notes = [330, 392, 494, 587, 740, 880];
  notes.forEach((freq, i)=>{
    setTimeout(()=>{
      playTone(freq, 'triangle', 0.35, 0.28, 0.01, 0.30);
      if(i === notes.length-1){
        setTimeout(()=> playTone(880, 'sine', 0.6, 0.3, 0.01, 0.55), 60);
        setTimeout(()=> playTone(1174, 'sine', 0.5, 0.22, 0.01, 0.45), 120);
      }
    }, i * 90);
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────
startGame();
