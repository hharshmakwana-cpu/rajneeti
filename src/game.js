// RAJNEETI 3D — game rules: buildings, money, voters, workers, ranks and elections.
// Pure state and rules; the 3D world and the HUD read from S and call these functions.

const SAVE_KEY = 'rajneeti3d.save.v1';
const now = () => Date.now();

// Buildings. size is in tiles. Producers make `amount` of `makes` every `every` seconds at level 1.
const BUILDINGS = {
  hq:      { name: 'Party Office', icon: '🏛️', size: 2, cost: 0, build: 0, unique: true, desc: 'Your headquarters. Upgrade it to unlock more of everything.' },
  chai:    { name: 'Chai Stall', icon: '☕', size: 1, cost: 40, build: 6, makes: 'votes', amount: 6, every: 15, rank: 0, desc: 'People chat about your party over tea.' },
  donation:{ name: 'Donation Box', icon: '💰', size: 1, cost: 30, build: 6, makes: 'coins', amount: 25, every: 20, rank: 0, desc: 'Supporters drop in money for the campaign.' },
  hostel:  { name: 'Karyakarta Bhavan', icon: '👷', size: 1, cost: 120, build: 15, workers: 1, rank: 0, desc: 'Home for party workers. +1 worker to build faster.' },
  poster:  { name: 'Poster Press', icon: '🖨️', size: 1, cost: 160, build: 20, makes: 'votes', amount: 22, every: 40, rank: 1, desc: 'Prints posters and banners for every wall in town.' },
  bank:    { name: 'Party Fund Bank', icon: '🏦', size: 1, cost: 260, build: 25, makes: 'coins', amount: 90, every: 45, rank: 1, desc: 'Keeps the money flowing.' },
  rally:   { name: 'Rally Ground', icon: '📣', size: 2, cost: 500, build: 40, makes: 'votes', amount: 80, every: 75, rank: 2, desc: 'Huge rallies with a stage and loudspeakers.' },
  tv:      { name: 'TV Tower', icon: '📡', size: 1, cost: 800, build: 50, boost: .2, rank: 3, desc: 'Your message on every TV. +20% voters from all buildings.' },
  tree:    { name: 'Neem Tree', icon: '🌳', size: 1, cost: 10, build: 2, deco: .01, rank: 0, desc: 'Makes the town greener. +1% voters.' },
  flag:    { name: 'Party Flag', icon: '🚩', size: 1, cost: 25, build: 3, deco: .02, rank: 0, desc: 'Shows everyone this is your town. +2% voters.' },
};
const SHOP_ORDER = ['chai', 'donation', 'hostel', 'tree', 'flag', 'poster', 'bank', 'rally', 'tv'];
const MAX_LEVEL = 5;

// The path to Delhi. Win each election to rise one rank.
const RANKS = [
  { title: 'Party Worker', next: 'Ward Election', votes: 120, rsp: 95, land: 6, reward: 150 },
  { title: 'Ward Member', next: 'Mayor Election', votes: 420, rsp: 360, land: 8, reward: 400 },
  { title: 'Mayor', next: 'MLA Election', votes: 1200, rsp: 1050, land: 8, reward: 900 },
  { title: 'MLA', next: 'Chief Minister Race', votes: 3000, rsp: 2700, land: 10, reward: 2000 },
  { title: 'Chief Minister', next: 'Lok Sabha Election', votes: 7000, rsp: 6400, land: 10, reward: 4000 },
  { title: 'Member of Parliament', next: 'Prime Minister Vote', votes: 15000, rsp: 14000, land: 12, reward: 8000 },
  { title: 'Prime Minister', next: 'Re-election', votes: 25000, rsp: 23000, land: 12, reward: 12000 },
];

let S = null;

function newState(o) {
  S = {
    v: 1, leader: o.leader, color: o.color, symbol: o.symbol,
    coins: 150, votes: 0, rank: 0, xp: 0, wins: 0,
    buildings: [], nextId: 1, lastSeen: now(),
    jeepAt: now() + 45000, tutorial: 0,
  };
  // the Party Office sits in the middle of the land
  const c = Math.floor(RANKS[0].land / 2) - 1;
  S.buildings.push({ id: S.nextId++, type: 'hq', x: c, z: c, level: 1, doneAt: 0, readyAt: 0 });
  save();
}

