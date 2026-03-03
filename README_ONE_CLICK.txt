AETHERYN WEB — Standalone Offline (v9: Index-First Retrieval + Structured JSON Output)

Fix for "Ollama did not return valid JSON":
- The ruleskeeper call now uses Ollama Structured Outputs (format: JSON schema) to force valid JSON.
- Fallback recovery extracts the first JSON object if the model still chatters.

Requires a reasonably up-to-date Ollama that supports `format` on /api/chat.

Edit server/.env:
OLLAMA_MODEL=llama3.1:8b

Debug:
- http://localhost:8080/canon
- POST http://localhost:8080/canon/query  {"q":"intake questions"}

DEV CONSOLE (AI TRACE)
- Windows: RUN_WINDOWS_DEV.bat
- Mac/Linux: ./RUN_MAC_LINUX_DEV.sh
- Or set in server/.env (then restart):
  DEV_BUILD=on

When DEV_BUILD is on, a "DEV" button appears in the top-right and shows a live trace of LLM calls + unified firewall retries.
If you don't see the button, open (use the same port the launcher printed):
  http://localhost:<PORT>/api/dev/status
and confirm it returns:  "dev": true


BOOK MODE (in-page tab)
- Click the "Book" tab to see a clean, player-facing transcript (narration + player actions rewritten as prose).
- Book files are saved automatically to: aetheryn-web/server/books/
  - <room>.book.txt (readable)
  - <room>.book.json (structured)

OPTIONAL: Grok narrator (NOT used for the Book)
- Set server/.env:
  - NARRATOR_PROVIDER=grok
  - XAI_API_KEY=...   (your xAI key)
  - GROK_MODEL=...    (example: grok-4-1-fast-reasoning)
- Both Grok and Ollama receive the Book tail as continuity reference each turn.


EPIC BOOK STRUCTURE (Session = Chapter)
- Each play session is recorded as one long Chapter in the Book transcript.
- A Chapter is NOT titled at the start.
  - The Book will show: "Chapter N" at the top.
  - At the END of the session, the host clicks "End Session" to generate the chapter title and append:
    "Chapter N: <Title>" to the end of the Book.
- Minimum structure:
  - 1 Scene = at least 10 Beats (a Beat = a player action + resulting narration).
  - 1 Session/Chapter = at least 10 Scenes.

HOST-ONLY GM TOOLS
- New Scene: requests a scene break (it will apply after the current scene reaches the minimum beats).
- End Session: only works if the current session meets the minimum scenes AND the current scene meets the minimum beats.

Tuning (optional)
- server/.env:
  - MIN_BEATS_PER_SCENE=10
  - MIN_SCENES_PER_SESSION=10


SCOPE LOCKDOWN (optional, default ON)
- Server will refuse out-of-game topics before calling the model.
- Meta commands:
  - /help  /scope  /tokens  /canon <query>
- Configure in server/.env (see server/SCOPE_LOCKDOWN_README.txt)

Ollama tuning (optional)
- You can raise context with OLLAMA_NUM_CTX in server/.env (see server/.env.example).


PUBLIC LOBBY (OPTIONAL MATCHMAKING)
----------------------------------
This build includes a tiny separate "matchmaking" server for public room discovery / quick match.

Run it:
- Windows: RUN_WINDOWS.bat (starts BOTH the game server + matchmaking)
- If you only want matchmaking: RUN_MATCHMAKING_WINDOWS.bat
- Mac/Linux: ./RUN_MAC_LINUX.sh (game server) and ./RUN_MATCHMAKING_MAC_LINUX.sh (matchmaking)

In the game:
- Open the "Lobby" tab.
- Set Matchmaking URL to: http://localhost:8090
- To host for people outside your network, you still need a reachable Public Join URL (tunnel/VPS).


MAP (Fog-of-War + Click Travel)
- Canon map is built-in. (Map upload is disabled by default to prevent cheating.)
- Pin once per location:
  1) Travel in-game until the canon token shows loc: <place>
  2) Click "Pin current location"
  3) Click the exact spot on the map
- Turn on "Reveal as you go" to get fog-of-war.
- Turn on "Click-to-travel" to set a destination by clicking a visited marker OR any wilderness point.
  - Press "Travel" to queue a travel message (no typing).
  - If "Auto-send" is enabled, map clicks can send immediately.
