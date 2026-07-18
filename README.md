# ♟️ ChessCipher

A browser-based chess steganography application for hiding messages inside
legally playable chess games, with optional password- or FEN-based
encryption.

ChessCipher exists because chess games are one of the few things you can
share publicly — on Chess.com, Lichess, a forum post, a screenshot — without
anyone assuming there's anything hidden in them. A PGN is just a PGN. This
project turns that ordinariness into a channel: your message becomes a real,
rule-legal game, and only someone with ChessCipher (and the right key, if
you used one) can get it back out.

It runs entirely in the browser. No server, no account, no build step, no
data ever leaves your machine.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [How It Works](#how-it-works)
  - [PGN Channel](#pgn-channel--hiding-a-message)
  - [Random FEN Secret Key](#random-fen-secret-key--generating-a-key)
  - [Manual Passwords](#manual-passwords)
  - [PGN Messages vs. FEN Keys](#pgn-messages-vs-fen-keys)
  - [Decoy System](#decoy-system)
  - [Dead Drop](#dead-drop)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Security Notes](#security-notes)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

---

## Features

| | |
|---|---|
| ♟️ PGN steganography | Hide a message inside a real, fully legal chess game |
| ♛ Random FEN secret keys | Generate a random legal position to use as a portable encryption key — no password to remember or transmit |
| 🔑 Manual passwords | Type any password you like; works exactly as you'd expect |
| 🎭 Decoy system | A wrong key returns a believable chess-commentary decoy, never an error |
| 🎬 Cinematic decode | The board replays move by move while the message types itself out, with adjustable speed and optional sound |
| 📇 Dead Drop cards | Generate a plain-text "where to find it" reference card that contains none of the actual secret |
| 📱 Responsive | Icon rail navigation on desktop, bottom tab bar on mobile |
| 🌐 Zero backend | Chess logic, encryption, and rendering all run client-side |

---

## Screenshots

> Add a screenshot or short GIF of the Encode → Decode flow here, e.g.
> `docs/demo.gif`, once you have one.

---

## 🚀 Quick Start

Open `index.html` in any modern browser. That's it.

```bash
git clone https://github.com/<your-fork>/ChessCipher.git
cd ChessCipher
open index.html   # or just double-click it
```

No install, no build step. The only external dependencies are loaded from a
CDN at runtime:

- [`chess.js`](https://github.com/jhlywa/chess.js) `0.10.3` — move
  legality, FEN/PGN parsing
- Google Fonts — `Poppins`, `Nunito`, `JetBrains Mono`

> **Note:** if your browser blocks relative-path script/CSS loading from
> `file://`, serve the folder instead:
> ```bash
> python3 -m http.server
> ```
> then visit `http://localhost:8000`.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Chess logic | [chess.js](https://github.com/jhlywa/chess.js) `0.10.3` | Move legality, FEN/PGN parsing — not worth reimplementing |
| Markup | Plain HTML | No templating engine |
| Styling | Plain CSS, custom properties | No preprocessor, no framework |
| Logic | Vanilla JS, no bundler | Runs by opening the file directly |
| Encryption | XOR cipher + a 32-bit hash, hand-rolled | Obfuscation-grade — see [Security Notes](#security-notes) |
| Fonts | Poppins / Nunito / JetBrains Mono | Google Fonts, loaded via `<link>` |

---

## How It Works

### PGN Channel — hiding a message

```
Message
   │
   ▼
Convert to bits (2-byte length prefix + UTF-8 bytes)
   │
   ▼
At each position: sort all legal moves alphabetically (SAN)
   │
   ▼
Pick the move whose index encodes the next k = ⌊log₂(N)⌋ bits
   │
   ▼
Repeat until the whole message is encoded
   │
   ▼
Legal Chess Game (PGN)
```

Every move chosen is validated by `chess.js` as it's played, so the
resulting PGN is completely legal — it can be replayed on Chess.com,
Lichess, or any PGN viewer. Decoding just replays the game from the start,
recomputing the same sorted legal-move list at each step, and reads off
which index each played move was.

### Random FEN Secret Key — generating a key

The FEN channel does **not** hide messages. Its only job is producing a
random, fully legal chess position to use as a portable encryption key —
instead of agreeing on a password like `ShadowFox` in advance, two people
can just publish a chess position somewhere ordinary:

```
Random walk of legal moves from the start position
   │
   ▼
Random Legal FEN
   │
   ▼
Hash
   │
   ▼
Encryption Key
```

Click **Generate FEN Key** on the Encode page. The app plays a random
number of random legal moves out from the starting position — every move
validated by `chess.js` as it's played, so the result is always an
ordinary, standard FEN with nothing app-specific about it. Short walks
tend to look like openings; longer ones drift toward middlegame/endgame
material. Anyone who reaches the *exact same position*, by any means —
ChessCipher, Lichess, Chess.com, an analysis board, a printed diagram —
gets the exact same FEN string, and therefore the exact same key, without
either party ever typing or transmitting a password.

**Only the visual position matters.** A static picture of a board never
tells you whose turn it is, what the castling rights are, or how many
moves have been played — so the key is derived from *only* the 8-row
piece placement field of the FEN. Whose turn it is, castling rights, en
passant target, and move counters are all stripped and ignored before
hashing:

```
Any FEN-like input
   │
   ▼
Extract just the piece placement (before the first space)
   │
   ▼
Append a fixed, hardcoded suffix ("w - - 0 1")
   │
   ▼
Hash
   │
   ▼
Encryption Key
```

This means `... w KQkq - 0 1`, `... b - e6 12 34`, and the placement on
its own with nothing appended all normalize to the exact same key, as
long as the pieces are arranged identically. Two people transcribing the
same board by hand will very likely disagree on some of that trailing
metadata — the key system is built to not care.

### Manual Passwords

Manual passwords still work exactly as before — type anything into the Key
field (e.g. `ShadowFox`) and it's used directly as the XOR key material.
Nothing about password mode changed.

### PGN Messages vs. FEN Keys

These two channels are intentionally separate and are never mixed:

| | Carries a message? | Where it goes |
|---|---|---|
| **PGN** | Yes — this is the only place your message lives | `Decode` page, main input box |
| **FEN** | No — never | `Key` field, on either the Encode or Decode page |

The Key field accepts **either** a typed password **or** a generated FEN —
the app detects automatically which one you gave it:

```
Key field input
   │
   ├─ Contains a recognizable FEN piece placement? ──▶ hash the placement ──▶ use as key
   │
   └─ Otherwise ───────────────────────────────────────▶ use as literal password
```

Pasting a FEN into the main PGN decode box (instead of the Key field) is
flagged in the UI rather than silently mishandled.

### Decoy System

If key-mode decoding doesn't reconstruct a coherent message — wrong key,
corrupted PGN, whatever — the app doesn't show an error. It deterministically
picks a chess-commentary decoy, seeded by a hash of the PGN plus the
attempted key:

- 60% — ordinary commentary (*"White handled the middlegame well."*)
- 30% — mildly suspicious (*"Something seems incomplete here."*)
- 10% — a subtle troll (*"Wrong key."*)

The same PGN and the same wrong key always produce the same decoy, so
behavior is consistent, but there's no way to tell "wrong key" apart from
"a real message that happens to read like commentary" without already
knowing the answer.

### Dead Drop

Generates a plain-text reference card — platform, username, game index —
describing *where* to find a hidden-message game, without containing any
of the actual secret. Meant to be shared through a separate, lower-trust
channel; the recipient goes and finds the real game themselves.

---

## 📂 Project Structure

```
ChessCipher/
├── index.html          # markup only — no inline styles or scripts
├── css/
│   └── styles.css      # every style rule, one file
├── js/
│   ├── engine.js       # pure cipher/PGN/FEN-key logic — zero DOM dependency
│   ├── pieces.js       # piece SVG artwork + board rendering
│   └── ui.js            # global state + all event handlers / DOM glue
├── LICENSE
└── README.md
```

### What each file is for

- **`index.html`** — structure only. Every page (Encode, Decode, Dead Drop,
  Guide), the support modal, and the toast notification.
- **`css/styles.css`** — one file, top to bottom: design tokens → rail nav →
  layout → cards/forms/buttons → chessboard → decode UI → dead drop → about
  page → modal/toast → responsive breakpoints.
- **`js/engine.js`** — the cipher engine. Pure functions only, no
  `document`/`window` calls anywhere in the file.
- **`js/pieces.js`** — `PIECE_SVG` (piece artwork) and `renderBoard`, the
  one place that turns a `chess.js` position into DOM squares and pieces.
- **`js/ui.js`** — global UI state and every function wired to a button,
  input, or page transition. The only file that calls into both
  `engine.js` and `pieces.js`.

---

## 🧩 Architecture

Scripts load as plain (non-module) `<script src>` tags, in dependency
order, at the bottom of `index.html`:

```html
<script src="js/engine.js"></script>   <!-- no dependencies -->
<script src="js/pieces.js"></script>   <!-- no dependencies -->
<script src="js/ui.js"></script>       <!-- depends on both above -->
```

They share the page's global scope on purpose — classic pre-module JS — so
the project stays runnable by double-clicking `index.html`, with no
bundler, no dev server, and none of the CORS issues `type="module"` imports
can hit when loaded from `file://`.

**`js/engine.js` in detail:**

- **Crypto primitives** — `strEnc`/`strDec`, `xorCipher`, `hash32`,
  `deriveKey`, `bytesToBits`/`bitsToBytes`
- **PGN codec** — `encodeToPGN(message, effectiveKey)`,
  `decodeFromPGN(pgn, effectiveKey)`, `sortedMoves`, `bitsPerPos`,
  `parsePGNmoves`
- **Random FEN key generator** — `generateRandomFEN()`, `isValidFEN(s)`,
  `extractPlacement(s)`, `normalizedKeyFEN(s)`
- **Decoys** — `DECOYS`, `getDecoy`

Every input a function needs is passed in as an argument rather than read
from a global, so anything in this file can be called, unit-tested, or
reused in complete isolation from the UI.

**Visual design notes:**

- Pieces use the classic "cburnett" SVG set (the same one Lichess uses by
  default), recolored for this app.
- The board is styled as blue-glass squares behind a frosted,
  backdrop-blurred frame; the FEN preview board uses the identical markup
  as the PGN board, so the two always render at the same size.
- Navigation is a fixed left icon rail on desktop, collapsing to a bottom
  tab bar on mobile.
- Sound is fully synthesized via `OscillatorNode` — no audio files.

---

## Installation

There is nothing to install. Clone or download the repository and open
`index.html`. See [Quick Start](#quick-start) above for the one edge case
(local file-loading restrictions) and its fix.

---

## 📖 Usage

1. **Encode a message** — go to `Encode`, type your message, optionally add
   a key (password or generated FEN), click **Generate PGN**.
2. **Get a secret key (optional)** — click **Generate FEN Key** to produce
   a random legal position; copy the FEN and paste it into the Key field
   before generating your PGN.
3. **Share the PGN** — post it anywhere PGNs are normally shared.
4. **Decode** — go to `Decode`, paste the PGN, enter the same key (if any),
   click **Decode Message**, and watch the replay.
5. **Dead Drop (optional)** — generate a reference card describing where to
   find the game, and share that through a different channel than the game
   itself.

---

## 🔐 Security Notes

- The encryption here is a hand-rolled XOR stream cipher plus a 32-bit
  hash — it is **obfuscation**, not cryptography with a formal security
  proof. It will stop casual inspection and makes a wrong guess
  indistinguishable from a right one at a glance, but it is not
  AES-GCM, and it has not been audited.
- Random FEN keys are only as unpredictable as the random walk that
  generated them; they are meant to remove the need to invent, remember,
  or transmit a password, not to provide formal cryptographic key strength.
- Do not use ChessCipher for anything where a real adversary with time and
  motivation is a realistic threat.

---

## Known Limitations

- **PGN capacity varies by game.** It depends on how many legal moves are
  available at each position (more legal moves = more bits per move), so
  very short games can't carry long messages. The app will tell you if a
  message doesn't fit.
- **No automated test suite yet** — `engine.js` is pure functions and
  should be straightforward to cover with a lightweight test runner; this
  just hasn't been written yet.
- This is a steganography/obfuscation project, not a vetted security
  product — see [Security Notes](#security-notes).

---

## 🤝 Contributing

Issues and pull requests are welcome. A few starting points if you're
looking for something to work on:

- An automated test suite for `js/engine.js`
- A live "moves available / bits used" capacity estimator while typing
- Drag-and-drop PGN file import on the Decode page
- Additional board/piece themes

Please keep `js/engine.js` free of DOM code, and keep `js/ui.js` free of
cipher logic — that separation is the whole point of the current
structure.

---

## Credits

- Chess rules/validation: [chess.js](https://github.com/jhlywa/chess.js)
- Piece artwork: the "cburnett" SVG chess piece set (CC BY-SA / GPL), the
  same set bundled as the default in
  [react-chessboard](https://github.com/Clariity/react-chessboard) and
  used by Lichess.
- Fonts: [Poppins](https://fonts.google.com/specimen/Poppins),
  [Nunito](https://fonts.google.com/specimen/Nunito),
  [JetBrains Mono](https://www.jetbrains.com/lp/mono/) via Google Fonts.

## 📜 License

[GNU GPLv3](./LICENSE) — see the `LICENSE` file for the full text.