// ---------- derived numbers ----------
const landSize = () => RANKS[Math.min(S.rank, RANKS.length - 1)].land;
const hq = () => S.buildings.find(b => b.type === 'hq');
const built = b => !b.doneAt || b.doneAt <= now();
const workersTotal = () => 1 + S.buildings.filter(b => b.type === 'hostel' && built(b)).reduce((t, b) => t + b.level, 0);
const workersBusy = () => S.buildings.filter(b => b.doneAt > now()).length;
const workersFree = () => workersTotal() - workersBusy();
const levelMult = lv => Math.pow(1.6, lv - 1);
const voteBoost = () => 1
  + S.buildings.filter(b => b.type === 'tv' && built(b)).reduce((t, b) => t + BUILDINGS.tv.boost * b.level, 0)
  + S.buildings.filter(b => BUILDINGS[b.type].deco && built(b)).reduce((t, b) => t + BUILDINGS[b.type].deco, 0);
const countOf = type => S.buildings.filter(b => b.type === type).length;
// how many of a building you may own: grows with the Party Office level
const maxCount = type => BUILDINGS[type].deco ? 6 + hq().level * 4 : BUILDINGS[type].unique ? 1 : Math.min(6, 1 + hq().level);

function output(b) {
  const d = BUILDINGS[b.type];
  if (!d.makes) return 0;
  return Math.round(d.amount * levelMult(b.level) * (d.makes === 'votes' ? voteBoost() : 1));
}
const cycleSecs = b => BUILDINGS[b.type].every * (1 + (b.level - 1) * .15);
function upgradeCost(b) { return b.type === 'hq' ? Math.round(200 * Math.pow(2.6, b.level - 1)) : Math.round(BUILDINGS[b.type].cost * 1.8 * Math.pow(2, b.level - 1)); }
function upgradeTime(b) { return b.type === 'hq' ? 20 * b.level : Math.round(BUILDINGS[b.type].build * Math.pow(1.5, b.level)); }
function canUpgrade(b) {
  if (b.level >= MAX_LEVEL || !built(b)) return false;
  return b.type === 'hq' ? b.level < 2 + S.rank : b.level < hq().level + 1;
}

function occupied(x, z, size, ignoreId) {
  for (const b of S.buildings) {
    if (b.id === ignoreId) continue;
    const s = BUILDINGS[b.type].size;
    if (x < b.x + s && x + size > b.x && z < b.z + s && z + size > b.z) return true;
  }
  return false;
}
const inLand = (x, z, size) => x >= 0 && z >= 0 && x + size <= landSize() && z + size <= landSize();
const canPlace = (type, x, z) => inLand(x, z, BUILDINGS[type].size) && !occupied(x, z, BUILDINGS[type].size);

// ---------- actions (return { err } or details) ----------
function shopStatus(type) {
  const d = BUILDINGS[type];
  if (S.rank < d.rank) return { locked: true, why: `Unlocks as ${RANKS[d.rank].title}` };
  if (countOf(type) >= maxCount(type)) return { locked: true, why: 'Upgrade Party Office for more' };
  if (S.coins < d.cost) return { poor: true };
  if (workersFree() < 1 && d.build > 3) return { busy: true };
  return {};
}

function place(type, x, z) {
  const d = BUILDINGS[type], st = shopStatus(type);
  if (st.locked) return { err: st.why };
  if (st.poor) return { err: 'Not enough coins' };
  if (st.busy) return { err: 'All workers are busy' };
  if (!canPlace(type, x, z)) return { err: 'No space there' };
  S.coins -= d.cost;
  const b = { id: S.nextId++, type, x, z, level: 1, doneAt: d.build > 0 ? now() + d.build * 1000 : 0, readyAt: 0 };
  b.readyAt = (b.doneAt || now()) + (d.makes ? cycleSecs(b) * 1000 : 0);
  S.buildings.push(b);
  S.xp += Math.ceil(d.cost / 10);
  save();
  return { b };
}

