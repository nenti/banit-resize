# 🐔 Mother Hen

A small top-down browser game built from a voice memo describing a game idea.
You play the **mother hen** and have to gather all your wandering **chicks**
and lead them safely home to bed.

> The full memo (German, auto-transcribed) is saved in
> [`memo-transcript.txt`](./memo-transcript.txt).

## How to play

1. Open `index.html` in any modern browser — no build step, no install.
2. **Move** with the arrow keys / `WASD`, or **drag** on the field (mouse or touch).
3. Touch a **chick 🐥** to add it to your trailing line — they follow you in a
   long snake.
4. Lead the line into the **henhouse 🏠** to tuck the chicks in. Collect and
   deliver them all to win the round.

### Rules (straight from the memo)

| Element | Behaviour |
| --- | --- |
| 🐥 **Chicks** | Wander the field. Touch them to collect; they line up behind you. |
| 🏠 **Henhouse** | Walk your trail into it to put chicks to bed. Deliver them all = win. |
| 🦅 **Eagle** | The bad guy. Patrols back and forth. If it touches you or your chicks, they scatter and you lose a ❤️. |
| 🧲 **Magnet** | Appears lying around and pulls nearby chicks toward you — but it **vanishes quickly**, so grab it fast. |
| 🍄 **Mushroom** | **Never eat it!** Touching it costs you a heart. |
| 🌸 **Flowers** | Pure decoration — harmless to run over. |
| 🚧 **Fence** | Don't crash into it with chicks in tow. |

- You start with **3 hearts** and **14 chicks**.
- Each round adds more chicks (≈30, then more), and from round 2 the field
  turns into a darker, **snowy** version. ❄️
- Lose all your hearts and the flock gets away — try again!

## Files

- `index.html` — page + overlays
- `style.css` — styling
- `game.js` — all game logic (vanilla JS + canvas, no dependencies)
- `memo-transcript.txt` — the original voice-memo transcript the game is based on
