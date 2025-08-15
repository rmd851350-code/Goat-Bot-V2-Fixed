/*
  Author: THOMAS SHELBY
  File: scripts/cmds/chess.js
  Description: Dependency-free, legal-move chess command with a simple minimax AI.
  Usage (bot framework must call execute(msg, args)):
    - !chess              => start new game
    - !chess board        => show board
    - !chess resign       => resign
    - !chess e2e4         => move from e2 to e4
*/

const files = ["a","b","c","d","e","f","g","h"];

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

// Board representation: 8x8 array, row 0 = rank 8, row7 = rank1
function initialBoard() {
  return [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    [" "," "," "," "," "," "," "," "],
    [" "," "," "," "," "," "," "," "],
    [" "," "," "," "," "," "," "," "],
    [" "," "," "," "," "," "," "," "],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
  ];
}

function coordToIdx(s) {
  // s like "e2" -> [row, col]
  if (!s || s.length < 2) return null;
  const file = s[0].toLowerCase();
  const rank = parseInt(s[1],10);
  const col = files.indexOf(file);
  const row = 8 - rank;
  if (col < 0 || row < 0 || row > 7) return null;
  return [row, col];
}
function idxToCoord(r,c) {
  return `${files[c]}${8-r}`;
}

function cloneState(state){
  return {
    board: clone(state.board),
    turn: state.turn,
    castling: clone(state.castling),
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    history: clone(state.history)
  };
}

// utilities
function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
function isUpper(p){ return p && p !== " " && p === p.toUpperCase(); }
function isLower(p){ return p && p !== " " && p === p.toLowerCase(); }
function pieceColor(p){ if(p===" "||!p) return null; return isUpper(p) ? "w":"b"; }

function renderBoardText(board){
  // nice textual board
  const map = { p:'p', r:'r', n:'n', b:'b', q:'q', k:'k' };
  let out = '';
  for(let r=0;r<8;r++){
    out += (8-r) + " ";
    for(let c=0;c<8;c++){
      const p = board[r][c];
      out += (p === " " ? "·" : p) + " ";
    }
    out += "\n";
  }
  out += "  a b c d e f g h";
  return out;
}

// generate pseudo-legal moves (not yet considering checks)
function generateMovesForSquare(board, r, c, state){
  const p = board[r][c];
  if(!p || p===" ") return [];
  const color = pieceColor(p);
  const moves = [];
  const forward = color === "w" ? -1 : 1;
  const enemy = color === "w" ? isLower : isUpper;
  const ally = color === "w" ? isUpper : isLower;

  const lowerP = p.toLowerCase();

  if (lowerP === 'p') {
    // pawn moves
    const oneR = r + forward;
    if(inBounds(oneR,c) && board[oneR][c] === " ") {
      moves.push([r,c,oneR,c]);
      // two squares from starting rank
      const startRank = (color==="w"?6:1);
      const twoR = r + forward*2;
      if(r === startRank && board[twoR][c] === " ") moves.push([r,c,twoR,c]);
    }
    // captures
    for(const dc of [-1,1]) {
      const cr = r + forward, cc = c + dc;
      if(inBounds(cr,cc) && board[cr][cc] !== " " && enemy(board[cr][cc])) {
        moves.push([r,c,cr,cc]);
      }
    }
    // (Note: en-passant not implemented)
  } else if (lowerP === 'n') {
    const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for(const d of deltas){
      const nr=r+d[0], nc=c+d[1];
      if(inBounds(nr,nc) && (board[nr][nc]===" " || enemy(board[nr][nc]))) moves.push([r,c,nr,nc]);
    }
  } else if (lowerP === 'b' || lowerP === 'r' || lowerP === 'q') {
    const dirs = [];
    if(lowerP === 'b' || lowerP === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
    if(lowerP === 'r' || lowerP === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for(const d of dirs){
      let nr=r+d[0], nc=c+d[1];
      while(inBounds(nr,nc)){
        if(board[nr][nc]===" ") { moves.push([r,c,nr,nc]); }
        else {
          if(enemy(board[nr][nc])) moves.push([r,c,nr,nc]);
          break;
        }
        nr += d[0]; nc += d[1];
      }
    }
  } else if (lowerP === 'k') {
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
      if(dr===0 && dc===0) continue;
      const nr=r+dr, nc=c+dc;
      if(inBounds(nr,nc) && (board[nr][nc]===" " || enemy(board[nr][nc]))) moves.push([r,c,nr,nc]);
    }
    // castling (simple rules: squares empty and not in check and rook still there and castling rights)
    if(color === "w") {
      if(state.castling.wk && board[7][5] === " " && board[7][6] === " "){
        // not checking if passing through check here — will filter later
        moves.push([r,c,7,6,'castle']);
      }
      if(state.castling.wq && board[7][1] === " " && board[7][2] === " " && board[7][3] === " "){
        moves.push([r,c,7,2,'castle']);
      }
    } else {
      if(state.castling.bk && board[0][5] === " " && board[0][6] === " "){
        moves.push([r,c,0,6,'castle']);
      }
      if(state.castling.bq && board[0][1] === " " && board[0][2] === " " && board[0][3] === " "){
        moves.push([r,c,0,2,'castle']);
      }
    }
  }
  return moves;
}

// generate all legal moves considering checks
function generateLegalMoves(state){
  const board = state.board;
  const color = state.turn; // 'w' or 'b'
  const moves = [];
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = board[r][c];
      if(p===" " || !p) continue;
      if(pieceColor(p) !== (color==="w")) {
        if(color==="w" && !isUpper(p)) continue;
        if(color==="b" && !isLower(p)) continue;
      }
      // generate pseudo moves
      const pseudo = generateMovesForSquare(board,r,c,state);
      for(const mv of pseudo){
        const [fr,fc,tr,tc,meta] = mv;
        const newState = makeMoveOnState(state, fr,fc,tr,tc, meta, true);
        // after move, check king safety
        const kingPos = findKing(newState.board, color);
        if(!kingPos) continue; // should not happen
        if(!isSquareAttacked(newState.board, kingPos[0], kingPos[1], oppositeColor(color))) {
          moves.push({ from:[fr,fc], to:[tr,tc], meta });
        }
      }
    }
  }
  return moves;
}

