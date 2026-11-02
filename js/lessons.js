/* The course. Every lesson runs on the real board and waits for the learner: nothing advances on a timer.

   Step types:
     find    Find the square `target`.
     move    (default) Play exactly `from` to `to`.
     mate    Play any move that gives checkmate. `from`/`to` is the move the hint suggests.
     check   Play any move that gives check. `from`/`to` is the move the hint suggests.
     choice  Answer a question. Each choice has text `t`, `ok` for the right answer, and `why`.
             The board stays explorable while the question is open.
   `goal` is the instruction and `why` is what the learner is told after getting it right.
   tests/test_app.py replays every step, so a position or answer that does not work fails the tests. */
const TPC_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const TPC_LESSONS = [
  {
    id: 'map', title: 'The board map', tag: 'Start here',
    intro: 'The board has 64 squares. Each one has a name: a letter, then a number. The letter is the file, a to h from left to right. The number is the rank, 1 to 8 from White\'s side to Black\'s side.',
    steps: [
      { type: 'find', fen: TPC_START, target: 'e4', goal: 'Find e4. Go to file e, then rank 4. It is near the middle of the board.', why: 'File e, rank 4. Every square name works this way.' },
      { type: 'find', fen: TPC_START, target: 'a8', goal: 'Find a8, the far left corner. A black rook stands there.', why: 'a is the left file and 8 is the far rank.' },
      { type: 'find', fen: TPC_START, target: 'h1', goal: 'Find h1, the near right corner. A white rook stands there.', why: 'h is the right file and 1 is the near rank.' },
      { type: 'find', fen: TPC_START, target: 'd5', goal: 'Find d5. It is one of the four centre squares.', why: 'The centre squares are d4, e4, d5 and e5. They matter later.' }
    ]
  },
  {
    id: 'rook', title: 'The rook', tag: 'Piece', piece: 'r',
    intro: 'The rook moves in straight lines along files and ranks, as far as it likes. It cannot jump over other pieces.',
    steps: [
      { fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', from: 'a1', to: 'a7', goal: 'Move the rook from a1 straight up the a-file to a7.', why: 'Rooks can travel any distance along a file.' },
      { fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', from: 'a1', to: 'd1', goal: 'Move the rook from a1 sideways along rank 1 to d1.', why: 'Rooks can travel along a rank too. It stopped before your king on e1.' },
      { fen: '7k/8/8/3p4/8/8/8/3RK3 w - - 0 1', from: 'd1', to: 'd5', goal: 'A black pawn stands on d5, straight ahead of your rook on d1. Move the rook to d5 to capture it.', why: 'You capture by moving onto an enemy piece. It leaves the board and you take its square.' }
    ]
  },
  {
    id: 'bishop', title: 'The bishop', tag: 'Piece', piece: 'b',
    intro: 'The bishop moves diagonally, as far as it likes. A bishop that starts on a light square stays on light squares forever. The same goes for dark squares.',
    steps: [
      { fen: '7k/8/8/8/8/8/8/2B1K3 w - - 0 1', from: 'c1', to: 'g5', goal: 'Move the bishop from c1 up and to the right, to g5.', why: 'Each diagonal step changes the file and the rank by one.' },
      { fen: '7k/8/8/8/8/8/8/2B1K3 w - - 0 1', from: 'c1', to: 'a3', goal: 'Move the bishop from c1 up and to the left, to a3.', why: 'Bishops can go along either diagonal.' }
    ]
  },
  {
    id: 'queen', title: 'The queen', tag: 'Piece', piece: 'q',
    intro: 'The queen combines the rook and the bishop. She moves in any straight line or diagonal, as far as she likes. She is your strongest piece.',
    steps: [
      { fen: '8/7k/8/8/3Q4/8/8/4K3 w - - 0 1', from: 'd4', to: 'd8', goal: 'Move the queen from d4 straight up the d-file to d8, like a rook.', why: 'That was the rook half of the queen.' },
      { fen: '8/7k/8/8/3Q4/8/8/4K3 w - - 0 1', from: 'd4', to: 'a7', goal: 'Move the queen from d4 diagonally up and to the left, to a7, like a bishop.', why: 'That was the bishop half of the queen.' }
    ]
  },
  {
    id: 'knight', title: 'The knight', tag: 'Piece', piece: 'n',
    intro: 'The knight moves in an L shape: two squares one way, then one square to the side. It is the only piece that can jump over others.',
    steps: [
      { fen: '7k/8/8/8/8/8/PPP5/1N2K3 w - - 0 1', from: 'b1', to: 'a3', goal: 'The knight on b1 is behind its pawns. Jump it over them to a3.', why: 'Two up and one to the left. The pawns did not stop it.' },
      { fen: '7k/8/8/8/4N3/8/8/4K3 w - - 0 1', from: 'e4', to: 'f6', goal: 'From e4, jump the knight two squares up and one to the right, to f6.', why: 'A knight in the middle of the board can reach up to eight squares.' }
    ]
  },
  {
    id: 'pawn', title: 'The pawn', tag: 'Piece', piece: 'p',
    intro: 'Pawns move straight forward one square, or two on their first move. They never move backward. They capture differently from how they move: one square diagonally forward.',
    steps: [
      { fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1', from: 'e2', to: 'e4', goal: 'The pawn on e2 has not moved yet. Push it two squares to e4.', why: 'Only a pawn\'s first move can be two squares.' },
      { fen: '7k/8/8/8/3p4/4P3/8/4K3 w - - 0 1', from: 'e3', to: 'd4', goal: 'A black pawn is on d4. Capture it diagonally with your pawn from e3.', why: 'Pawns capture diagonally forward, one square.' },
      { fen: '7k/3P4/8/8/8/8/8/4K3 w - - 0 1', from: 'd7', to: 'd8', goal: 'Your pawn on d7 is one step from the far side. Move it to d8 and it becomes a queen.', why: 'This is called promotion. In a real game you choose a queen, rook, bishop or knight.' }
    ]
  },
  {
    id: 'king', title: 'The king', tag: 'Piece', piece: 'k',
    intro: 'The king moves one square in any direction. He is the piece the whole game is about. He may never step onto a square that an enemy piece attacks.',
    steps: [
      { fen: '7k/8/8/8/8/8/8/4K3 w - - 0 1', from: 'e1', to: 'd2', goal: 'Move the king one square diagonally from e1 to d2.', why: 'One square, in any of eight directions.' },
      { fen: '7k/8/8/8/4K3/8/8/8 w - - 0 1', from: 'e4', to: 'e5', goal: 'Move the king one square forward from e4 to e5.', why: 'Kings are slow, so they need protecting.' },
      { fen: '3r3k/8/8/8/8/8/8/4K3 w - - 0 1', from: 'e1', to: 'f2', goal: 'A black rook on d8 attacks the whole d-file, so your king may not step onto it. Move the king from e1 away from the rook, to f2.', why: 'Squares the enemy attacks are off limits to your king.' }
    ]
  },
  {
    id: 'values', title: 'Captures and piece values', tag: 'Winning pieces',
    intro: 'Pieces are not equal. Players count them in points: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king has no points because he can never be captured.',
    steps: [
      {
        type: 'choice', fen: TPC_START, goal: 'Which is worth more?',
        choices: [
          { t: 'A rook, 5 points', ok: true, why: 'Yes. A rook is 5 points and a knight is 3.' },
          { t: 'A knight, 3 points', why: 'A knight is 3 points, but a rook is 5.' }
        ]
      },
      { fen: '7k/8/1r6/8/8/1Q2p3/8/4K3 w - - 0 1', from: 'b3', to: 'b6', goal: 'Your queen on b3 can capture the pawn on e3 or the rook on b6. Take the piece worth more points.', why: 'The rook is worth 5 points and the pawn only 1.' },
      {
        type: 'choice', fen: '7k/8/8/3p4/4p3/5P2/8/4K3 w - - 0 1', goal: 'Your pawn on f3 can capture the pawn on e4, but a black pawn on d5 guards e4. If you capture and Black captures back, what happens?',
        choices: [
          { t: 'A fair trade: one pawn each', ok: true, why: 'Yes. You each lose one pawn. Always check whether a piece is guarded before you take it.' },
          { t: 'I win a pawn for free', why: 'Not this time. The pawn on d5 can capture back, so you lose your pawn too.' }
        ]
      }
    ]
  },
  {
    id: 'check', title: 'Check', tag: 'Attacking the king',
    intro: 'When a king is attacked, that is called check. A player in check must deal with it right away. There are three ways out: move the king, block the attack, or capture the attacker.',
    steps: [
      { type: 'check', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', from: 'a1', to: 'a8', goal: 'Give check. Move your rook onto a line that attacks the black king on h8. Try a8.', why: 'Now the rook attacks the king along rank 8. Black must respond.' },
      { fen: '4r2k/8/8/8/8/8/8/4K3 w - - 0 1', from: 'e1', to: 'd1', goal: 'Your king on e1 is in check from the rook on e8. First way out: move the king off the e-file, to d1.', why: 'The king stepped off the line of attack.' },
      { fen: '4r3/7k/8/8/8/2B5/8/4K3 w - - 0 1', from: 'c3', to: 'e5', goal: 'You are in check again. Second way out: block the attack. Move your bishop from c3 to e5, between the rook and your king.', why: 'The bishop now stands in the way, so the king is safe.' },
      { fen: 'R3r2k/8/8/8/8/8/8/4K3 w - - 0 1', from: 'a8', to: 'e8', goal: 'You are in check once more. Third way out: capture the attacker. Your rook on a8 can take the rook on e8.', why: 'No attacker, no check. And you won a rook.' }
    ]
  },
  {
    id: 'mate', title: 'Your first checkmate', tag: 'Goal of the game',
    intro: 'Checkmate means the king is in check and none of the three ways out works. That ends the game and wins it.',
    steps: [
      { type: 'mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', from: 'a1', to: 'a8', goal: 'The black king on g8 is trapped behind its own pawns. Find a checkmate with your rook on a1.', why: 'The rook attacks along rank 8 and the king\'s own pawns block its escape. This is called a back rank mate.' },
      { type: 'mate', fen: 'k7/4Q3/1K6/8/8/8/8/8 w - - 0 1', from: 'e7', to: 'b7', goal: 'Your king on b6 guards a7 and b7. Find a checkmate with the queen on e7.', why: 'The king and queen working together leave Black no escape.' }
    ]
  },
  {
    id: 'draws', title: 'Stalemate and draws', tag: 'When nobody wins',
    intro: 'If a player is not in check but has no legal move, that is stalemate, and the game is a draw. A nearly won game can slip away this way. Games are also drawn when too few pieces remain to checkmate.',
    steps: [
      {
        type: 'choice', state: 'stalemate', fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1', goal: 'Black to move. King on a8. White has a queen on c7 and a king on b6. The black king is not attacked, but every square it could go to is. What is this?',
        choices: [
          { t: 'Checkmate', why: 'Not quite. Checkmate needs the king to be attacked, and this one is not.' },
          { t: 'Stalemate, a draw', ok: true, why: 'Yes. Black has no legal move and is not in check, so nobody wins.' }
        ]
      },
      {
        type: 'choice', state: 'checkmate', fen: 'k7/1Q6/1K6/8/8/8/8/8 b - - 0 1', goal: 'Now the white queen is on b7, next to the black king on a8, and the white king guards the queen. What is this?',
        choices: [
          { t: 'Checkmate', ok: true, why: 'Yes. The king is attacked, cannot capture the guarded queen, and has nowhere to go.' },
          { t: 'Stalemate, a draw', why: 'Not this time. The queen is attacking the king, so this is check with no way out.' }
        ]
      }
    ]
  },
  {
    id: 'special', title: 'Special moves', tag: 'Rules to know',
    intro: 'Three rules surprise new players: castling, which moves the king and a rook together; en passant, a special pawn capture; and promotion, which you met in the pawn lesson.',
    steps: [
      { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', from: 'e1', to: 'g1', goal: 'Castle on the king side. Move your king two squares from e1 to g1, and the rook on h1 jumps to the other side of it.', why: 'Castling tucks the king away and brings the rook out. Neither piece may have moved before, and the king may not be in check or pass through an attacked square.' },
      { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', from: 'e1', to: 'c1', goal: 'Now castle on the queen side. Move your king two squares from e1 to c1.', why: 'The rook from a1 lands on d1. Same rules, the other direction.' },
      { fen: '7k/8/8/3pP3/8/8/8/4K3 w - d6 0 1', from: 'e5', to: 'd6', goal: 'Black\'s pawn just moved two squares, from d7 to d5, and landed beside your pawn on e5. Capture it en passant by moving your pawn diagonally to d6.', why: 'You capture the pawn as if it had moved only one square. You may do this only on the very next move.' }
    ]
  },
  {
    id: 'opening', title: 'Your first four moves', tag: 'Playing well',
    intro: 'A good start follows three ideas: take the centre with a pawn, bring out your knights and bishops, then castle to keep your king safe.',
    steps: [
      { fen: TPC_START, from: 'e2', to: 'e4', goal: 'Take the centre. Push your pawn from e2 to e4.', why: 'The pawn claims the centre and opens lines for your queen and bishop.' },
      { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', from: 'g1', to: 'f3', goal: 'Black replied with a pawn to e5. Bring out a knight: g1 to f3.', why: 'The knight heads for the centre and attacks the pawn on e5.' },
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', from: 'f1', to: 'c4', goal: 'Black brought out a knight to c6. Bring out your bishop: f1 to c4.', why: 'The bishop aims at f7, a weak square beside the black king.' },
      { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', from: 'e1', to: 'g1', goal: 'Black brought out a bishop to c5. The squares next to your king are clear. Castle: move the king from e1 to g1.', why: 'Your king is safe and your rook is ready. You know enough to play a full game now.' }
    ]
  }
];
