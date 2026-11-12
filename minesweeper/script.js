// WELCOME TO script.js!
//
// JavaScript is the programming language that makes a web page INTERACTIVE.
// index.html is the skeleton and style.css is the decoration; this file is
// the brain. It decides what happens when you click, runs the timer, places
// the mines, and checks whether you won.
//
// Any line starting with two slashes (//) is a "comment": a note for humans
// that the computer ignores.
//
// HOW THIS GAME WORKS, IN SHORT:
//   1. The board is a grid of cells (like a spreadsheet).
//   2. Some cells hide mines. The rest show a number counting how many
//      mines touch them (including diagonally).
//   3. You open cells you think are safe and flag the ones you think are mines.
//   4. Open every safe cell to win. Open a mine and you lose.


// ── State ──────────────────────────────────────────────────────────────────
// "State" means the information the game needs to remember right now.
//
// A "variable" is a named box that stores a value. "let" creates a variable
// whose value is allowed to change later. The text after = is its starting
// value.
//
// Variable types used below:
//   - A string is text in quotes, like 'square'.
//   - A number is a plain number, like 0.
//   - A boolean is either true or false (like a light switch).
//   - An array is an ordered list of items, written with square brackets [].
//   - null means "nothing here yet".

let selectedShape = 'square';  // which map shape the player has picked
let selectedDiff  = 'easy';    // which difficulty the player has picked
let grid = [];         // {mine, revealed, flagged, count, active}
                       // The whole board: a list of rows, each row being a list of cells.
                       // Each cell is an "object" (a bundle of named values) holding:
                       //   mine     = does this cell hide a mine?
                       //   revealed = has the player opened it?
                       //   flagged  = has the player put a flag on it?
                       //   count    = how many neighboring cells have mines?
                       //   active   = is this cell part of the chosen shape?
let COLS, ROWS;        // how many columns and rows the board has (set when a game starts)
let activeCells = new Set();  // "row,col"
                       // A Set is a collection where every item appears only once and
                       // lookups are fast. This one holds the location of every cell in
                       // the shape, written as text like "3,4" (row 3, column 4).
let mineCount = 0;     // total mines on the board
let flagCount = 0;     // flags the player has placed
let timerInterval = null;  // remembers the running timer so we can stop it later
let seconds = 0;       // seconds elapsed in the current game
let gameOver = false;  // becomes true when the player wins or loses
let firstClick = true; // true until the player's first click (the mines are placed AFTER that click so the first click is always safe)
let longPressTimer = null; // used on phones to detect "press and hold" for flagging


// ── Difficulty ─────────────────────────────────────────────────────────────
// "const" creates a variable that can NOT be changed after it is set (a
// constant). We use it for settings that should stay fixed.
//
// mineRate is the chance that any given cell gets a mine. For example, 0.12
// means about 12 out of every 100 cells hide a mine. Harder = more mines.
const DIFF = {
  easy:   { mineRate: 0.12 },
  medium: { mineRate: 0.18 },
  hard:   { mineRate: 0.26 },
};


// ── Best Time (saved in localStorage) ──────────────────────────────────────
// NEW FEATURE: each shape + difficulty combo gets its own saved best time.
// localStorage only stores text, so we convert to/from numbers ourselves.
//
// "localStorage" is a small storage area built into the browser. Whatever
// you save there stays on the visitor's computer even after they close the
// page, so the best time is still there next visit. It stores "key: value"
// pairs, like a dictionary: the key is the name (like a label on a drawer)
// and the value is what is stored inside.

// A "function" is a named, reusable set of instructions. You define it once
// and can "call" (run) it as many times as you like by writing its name
// followed by parentheses.
//
// This one builds the key (storage label) for the current shape and
// difficulty, for example: "minesweeper-best-diamond-hard".
// The backticks ` ` let us drop variable values into text using ${...}.
function bestTimeKey(){
  return `minesweeper-best-${selectedShape}-${selectedDiff}`;
}