function oppositeColor(c){ return c==="w" ? "b":"w"; }

function findKing(board, color){
  const target = color==="w" ? "K":"k";
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]===target) return [r,c];
  return null;
}

// check if square (r,c) is attacked by color attackerColor
function isSquareAttacked(board, r, c, attackerColor){
  // iterate all attacker pieces and see if any pseudo move hits r,c
  for(let rr=0;rr<8;rr++){
    for(let cc=0;cc<8;cc++){
      const p = board[rr][cc];
      if(p===" "||!p) continue;
      if(pieceColor(p) !== attackerColor) continue;
      const pseudo = generateMovesForSquare(board, rr, cc, {
        board, turn: attackerColor, castling: {wk:false,wq:false,bk:false,bq:false}
      });
      for(const mv of pseudo){
        const [fr,fc,tr,tc] = mv;
        if(tr===r && tc===c) return true;
      }
    }
  }
  return false;
}

// Apply move on a STATE (returns newState). If makeCopy true, returns cloned new state; else modifies copy.
function makeMoveOnState(state, fr,fc,tr,tc, meta, makeCopy=false){
  const s = makeCopy ? cloneState(state) : state;
  if(makeCopy) s.board = clone(state.board);
  const piece = s.board[fr][fc];
  // push history for undo
  const hist = { fr,fc,tr,tc, piece, captured: s.board[tr][tc], meta, castling: clone(s.castling), halfmove: s.halfmoveClock, fullmove: s.fullmoveNumber };
  s.history = s.history || [];
  s.history.push(hist);

  // move
  s.board[tr][tc] = piece;
  s.board[fr][fc] = " ";

  // handle promotion (auto to queen) - if pawn reaches last rank
  if(piece.toLowerCase() === 'p'){
    if((piece === 'P' && tr === 0) || (piece === 'p' && tr === 7)){
      s.board[tr][tc] = piece === 'P' ? 'Q' : 'q';
    }
  }

  // castling: if meta === 'castle' handle rook move
  if(meta === 'castle'){
    // white king moving to 7,6 or 7,2 etc handled by from->to; move rook accordingly
    if(fr===7 && fc===4 && tr===7 && tc===6){ // white kingside
      s.board[7][5] = s.board[7][7]; s.board[7][7] = " ";
    } else if(fr===7 && fc===4 && tr===7 && tc===2){ // white queenside
      s.board[7][3] = s.board[7][0]; s.board[7][0] = " ";
    } else if(fr===0 && fc===4 && tr===0 && tc===6){ // black kingside
      s.board[0][5] = s.board[0][7]; s.board[0][7] = " ";
    } else if(fr===0 && fc===4 && tr===0 && tc===2){ // black queenside
      s.board[0][3] = s.board[0][0]; s.board[0][0] = " ";
    }
  }

  // update castling rights: if king or rook moved
  if(piece === 'K'){ s.castling.wk = false; s.castling.wq = false; }
  if(piece === 'k'){ s.castling.bk = false; s.castling.bq = false; }
  // rook moves affecting rights
  if(fr===7 && fc===0) s.castling.wq = false;
  if(fr===7 && fc===7) s.castling.wk = false;
  if(fr===0 && fc===0) s.castling.bq = false;
  if(fr===0 && fc===7) s.castling.bk = false;

  // increase move counters
  if(piece.toLowerCase() === 'p' || hist.captured !== " ") s.halfmoveClock = 0;
  else s.halfmoveClock = (s.halfmoveClock||0) + 1;
  if(s.turn === 'b') s.fullmoveNumber = (s.fullmoveNumber||1) + 1;

  // switch turn
  s.turn = oppositeColor(s.turn);

  return s;
}

