// ---------------------------------------------------------------------------
// Petite base de données dans LocalStorage
// ---------------------------------------------------------------------------
const DB_KEY = "PTA_DB_V1";
let DB = loadDB();

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw);
  return { players: [], pairs: [], tournaments: [], matches: [] };
}
function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(DB)); }

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
const PlayersService = {
  add(data) {
    const id = "p" + Date.now();
    DB.players.push({ id, ...data });
    saveDB();
    return id;
  },
  list() { return DB.players; }
};

const PairsService = {
  add(p1, p2, seed) {
    const id = "pr" + Date.now();
    DB.pairs.push({ id, p1, p2, seed: seed || null });
    saveDB();
  },
  list() {
    return DB.pairs.map(pr => ({
      ...pr,
      p1Name: playerName(pr.p1),
      p2Name: playerName(pr.p2)
    }));
  }
};

const TournamentsService = {
  add(data) {
    const id = "t" + Date.now();
    DB.tournaments.push({
      id,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      category: data.category,
      rules: { superTB: data.superTB, tbTo: 7, superTBTo: 10 },
      format: { hasGroups: false, groupsCount: 0, hasBracket: false, bracketSize: 0 },
      registrations: [],
      groups: [],
      bracket: null,
      matchIds: []
    });
    saveDB();
  },
  list() { return DB.tournaments; },
  register(tournamentId, pairId) {
    const t = DB.tournaments.find(t => t.id === tournamentId);
    if (!t) return;
    if (!t.registrations.find(r => r.pairId === pairId)) {
      t.registrations.push({ pairId, status: "accepted" });
      saveDB();
    }
  },
  registrations(tournamentId) {
    const t = DB.tournaments.find(t => t.id === tournamentId);
    return t ? t.registrations : [];
  },
  get(id) { return DB.tournaments.find(t => t.id === id); }
};

const MatchesService = {
  add(match) {
    DB.matches.push(match);
    saveDB();
  },
  update(match) {
    const i = DB.matches.findIndex(m => m.id === match.id);
    DB.matches[i] = match;
    saveDB();
  },
  list() { return DB.matches; },
  get(id) { return DB.matches.find(m => m.id === id); }
};

// ---------------------------------------------------------------------------
// Scoring Engine : points 0/15/30/40/Ad, tie-break 7, super tie-break 10
// ---------------------------------------------------------------------------
const ScoringEngine = {
  applyPoint(match, winner) {
    const state = match.state || initState(getTournamentRules(match.tournamentId));
    const ev = { ts: Date.now(), type: "POINT", winner };
    state.events.push(ev);
    applyEvents(state);
    match.state = state;
    match.score = serializeScore(state);
    match.status = state.finished ? "finished" : "live";
  },
  undo(match) {
    const state = match.state;
    if (!state || state.events.length === 0) return;
    state.events.pop();
    applyEvents(state);
    match.score = serializeScore(state);
    match.status = state.finished ? "finished" : "live";
  }
};

function initState(rules) {
  return {
    events: [],
    points: [0, 0],
    games: [0, 0],
    sets: [],
    tbPoints: [0, 0],
    inTB: false,
    superTB: false,
    finished: false,
    rules
  };
}

function applyEvents(s) {
  const evs = s.events.slice();
  const rules = s.rules;
  Object.assign(s, initState(rules));
  s.events = evs;
  evs.forEach(ev => processPoint(ev.winner, s));
}

function processPoint(winner, s) {
  if (s.finished) return;
  const loser = winner === 0 ? 1 : 0;

  if (s.superTB) {
    s.tbPoints[winner]++;
    if (s.tbPoints[winner] >= s.rules.superTBTo && s.tbPoints[winner] - s.tbPoints[loser] >= 2) {
      s.sets.push({ p1: s.games[0], p2: s.games[1], tb: [...s.tbPoints] });
      s.finished = true;
    }
    return;
  }

  if (s.inTB) {
    s.tbPoints[winner]++;
    if (s.tbPoints[winner] >= s.rules.tbTo && s.tbPoints[winner] - s.tbPoints[loser] >= 2) {
      s.games[winner]++;
      s.inTB = false;
      s.tbPoints = [0, 0];
    }
  } else {
    s.points[winner]++;
    if (s.points[winner] >= 4 && s.points[winner] - s.points[loser] >= 2) {
      s.games[winner]++;
      s.points = [0, 0];

      if (s.games[winner] === 6 && s.games[loser] === 6) {
        if (s.sets.length === 2 && s.rules.superTB) {
          s.superTB = true;
        } else {
          s.inTB = true;
        }
      }

      if (s.games[winner] >= 6 && s.games[winner] - s.games[loser] >= 2) {
        s.sets.push({ p1: s.games[0], p2: s.games[1] });
        s.games = [0, 0];
        if (s.sets.length === 2) {
          if (s.rules.superTB) {
            s.superTB = true;
          } else {
            s.finished = true;
          }
        }
      }
    } else if (s.points[winner] === s.points[loser] && s.points[winner] >= 3) {
      // retour à égalité après avantage
      s.points = [3, 3];
    }
  }
}