// Reads the saved best time for the current shape and difficulty.
// It returns the time as a number, or null if nothing has been saved yet.
function getBestTime(){
  // "try ... catch" means: TRY to run this code, and if an error happens,
  // don't crash; run the catch part instead.
  try {
    // getItem looks up a saved value by its key. If the key doesn't exist,
    // it gives back null.
    const saved = localStorage.getItem(bestTimeKey());
    // This is a "ternary": a short if/else written as condition ? valueIfTrue : valueIfFalse.
    // Number(...) converts saved text like "42" into the real number 42.
    return saved === null ? null : Number(saved);
  } catch (e) {
    return null; // localStorage can be blocked (e.g. private browsing)
  }
}

// Saves a new best time. setItem stores a value under a key. Values are
// stored as text, so String(secs) turns the number into text first.
function saveBestTime(secs){
  try {
    localStorage.setItem(bestTimeKey(), String(secs));
  } catch (e) {
    // If saving fails, the game still works - we just don't remember the time.
  }
}

// Updates the "★ BEST" number on the page.
// "document" is the web page itself. getElementById finds the one element
// that has a given id. textContent is the text inside that element, so
// assigning to it changes what is shown on screen.
// This is called changing the "DOM" (Document Object Model): the live,
// changeable version of the page that JavaScript can read and edit.
function updateBestDisplay(){
  const best = getBestTime();
  document.getElementById('best-val').textContent = best === null ? '--' : best;
}


// ── Shape Generators ───────────────────────────────────────────────────────
// Each returns a Set of "row,col" strings that are ACTIVE
//
// Each function below decides which cells belong to one shape. The board is
// always a square grid of size x size, and each shape is "cut out" of it by
// choosing which cells to keep. Each function returns three things:
//   cells = the Set of kept cells, rows = row count, cols = column count.
// "size" is the width and height of the full square grid (it comes from the
// difficulty: bigger for harder games).
//
// Most of them use a "for loop": code that repeats a set number of times.
//   for(let r=0; r<size; r++) means "start r at 0, keep going while r is
//   less than size, and add 1 to r each time" (r++ means "add 1").
// Two loops nested together visit every row r and column c, one cell at a
// time. "r" stands for row and "c" for column.

// A helper that turns a row and column into the text "row,col" (for example
// key(3,4) gives "3,4"). We use these text labels as names for cells.
function key(r,c){ return `${r},${c}`; }

// SQUARE: keep every cell. cells.add(...) puts an item into the Set.
function shapeSquare(size){
  const cells = new Set();
  for(let r=0;r<size;r++) for(let c=0;c<size;c++) cells.add(key(r,c));
  return { cells, rows: size, cols: size };
}