function undoMove(state){
  if(!state.history || state.history.length===0) return state;
  const last = state.history.pop();
  state.board[last.fr][last.fc] = last.piece;
  state.board[last.tr][last.tc] = last.captured;
  state.castling = last.castling;
  state.halfmoveClock = last.halfmove;
  state.fullmoveNumber = last.fullmove;
  state.turn = oppositeColor(state.turn);
  return state;
}

// simple game over checks
function isCheck(state, color){
  const king = findKing(state.board, color);
  if(!king) return false;
  return isSquareAttacked(state.board, king[0], king[1], oppositeColor(color));
}
function hasAnyLegalMove(state){
  const moves = generateLegalMoves(state);
  return moves.length > 0;
}
function isCheckmate(state){
  const c = state.turn;
  if(!isCheck(state,c)) return false;
  if(hasAnyLegalMove(state)) return false;
  return true;
}
function isStalemate(state){
  const c = state.turn;
  if(isCheck(state,c)) return false;
  if(hasAnyLegalMove(state)) return false;
  return true;
}

// evaluation (material only)
const pieceValue = { 'p':1,'n':3,'b':3,'r':5,'q':9,'k':0 };
function evaluateState(state){
  let s = 0;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = state.board[r][c];
    if(p && p !== " "){
      const v = pieceValue[p.toLowerCase()]||0;
      s += isUpper(p) ? v : -v;
    }
  }
  return (state.turn === 'w') ? s : -s; // from side to move perspective
}

// minimax negamax with depth
function negamax(state, depth, alpha, beta){
  if(depth === 0) return evaluateState(state);
  if(isCheckmate(state)) return -9999;
  if(isStalemate(state)) return 0;

  let max = -Infinity;
  const moves = generateLegalMoves(state);
  if(moves.length === 0) return isCheck(state, state.turn) ? -9999 : 0;

  for(const m of moves){
    const newState = makeMoveOnState(cloneStateForEngine(state), m.from[0], m.from[1], m.to[0], m.to[1], m.meta, true);
    const val = -negamax(newState, depth-1, -beta, -alpha);
    if(val > max) max = val;
    if(val > alpha) alpha = val;
    if(alpha >= beta) break;
  }
  return max;
}

function cloneStateForEngine(s){
  return {
    board: clone(s.board),
    turn: s.turn,
    castling: { wk: s.castling.wk, wq: s.castling.wq, bk: s.castling.bk, bq: s.castling.bq },
    halfmoveClock: s.halfmoveClock,
    fullmoveNumber: s.fullmoveNumber,
    history: clone(s.history||[])
  };
}

function chooseBestMoveEngine(state, depth=2){
  const moves = generateLegalMoves(state);
  let best = null, bestScore = -Infinity;
  for(const m of moves){
    const newState = makeMoveOnState(cloneStateForEngine(state), m.from[0], m.from[1], m.to[0], m.to[1], m.meta, true);
    const val = -negamax(newState, depth-1, -Infinity, Infinity);
    if(val > bestScore){ bestScore = val; best = m; }
  }
  return best;
}

// Initialize game state object
function newGameState(){
  return {
    board: initialBoard(),
    turn: 'w',
    castling: { wk: true, wq: true, bk: true, bq: true },
    halfmoveClock: 0,
    fullmoveNumber: 1,
    history: []
  };
}

