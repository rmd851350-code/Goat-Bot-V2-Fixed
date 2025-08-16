const files = ["a","b","c","d","e","f","g","h"];
const gamesMap = {}; // threadID -> game state

function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

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

function coordToIdx(s){
  if(!s || s.length<2) return null;
  const file = s[0].toLowerCase();
  const rank = parseInt(s[1],10);
  const col = files.indexOf(file);
  const row = 8 - rank;
  if(col<0||row<0||row>7) return null;
  return [row,col];
}

function idxToCoord(r,c){ return `${files[c]}${8-r}`; }

function renderBoardText(board){
  let out = '';
  for(let r=0;r<8;r++){
    out += (8-r) + " ";
    for(let c=0;c<8;c++){
      out += (board[r][c]===" "?"·":board[r][c])+" ";
    }
    out += "\n";
  }
  out += "  a b c d e f g h";
  return out;
}

function newGameState(){
  return { board: initialBoard(), turn: 'w', history: [] };
}

function oppositeColor(c){ return c==="w"?"b":"w"; }

function makeMove(state, fr,fc,tr,tc){
  const piece = state.board[fr][fc];
  state.history.push({ fr,fc,tr,tc,piece,captured: state.board[tr][tc] });
  state.board[tr][tc] = piece;
  state.board[fr][fc] = " ";
  state.turn = oppositeColor(state.turn);
}

// simple AI: pick first movable pawn or piece
function aiMove(state){
  const b = state.board;
  for(let r=0;r<8;r++){
    for(let c=0;c<8;c++){
      const p = b[r][c];
      if(p===" " || p.toLowerCase()===p) continue; // AI plays black
      const moves = [[1,0],[1,1],[1,-1]]; // simplistic pawn moves
      for(const m of moves){
        const nr=r+m[0], nc=c+m[1];
        if(nr>=0&&nr<8&&nc>=0&&nc<8 && b[nr][nc] === " "){
          makeMove(state,r,c,nr,nc);
          return idxToCoord(r,c)+idxToCoord(nr,nc);
        }
      }
    }
  }
  return "pass";
}

module.exports = {
  config: {
    name: "chess",
    version: "1.1",
    author: "THOMAS SHELBY",
    description: "Messenger chess game with AI move",
    role: 0,
    usePrefix: true,
    category: "Games",
    cooldowns: 3
  },

  run: async function({ api, event, args }) {
    const thread = event.threadID;
    const send = (text)=> api.sendMessage(text, thread);

    if(!gamesMap[thread]) gamesMap[thread] = newGameState();
    const state = gamesMap[thread];

    if(!args || args.length===0){
      gamesMap[thread] = newGameState();
      return send("♟️ New chess game started!\nYou are White.\nMove like: `.chess e2e4`\n\n" + renderBoardText(gamesMap[thread].board));
    }

    const cmd = args[0].toLowerCase();

    if(cmd === "board") return send(renderBoardText(state.board));
    if(cmd === "resign"){ delete gamesMap[thread]; return send("You resigned. To play again: `.chess`"); }

    // move like e2e4
    const moveStr = args.join("").replace(/[^a-h1-8]/g,"");
    if(moveStr.length!==4) return send("Invalid move format. Use `.chess e2e4`.");

    const from = coordToIdx(moveStr.slice(0,2));
    const to = coordToIdx(moveStr.slice(2,4));
    if(!from || !to) return send("Invalid coordinates.");

    const piece = state.board[from[0]][from[1]];
    if(piece===" ") return send("No piece at "+moveStr.slice(0,2));
    if((state.turn==="w" && piece!==piece.toUpperCase()) || (state.turn==="b" && piece!==piece.toLowerCase())){
      return send("It's not your turn.");
    }

    makeMove(state, from[0],from[1],to[0],to[1]);

    // AI move
    if(state.turn==="b"){
      const aiM = aiMove(state);
      return send(renderBoardText(state.board) + `\nYou played: ${moveStr}\nAI played: ${aiM}`);
    }

    return send(renderBoardText(state.board) + `\nYou played: ${moveStr}`);
  }
};