function upgrade(id) {
  const b = S.buildings.find(x => x.id === id);
  if (!canUpgrade(b)) return { err: b.type === 'hq' ? 'Win the next election first' : 'Upgrade the Party Office first' };
  const cost = upgradeCost(b);
  if (S.coins < cost) return { err: 'Not enough coins' };
  if (workersFree() < 1) return { err: 'All workers are busy' };
  S.coins -= cost; b.level++;
  b.doneAt = now() + upgradeTime(b) * 1000;
  if (BUILDINGS[b.type].makes) b.readyAt = b.doneAt + cycleSecs(b) * 1000;
  S.xp += Math.ceil(cost / 10);
  save();
  return { b };
}

function move(id, x, z) {
  const b = S.buildings.find(q => q.id === id), size = BUILDINGS[b.type].size;
  if (!inLand(x, z, size) || occupied(x, z, size, id)) return { err: 'No space there' };
  b.x = x; b.z = z; save();
  return { b };
}

function sell(id) {
  const b = S.buildings.find(q => q.id === id);
  if (b.type === 'hq') return { err: 'You cannot sell your Party Office' };
  S.buildings = S.buildings.filter(q => q !== b);
  S.coins += Math.floor(BUILDINGS[b.type].cost / 2);
  save();
  return {};
}

// finish a build instantly by paying coins
function rushCost(b) { return Math.max(5, Math.ceil((b.doneAt - now()) / 1000) * 2); }
function rush(id) {
  const b = S.buildings.find(q => q.id === id);
  if (built(b)) return { err: 'Already done' };
  const c = rushCost(b);
  if (S.coins < c) return { err: 'Not enough coins' };
  S.coins -= c;
  const left = b.doneAt - now();
  b.doneAt = now() - 1; if (b.readyAt) b.readyAt -= left;
  save();
  return {};
}

const isReady = b => built(b) && BUILDINGS[b.type].makes && b.readyAt <= now();

function collect(id) {
  const b = S.buildings.find(q => q.id === id);
  if (!b || !isReady(b)) return null;
  const d = BUILDINGS[b.type], amt = output(b);
  if (d.makes === 'coins') S.coins += amt; else S.votes += amt;
  b.readyAt = now() + cycleSecs(b) * 1000;
  S.xp += 1;
  save();
  return { kind: d.makes, amount: amt };
}

// ---------- elections ----------
const election = () => RANKS[Math.min(S.rank, RANKS.length - 1)];
const electionReady = () => S.votes >= election().votes;

// cheer is 0..1 from the tapping game during the count
function runElection(cheer) {
  const e = election();
  const mine = Math.round(S.votes * (1 + cheer * .25));
  const theirs = Math.round(e.rsp * (.9 + Math.random() * .25));
  const win = mine > theirs;
  const res = { mine, theirs, win, from: e.title, title: e.next };
  if (win) {
    S.votes = Math.max(0, S.votes - Math.round(e.votes * .6));
    S.coins += e.reward; S.wins++;
    if (S.rank < RANKS.length - 1) {
      // the town grows outward on every side, so shift buildings to stay centred
      const grow = (RANKS[S.rank + 1].land - RANKS[S.rank].land) / 2;
      S.rank++;
      if (grow) for (const b of S.buildings) { b.x += grow; b.z += grow; }
    }
    else RANKS[RANKS.length - 1].votes = Math.round(RANKS[RANKS.length - 1].votes * 1.2); // keep re-elections growing
    res.rank = RANKS[S.rank].title; res.reward = e.reward;
  } else {
    S.votes = Math.round(S.votes * .7);
  }
  save();
  return res;
}

// ---------- the RSP jeep ----------
// Every so often an RSP jeep drives through town. Catch it for coins, or it takes voters.
function jeepDue() { return now() >= S.jeepAt; }
function jeepDone(caught) {
  S.jeepAt = now() + (60 + Math.random() * 60) * 1000;
  let amount;
  if (caught) { amount = 20 + S.rank * 30; S.coins += amount; }
  else { amount = Math.round(S.votes * .08); S.votes -= amount; }
  save();
  return amount;
}

// ---------- save ----------
function save() { if (!S) return; S.lastSeen = now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
function load() {
  try { const s = localStorage.getItem(SAVE_KEY); if (s) { S = JSON.parse(s); return true; } } catch (e) { /* ignore */ }
  return false;
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