// DIAMOND: keep a cell only if it is close enough to the center.
// Math.floor rounds down to a whole number. Math.abs removes the minus sign
// (so it gives a distance rather than a direction). Adding the row distance
// and column distance from the center, and keeping small totals, produces a
// diamond.
// "if" runs the code after it only when the condition in parentheses is true.
function shapeDiamond(size){
  const cells = new Set();
  const half = Math.floor(size/2);
  for(let r=0;r<size;r++) for(let c=0;c<size;c++){
    if(Math.abs(r-half)+Math.abs(c-half) <= half) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

// CROSS (a plus sign): keep a cell if it's in the middle vertical band OR
// the middle horizontal band. "&&" means AND, "||" means OR.
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

// RING: a diamond with a hole cut out of the middle. We keep cells that are
// inside the big diamond (d<=half) but NOT inside the small center (d>inner).
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

// TRIANGLE: each row is a little wider than the one above it, and centered.
// Row 0 gets 1 cell, row 1 gets 2 cells, and so on. "start" is the column
// where that row's cells begin so the row ends up centered.
function shapeTriangle(size){
  const cells = new Set();
  for(let r=0;r<size;r++){
    const width = Math.round((r+1)*(size/(size)));
    const start = Math.floor((size-width)/2);
    for(let c=start;c<start+width;c++) cells.add(key(r,c));
  }
  return { cells, rows: size, cols: size };
}

// HEXAGON: rows near the middle are wide, and rows near the top and bottom
// get narrower, which gives a six-sided look.
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

// SPIRAL: uses a bit of trigonometry. For each cell we work out its distance
// from the center (Math.sqrt is square root, from the Pythagorean theorem)
// and its angle around the center (Math.atan2). Mixing those two numbers
// produces a swirling band. The "%" (remainder) operator makes the pattern
// repeat. Math.PI is the number pi (about 3.14159).
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

// STAR+ ("plus_ring"): a circle outline combined with a plus-shaped cross.
// A cell is kept if it is on the ring, OR in the vertical arm, OR in the
// horizontal arm. "**2" means "squared" (multiplied by itself).
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

// A lookup table that connects each shape's name (text) to the function that
// builds it. Later, SHAPES[selectedShape] finds the right function to run.
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

// How big the full square grid is for each difficulty (13 x 13, 17 x 17, or 21 x 21).
const SHAPE_SIZES = {
  easy: 13, medium: 17, hard: 21,
};


// ── UI Selection ───────────────────────────────────────────────────────────
// "UI" means "user interface": the parts of the page the player interacts
// with. These functions run when the player clicks a shape or difficulty
// button (see the onclick attributes in index.html).
// The "btn" in the parentheses is the specific button that was clicked.
function selectShape(btn){
  // Find every shape button and remove the "active" highlight from all of them...
  document.querySelectorAll('#shape-buttons .btn').forEach(b=>b.classList.remove('active'));
  // ...then add the highlight to just the clicked one.
  // (querySelectorAll finds ALL elements matching a CSS-style selector.
  //  forEach runs the code for each item. classList adds or removes classes.
  //  "b=>..." is an "arrow function": a short way to write a tiny function.)
  btn.classList.add('active');
  // Read the button's data-shape attribute (from the HTML) and remember it.
  selectedShape = btn.dataset.shape;
  updateBestDisplay(); // show the best time for this shape
}

// Same idea for the difficulty buttons.
function selectDiff(btn){
  document.querySelectorAll('#diff-buttons .btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  selectedDiff = btn.dataset.diff;
  updateBestDisplay(); // show the best time for this difficulty
}


// ── Game Init ──────────────────────────────────────────────────────────────
// "Init" is short for "initialize": setting everything up from scratch.
// startGame runs on page load and every time the player starts a new game.
function startGame(){
  // Stop any timer left over from the previous game, and reset every counter.
  clearInterval(timerInterval);
  seconds = 0;
  flagCount = 0;
  gameOver = false;
  firstClick = true;
  // Hide the win/lose pop-up, and reset the timer text to 00.
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('timer-val').textContent = '00';

  // Build the chosen shape at the chosen size. The line with { cells, rows,
  // cols } is "destructuring": it unpacks the three values the shape
  // function returned into three separate variables.
  const size = SHAPE_SIZES[selectedDiff];
  const { cells, rows, cols } = SHAPES[selectedShape](size);
  ROWS = rows; COLS = cols;
  activeCells = cells;

  // Build grid
  // Create one entry for every cell. Every cell starts with no mine, not
  // opened, not flagged, and a count of 0. "active" is true only if the cell
  // is part of the shape (cells.has checks whether the Set contains it).
  grid = [];
  for(let r=0;r<ROWS;r++){
    grid[r] = [];
    for(let c=0;c<COLS;c++){
      grid[r][c] = { mine:false, revealed:false, flagged:false, count:0,
                     active: cells.has(key(r,c)) };
    }
  }

  // Mines are NOT placed yet; that happens on the first click.
  mineCount = 0;
  updateHUD();
  updateBestDisplay();
  renderBoard();
}

// Places the mines randomly, then works out each cell's number.
// firstR and firstC are the row and column of the player's first click.
function placeMines(firstR, firstC){
  const rate = DIFF[selectedDiff].mineRate;
  const safe = new Set();
  // Safe zone: 1-cell radius around first click
  // We collect the clicked cell and its 8 neighbors into a "safe" list, and
  // skip them when placing mines, so your first click never loses and
  // usually opens up a good area.
  // (The "rr>=0&&rr<ROWS..." check makes sure we stay inside the board edges.)
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    const rr=firstR+dr, cc=firstC+dc;
    if(rr>=0&&rr<ROWS&&cc>=0&&cc<COLS) safe.add(key(rr,cc));
  }
  // Visit every active cell. Skip the safe ones. For the rest, Math.random()
  // gives a random number from 0 up to (but not including) 1; if it's less
  // than the mine rate, this cell gets a mine. For example, at a rate of 0.12 that happens
  // roughly 12 percent of the time.
  // k.split(',') cuts the text "3,4" into ["3","4"], and .map(Number) turns
  // those pieces into real numbers.
  activeCells.forEach(k=>{
    if(safe.has(k)) return;
    const [r,c] = k.split(',').map(Number);
    if(Math.random()<rate){ grid[r][c].mine=true; mineCount++; }
  });
  // Compute neighbor counts
  // For every cell that is not a mine, count how many of its neighbors are
  // mines and store that as its number.
  activeCells.forEach(k=>{
    const [r,c] = k.split(',').map(Number);
    if(grid[r][c].mine) return;
    let cnt=0;
    neighbors(r,c).forEach(([nr,nc])=>{ if(grid[nr][nc].mine) cnt++; });
    grid[r][c].count = cnt;
  });
  updateHUD();
}

// Returns a list of all cells touching the given cell (up to 8: up, down,
// left, right, and the four diagonals), skipping spots that are off the
// board or outside the shape.
function neighbors(r,c){
  const res=[];
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    if(dr===0&&dc===0) continue;   // "continue" skips this step: a cell isn't its own neighbor
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&grid[nr][nc].active) res.push([nr,nc]);
  }
  return res;
}


