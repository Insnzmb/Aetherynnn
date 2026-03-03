AETHERYN — Llama Scope Lockdown (Local)

Goal:
- Keep the model "inside the game" by default.
- Permit ONLY Aetheryn gameplay, Aetheryn canon/rules clarifications, and local bundle troubleshooting.

How it works:
1) Server-side Scope Gate: before any model call, messages are checked against a keyword list.
2) If the message is OUT OF SCOPE, the server refuses and returns you to play with safe choices.
3) Meta commands (start with "/") are handled locally without calling the model.

Environment flags (server/.env):
- SCOPE_LOCKDOWN=on            # on|off  (default: on)
- SCOPE_STRICTNESS=2           # 0=off, 1=soft, 2=strict (default: 2)
- META_PREFIX=/                # command prefix (default: /)

Meta commands:
- /help                        # show this help + quick tips
- /scope                       # summary + where the big list lives
- /tokens                      # print current canon tokens
- /canon <query>               # retrieve relevant canon chunks for a phrase (debug view)

Files:
- server/scope_blacklist_keywords.json
- server/AETHERYN_SCOPE_DONT_TALK_ABOUT.txt

Tip:
If you want the model to answer real-world questions, turn it off:
- set SCOPE_LOCKDOWN=off in server/.env and restart.
