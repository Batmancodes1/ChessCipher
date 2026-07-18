/**
 * ChessCipher — UI Glue
 * ---------------------------------------------------------------
 * Everything wired directly to a button, input, or page transition.
 * Calls into engine.js (cipher/PGN/FEN logic) and pieces.js (board
 * rendering) — this file owns no cipher logic of its own, only DOM
 * state and event handling.
 * ---------------------------------------------------------------
 */
"use strict";

// ============================================================
      // GLOBAL STATE
      // ============================================================
      let sndOn = false;
      let decSpd = 1; // 0=instant 1=normal 2=fast
      let decState = "idle"; // idle running paused done
      let decAbort = false;
      let audioCtx = null;

      // Tracks whether the currently-displayed PGN result still matches
      // the message + key that produced it, so we can warn the user
      // instead of leaving a stale result on screen after they change
      // either input.
      let lastEncodedMsg = null;
      let lastEncodedKey = null;

      // Preview board state (encode page)
      let prevChess = null;
      let prevMoves = [];
      let prevIdx = 0;

      // Decode board state
      let decChess = null;

      

// ============================================================
      // ENCODE UI
      // ============================================================

      function doEncode() {
        const msg = document.getElementById("encMsg").value.trim();
        const key = document.getElementById("encKey").value;
        clearAlert("encAlert");

        if (!msg) {
          showAlert("encAlert", "err", "Please enter a message to encode.");
          return;
        }

        const ek = deriveKey(key);
        document.getElementById("pgnOut").textContent =
          "Generating legal chess game...";

        setTimeout(() => {
          const result = encodeToPGN(msg, ek);

          if (result.error) {
            showAlert("encAlert", "err", result.error);
            document.getElementById("pgnOut").textContent = "Encoding failed.";
            return;
          }

          document.getElementById("pgnOut").textContent = result.pgn;
          document.getElementById("encStats").style.display = "flex";
          document.getElementById("sBits").textContent = result.totalBits;
          document.getElementById("sMoves").textContent = result.moves.length;
          document.getElementById("sChars").textContent = msg.length;
          document.getElementById("moveCountBadge").textContent =
            result.moves.length + " moves";

          // Remember exactly what produced this result so we can warn
          // the user if they change the message or key afterward.
          lastEncodedMsg = msg;
          lastEncodedKey = key;
          setPgnStale(false);

          // Show board section
          document.getElementById("encBoardSection").style.display = "block";
          prevChess = new Chess();
          prevMoves = result.moves;
          prevIdx = 0;
          renderBoard("boardEncode", prevChess, null, null);
          updatePreviewLabel();

          // Scroll to result
          scrollTo("encResultCol");
          document.getElementById("encResultCol").classList.add("result-flash");
          setTimeout(
            () =>
              document
                .getElementById("encResultCol")
                .classList.remove("result-flash"),
            800,
          );

          // Auto-animate preview
          animatePreview();
        }, 20);
      }

      /**
       * Live feedback for the encode Key field: shows whether the app
       * sees a FEN-derived key, a plain password, or no key at all —
       * and, if a PGN was already generated, flags it as stale the
       * moment the message or key text no longer matches what produced
       * it, instead of silently leaving a mismatched result on screen.
       */
      function onEncInputChange() {
        const key = document.getElementById("encKey").value;
        const status = document.getElementById("encKeyStatus");
        const t = key.trim();
        if (!t) {
          status.textContent = "Public — no key, anyone can decode this";
          status.style.color = "";
        } else if (isValidFEN(t)) {
          status.textContent =
            "Key Mode — using the FEN position as the encryption key";
          status.style.color = "var(--teal)";
        } else {
          status.textContent = "Key Mode — using this text as a password";
          status.style.color = "var(--teal)";
        }

        if (lastEncodedMsg !== null) {
          const msg = document.getElementById("encMsg").value.trim();
          const stale = msg !== lastEncodedMsg || key !== lastEncodedKey;
          setPgnStale(stale);
        }
      }

      function setPgnStale(stale) {
        const warning = document.getElementById("pgnStaleWarning");
        const box = document.getElementById("pgnOut");
        if (!warning || !box) return;
        warning.style.display = stale ? "flex" : "none";
        box.style.opacity = stale ? "0.45" : "1";
      }

      function animatePreview() {
        if (!prevChess || prevIdx >= prevMoves.length) return;
        const r = prevChess.move(prevMoves[prevIdx], { sloppy: true });
        if (r) renderBoard("boardEncode", prevChess, r.from, r.to);
        prevIdx++;
        updatePreviewLabel();
        if (prevIdx < prevMoves.length) setTimeout(animatePreview, 120);
      }

      function previewPrev() {
        if (!prevChess || prevIdx <= 0) return;
        prevIdx = Math.max(0, prevIdx - 2);
        prevChess = new Chess();
        for (let i = 0; i < prevIdx; i++)
          prevChess.move(prevMoves[i], { sloppy: true });
        renderBoard("boardEncode", prevChess, null, null);
        updatePreviewLabel();
      }

      function previewNext() {
        if (!prevChess || prevIdx >= prevMoves.length) return;
        const r = prevChess.move(prevMoves[prevIdx], { sloppy: true });
        if (r) renderBoard("boardEncode", prevChess, r.from, r.to);
        prevIdx++;
        updatePreviewLabel();
      }

      function previewReset() {
        if (!prevChess) return;
        prevChess = new Chess();
        prevIdx = 0;
        renderBoard("boardEncode", prevChess, null, null);
        updatePreviewLabel();
      }

      function updatePreviewLabel() {
        const el = document.getElementById("previewMoveLabel");
        if (el) el.textContent = prevIdx + "/" + (prevMoves.length || 0);
      }

      /**
       * Generates a random legal chess position to use as a portable
       * encryption key (see generateRandomFEN in engine.js). Uses the
       * exact same board markup as the PGN preview board so it renders
       * at the same size — no separate "FEN board" styling.
       */
      function generateFENKey() {
        const fen = generateRandomFEN();
        const fenCard = document.getElementById("fenCard");
        const fenOut = document.getElementById("fenOut");
        fenCard.style.display = "block";

        fenOut.innerHTML = `
    <p style="font-size: 12.5px; color: var(--ink-muted); margin-bottom: 12px; line-height: 1.6;">
      A random, fully legal chess position. Copy the FEN below and paste it
      into the <b>Encryption Key</b> field on this page (or the Decode page)
      to use it as your secret key instead of typing a password.
    </p>
    <div class="board-wrap" style="margin-bottom: 12px;">
      <div class="board-coord-wrap">
        <div class="board-grid" id="fenBoardPrev"></div>
      </div>
    </div>
    <div class="out-header">
      <span class="out-label">Secret Key (FEN)</span>
      <button class="copy-btn" onclick="copyText('${fen.replace(/'/g, "\\'")}')">[ copy ]</button>
    </div>
    <div class="out-box" style="font-size:11px;word-break:break-all">${fen}</div>
    <div class="btn-row" style="margin-top: 12px;">
      <button class="btn btn-teal" onclick="useFENAsKey('${fen.replace(/'/g, "\\'")}')">
        Use as Encryption Key
      </button>
      <button class="btn btn-ghost" onclick="generateFENKey()">
        Generate Another
      </button>
    </div>
  `;

        setTimeout(() => {
          try {
            const c = new Chess(fen);
            renderBoard("fenBoardPrev", c, null, null);
          } catch (e) {}
        }, 30);

        scrollTo("fenCard");
      }

      /** Drops a generated FEN straight into the encode Key field. */
      function useFENAsKey(fen) {
        document.getElementById("encKey").value = fen;
        onEncInputChange();
        showToast("FEN key inserted");
      }

      function clearEncode() {
        document.getElementById("encMsg").value = "";
        document.getElementById("encKey").value = "";
        document.getElementById("pgnOut").textContent =
          "Your encoded PGN will appear here.\n\nTip: Copy and paste into Chess.com, Lichess, or any chess platform.";
        document.getElementById("encStats").style.display = "none";
        document.getElementById("encBoardSection").style.display = "none";
        document.getElementById("fenCard").style.display = "none";
        document.getElementById("moveCountBadge").textContent = "0 moves";
        clearAlert("encAlert");
        prevChess = null;
        prevMoves = [];
        prevIdx = 0;
        lastEncodedMsg = null;
        lastEncodedKey = null;
        setPgnStale(false);
        onEncInputChange();
      }

      // ============================================================
      // DECODE UI — CINEMATIC
      // ============================================================

      async function doDecode() {
        if (decState === "running") return;

        const input = document.getElementById("decInput").value.trim();
        const key = document.getElementById("decKey").value;
        clearAlert("decAlert");

        if (!input) {
          showAlert("decAlert", "err", "Paste a PGN string first.");
          return;
        }

        scrollTo("decResultPanel");
        document.getElementById("decodeChanBadge").textContent = "PGN Channel";

        const ek = deriveKey(key);
        let decoded = null;
        try {
          decoded = decodeFromPGN(input, ek);
        } catch (e) {}

        // Parse for animation
        const chess = parsePGNmoves(input);
        const hist = chess.history({ verbose: true });

        if (hist.length < 2) {
          showAlert(
            "decAlert",
            "err",
            "Could not parse PGN. Check the format and try again.",
          );
          return;
        }

        decChess = new Chess();
        decState = "running";
        decAbort = false;

        renderBoard("boardDecode", decChess, null, null);
        document.getElementById("msgOut").innerHTML =
          '<span class="cursor"></span>';
        setProgress(0);

        await animateDecode(hist, decoded, key);
      }

      async function animateDecode(hist, message, key) {
        const total = hist.length;
        const statuses = [
          " Parsing move sequence...",
          " Extracting binary channel...",
          " Decrypting payload...",
          " Reconstructing message...",
        ];
        let si = 0;
        setDecStatus(statuses[0]);

        for (let i = 0; i < total; i++) {
          // Pause handling
          while (decState === "paused") await sleep(80);
          if (decAbort) {
            decState = "idle";
            decAbort = false;
            return;
          }

          const mv = hist[i];
          const r = decChess.move(mv.san, { sloppy: true });
          if (r) renderBoard("boardDecode", decChess, r.from, r.to);

          const pct = Math.round(((i + 1) / total) * 100);
          setProgress(pct);

          // Update status messages
          const nsi = Math.min(
            Math.floor((i / total) * statuses.length),
            statuses.length - 1,
          );
          if (nsi !== si) {
            si = nsi;
            setDecStatus(statuses[si]);
          }

          if (sndOn) playClick();

          if (decSpd === 0) continue;
          await sleep(decSpd === 2 ? 65 : 185);
        }

        setDecStatus(" Decode complete.");
        setProgress(100);

        revealMsg(
          message ||
            getDecoy(
              document.getElementById("decInput").value,
              document.getElementById("decKey").value,
            ),
        );
        decState = "done";

        document.getElementById("decResultPanel").classList.add("result-flash");
        setTimeout(
          () =>
            document
              .getElementById("decResultPanel")
              .classList.remove("result-flash"),
          800,
        );
      }

      function revealMsg(msg) {
        const el = document.getElementById("msgOut");
        el.textContent = "";
        el.classList.add("glow");

        const cur = document.createElement("span");
        cur.className = "cursor";
        el.appendChild(cur);

        let idx = 0;
        function type() {
          if (idx >= msg.length) {
            cur.remove();
            return;
          }
          const chunk = decSpd === 0 ? msg.length : 1;
          const speed = decSpd === 0 ? 0 : decSpd === 2 ? 10 : 28;
          el.insertBefore(
            document.createTextNode(msg.substring(idx, idx + chunk)),
            cur,
          );
          idx += chunk;
          if (sndOn && speed !== 0 && msg.substring(idx - chunk, idx).trim())
            playType();
          if (speed === 0) {
            type();
            return;
          }
          setTimeout(type, speed);
        }
        type();
      }

      function skipAnim() {
        decAbort = true;
        decState = "idle";

        const input = document.getElementById("decInput").value.trim();
        const key = document.getElementById("decKey").value;
        if (!input) return;

        const ek = deriveKey(key);
        let msg = null;
        try {
          msg = decodeFromPGN(input, ek);
        } catch (e) {}

        try {
          const c = parsePGNmoves(input);
          renderBoard("boardDecode", c, null, null);
        } catch (e) {}

        setProgress(100);
        setDecStatus(" Decode complete (skipped).");
        revealMsg(msg || getDecoy(input, key));
      }

      function replayDec() {
        decAbort = true;
        decState = "idle";
        setTimeout(() => {
          decAbort = false;
          doDecode();
        }, 150);
      }

      function togglePause() {
        if (decState === "running") {
          decState = "paused";
          document.getElementById("pauseBtn").classList.add("active");
        } else if (decState === "paused") {
          decState = "running";
          document.getElementById("pauseBtn").classList.remove("active");
        }
      }

      // ============================================================
      // DEAD DROP
      // ============================================================

      function doDeadDrop() {
        const handle = document.getElementById("ddHandle").value.trim();
        const platform = document.getElementById("ddPlat").value;
        const location = document.getElementById("ddLoc").value;
        const idx = document.getElementById("ddIdx").value.trim() || "latest";
        const hint = document.getElementById("ddHint").value.trim();

        if (!handle) {
          return;
        }

        const date = new Date().toISOString().split("T")[0];
        const ref = hash32(handle + platform + idx)
          .substring(0, 8)
          .toUpperCase();

        const lines = [
          `Ref ID   : ${ref}`,
          `Date     : ${date}`,
          `Platform : ${platform}`,
          `Location : ${location}`,
          `Handle   : ${handle}`,
          `Game     : ${idx}`,
          hint ? `Key Hint : ${hint}` : `Key      : none required`,
          ``,
          `Instructions`,
          `------------`,
          `1. Navigate to ${platform}`,
          `2. Find player: ${handle}`,
          `3. Open game: ${idx}`,
          `4. Copy full PGN from game viewer`,
          `5. Paste into ChessCipher → Decode tab`,
          hint ? `6. Enter key when prompted` : `6. No key required`,
          ``,
          `Encoded with ChessCipher v2.0`,
        ];

        const card = document.getElementById("ddCardOut");
        card.textContent = lines.join("\n");

        const cardEl = document.getElementById("ddResultCard");
        cardEl.style.display = "block";
        scrollTo("ddResultCard");
        cardEl.classList.add("result-flash");
        setTimeout(() => cardEl.classList.remove("result-flash"), 800);
      }

      function clearDD() {
        ["ddHandle", "ddIdx", "ddHint"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });
        document.getElementById("ddResultCard").style.display = "none";
      }

      // ============================================================
      // UTILITIES
      // ============================================================

      function detectFENFormat(s) {
        if (!s) return false;
        const t = s.trim();
        return (
          t.split("/").length === 8 &&
          /^[rnbqkpRNBQKP1-8\/]+/.test(t) &&
          !t.includes(".")
        );
      }

      function detectFmt() {
        const val = document.getElementById("decInput").value.trim();
        const b = document.getElementById("fmtBadge");
        if (!val) {
          b.textContent = "PGN Channel";
          b.style.color = "";
          return;
        }
        if (detectFENFormat(val)) {
          b.textContent = "That's a FEN — use the Key field instead";
          b.style.color = "var(--red)";
        } else {
          b.textContent = "PGN Channel";
          b.style.color = "";
        }
      }

      /** Live feedback for the decode Key field, mirroring onEncInputChange. */
      function onDecInputChange() {
        const key = document.getElementById("decKey").value;
        const status = document.getElementById("decKeyStatus");
        if (!status) return;
        const t = key.trim();
        if (!t) {
          status.textContent = "Leave blank if this was encoded in public mode";
          status.style.color = "";
        } else if (isValidFEN(t)) {
          status.textContent = "Recognized as a FEN — will hash it into the key";
          status.style.color = "var(--teal)";
        } else {
          status.textContent = "Will be used as a literal password";
          status.style.color = "var(--teal)";
        }
      }

      function setSpd(s) {
        decSpd = s;
        ["spd1", "spd2", "spd0"].forEach((id) =>
          document.getElementById(id).classList.remove("active"),
        );
        const map = { 1: "spd1", 2: "spd2", 0: "spd0" };
        document.getElementById(map[s]).classList.add("active");
      }

      function toggleSnd() {
        sndOn = !sndOn;
        const t = document.getElementById("sndToggle");
        sndOn ? t.classList.add("on") : t.classList.remove("on");
        document.getElementById("sndLabel").textContent = sndOn
          ? "♪ on"
          : "♪ off";
      }

      function setProgress(pct) {
        document.getElementById("progBar").style.width = pct + "%";
      }

      function setDecStatus(msg) {
        const el = document.getElementById("decStatus");
        if (el) el.innerHTML = `<span>${msg.replace(/^ /, "")}</span>`;
      }

      function showPage(page, btn) {
        document
          .querySelectorAll(".page")
          .forEach((p) => p.classList.remove("active"));
        document
          .querySelectorAll(".nav-tab")
          .forEach((t) => t.classList.remove("active"));
        document.getElementById("page-" + page).classList.add("active");
        if (btn) btn.classList.add("active");
        // Init decode board on first visit
        if (page === "decode" && !decChess) {
          decChess = new Chess();
          renderBoard("boardDecode", decChess, null, null);
        }
      }

      function scrollTo(id) {
        const el = document.getElementById(id);
        if (!el) return;
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }

      function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
      }

      function showAlert(id, type, msg) {
        const el = document.getElementById(id);
        if (el)
          el.innerHTML = `<div class="alert alert-${type === "err" ? "err" : "ok"}">${msg}</div>`;
      }

      function clearAlert(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
      }

      // Copy helpers
      function copyEl(id) {
        const el = document.getElementById(id);
        if (!el) return;
        copyText(el.textContent);
      }

      function copyText(text) {
        navigator.clipboard
          .writeText(text)
          .then(() => showToast("Copied to clipboard"))
          .catch(() => {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            showToast("Copied!");
          });
      }

      function showToast(msg) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 1800);
      }

      function openModal(id) {
        document.getElementById(id).classList.add("open");
      }
      function closeModal(id) {
        document.getElementById(id).classList.remove("open");
      }

      function copyUPI() {
        copyText("rabindrachoudhary125@oksbi");
        const el = document.getElementById("upiMsg");
        if (el) {
          el.textContent = "Copied! ✓";
          setTimeout(() => (el.textContent = ""), 2000);
        }
      }

      function copyNavUPI() {
        copyText("rabindrachoudhary125@oksbi");
        const btn = document.getElementById("navUpiBtn");
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = "Copied! ✓";
          btn.style.color = "var(--gold)";
          btn.style.borderColor = "var(--gold)";
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.color = "";
            btn.style.borderColor = "";
          }, 2000);
        }
      }

      // Sound synthesis
      function playClick() {
        try {
          if (!audioCtx)
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(
            600 + Math.random() * 300,
            audioCtx.currentTime,
          );
          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioCtx.currentTime + 0.09,
          );
          osc.start();
          osc.stop(audioCtx.currentTime + 0.09);
        } catch (e) {}
      }

      // Soft typewriter tick — plays per revealed character during the
      // decoded-message reveal animation. Shorter, higher-pitched, and
      // quieter than playClick() so the two stay distinguishable: click
      // = a board move happened, tick = a character was just typed out.
      function playType() {
        try {
          if (!audioCtx)
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = "square";
          osc.frequency.setValueAtTime(
            1000 + Math.random() * 400,
            audioCtx.currentTime,
          );
          gain.gain.setValueAtTime(0.025, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioCtx.currentTime + 0.025,
          );
          osc.start();
          osc.stop(audioCtx.currentTime + 0.025);
        } catch (e) {}
      }

      

// ============================================================
      // INIT
      // ============================================================
      (function init() {
        // Init encode board
        const c = new Chess();
        renderBoard("boardEncode", c, null, null);
        // Init decode board
        decChess = new Chess();
        renderBoard("boardDecode", decChess, null, null);
      })();
    