// ── Rendering ──────────────────────────────────────────────────────────────
// "Rendering" means drawing something on the screen. This function builds
// the whole board from scratch using HTML elements that JavaScript creates.
function renderBoard(){
  const board = document.getElementById('board');
  board.innerHTML = '';   // empty the board first (innerHTML is the HTML inside an element)
  // Tell the CSS grid how many columns and rows exist, each 32 pixels big.
  board.style.gridTemplateColumns = `repeat(${COLS}, 32px)`;
  board.style.gridTemplateRows    = `repeat(${ROWS}, 32px)`;

  // Go through every cell and create a <div> square for it.
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    const cellData = grid[r][c];

    // Pick the right look (a CSS class) based on the cell's state.
    if(!cellData.active){
      cell.classList.add('inactive');     // outside the shape: invisible
    } else if(cellData.revealed){
      cell.classList.add('revealed');     // opened
      if(cellData.mine){
        cell.classList.add('mine-revealed');
        cell.innerHTML = '<span class="mine-icon">💥</span>';
      } else if(cellData.count>0){
        cell.classList.add(`n${cellData.count}`);   // colored number class like "n3"
        cell.textContent = cellData.count;
      }
    } else if(cellData.flagged){
      cell.classList.add('flagged');
      cell.innerHTML = '<span class="flag-icon">⚑</span>';
    } else {
      cell.classList.add('hidden');       // not opened yet
    }

    // Make the cell respond to the player, but only while the game is still going.
    // An "event listener" waits for something to happen (an "event", such as
    // a click) and then runs a function.
    if(cellData.active && !gameOver){
      cell.addEventListener('click', ()=>handleClick(r,c));
      // "contextmenu" is the right-click event. e.preventDefault() cancels the
      // browser's normal right-click menu so we can use right-click for flags.
      cell.addEventListener('contextmenu', e=>{ e.preventDefault(); handleFlag(r,c); });
      // Long press for mobile
      // Phones have no right-click, so: when a finger touches (touchstart),
      // start a 450 millisecond timer (setTimeout runs code after a delay). If the
      // finger lifts (touchend) or moves (touchmove) before it finishes, cancel it.
      // Otherwise the flag is placed.
      cell.addEventListener('touchstart', e=>{ e.preventDefault(); longPressTimer=setTimeout(()=>handleFlag(r,c),450); }, {passive:false});
      cell.addEventListener('touchend',   ()=>clearTimeout(longPressTimer));
      cell.addEventListener('touchmove',  ()=>clearTimeout(longPressTimer));
    }

    // Put the finished cell onto the board.
    board.appendChild(cell);
  }
}

