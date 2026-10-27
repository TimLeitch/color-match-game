const SECTION_CAPACITY = 50;
// Eight high-contrast hues — no orange/red twins and no teal/green twins.
const COLORS = [
  { id: "citrus", name: "CITRUS", hex: "#ffeb3b", ink: "#1b2108" },
  { id: "amber", name: "AMBER", hex: "#ff6d00", ink: "#ffffff" },
  { id: "coral", name: "CORAL", hex: "#d50000", ink: "#ffffff" },
  { id: "fuchsia", name: "FUCHSIA", hex: "#ff1f8f", ink: "#ffffff" },
  { id: "plum", name: "PLUM", hex: "#6200ea", ink: "#ffffff" },
  { id: "blue", name: "BLUE", hex: "#2962ff", ink: "#ffffff" },
  { id: "sky", name: "SKY", hex: "#40c4ff", ink: "#062033" },
  { id: "mint", name: "MINT", hex: "#00c853", ink: "#04150e" },
];
// Discrete yard sizes shared by every track; each map caps how high it can go (max 20).
const DUMPSTER_OPTIONS = [4, 6, 8, 10, 12, 16, 20];
const TRACKS = [
  {
    id: "oval",
    name: "OVAL",
    dumpsters: [4, 12],
    path: "M50 6 C76 6 94 23 94 50 C94 77 76 94 50 94 C24 94 6 77 6 50 C6 23 24 6 50 6 Z",
  },
  {
    id: "round-square",
    name: "ROUND SQUARE",
    dumpsters: [4, 20],
    path: "M29 6 H71 Q94 6 94 29 V71 Q94 94 71 94 H29 Q6 94 6 71 V29 Q6 6 29 6 Z",
  },
  {
    id: "diamond",
    name: "DIAMOND",
    dumpsters: [4, 16],
    path: "M50 5 C60 14 88 40 95 50 C86 60 60 87 50 95 C40 86 13 60 5 50 C14 40 40 13 50 5 Z",
  },
  {
    id: "figure-eight",
    name: "FIGURE EIGHT",
    dumpsters: [4, 12],
    path: "M50 50 C14 28 20 5 50 5 C80 5 86 28 50 50 C14 72 20 95 50 95 C80 95 86 72 50 50 Z",
  },
];
const RACES = [
  {
    name: "SPRINT",
    speed: 34,
    capacity: 80,
    volumes: [25, 20, 15, 10],
    description:
      "Fast dispatches. Each color section carries a different load.",
  },
  {
    name: "ENDURANCE",
    speed: 25,
    capacity: 140,
    volumes: [30, 20, 15, 10],
    description: "A longer haul with room for a heavier convoy.",
  },
  {
    name: "RELAY",
    speed: 43,
    capacity: 100,
    volumes: [25, 20, 15, 10],
    description: "Quick handoffs. Match colors to build your streak.",
  },
];
// Card sizes from roomiest to tightest; the layout uses the largest that still rings the yard.
const CARD_SIZES = [
  { name: "lg", width: 200 },
  { name: "md", width: 150 },
  { name: "sm", width: 112 },
  { name: "xs", width: 84 },
];
const SVG_NS = "http://www.w3.org/2000/svg";
const yardElement = document.querySelector("#yard");
const trackMapElement = document.querySelector(".track-map");
const trackPaths = ["#track-shadow", "#track-lane", "#track-dashes"].map(
  (selector) => document.querySelector(selector),
);
const chutesElement = document.querySelector("#chutes");
const routeLayerElement = document.querySelector("#route-layer");
const routeElement = document.querySelector("#route");
const stationsElement = document.querySelector("#stations");
const ridersElement = document.querySelector("#track-riders");
const levelNumberElement = document.querySelector("#level-number");
const levelShapeElement = document.querySelector("#level-shape");
const sortedCountElement = document.querySelector("#sorted-count");
const sortedTotalElement = document.querySelector("#sorted-total");
const raceDetailsElement = document.querySelector("#race-details");
const trackStatElement = document.querySelector("#track-stat");
const trackCountElement = document.querySelector("#track-count");
const trackCapElement = document.querySelector("#track-cap");
const markersElement = document.querySelector("#track-markers");
const bestStreakElement = document.querySelector("#best-streak");
const yardStatusElement = document.querySelector("#yard-status");
const gameMessageElement = document.querySelector("#game-message");
const saveIndicatorElement = document.querySelector("#save-indicator");
const resetButton = document.querySelector("#reset-button");
const startOverButton = document.querySelector("#start-over-button");
// These mirror the CSS media queries: landscape phones get the compact layout, portrait phones get the rotate prompt.
const compactQuery = window.matchMedia(
  "(orientation: landscape) and (max-height: 520px)",
);
const portraitQuery = window.matchMedia(
  "(orientation: portrait) and (max-width: 700px)",
);
const isPaused = () => portraitQuery.matches;

// unlocked is the furthest level reached; it only ever goes up.
let unlocked = readUnlockedLevel();
let level = readStartLevel();
let plan;
let track;
let race;
let bins = [];
let riders = [];
let riderId = 0;
let sectionsPerBin = 4;
let trackLength = 0;
let sorted = 0;
let score = 0;
let streak = 0;
let bestStreak = readBestStreak();
let lastFrame = 0;
let finished = false;
// The dumpster whose next stack is picked up and waiting for a destination.
let selected = null;
let advanceId;
let lastReportedAt = 0;
let trackTable = { points: [], length: 1 };
let riderSize = 16;
let pendingSorted = null;
let lastSortedEventAt = 0;
let booted = false;