/* --------------- Command module export --------------- */

const gamesMap = {}; // threadId -> state

module.exports = {
  name: "chess",
  author: "THOMAS SHELBY",
  description: "Full-rule-ish chess (no en-passant/threefold/50-move). Usage: !chess, !chess e2e4, !chess board, !chess resign",
  async execute(msg, args) {
    // msg expected to provide: threadID, reply(text) or msg.reply(text)
    const thread = msg.threadID || (msg.thread && msg.thread.id) || "default";
    const send = async (txt) => {
      if(typeof msg.reply === "function") return msg.reply(txt);
      if(typeof msg.send === "function") return msg.send(txt);
      if(typeof msg.channel === "function") return msg.channel(txt);
      // fallback: try console.log
      console.log("BOT MSG:", txt);
    };

    if(!gamesMap[thread]) gamesMap[thread] = newGameState();
    const state = gamesMap[thread];

    // No args -> start new game
    if(!args || args.length === 0){
      gamesMap[thread] = newGameState();
      return send("♟️ New game started!\nYou are White. Move like: `!chess e2e4`\n\n" + renderBoardText(gamesMap[thread].board));
    }

    const cmd = args[0].toLowerCase();

    if(cmd === "board"){
      return send(renderBoardText(state.board));
    }
    if(cmd === "resign"){
      delete gamesMap[thread];
      return send("You resigned. To play again: `!chess`");
    }

    // move like e2e4 or e2 e4
    let mv = null;
    if(args.length === 1){
      const m = args[0].replace(/[^a-h1-8]/g,"");
      if(m.length === 4) mv = [m.slice(0,2), m.slice(2,4)];
    } else if(args.length >= 2){
      mv = [args[0], args[1]];
    }

    if(!mv){
      return send("Invalid move format. Use `!chess e2e4` or `!chess e2 e4`.");
    }

    const f = coordToIdx(mv[0]);
    const t = coordToIdx(mv[1]);
    if(!f || !t) return send("Invalid coordinates. Use a-h and 1-8.");

    // check piece presence and color
    const piece = state.board[f[0]][f[1]];
    if(piece === " "){
      return send("No piece at " + mv[0]);
    }
    const color = pieceColor(piece) === "w" ? "w":"b";
    if(color !== state.turn) return send("It's not your turn.");

    // find if the move is legal among generated legal moves
    const legalMoves = generateLegalMoves(state);
    let found = null;
    for(const m of legalMoves){
      if(m.from[0]===f[0] && m.from[1]===f[1] && m.to[0]===t[0] && m.to[1]===t[1]) { found = m; break; }
    }
    if(!found) return send("Move not legal (or would leave/put your king in check).");

    // apply player move
    makeMoveOnState(state, f[0], f[1], t[0], t[1], found.meta, false);

    // check game over after player's move
    if(isCheckmate(state)){
      const boardText = renderBoardText(state.board);
      delete gamesMap[thread];
      return send(boardText + "\nCheckmate! You win.");
    }
    if(isStalemate(state)){
      const boardText = renderBoardText(state.board);
      delete gamesMap[thread];
      return send(boardText + "\nStalemate! Draw.");
    }

    // bot move (smarter)
    const botMove = chooseBestMoveEngine(state, 2); // depth 2
    if(botMove){
      makeMoveOnState(state, botMove.from[0], botMove.from[1], botMove.to[0], botMove.to[1], botMove.meta, false);
    }

    // responses
    const boardText = renderBoardText(state.board);
    if(isCheckmate(state)){
      delete gamesMap[thread];
      return send(boardText + `\nBot plays ${idxToCoord(botMove.from[0],botMove.from[1])}${idxToCoord(botMove.to[0],botMove.to[1])}\nCheckmate! Bot wins.`);
    }
    if(isStalemate(state)){
      delete gamesMap[thread];
      return send(boardText + `\nBot plays ${idxToCoord(botMove.from[0],botMove.from[1])}${idxToCoord(botMove.to[0],botMove.to[1])}\nStalemate! Draw.`);
    }

    const botMoveText = botMove ? `${idxToCoord(botMove.from[0],botMove.from[1])}${idxToCoord(botMove.to[0],botMove.to[1])}` : "—";
    return send(boardText + `\nBot plays ${botMoveText}\nIt's your move.`);
  }
};
