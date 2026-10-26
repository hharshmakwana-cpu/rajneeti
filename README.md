# Rajneeti

A 3D party-building game for phones. Build your party's town, collect voters and money, win elections and rise from Party Worker to Prime Minister. Plays offline. All parties and people are fictional.

**Play:** https://hharshmakwana-cpu.github.io/rajneeti/ (or open `dist/index.html`). Add it to your phone's home screen to play like an app.

## How it plays
- **Build** a Chai Stall, Donation Box, Poster Press, Party Fund Bank, Rally Ground, TV Tower, Karyakarta Bhavan (more workers), trees and flags around your Party Office.
- Buildings **produce voters 🗳️ or money 💰 over time**. Tap the bubble above a building to collect. Work continues while the game is closed.
- **Upgrade** buildings for more output. Your Party Office level sets how many buildings you may have.
- When the ring on the 🗳️ button is full, **fight an election** against the RSP: tap to cheer, watch the count, win to rise one rank and unlock new buildings and more land.
- **Road to Delhi:** Party Worker → Ward Member → Mayor → MLA → Chief Minister → Member of Parliament → Prime Minister.
- An **RSP jeep** sometimes drives through town. Tap it to chase it away for coins, or it takes some of your voters.

## Develop
Source is in `src/`:
- `game.js` rules, economy and saving
- `models.js` low-poly 3D buildings made from simple shapes
- `world.js` the 3D town, camera, people and the jeep
- `hud.js` buttons, shop, bubbles, elections, tutorial
- `sound.js` synthesised Indian music and sound effects; `fx.js` confetti and banners
- `vendor/three.min.js` three.js r149 (MIT licence, bundled so the game works offline)

Run `node build.js` to produce the single-file game in `dist/`. The earlier 2D version is in `legacy/`.
