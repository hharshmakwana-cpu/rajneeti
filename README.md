# Rajneeti: Path to Power

An offline, single-player Indian political strategy game. Lead an opposition party to victory in the Lok Sabha, govern as Prime Minister for five years, then fight for re-election. All parties and leaders are fictional.

## Play
**Online:** https://hharshmakwana-cpu.github.io/rajneeti/

- **Quickest:** open `dist/index.html` in any browser. It's one self-contained file with no internet needed.
- **Install on a phone:** host the `dist/` folder on any static host (GitHub Pages, Netlify), open it, and choose "Add to Home Screen". The service worker caches it for offline play.

Progress auto-saves in the browser. Tap 🔊 to mute, or open ☰ → Sound for separate game-sound and music volume.

## Game phases
1. **Campaign (10 weeks):** pick 3 promises, then pick 1 of 3 move cards, three times a week (rally, make friends with a local party, TV ads, collect money).
2. **Counting day:** seat-by-seat first-past-the-post results.
3. **Hung parliament:** win kingmakers over by asking, offering a minister's post, or offering money for their state.
4. **Prime Minister (20 quarters):** each quarter, answer any news card and swipe idea cards (right = yes, left = no). Once a year on Money Day, choose a budget. Keep the four meters green: Happy, Jobs, Prices, Savings.
5. **Re-election:** your approval in each state becomes your starting position, and broken promises cost trust.

## Develop
Source is in `src/` (`data.js` content, `events.js` event cards, `engine.js` rules/economy, `ui.js` interface, `sound.js` synthesised sound effects and music, `fx.js` confetti, bursts, banners and other effects). Open `src/index.html` directly while editing, then run `node build.js` to regenerate `dist/`.
