const { Chess } = require("chess.js");

const games = {}; // chatId -> Chess instance

function renderBoard(chess) {
  const board = chess.board();
  let str = "";
  for (let row of board) {
    str += row
      .map(square => {
        if (square === null) return "·";
        const piece = square.type;
        return square.color === "w" ? piece.toUpperCase() : piece;
      })
      .join(" ") + "\n";
  }
  return "```\n" + str + "```";
}

// Simple evaluation: material count
function evaluateBoard(chess) {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let score = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (square) {
        const val = pieceValues[square.type];
        score += square.color === "w" ? val : -val;
      }
    }
  }
  return score;
}

// Pick best move by shallow evaluation
function getBestMove(chess) {
  const moves = chess.moves();
  let bestMove = null;
  let bestEval = -Infinity;

  for (let move of moves) {
    chess.move(move);
    let evalScore = -evaluateBoard(chess);
    chess.undo();
    if (evalScore > bestEval) {
      bestEval = evalScore;
      bestMove = move;
    }
  }
  return bestMove || moves[Math.floor(Math.random() * moves.length)];
}

module.exports = {
  name: "chess",
  author: "THOMAS SHELBY",
  description: "Play chess with the bot",
  async execute(msg, args) {
    const chatId = msg.threadID;

    // Start new game
    if (args.length === 0) {
      games[chatId] = new Chess();
      return msg.reply(
        "♟️ New chess game started!\nYou are White. Send your move like `e2e4`.\n" +
        renderBoard(games[chatId])
      );
    }

    if (!games[chatId]) {
      return msg.reply("No game in progress. Type `!chess` to start a new game.");
    }

    const move = args[0];
    const game = games[chatId];

    // Player move
    const playerMove = game.move(move, { sloppy: true });
    if (!playerMove) {
      return msg.reply("❌ Invalid move. Use format like `e2e4`.");
    }

    if (game.game_over()) {
      const result = game.in_checkmate() ? "✅ You win!" : "Draw!";
      delete games[chatId];
      return msg.reply(renderBoard(game) + "\n" + result);
    }

    // Bot move
    const botMove = getBestMove(game);
    game.move(botMove);

    if (game.game_over()) {
      const result = game.in_checkmate() ? "💀 Bot wins!" : "Draw!";
      delete games[chatId];
      return msg.reply(renderBoard(game) + `\nBot plays ${botMove}\n` + result);
    }

    return msg.reply(
      renderBoard(game) + `\nBot plays ${botMove}`
    );
  }
};