function serializeScore(s) {
  return { sets: s.sets };
}

function formatCurrent(state) {
  if (!state) return "";
  if (state.superTB || state.inTB) {
    return `Tie-break: ${state.tbPoints[0]}-${state.tbPoints[1]}`;
  }
  const labels = ["0","15","30","40","Ad"];
  return `${labels[state.points[0]] || 0}-${labels[state.points[1]] || 0}`;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function playerName(id) {
  const p = DB.players.find(p => p.id === id);
  return p ? `${p.firstName} ${p.lastName}` : "???";
}

function refreshPlayers() {
  const list = document.getElementById("playersList");
  list.innerHTML = "";
  PlayersService.list().forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.firstName} ${p.lastName} (${p.license || "-"})`;
    list.appendChild(li);
  });

  // options for pair form
  const opts = PlayersService.list()
    .map(p => `<option value="${p.id}">${p.firstName} ${p.lastName}</option>`)
    .join("");
  document.querySelector("#pairForm select[name='p1']").innerHTML = opts;
  document.querySelector("#pairForm select[name='p2']").innerHTML = opts;
}

function refreshPairs() {
  const list = document.getElementById("pairsList");
  list.innerHTML = "";
  PairsService.list().forEach(pr => {
    const li = document.createElement("li");
    li.textContent = `${pr.p1Name} / ${pr.p2Name}` +
      (pr.seed ? ` (TS ${pr.seed})` : "");
    list.appendChild(li);
  });
}

function refreshTournaments() {
  const list = document.getElementById("tournamentsList");
  list.innerHTML = "";
  const opts = [];
  TournamentsService.list().forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.name} (${t.category})`;
    list.appendChild(li);
    opts.push(`<option value="${t.id}">${t.name}</option>`);
  });
  document.getElementById("tournamentSelect").innerHTML = `<option value="">-- choisir --</option>` + opts.join("");
  document.querySelector("#matchForm select[name='tournamentId']").innerHTML = `<option value="">Tournoi</option>` + opts.join("");
}

function refreshMatches() {
  const sel = document.getElementById("matchSelect");
  sel.innerHTML = `<option value="">-- choisir --</option>` +
    MatchesService.list().map(m => {
      const p1 = pairLabel(m.pair1Id);
      const p2 = pairLabel(m.pair2Id);
      return `<option value="${m.id}">${p1} vs ${p2}</option>`;
    }).join("");
}

function pairLabel(id) {
  const pr = DB.pairs.find(p => p.id === id);
  if (!pr) return "?";
  return `${playerName(pr.p1)} / ${playerName(pr.p2)}`;
}

function refreshRegistrations(tournamentId) {
  const box = document.getElementById("registrationBox");
  if (!tournamentId) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const list = document.getElementById("registrationList");
  list.innerHTML = "";
  const regs = TournamentsService.registrations(tournamentId);
  regs.forEach(r => {
    const li = document.createElement("li");
    li.textContent = pairLabel(r.pairId);
    list.appendChild(li);
  });

  const registered = regs.map(r => r.pairId);
  const opts = PairsService.list()
    .filter(pr => !registered.includes(pr.id))
    .map(pr => `<option value="${pr.id}">${pr.p1Name} / ${pr.p2Name}</option>`) 
    .join("");
  document.querySelector("#registrationForm select[name='pairId']").innerHTML = `<option value="">Paire</option>` + opts;
}

function refreshMatchFormPairs() {
  const tId = document.querySelector("#matchForm select[name='tournamentId']").value;
  const regs = TournamentsService.registrations(tId);
  const opts = regs.map(r => {
    const pr = DB.pairs.find(p => p.id === r.pairId);
    return `<option value="${pr.id}">${pairLabel(pr.id)}</option>`;
  }).join("");
  document.querySelector("#matchForm select[name='pair1Id']").innerHTML = `<option value="">Paire 1</option>` + opts;
  document.querySelector("#matchForm select[name='pair2Id']").innerHTML = `<option value="">Paire 2</option>` + opts;
}

function getTournamentRules(id) {
  const t = TournamentsService.get(id);
  return t ? t.rules : { superTB: false, tbTo: 7, superTBTo: 10 };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------
document.getElementById("playerForm").onsubmit = e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  PlayersService.add(data);
  e.target.reset();
  refreshPlayers();
};

document.getElementById("pairForm").onsubmit = e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const p1 = fd.get("p1"), p2 = fd.get("p2");
  if (p1 === p2) return alert("Joueurs identiques !");
  PairsService.add(p1, p2, fd.get("seed"));
  e.target.reset();
  refreshPairs();
};

document.getElementById("tournamentForm").onsubmit = e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.superTB = !!data.superTB;
  TournamentsService.add(data);
  e.target.reset();
  refreshTournaments();
};

document.getElementById("tournamentSelect").onchange = e => {
  refreshRegistrations(e.target.value);
  refreshMatchFormPairs();
};

document.querySelector("#matchForm select[name='tournamentId']").onchange = () => {
  refreshMatchFormPairs();
};