// Cells are added to the board row by row, so a cell's position in the list
// is row * (number of columns) + column.
function cellIndex(r,c){ return r*COLS+c; }

// Finds the on-screen element for a given row and column.
function getCellEl(r,c){
  return document.getElementById('board').children[cellIndex(r,c)];
}

// Refreshes the look of just ONE cell, instead of redrawing the whole board
// (which would be slower). It follows the same rules as renderBoard.
function updateCell(r,c){
  const cellData = grid[r][c];
  const el = getCellEl(r,c);
  if(!el||!cellData.active) return;   // "return" exits the function early
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
// Runs when the player left-clicks a cell to open it.
function handleClick(r,c){
  if(gameOver) return;   // ignore clicks once the game has ended
  const cell = grid[r][c];
  if(cell.revealed||cell.flagged) return;   // can't open a cell that is already open or flagged

  // On the very first click: place the mines (so the first click is safe)
  // and start the timer.
  if(firstClick){
    firstClick=false;
    placeMines(r,c);
    startTimer();
  }

  if(cell.mine){ revealMine(r,c); return; }   // clicked a mine: game over
  flood(r,c);       // otherwise open the cell (and maybe its neighbors)
  checkWin();       // see if that was the last safe cell
}

// Runs on a right-click (or long press): put a flag on a cell, or take it off.
function handleFlag(r,c){
  if(gameOver) return;
  const cell = grid[r][c];
  if(cell.revealed) return;
  cell.flagged = !cell.flagged;   // "!" means NOT: flips true to false and false to true
  flagCount += cell.flagged ? 1 : -1;   // "+=" adds to the variable: +1 for a new flag, -1 for a removed one
  cell.flagged ? sfxFlag() : sfxUnflag();   // play a different sound for each case
  updateCell(r,c);
  updateHUD();
}

// "Flood fill": opens a cell, and if that cell has zero neighboring mines,
// automatically opens all of its neighbors too, then THEIR neighbors, and so
// on, spreading outward like water until it reaches cells that have numbers.
// That is what makes a big empty area open all at once in Minesweeper.
function flood(r,c){
  // "stack" is a to-do list of cells still to open. Taking items from the
  // end of the list with pop() is how a stack works.
  const stack = [[r,c]];
  const visited = new Set();   // cells we've already handled, so we don't repeat work
  let emptyCells = 0;          // how many zero-neighbor cells were opened (used for sounds)
  let numberedCells = [];      // the numbers we opened (used for sounds)
  // "while" repeats the code inside it for as long as its condition is true.
  while(stack.length){
    const [cr,cc] = stack.pop();
    const k = key(cr,cc);
    if(visited.has(k)) continue;
    visited.add(k);
    const cell = grid[cr][cc];
    // Skip cells that are outside the shape, already open, flagged, or mines.
    if(!cell.active||cell.revealed||cell.flagged||cell.mine) continue;
    cell.revealed=true;
    updateCell(cr,cc);
    if(cell.count===0){
      // A zero cell: add all its neighbors to the to-do list so they open too.
      emptyCells++;
      neighbors(cr,cc).forEach(([nr,nc])=>stack.push([nr,nc]));
    } else {
      // A numbered cell: open it, but stop spreading here.
      numberedCells.push(cell.count);
    }
  }
  // Play sounds
  // A big opening plays a cascade of ticks, then the sound of the highest
  // number found. A single numbered cell plays its own tone. A single empty
  // cell plays a soft click.
  if(emptyCells > 1){
    sfxFlood(emptyCells + numberedCells.length);
    // Play the highest number tone after flood settles
    if(numberedCells.length){
      const maxN = Math.max(...numberedCells);   // the three dots "spread" the list into separate values
      setTimeout(()=> sfxNumber(maxN), Math.min(emptyCells,12)*28 + 60);
    }
  } else if(numberedCells.length){
    sfxNumber(numberedCells[0]);
  } else {
    sfxReveal();
  }
}

// Called when the player opens a mine: the game is lost.
function revealMine(r,c){
  gameOver=true;
  clearInterval(timerInterval);   // stop the timer
  sfxExplosion();
  grid[r][c].revealed=true;
  const el=getCellEl(r,c);
  el.className='cell mine-hit';
  el.innerHTML='<span class="mine-icon">💣</span>';
  // Reveal all mines with delay
  // Show every other mine one after another, 50 milliseconds apart, for a
  // dramatic chain-reaction effect. A millisecond is one thousandth of a second.
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
  // After all the mines have appeared, show the GAME OVER pop-up.
  setTimeout(()=>showOverlay(false), 50*i+400);
}

// Checks whether the player has won: the game is won when every cell that
// is NOT a mine has been opened.
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
    // It's a new record if there is no saved time yet, or this time is lower.
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
// Fills in and shows the win/lose pop-up. "win" is true or false.
// "isNewBest = false" gives the second input a default value: if nobody
// supplies it, it is treated as false.
function showOverlay(win, isNewBest = false){
  const box   = document.getElementById('overlay-box');
  const title = document.getElementById('overlay-title');
  const sub   = document.getElementById('overlay-sub');
  // Set the CSS classes so the box and title use the win colors (teal) or
  // the lose colors (pink-red).
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
  // Adding the "show" class makes the pop-up visible (see style.css).
  document.getElementById('overlay').classList.add('show');
}


// ── HUD ────────────────────────────────────────────────────────────────────
// HUD = "heads-up display", the numbers above the board.
// padStart(2,'0') makes sure a number has at least 2 characters by adding
// zeros in front, so 5 is shown as "05".
function updateHUD(){
  document.getElementById('mines-val').textContent = String(mineCount).padStart(2,'0');
  document.getElementById('flags-val').textContent = String(flagCount).padStart(2,'0');
}

// Starts the stopwatch. setInterval runs a function over and over, here once
// every 1000 milliseconds (1 second). Each time, it adds 1 to the seconds
// and updates the number on screen.
function startTimer(){
  timerInterval=setInterval(()=>{
    seconds++;   // "++" adds 1
    document.getElementById('timer-val').textContent=String(seconds).padStart(2,'0');
  },1000);
}


// ── Audio Engine ───────────────────────────────────────────────────────────
// All the game's sounds are created by code. There are no sound files!
// This uses the "Web Audio API", a set of tools built into the browser for
// generating and shaping sound. An "API" (Application Programming
// Interface) is a ready-made toolkit that a program can use.
//
// A few sound words used below:
//   - Oscillator: a generator that produces a steady wave of sound at a
//     chosen pitch.
//   - Frequency: how high or low a note sounds, measured in Hz (hertz). A
//     bigger number is a higher pitch.
//   - Wave type: sine is smooth, triangle is a bit brighter, and square is
//     buzzy and retro.
//   - Gain: volume.
//   - Noise: random static, like an "shhh", useful for explosions.
let audioCtx = null;   // the "audio context": the browser's sound system (created the first time it's needed)
let muted = false;     // true when the player has turned sound off

// Returns the audio system, creating it on first use. Browsers don't allow
// sound until the user has interacted with the page, and they may pause it
// ("suspended"), so resume() wakes it up.
function getCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Turns sound on or off when the player clicks the SFX button ("SFX" means
// "sound effects"), and updates the button's icon and look.
function toggleMute(){
  muted = !muted;
  const btn = document.getElementById('btn-mute');
  btn.textContent = muted ? '🔇 SFX' : '🔊 SFX';
  btn.classList.toggle('muted', muted);   // toggle adds the class when true, removes it when false
}

// Utility: create a gain node that auto-disconnects
// A "gain node" is a volume knob that sound passes through on the way to the
// speakers. (This helper is not used by the sounds below; it is a leftover tool.)
function makeGain(ctx, val){
  const g = ctx.createGain();
  g.gain.setValueAtTime(val, ctx.currentTime);
  g.connect(ctx.destination);
  return g;
}

// Short sine/square blip
// Plays one short note. The inputs say what it should sound like:
//   freq = pitch, type = wave type, duration = length in seconds,
//   volume = loudness. The "= 0.005" parts are default values.
// The volume rises quickly (the "attack") and then fades out smoothly, which
// stops the note from making an ugly clicking sound.
function playTone(freq, type, duration, volume, attack=0.005, decay=0.05){
  if(muted) return;   // do nothing when muted
  const ctx = getCtx();
  const osc = ctx.createOscillator();   // the sound generator
  const gain = ctx.createGain();        // the volume knob
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  // Connect the pieces like a chain: generator -> volume knob -> speakers.
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration + 0.01);
}

// White-noise burst
// Plays a burst of random static. "highpass" is a filter that removes the
// low rumbly sounds and lets only sounds above a certain pitch through.
// How it works: fill a "buffer" (a short stretch of sound data) with random
// numbers between -1 and 1, then play it back through the filter and a
// volume fade.
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
// Each function below is one specific game sound, built from playTone and
// playNoise.

// Soft click when revealing an empty cell
function sfxReveal(){
  playTone(420, 'sine', 0.08, 0.18, 0.003, 0.07);
}

// Slightly pitched tone per number (1=low, 8=high)
// The list's first spot (position 0) is a placeholder so that freqs[1] is
// the pitch for the number 1, freqs[2] for 2, and so on. "|| 300" means
// "or use 300 if there is no match".
function sfxNumber(n){
  const freqs = [0, 280, 320, 380, 440, 520, 620, 740, 880];
  playTone(freqs[n] || 300, 'triangle', 0.12, 0.22, 0.004, 0.10);
}

// Flood reveal: cascading soft ticks
// Plays up to 12 quick ticks, each a little higher and 28 milliseconds
// after the last, like a rising ripple.
function sfxFlood(cellCount){
  if(muted) return;
  const ticks = Math.min(cellCount, 12);
  for(let i=0;i<ticks;i++){
    setTimeout(()=> playTone(380 + i*18, 'sine', 0.06, 0.12, 0.002, 0.05), i * 28);
  }
}

// Flag planted
// Two quick blips, going UP in pitch.
function sfxFlag(){
  playTone(600, 'square', 0.05, 0.15, 0.003, 0.04);
  setTimeout(()=> playTone(900, 'square', 0.05, 0.10, 0.003, 0.04), 55);
}

// Flag removed
// The same two blips in reverse: going DOWN in pitch.
function sfxUnflag(){
  playTone(900, 'square', 0.05, 0.12, 0.003, 0.04);
  setTimeout(()=> playTone(600, 'square', 0.05, 0.08, 0.003, 0.04), 55);
}

// Explosion
// Three layers stacked together: a long low rumble of noise, a deep "thud"
// whose pitch drops fast, and a short high "crack" at the start.
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
// An "arpeggio" is a chord played one note at a time instead of all at once.
// This plays six climbing notes 90 milliseconds apart, then adds two final
// notes together on top of the last one. forEach gives each note's pitch
// (freq) and its position in the list (i), which sets its delay.
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
// "Boot" means "start up". This is the one line that runs on its own as soon
// as the page loads. Everything above only DEFINES functions and variables;
// nothing happens until something calls them. This line calls startGame() so
// that a fresh board is ready the moment the page opens.
startGame();