function readLocal(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

// Progress lives in this browser (no login needed). When hosted, the account save is checked too
// and the furthest progress wins, so a missing or late save can't send a player back to level 1.
function readUnlockedLevel(hostedSave = window.KG?.initialSave) {
  return Math.max(
    1,
    Number(hostedSave?.unlocked) || 0,
    Number(hostedSave?.level) || 0,
    readLocal("color-magic-unlocked"),
    readLocal("color-magic-level"),
  );
}

function readStartLevel() {
  const fromUrl = Math.floor(Number(new URLSearchParams(location.search).get("level")));
  if (fromUrl >= 1) return fromUrl;
  const current = Number(window.KG?.initialSave?.level) || readLocal("color-magic-level");
  return Math.min(unlocked, Math.max(1, current || unlocked));
}

function readBestStreak(hostedSave = window.KG?.initialSave) {
  return Math.max(Number(hostedSave?.bestStreak) || 0, readLocal("color-magic-best-streak"));
}

function saveProgress(savedLevel = level) {
  unlocked = Math.max(unlocked, savedLevel);
  const data = { level: savedLevel, unlocked, bestStreak };
  try {
    localStorage.setItem("color-magic-level", String(savedLevel));
    localStorage.setItem("color-magic-unlocked", String(unlocked));
    localStorage.setItem("color-magic-best-streak", String(bestStreak));
  } catch {}
  window.KG?.save?.(data);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(random() * (index + 1));
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function pickFromCycle(values, cycleSize, seedOffset) {
  const cycle = Math.floor((level - 1) / cycleSize);
  const position = (level - 1) % cycleSize;
  return shuffled(values, seededRandom(cycle + seedOffset))[position];
}

function createLevelPlan() {
  const random = seededRandom(level * 982451653);
  const levelTrack = pickFromCycle(TRACKS, TRACKS.length, 1847);
  const [fewest, most] = levelTrack.dumpsters;
  // Pick a discrete yard size (4 / 6 / 8 / … / 20); early levels stay toward the low end.
  const options = DUMPSTER_OPTIONS.filter(
    (count) => count >= fewest && count <= most,
  );
  const reach = Math.min(1, (level - 1) / 28);
  const unlocked = Math.max(1, Math.round(1 + (options.length - 1) * reach));
  const dumpsterCount =
    options[Math.floor(random() * unlocked)] ?? options[0] ?? 4;
  // At least 4 colors; climb toward 8 only when the yard has room for spare dumpsters.
  const spareBins = Math.max(1, Math.ceil(dumpsterCount / 5));
  const maxColors = Math.min(COLORS.length, 8, dumpsterCount);
  const minColors = Math.min(4, maxColors);
  const colorCeiling = Math.min(
    maxColors,
    Math.max(minColors, dumpsterCount - spareBins),
  );
  const colorCount =
    minColors + Math.floor(random() * (colorCeiling - minColors + 1));
  return {
    track: levelTrack,
    race: pickFromCycle(RACES, RACES.length, 7919),
    dumpsterCount,
    sectionsPerBin: 3,
    colorCount,
    scrambleMoves: Math.min(5 + Math.floor(colorCount / 2), 12),
    seed: Math.floor(random() * 0xffffffff),
  };
}

const colorById = (id) => COLORS.find((color) => color.id === id);
const binNumber = (bin) => String(bin.id + 1).padStart(2, "0");
const isFilled = (section) => section.amount + section.incoming > 0;
const trackRoom = () => race.capacity - riders.length;
// Distance a piece travels from one dock to another, always forward around the loop.
const routeSpan = (from, to) => (((to.progress - from.progress) % 1) + 1) % 1;
const riderProgress = (rider) => bins[rider.target].progress - rider.travel;

function binColors(bin) {
  return new Set(bin.sections.filter(isFilled).map((section) => section.color));
}

// The leftmost loaded section is the only one that can be released; while pieces are still landing in it, the dumpster waits.
function nextStack(bin) {
  return bin.sections.find(isFilled) || null;
}

function canPickUp(bin) {
  const stack = nextStack(bin);
  return Boolean(stack && stack.incoming === 0);
}

// Pieces top up matching sections first, then spill into empty ones.
function planDelivery(target, color, amount) {
  const matching = target.sections.filter(
    (section) => isFilled(section) && section.color === color,
  );
  const empty = target.sections.filter((section) => !isFilled(section));
  const deliveries = [];
  let remaining = amount;
  for (const section of [...matching, ...empty]) {
    if (remaining <= 0) break;
    const count = Math.min(
      remaining,
      SECTION_CAPACITY - section.amount - section.incoming,
    );
    if (count <= 0) continue;
    deliveries.push({ section, count, joins: isFilled(section) });
    remaining -= count;
  }
  return deliveries;
}

function deliverableAmount(source, target) {
  const stack = nextStack(source);
  if (!stack || source === target) return 0;
  return planDelivery(
    target,
    stack.color,
    Math.min(stack.amount, trackRoom()),
  ).reduce((sum, delivery) => sum + delivery.count, 0);
}

// Front stacks can swap in place when a send has nowhere to land.
function canSwap(source, target) {
  return (
    source !== target &&
    canPickUp(source) &&
    canPickUp(target) &&
    nextStack(source).color !== nextStack(target).color
  );
}

function countSorted() {
  return bins.filter((bin) => binColors(bin).size <= 1).length;
}

function hasAnyMove() {
  return bins.some(
    (source) =>
      canPickUp(source) &&
      bins.some(
        (target) =>
          target !== source &&
          (planDelivery(target, nextStack(source).color, 1).length > 0 ||
            canSwap(source, target)),
      ),
  );
}

// Samples the track in screen pixels so progress means equal pixel distance, even when the SVG is stretched.
function buildTrackTable() {
  const path = trackPaths[1];
  const matrix = path.getScreenCTM();
  const yardRect = yardElement.getBoundingClientRect();
  const originX = yardRect.left + yardElement.clientLeft;
  const originY = yardRect.top + yardElement.clientTop;
  const samples = 360;
  const points = [];
  let distance = 0;
  for (let index = 0; index <= samples; index += 1) {
    const raw = path.getPointAtLength((index / samples) * trackLength);
    const screen = new DOMPoint(raw.x, raw.y).matrixTransform(matrix);
    const x = screen.x - originX;
    const y = screen.y - originY;
    if (index > 0)
      distance += Math.hypot(x - points[index - 1].x, y - points[index - 1].y);
    points.push({ x, y, distance });
  }
  trackTable = { points, length: distance };
}

function pointOnTrack(progress) {
  const { points, length } = trackTable;
  const target = (((progress % 1) + 1) % 1) * length;
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].distance <= target) low = middle;
    else high = middle;
  }
  const from = points[low];
  const to = points[high];
  const t = (target - from.distance) / (to.distance - from.distance || 1);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

