// Puppeteer + Smarter Chess Bot (Unofficial, cookies-based)
const puppeteer = require("puppeteer");
const fs = require("fs");
const { Chess } = require("chess.js");

const COOKIES_PATH = "./cookies.json"; // GitHub-এ আপলোড করা cookies.json

// Conversation-wise games
const games = new Map(); // key: conversationId, value: Chess instance

// Basic piece values for evaluation
const pieceValue = { p:1, n:3, b:3, r:5, q:9, k:0 };

// Simple evaluation: material balance
function evaluateBoard(chess) {
    let board = chess.board();
    let score = 0;
    for (let r=0; r<8; r++) {
        for (let f=0; f<8; f++) {
            const sq = board[r][f];
            if (sq) {
                let val = pieceValue[sq.type.toLowerCase()] || 0;
                score += sq.color === 'w' ? val : -val;
            }
        }
    }
    return score;
}

// Choose best move (1-ply lookahead)
function chooseBestMove(chess) {
    const moves = chess.moves({ verbose:true });
    let bestScore = -Infinity;
    let bestMove = null;
    for (const move of moves) {
        chess.move(move);
        const score = -evaluateBoard(chess); // Negamax style
        chess.undo();
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true, // Render এ true
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    // Load cookies
    const cookiesString = fs.readFileSync(COOKIES_PATH, "utf-8");
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    await page.goto("https://www.messenger.com/");
    console.log("✅ Logged in using cookies");

    // Polling messages every 5 sec
    while (true) {
        try {
            // Get all messages in view
            const messages = await page.$$eval(
                "div[aria-label='Messages'] div[role='row'] span",
                els => els.map(e => ({text:e.innerText, id:e.parentElement.parentElement.dataset.threadid || 'unknown'}))
            );

            for (const msg of messages) {
                const lower = msg.text.toLowerCase();
                const convoId = msg.id; // use thread id as convo key

                // Start new game
                if (lower.startsWith("!chess")) {
                    if (!games.has(convoId)) games.set(convoId, new Chess());
                    await sendMessage(page, convoId, "♟ নতুন গেম শুরু!\n" + displayBoard(games.get(convoId)));
                }

                // Move: e2e4
                if (/^[a-h][1-8][a-h][1-8]$/.test(lower)) {
                    if (!games.has(convoId)) games.set(convoId, new Chess());
                    const chess = games.get(convoId);
                    const move = chess.move({ from: lower.slice(0,2), to: lower.slice(2,4) });
                    if (!move) {
                        await sendMessage(page, convoId, "অবৈধ চাল!");
                        continue;
                    }

                    // Smarter bot move
                    const botMove = chooseBestMove(chess);
                    if (botMove) chess.move(botMove);

                    await sendMessage(page, convoId,
                        `আপনার চাল: ${move.from}${move.to}\n` +
                        (botMove ? `আমার চাল: ${botMove.from}${botMove.to}\n` : "আমি আর move করতে পারি না!\n") +
                        displayBoard(chess)
                    );

                    if (chess.game_over()) games.delete(convoId);
                }
            }

            await new Promise(r => setTimeout(r, 5000));
        } catch (err) {
            console.error(err);
        }
    }
})();

// Display chess board in Unicode
function displayBoard(chess) {
    const map = { 'p':'♟','r':'♜','n':'♞','b':'♝','q':'♛','k':'♚','P':'♙','R':'♖','N':'♘','B':'♗','Q':'♕','K':'♔' };
    let rows = chess.board();
    let lines = [];
    for (let r=7; r>=0; r--) {
        let line = `${r+1} `;
        for (let f=0; f<8; f++) {
            const sq = rows[r][f];
            if (!sq) line += '· ';
            else line += map[sq.type === sq.type.toLowerCase() ? sq.type : sq.type.toUpperCase()] + ' ';
        }
        lines.push(line.trim());
    }
    lines.push('  a b c d e f g h');
    return lines.join('\n');
}

// Send message (simplified)
async function sendMessage(page, convoId, text) {
    const textarea = await page.$("div[aria-label='Type a message...']");
    if (textarea) {
        await textarea.focus();
        await page.keyboard.type(text);
        await page.keyboard.press("Enter");
    }
}