document.getElementById("registrationForm").onsubmit = e => {
  e.preventDefault();
  const tId = document.getElementById("tournamentSelect").value;
  const fd = new FormData(e.target);
  const pairId = fd.get("pairId");
  if (!tId || !pairId) return;
  TournamentsService.register(tId, pairId);
  refreshRegistrations(tId);
  refreshMatchFormPairs();
  e.target.reset();
};

document.getElementById("matchSelect").onchange = e => {
  const id = e.target.value;
  if (!id) return document.getElementById("scoreboard").classList.add("hidden");
  const m = MatchesService.get(id);
  showMatch(m);
};

document.getElementById("matchForm").onsubmit = e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const tId = fd.get("tournamentId");
  const p1 = fd.get("pair1Id");
  const p2 = fd.get("pair2Id");
  if (!tId || !p1 || !p2 || p1 === p2) return alert("Sélection invalide");
  const match = {
    id: "m" + Date.now(),
    tournamentId: tId,
    pair1Id: p1,
    pair2Id: p2,
    status: "scheduled",
    state: initState(getTournamentRules(tId)),
    score: { sets: [] }
  };
  MatchesService.add(match);
  e.target.reset();
  refreshMatches();
  document.getElementById("matchSelect").value = match.id;
  showMatch(match);
};

document.getElementById("p1Point").onclick = () => {
  const m = currentMatch();
  if (m) { ScoringEngine.applyPoint(m, 0); MatchesService.update(m); showMatch(m); }
};
document.getElementById("p2Point").onclick = () => {
  const m = currentMatch();
  if (m) { ScoringEngine.applyPoint(m, 1); MatchesService.update(m); showMatch(m); }
};
document.getElementById("undo").onclick = () => {
  const m = currentMatch();
  if (m) { ScoringEngine.undo(m); MatchesService.update(m); showMatch(m); }
};
document.getElementById("finish").onclick = () => {
  const m = currentMatch();
  if (m) { m.state.finished = true; MatchesService.update(m); showMatch(m); }
};

function currentMatch() {
  const id = document.getElementById("matchSelect").value;
  return MatchesService.get(id);
}
function showMatch(m) {
  document.getElementById("scoreboard").classList.remove("hidden");
  document.getElementById("matchTitle").textContent =
    `${pairLabel(m.pair1Id)} vs ${pairLabel(m.pair2Id)}`;
  const current = document.getElementById("current");
  current.textContent = formatCurrent(m.state);

  const sets = document.getElementById("sets");
  sets.innerHTML = "";
  (m.score?.sets || []).forEach((s, i) => {
    const div = document.createElement("div");
    div.textContent = `Set ${i+1}: ${s.p1}-${s.p2}`;
    sets.appendChild(div);
  });
}

// Navigation
document.querySelectorAll("nav button").forEach(btn => {
  btn.onclick = () => showView(btn.dataset.view);
});
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById("view-"+name).classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Import / Export / Reset / Seed
// ---------------------------------------------------------------------------
document.getElementById("export").onclick = () => {
  document.getElementById("jsonOut").value = JSON.stringify(DB, null, 2);
};
document.getElementById("import").onclick = () =>
  document.getElementById("importFile").click();
document.getElementById("importFile").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then(txt => {
    DB = JSON.parse(txt);
    saveDB();
    init();
  });
};
document.getElementById("reset").onclick = () => {
  if (confirm("Effacer toutes les données ?")) {
    localStorage.removeItem(DB_KEY);
    DB = loadDB();
    init();
  }
};

document.getElementById("seed").onclick = () => {
  if (!confirm("Charger les données de démo ?")) return;
  DB = seedData();
  saveDB();
  init();
};

function seedData() {
  const players = [
    {id:"p1",firstName:"Alice",lastName:"Leroy"},
    {id:"p2",firstName:"Benoît",lastName:"Moreau"},
    {id:"p3",firstName:"Chloé",lastName:"Dubois"},
    {id:"p4",firstName:"David",lastName:"Petit"}
  ];
  const pairs = [
    {id:"pr1",p1:"p1",p2:"p2",seed:1},
    {id:"pr2",p1:"p3",p2:"p4",seed:2}
  ];
  const tournaments = [{
    id:"t1",name:"Open Démo",startDate:"2025-08-21",endDate:"2025-08-23",
    category:"P100",rules:{superTB:true,tbTo:7,superTBTo:10},
    format:{hasGroups:false,groupsCount:0,hasBracket:false,bracketSize:0},
    registrations:[{pairId:"pr1",status:"accepted"},{pairId:"pr2",status:"accepted"}],
    groups:[],bracket:null,matchIds:["m1"]
  }];
  const matches = [{
    id:"m1",tournamentId:"t1",pair1Id:"pr1",pair2Id:"pr2",status:"scheduled",
    state:initState(tournaments[0].rules),score:{sets:[]}
  }];
  return { players, pairs, tournaments, matches };
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
function init() {
  refreshPlayers();
  refreshPairs();
  refreshTournaments();
  refreshRegistrations("");
  refreshMatchFormPairs();
  refreshMatches();
  showView("players");
}
init();