// A card docks where a line from the middle of the track out towards it meets the track, so docks spread
// along the track the same way the cards spread around the yard, even on pointed shapes like the diamond.
function dockProgress(position, box) {
  const target = Math.atan2(
    (position.y - box.y) / box.halfH,
    (position.x - box.x) / box.halfW,
  );
  let best = trackTable.points[0];
  let bestScore = Infinity;
  for (const point of trackTable.points) {
    const u = (point.x - box.x) / box.halfW;
    const v = (point.y - box.y) / box.halfH;
    // Skip the figure eight's crossing, which sits right in the middle.
    if (u * u + v * v < 0.04) continue;
    const turn = Math.abs(Math.atan2(v, u) - target);
    // Among points at almost the same angle, the one nearest the card wins.
    const score =
      Math.min(turn, Math.PI * 2 - turn) +
      Math.hypot(point.x - position.x, point.y - position.y) * 1e-5;
    if (score < bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return (best.distance / trackTable.length) % 1;
}

// Nudges sorted dock points apart so neighbouring markers never sit on top of each other.
function spreadDocks(docks, minGap) {
  if (docks.length < 2) return docks;
  for (let pass = 0; pass < 60; pass += 1) {
    let moved = false;
    for (let index = 0; index < docks.length; index += 1) {
      const next = (index + 1) % docks.length;
      const gap = (docks[next] - docks[index] + 1) % 1;
      if (gap >= minGap - 1e-6) continue;
      const push = (minGap - gap) / 2;
      docks[index] = (docks[index] - push + 1) % 1;
      docks[next] = (docks[next] + push) % 1;
      moved = true;
    }
    if (!moved) break;
  }
  return docks;
}

// Pieces shrink so a full track's worth of them fits end to end as one solid line.
function sizeRiders() {
  const largest = 20;
  riderSize = Math.max(
    8,
    Math.min(largest, (trackTable.length / race.capacity) * 0.95),
  );
  yardElement.style.setProperty("--rider-size", `${riderSize}px`);
}

function setTrackShape() {
  track = plan.track;
  trackMapElement.classList.toggle(
    "is-figure-eight",
    track.id === "figure-eight",
  );
  for (const path of trackPaths) path.setAttribute("d", track.path);
  trackLength = trackPaths[1].getTotalLength();
  levelShapeElement.textContent = track.name;
}

function createStationButton(bin, index) {
  const button = document.createElement("button");
  button.className = "station";
  button.type = "button";
  button.dataset.station = String(index);
  button.innerHTML = `<span class="station-heading"><span class="station-name"><span class="name-full">DUMPSTER </span><span class="name-num"></span></span><span class="station-count"></span></span><span class="dumpster"><span class="dumpster-sections"></span></span><span class="station-action"><span class="action-label"></span><span class="station-volume"><span class="volume-value"></span><span class="volume-unit"> PCS</span></span></span>`;
  button.querySelector(".name-num").textContent = binNumber(bin);
  button.querySelector(".dumpster-sections").append(
    ...bin.sections.map(() => {
      const section = document.createElement("span");
      section.className = "dumpster-section";
      const amount = document.createElement("span");
      amount.className = "section-amount";
      section.append(amount);
      return section;
    }),
  );
  button.addEventListener("click", () => chooseStation(bin.id));
  button.addEventListener("pointerenter", () => previewRoute(bin.id));
  button.addEventListener("pointerleave", () => previewRoute(null));
  button.addEventListener("focus", () => previewRoute(bin.id));
  button.addEventListener("blur", () => previewRoute(null));
  button.addEventListener("animationend", () =>
    button.classList.remove("is-denied"),
  );
  stationsElement.append(button);
  return button;
}

// Splits the cards between rows (top and bottom) and columns (left and right) and centres each group on its side.
function ringLayout(count, width, height, card, rowsFirst) {
  const { width: cardW, height: cardH, gap, margin, pad } = card;
  const across = Math.max(
    0,
    Math.floor((width - margin * 2 + gap) / (cardW + gap)),
  );
  const band = margin + cardH + gap;
  const down = Math.max(
    0,
    Math.floor((height - band * 2 + gap) / (cardH + gap)),
  );
  if (across * 2 + down * 2 < count) return null;
  const sides = {};
  const fill = (first, second, limit, total) => {
    sides[first] = Math.min(limit, Math.ceil(total / 2));
    sides[second] = Math.min(limit, total - sides[first]);
    return total - sides[first] - sides[second];
  };
  if (rowsFirst)
    fill("right", "left", down, fill("top", "bottom", across, count));
  else fill("top", "bottom", across, fill("right", "left", down, count));
  const spread = (total, from, span) =>
    Array.from(
      { length: total },
      (_, index) => from + ((index + 0.5) * span) / total,
    );
  const rowSpan = width - margin * 2;
  const columnSpan = height - band * 2;
  // Clockwise from the top-left so neighbouring cards stay neighbours around the ring.
  const positions = [
    ...spread(sides.top, margin, rowSpan).map((x) => ({
      x,
      y: margin + cardH / 2,
    })),
    ...spread(sides.right, band, columnSpan).map((y) => ({
      x: width - margin - cardW / 2,
      y,
    })),
    ...spread(sides.bottom, margin, rowSpan)
      .reverse()
      .map((x) => ({ x, y: height - margin - cardH / 2 })),
    ...spread(sides.left, band, columnSpan)
      .reverse()
      .map((y) => ({ x: margin + cardW / 2, y })),
  ];
  // Opposite sides share an inset so the track stays centred even when only one of them has cards.
  const vertical = sides.top || sides.bottom ? band + pad : pad;
  const horizontal =
    sides.left || sides.right ? margin + cardW + gap + pad : pad;
  const inset = {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  };
  const trackArea =
    Math.max(0, width - inset.left - inset.right) *
    Math.max(0, height - inset.top - inset.bottom);
  return { positions, inset, trackArea };
}

// Tries each card size from largest down and keeps whichever ring leaves the track the most room.
// On phones, prefer smaller cards so dumpsters sit outside a visible track instead of covering it.
function chooseLayout(count, width, height) {
  const compact = compactQuery.matches;
  const spacing = compact
    ? { gap: 3, margin: 3, pad: 10 }
    : { gap: 8, margin: 8, pad: 20 };
  const smallest = CARD_SIZES.length - 1;
  // Desktop starts roomy; phones start at sm and keep shrinking until the track has room.
  const preferred = compact
    ? 2
    : count <= 6
      ? 0
      : count <= 12
        ? 1
        : count <= 20
          ? 2
          : 3;
  const firstButton = stationsElement.children[0];
  const yardArea = width * height;
  const trackGoal = compact ? yardArea * 0.32 : 0;
  let best = null;
  for (let step = preferred; step <= smallest + (compact ? 8 : 4); step += 1) {
    const size = CARD_SIZES[Math.min(step, smallest)];
    // Past the smallest size, keep narrowing it until everything fits.
    const cardW = size.width * 0.9 ** Math.max(0, step - smallest);
    if (compact && cardW < 56) break;
    yardElement.dataset.card = size.name;
    yardElement.style.setProperty("--station-width", `${cardW}px`);
    const card = { ...spacing, width: cardW, height: firstButton.offsetHeight };
    const options = [true, false]
      .map((rowsFirst) => ringLayout(count, width, height, card, rowsFirst))
      .filter(Boolean)
      .sort((a, b) => b.trackArea - a.trackArea);
    if (!options.length) continue;
    const layout = options[0];
    if (!compact) return layout;
    if (!best || layout.trackArea > best.layout.trackArea)
      best = { layout, sizeName: size.name, cardW };
    if (layout.trackArea >= trackGoal) {
      yardElement.dataset.card = size.name;
      yardElement.style.setProperty("--station-width", `${cardW}px`);
      return layout;
    }
  }
  if (best) {
    yardElement.dataset.card = best.sizeName;
    yardElement.style.setProperty("--station-width", `${best.cardW}px`);
    return best.layout;
  }
  // A yard this small can't fit every card, so space them as if they were smaller and let neighbours overlap.
  const card = {
    ...spacing,
    width: CARD_SIZES[smallest].width,
    height: firstButton.offsetHeight,
  };
  for (let attempt = 0; attempt < 40; attempt += 1) {
    card.width *= 0.85;
    card.height *= 0.85;
    const layout = ringLayout(count, width, height, card, true);
    if (layout) return layout;
  }
  const { pad } = spacing;
  return {
    positions: Array.from({ length: count }, () => ({ x: width / 2, y: pad })),
    inset: { top: pad, bottom: pad, left: pad, right: pad },
  };
}

function placeStations() {
  if (!bins.length) return;
  const width = yardElement.clientWidth;
  const height = yardElement.clientHeight;
  if (!width || !height) return;
  const buttons = [...stationsElement.children];
  const { positions, inset } = chooseLayout(bins.length, width, height);
  const boxW = Math.max(120, width - inset.left - inset.right);
  const boxH = Math.max(100, height - inset.top - inset.bottom);
  trackMapElement.style.left = `${inset.left}px`;
  trackMapElement.style.top = `${inset.top}px`;
  trackMapElement.style.width = `${boxW}px`;
  trackMapElement.style.height = `${boxH}px`;
  buildTrackTable();
  sizeRiders();
  // Dumpsters are numbered in the direction pieces travel.
  const box = {
    x: inset.left + boxW / 2,
    y: inset.top + boxH / 2,
    halfW: boxW / 2,
    halfH: boxH / 2,
  };
  const docks = positions
    .map((position) => ({ position, progress: dockProgress(position, box) }))
    .sort((a, b) => a.progress - b.progress);
  const markerSize = markersElement.firstElementChild?.offsetWidth || 24;
  const spread = spreadDocks(
    docks.map((dock) => dock.progress),
    Math.min(
      0.8 / bins.length,
      Math.max((markerSize * 1.3) / trackTable.length, 0.45 / bins.length),
    ),
  );
  for (const layer of [chutesElement, routeLayerElement])
    layer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  bins.forEach((bin, index) => {
    const { position } = docks[index];
    bin.progress = spread[index];
    buttons[index].style.left = `${position.x}px`;
    buttons[index].style.top = `${position.y}px`;
    const dock = pointOnTrack(bin.progress);
    const chute = chutesElement.children[index];
    chute.setAttribute("x1", position.x);
    chute.setAttribute("y1", position.y);
    chute.setAttribute("x2", dock.x);
    chute.setAttribute("y2", dock.y);
    const marker = markersElement.children[index];
    marker.style.left = `${dock.x}px`;
    marker.style.top = `${dock.y}px`;
  });
  // Pieces still waiting inside a dumpster leave from wherever its dock now sits.
  for (const rider of riders)
    if (rider.wait > 0)
      rider.travel = routeSpan(bins[rider.source], bins[rider.target]);
  previewRoute(null);
}

// Build a solved yard, then undo it with legal pours so every deal stays solvable.
function fillSolvedDumpster(color, random) {
  // Leave one open section so scramble (and the player) always have a landing pad.
  const filled = Math.max(1, sectionsPerBin - 1);
  const chunks = shuffled([...race.volumes], random).slice(0, filled);
  return Array.from({ length: sectionsPerBin }, (_, index) => ({
    color: index < chunks.length ? color : null,
    amount: index < chunks.length ? chunks[index] : 0,
    incoming: 0,
  }));
}

function pourDirect(source, target, amount) {
  const stack = nextStack(source);
  if (!stack) return 0;
  const color = stack.color;
  const deliveries = planDelivery(target, color, amount);
  const moved = deliveries.reduce((sum, delivery) => sum + delivery.count, 0);
  if (!moved) return 0;
  stack.amount -= moved;
  if (stack.amount <= 0) {
    stack.color = null;
    stack.amount = 0;
  }
  for (const { section, count } of deliveries) {
    section.color = color;
    section.amount += count;
  }
  return moved;
}

function scrambleYard(random, moves) {
  for (let step = 0; step < moves; step += 1) {
    const sources = shuffled(
      bins.filter((bin) => canPickUp(bin)),
      random,
    );
    let poured = false;
    for (const source of sources) {
      const stack = nextStack(source);
      const targets = shuffled(
        bins.filter(
          (target) =>
            target !== source &&
            planDelivery(target, stack.color, 1).length > 0,
        ),
        random,
      );
      if (!targets.length) continue;
      // Prefer pouring into dumpsters that already hold another color — that creates the mix.
      const mixedFirst = [
        ...targets.filter((target) => binColors(target).size > 0),
        ...targets,
      ];
      const chunk = Math.min(
        stack.amount,
        race.volumes[Math.floor(random() * race.volumes.length)],
      );
      if (pourDirect(source, mixedFirst[0], Math.max(5, chunk)) > 0) {
        poured = true;
        break;
      }
    }
    if (!poured) break;
  }
}

function isYardMessy() {
  return countSorted() < bins.length && hasAnyMove();
}

function buildBins() {
  const dumpsterCount = plan.dumpsterCount;
  sectionsPerBin = plan.sectionsPerBin;
  const random = seededRandom(plan.seed);
  const palette = shuffled(COLORS, random).slice(0, plan.colorCount);
  // Solved start: one dumpster per color, spare dumpsters empty for working space.
  bins = Array.from({ length: dumpsterCount }, (_, index) => ({
    id: index,
    name: `Dumpster ${String(index + 1).padStart(2, "0")}`,
    progress: index / dumpsterCount,
    streamEnd: 0,
    sections:
      index < palette.length
        ? fillSolvedDumpster(palette[index].id, random)
        : Array.from({ length: sectionsPerBin }, () => ({
            color: null,
            amount: 0,
            incoming: 0,
          })),
  }));
  scrambleYard(random, plan.scrambleMoves);
  // Keep nudging until the yard is mixed but still has a legal move.
  for (let rescue = 0; rescue < 24 && !isYardMessy(); rescue += 1)
    scrambleYard(random, 3);
  // Shuffle dumpster seats so empties and mixes aren't always on the same side.
  bins = shuffled(bins, random).map((bin, index) => ({
    ...bin,
    id: index,
    name: `Dumpster ${String(index + 1).padStart(2, "0")}`,
  }));
  stationsElement.replaceChildren();
  bins.forEach(createStationButton);
  markersElement.replaceChildren(
    ...bins.map((bin) => {
      const marker = document.createElement("span");
      marker.className = "track-marker";
      marker.textContent = String(bin.id + 1);
      return marker;
    }),
  );
  chutesElement.replaceChildren(
    ...bins.map(() => {
      const chute = document.createElementNS(SVG_NS, "line");
      chute.setAttribute("class", "chute");
      return chute;
    }),
  );
  renderStations();
  placeStations();
  sortedTotalElement.textContent = `/ ${String(dumpsterCount).padStart(2, "0")}`;
  raceDetailsElement.textContent = `${race.name} / ${dumpsterCount} DUMPSTERS / ${plan.colorCount} COLORS`;
}

function newLevel(nextLevel = false) {
  clearTimeout(advanceId);
  flushSorted();
  if (nextLevel) level += 1;
  if (booted) saveProgress();
  plan = createLevelPlan();
  track = plan.track;
  race = plan.race;
  riders = [];
  riderId = 0;
  score = 0;
  streak = 0;
  selected = null;
  finished = false;
  levelNumberElement.textContent = String(level).padStart(2, "0");
  trackCapElement.textContent = `/ ${race.capacity}`;
  yardStatusElement.textContent =
    "TAP A DUMPSTER TO RELEASE ITS NEXT STACK - SEND OR SWAP";
  gameMessageElement.textContent = `${race.description} Sort every dumpster down to one color.`;
  setTrackShape();
  buildBins();
  sorted = countSorted();
  render();
  reportProgress(true);
}

function stationState(bin, stack) {
  const source = selected === null ? null : bins[selected];
  if (source === bin)
    return {
      name: "source",
      label: "CANCEL",
      volume: `${Math.min(stack.amount, trackRoom())}`,
      pieces: true,
    };
  if (source) {
    const amount = deliverableAmount(source, bin);
    if (amount)
      return { name: "target", label: "SEND HERE", volume: `+${amount}` };
    if (canSwap(source, bin))
      return {
        name: "swap",
        label: "SWAP",
        volume: `${nextStack(bin).amount}`,
        pieces: true,
      };
    return { name: "blocked", label: "NO ROOM", volume: "✕" };
  }
  if (finished) return { name: "off", label: "DONE", volume: "✓" };
  if (!stack) return { name: "off", label: "EMPTY", volume: "—" };
  if (stack.incoming > 0)
    return { name: "off", label: "RECEIVING", volume: "…" };
  if (trackRoom() <= 0 && !bins.some((target) => canSwap(bin, target)))
    return { name: "off", label: "TRACK FULL", volume: `${stack.amount}` };
  return {
    name: "ready",
    label: "RELEASE",
    volume: `${stack.amount}`,
    pieces: true,
  };
}

function renderStations() {
  const source = selected === null ? null : bins[selected];
  const sourceStack = source && nextStack(source);
  bins.forEach((bin, index) => {
    const button = stationsElement.children[index];
    const stack = nextStack(bin);
    const state = stationState(bin, stack);
    const sectionElements = button.querySelector(".dumpster-sections").children;
    bin.sections.forEach((section, sectionIndex) => {
      const element = sectionElements[sectionIndex];
      const color = isFilled(section) && colorById(section.color);
      element.classList.toggle("is-empty", !color);
      element.classList.toggle(
        "is-next",
        section === stack && state.name === "ready",
      );
      element.classList.toggle("is-picked", section === sourceStack);
      element.classList.toggle("is-incoming", section.incoming > 0);
      element.classList.toggle(
        "is-reserved",
        section.amount === 0 && section.incoming > 0,
      );
      element.style.setProperty("--swatch", color ? color.hex : "transparent");
      element.style.setProperty("--swatch-ink", color ? color.ink : "#14190f");
      element.firstChild.textContent =
        section.amount > 0 ? String(section.amount) : "";
    });
    const colors = binColors(bin);
    const pieces = bin.sections.reduce(
      (sum, section) => sum + section.amount,
      0,
    );
    button.querySelector(".station-count").textContent =
      colors.size === 0
        ? "EMPTY"
        : colors.size === 1
          ? "SORTED"
          : `${colors.size} COLORS`;
    button.querySelector(".action-label").textContent = state.label;
    button.querySelector(".volume-value").textContent = state.volume;
    button.classList.toggle("has-pieces", Boolean(state.pieces));
    for (const name of ["ready", "off", "source", "target", "swap", "blocked"])
      button.classList.toggle(`is-${name}`, state.name === name);
    button.classList.toggle("is-sorted", colors.size === 1);
    button.setAttribute(
      "aria-disabled",
      String(state.name === "off" || state.name === "blocked"),
    );
    const colorSummary = colors.size
      ? [...colors].map((id) => colorById(id).name).join(", ")
      : "empty";
    const action =
      state.name === "ready"
        ? `release ${stack?.amount} ${stack && colorById(stack.color).name} pieces`
        : state.name === "source"
          ? "picked up, activate again to cancel"
          : state.name === "target"
            ? `send ${state.volume.slice(1)} pieces here`
            : state.name === "swap"
              ? `swap next stacks (${state.volume} pieces)`
              : state.name === "blocked"
                ? "no room for this color"
                : state.label.toLowerCase();
    button.setAttribute(
      "aria-label",
      `${bin.name}, ${pieces} pieces, ${colorSummary}. ${action}`,
    );
    for (const element of [
      markersElement.children[index],
      chutesElement.children[index],
    ]) {
      element.classList.toggle("is-source", state.name === "source");
      element.classList.toggle("is-target", state.name === "target");
      element.classList.toggle("is-swap", state.name === "swap");
      element.classList.toggle("is-blocked", state.name === "blocked");
    }
  });
}

function renderRiders() {
  const existing = new Map(
    [...ridersElement.children].map((element) => [
      Number(element.dataset.rider),
      element,
    ]),
  );
  for (const rider of riders) {
    // Pieces still queued inside the dumpster haven't reached the track yet.
    if (rider.wait > 0) continue;
    let element = existing.get(rider.id);
    if (!element) {
      element = document.createElement("span");
      element.className = "rider";
      element.dataset.rider = String(rider.id);
      element.setAttribute("aria-hidden", "true");
      element.style.backgroundColor = colorById(rider.color).hex;
      ridersElement.append(element);
    }
    const point = pointOnTrack(riderProgress(rider));
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    existing.delete(rider.id);
  }
  for (const element of existing.values()) element.remove();
}

function render() {
  sortedCountElement.textContent = String(sorted).padStart(2, "0");
  trackCountElement.textContent = String(riders.length).padStart(2, "0");
  trackStatElement.classList.toggle("is-full", riders.length >= race.capacity);
  bestStreakElement.textContent = String(bestStreak).padStart(2, "0");
  renderStations();
  renderRiders();
}

// Highlights the stretch of track a stack would ride from the picked-up dumpster to this one.
function previewRoute(binId) {
  const source = selected === null ? null : bins[selected];
  const target = binId === null ? null : bins[binId];
  if (!source || !target || !deliverableAmount(source, target)) {
    routeElement.setAttribute("points", "");
    return;
  }
  const span = routeSpan(source, target);
  const steps = Math.max(2, Math.ceil(span * 240));
  routeElement.setAttribute(
    "points",
    Array.from({ length: steps + 1 }, (_, index) => {
      const point = pointOnTrack(source.progress + (span * index) / steps);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" "),
  );
}

function deny(bin, message) {
  const button = stationsElement.children[bin.id];
  button.classList.remove("is-denied");
  void button.offsetWidth;
  button.classList.add("is-denied");
  yardStatusElement.textContent = message;
}

function cancelSelection() {
  if (selected === null) return;
  selected = null;
  previewRoute(null);
  yardStatusElement.textContent =
    "STACK PUT BACK - TAP A DUMPSTER TO RELEASE ITS NEXT STACK";
  render();
}

function chooseStation(binId) {
  if (finished || isPaused()) return;
  const bin = bins[binId];
  if (selected === null) pickUp(bin);
  else if (selected === binId) cancelSelection();
  else if (deliverableAmount(bins[selected], bin))
    sendStack(bins[selected], bin);
  else if (canSwap(bins[selected], bin)) swapStacks(bins[selected], bin);
  else sendStack(bins[selected], bin);
}

function pickUp(bin) {
  const stack = nextStack(bin);
  if (!stack) return deny(bin, `DUMPSTER ${binNumber(bin)} IS EMPTY`);
  if (stack.incoming > 0)
    return deny(
      bin,
      `DUMPSTER ${binNumber(bin)} IS STILL RECEIVING - WAIT FOR IT TO LAND`,
    );
  const canSend =
    trackRoom() > 0 && bins.some((target) => deliverableAmount(bin, target));
  const canTrade = bins.some((target) => canSwap(bin, target));
  if (!canSend && !canTrade) {
    if (trackRoom() <= 0)
      return deny(bin, "TRACK FULL - WAIT FOR PIECES TO LAND");
    return deny(bin, `NO DUMPSTER HAS ROOM FOR ${colorById(stack.color).name}`);
  }
  selected = bin.id;
  const colorName = colorById(stack.color).name;
  const amount = canSend ? Math.min(stack.amount, trackRoom()) : stack.amount;
  yardStatusElement.textContent = canSend
    ? `${amount} ${colorName} READY - TAP WHERE TO SEND, OR SWAP`
    : `NO ROOM TO SEND ${colorName} - TAP A DUMPSTER TO SWAP STACKS`;
  render();
}

function swapStacks(source, target) {
  const sourceStack = nextStack(source);
  const targetStack = nextStack(target);
  const fromColor = sourceStack.color;
  const toColor = targetStack.color;
  const fromAmount = sourceStack.amount;
  const toAmount = targetStack.amount;
  // Exchange the front stacks in place — no track ride.
  sourceStack.color = toColor;
  sourceStack.amount = toAmount;
  targetStack.color = fromColor;
  targetStack.amount = fromAmount;
  selected = null;
  previewRoute(null);
  sorted = countSorted();
  yardStatusElement.textContent = `SWAPPED ${binNumber(source)} ${colorById(fromColor).name} ↔ ${binNumber(target)} ${colorById(toColor).name}`;
  window.KG?.event("stacks_swapped", {
    level,
    station: source.id + 1,
    target: target.id + 1,
    fromColor,
    toColor,
  });
  window.KG?.setStatus(
    `Level ${level} · ${sorted}/${bins.length} sorted · ${riders.length} on track`,
  );
  render();
  reportProgress(true);
  if (sorted === bins.length && riders.length === 0) finishRace();
}

function sendStack(source, target) {
  const stack = nextStack(source);
  const colorName = colorById(stack.color).name;
  const deliveries = planDelivery(
    target,
    stack.color,
    Math.min(stack.amount, trackRoom()),
  );
  const amount = deliveries.reduce((sum, delivery) => sum + delivery.count, 0);
  if (!amount)
    return deny(
      target,
      `DUMPSTER ${binNumber(target)} HAS NO ${colorName} SECTION WITH ROOM AND NO EMPTY SECTION`,
    );
  stack.amount -= amount;
  // Pieces leave one by one, a piece-width apart, so the stack becomes a solid line that keeps moving.
  const pieceGap = riderSize / ((race.speed / trackLength) * trackTable.length);
  const travel = routeSpan(source, target);
  let wait = source.streamEnd;
  for (const { section, count, joins } of deliveries) {
    section.color = stack.color;
    section.incoming += count;
    for (let index = 0; index < count; index += 1) {
      riders.push({
        id: riderId++,
        color: stack.color,
        source: source.id,
        target: target.id,
        section: target.sections.indexOf(section),
        // The first piece into an empty section opens a new color home; the rest of that stream match it.
        matched: joins || index > 0,
        travel,
        wait,
      });
      wait += pieceGap;
    }
  }
  source.streamEnd = wait;
  selected = null;
  previewRoute(null);
  sorted = countSorted();
  yardStatusElement.textContent = `${amount} ${colorName} RELEASED FROM ${binNumber(source)} - HEADING TO ${binNumber(target)}`;
  window.KG?.event("color_released", {
    level,
    station: source.id + 1,
    target: target.id + 1,
    color: stack.color,
    amount,
    race: race.name,
  });
  window.KG?.setStatus(
    `Level ${level} · ${sorted}/${bins.length} sorted · ${riders.length} on track`,
  );
  render();
  reportProgress(true);
}

function dockRider(rider) {
  const bin = bins[rider.target];
  const section = bin.sections[rider.section];
  section.amount += 1;
  section.incoming -= 1;
  if (rider.matched) {
    streak += 1;
    score += 15 + Math.min(streak, 10);
    if (streak > bestStreak) {
      bestStreak = streak;
      saveProgress();
    }
  } else {
    streak = 0;
    score += 5;
  }
  if (section.incoming > 0) return;
  // Announce once the whole stream has landed rather than piece by piece.
  const colorName = colorById(rider.color).name;
  const sortedNow = binColors(bin).size === 1;
  const message = sortedNow
    ? `DUMPSTER ${binNumber(bin)} SORTED - ALL ${colorName}`
    : `${colorName} LANDED IN ${binNumber(bin)} - STREAK ${streak}`;
  // Don't talk over the prompt while the player is choosing a destination.
  if (selected === null) yardStatusElement.textContent = message;
  gameMessageElement.textContent = sortedNow
    ? `Dumpster ${binNumber(bin)} holds only ${colorName.toLowerCase()} now.`
    : `${streak} matching ${streak === 1 ? "piece" : "pieces"} in a row.`;
}

function reportProgress(force = false) {
  const now = performance.now();
  if (!force && now - lastReportedAt < 350) return;
  lastReportedAt = now;
  saveIndicatorElement.textContent = window.KG ? "ACCOUNT SAVE" : "SAVED";
  saveIndicatorElement.classList.remove("is-error", "is-saved");
  window.KG?.report({
    level,
    score,
    sorted,
    bestStreak,
    onTrack: riders.length,
    race: race.name,
    dumpsters: bins.length,
  });
}

function finishRace() {
  if (finished) return;
  flushSorted();
  finished = true;
  selected = null;
  previewRoute(null);
  yardStatusElement.textContent = `LEVEL ${String(level).padStart(2, "0")} COMPLETE - NEXT TRACK UP`;
  gameMessageElement.textContent = `All ${bins.length} dumpsters sorted on the ${track.name.toLowerCase()} with ${score} points.`;
  window.KG?.event("race_won", {
    level,
    race: race.name,
    track: track.name,
    score,
    sorted,
  });
  // Save the next level right away so a refresh during the win banner doesn't lose it.
  saveProgress(level + 1);
  advanceId = window.setTimeout(() => newLevel(true), 2200);
  render();
  reportProgress();
}

function flushSorted() {
  if (!pendingSorted) return;
  window.KG?.event("pieces_sorted", {
    level,
    amount: pendingSorted.amount,
    stations: [...pendingSorted.stations],
    colors: [...pendingSorted.colors],
    score,
  });
  pendingSorted = null;
  lastSortedEventAt = performance.now();
}

function updateRiders(deltaSeconds) {
  const lapsPerSecond = race.speed / trackLength;
  for (const bin of bins)
    bin.streamEnd = Math.max(0, bin.streamEnd - deltaSeconds);
  const landed = [];
  for (let riderIndex = riders.length - 1; riderIndex >= 0; riderIndex -= 1) {
    const rider = riders[riderIndex];
    let moveSeconds = deltaSeconds;
    if (rider.wait > 0) {
      rider.wait -= deltaSeconds;
      if (rider.wait > 0) continue;
      // Carry the leftover time so the gap between pieces stays even.
      moveSeconds = -rider.wait;
      rider.wait = 0;
    }
    rider.travel -= lapsPerSecond * moveSeconds;
    if (rider.travel > 0) continue;
    riders.splice(riderIndex, 1);
    landed.push(rider);
  }
  if (!landed.length) return;
  landed.sort((a, b) => a.id - b.id);
  pendingSorted ??= { amount: 0, stations: new Set(), colors: new Set() };
  for (const rider of landed) {
    dockRider(rider);
    pendingSorted.amount += 1;
    pendingSorted.stations.add(rider.target + 1);
    pendingSorted.colors.add(rider.color);
  }
  if (performance.now() - lastSortedEventAt > 750) flushSorted();
  sorted = countSorted();
  window.KG?.setStatus(
    `Level ${level} · ${sorted}/${bins.length} sorted · ${riders.length} on track`,
  );
  if (sorted === bins.length && riders.length === 0) {
    finishRace();
    return;
  }
  if (riders.length === 0 && selected === null && !hasAnyMove())
    yardStatusElement.textContent = "NO MOVES LEFT - TAP ↻ TO RELOAD THE YARD";
  render();
  reportProgress();
}

function animate(timestamp) {
  const deltaSeconds = lastFrame
    ? Math.min((timestamp - lastFrame) / 1000, 0.05)
    : 0;
  lastFrame = timestamp;
  if (deltaSeconds > 0 && riders.length && !finished && !isPaused())
    updateRiders(deltaSeconds);
  renderRiders();
  requestAnimationFrame(animate);
}

const relayout = () =>
  requestAnimationFrame(() => {
    placeStations();
    renderRiders();
  });
resetButton.addEventListener("click", () => newLevel(false));
startOverButton.addEventListener("click", () => {
  level = 1;
  newLevel(false);
});
// Tapping the open yard or pressing Escape puts a picked-up stack back.
yardElement.addEventListener("click", (event) => {
  if (!event.target.closest(".station")) cancelSelection();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") cancelSelection();
});
window.addEventListener("resize", relayout);
compactQuery.addEventListener("change", relayout);
window.KG?.setStatus(`Level ${level} · ${track?.name || "starting"}`);
newLevel(false);
booted = true;
requestAnimationFrame(animate);
