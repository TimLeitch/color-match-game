const BIN_CAPACITY = 5;
const SECTION_CAPACITY = 50;
const COLORS = [
  { id: "citrus", name: "CITRUS", hex: "#d4e84d", ink: "#1b2108" },
  { id: "coral", name: "CORAL", hex: "#ef795d", ink: "#2a0f08" },
  { id: "sky", name: "SKY", hex: "#78bdd1", ink: "#0b2630" },
  { id: "blue", name: "BLUE", hex: "#3f63bd", ink: "#ffffff" },
];
const TRACKS = [
  {
    id: "oval",
    name: "OVAL",
    path: "M50 6 C76 6 94 23 94 50 C94 77 76 94 50 94 C24 94 6 77 6 50 C6 23 24 6 50 6 Z",
  },
  {
    id: "round-square",
    name: "ROUND SQUARE",
    path: "M29 6 H71 Q94 6 94 29 V71 Q94 94 71 94 H29 Q6 94 6 71 V29 Q6 6 29 6 Z",
  },
  {
    id: "diamond",
    name: "DIAMOND",
    path: "M50 5 C60 14 88 40 95 50 C86 60 60 87 50 95 C40 86 13 60 5 50 C14 40 40 13 50 5 Z",
  },
  {
    id: "figure-eight",
    name: "FIGURE EIGHT",
    path: "M50 50 C14 28 20 5 50 5 C80 5 86 28 50 50 C14 72 20 95 50 95 C80 95 86 72 50 50 Z",
  },
];
const RACES = [
  {
    name: "SPRINT",
    seconds: 120,
    speed: 34,
    capacity: 80,
    volumes: [50, 20, 10, 5, 15],
    description:
      "Fast dispatches. Each color section carries a different load.",
  },
  {
    name: "ENDURANCE",
    seconds: 180,
    speed: 25,
    capacity: 140,
    volumes: [50, 25, 20, 15, 10],
    description: "A longer haul with room for a heavier convoy.",
  },
  {
    name: "RELAY",
    seconds: 150,
    speed: 43,
    capacity: 100,
    volumes: [50, 30, 15, 10, 5],
    description: "Quick handoffs. Match colors to build your streak.",
  },
];
const yardElement = document.querySelector("#yard");
const trackMapElement = document.querySelector(".track-map");
const trackPaths = ["#track-shadow", "#track-lane", "#track-dashes"].map(
  (selector) => document.querySelector(selector),
);
const stationsElement = document.querySelector("#stations");
const ridersElement = document.querySelector("#track-riders");
const levelNumberElement = document.querySelector("#level-number");
const levelShapeElement = document.querySelector("#level-shape");
const sortedCountElement = document.querySelector("#sorted-count");
const sortedTotalElement = document.querySelector("#sorted-total");
const raceClockElement = document.querySelector("#race-clock");
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
// These mirror the CSS media queries: landscape phones get the compact layout, portrait phones get the rotate prompt.
const compactQuery = window.matchMedia(
  "(orientation: landscape) and (max-height: 520px)",
);
const portraitQuery = window.matchMedia(
  "(orientation: portrait) and (max-width: 700px)",
);
const isPaused = () => portraitQuery.matches;

let level = readSavedLevel();
let plan;
let track;
let race;
let bins = [];
let riders = [];
let riderId = 0;
let sectionsPerBin = BIN_CAPACITY;
let totalTokens = 0;
let trackLength = 0;
let sorted = 0;
let score = 0;
let streak = 0;
let bestStreak = readBestStreak();
let timeLeft = 0;
let lastFrame = 0;
let acceptingReleases = true;
let finished = false;
let timerId;
let advanceId;
let lastSavedAt = 0;
let trackTable = { points: [], length: 1 };
let riderSize = 16;
let pendingSorted = null;
let lastSortedEventAt = 0;

function readSavedLevel() {
  const hostedLevel = Number(window.KG?.initialSave?.level) || 1;
  if (window.KG) return hostedLevel;
  try {
    return Number(localStorage.getItem("color-magic-level")) || 1;
  } catch {
    return hostedLevel;
  }
}

function readBestStreak() {
  const hostedValue = Number(window.KG?.initialSave?.bestStreak) || 0;
  if (window.KG) return hostedValue;
  try {
    return Number(localStorage.getItem("color-magic-best-streak")) || 0;
  } catch {
    return hostedValue;
  }
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
  return {
    track: pickFromCycle(TRACKS, TRACKS.length, 1847),
    race: pickFromCycle(RACES, RACES.length, 7919),
    dumpsterCount: 3 + Math.floor(random() * 8),
    sectionsPerBin: 4 + Math.floor(random() * 2),
    seed: Math.floor(random() * 0xffffffff),
  };
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

// Pieces shrink so a full track's worth of them fits end to end as one solid line.
function sizeRiders() {
  const largest = compactQuery.matches ? 14 : 20;
  riderSize = Math.max(
    7,
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

function raceForLevel() {
  return plan.race;
}

function createStationButton(bin, index) {
  const button = document.createElement("button");
  button.className = "station";
  button.type = "button";
  button.dataset.station = String(index);
  button.innerHTML = `<span class="station-heading"><span class="station-name"><span class="name-full">DUMPSTER </span><span class="name-num"></span></span><span class="station-count"></span></span><span class="dumpster"><span class="dumpster-sections"></span></span><span class="station-action"><span class="action-label">RELEASE</span><span class="station-volume"></span></span>`;
  button.querySelector(".name-num").textContent = String(index + 1).padStart(
    2,
    "0",
  );
  button.addEventListener("click", () => releaseColor(bin.id));
  stationsElement.append(button);
  return button;
}

function frameSlots(width, height, cardW, cardH, gap, margin) {
  const across = Math.max(
    1,
    Math.floor((width - margin * 2 + gap) / (cardW + gap)),
  );
  const firstX =
    (width - (across * cardW + (across - 1) * gap)) / 2 + cardW / 2;
  const topY = margin + cardH / 2;
  const bottomY = height - margin - cardH / 2;
  const span = bottomY - topY - cardH - gap * 2;
  const rows = Math.max(0, Math.floor((span + gap) / (cardH + gap)));
  const sideY = (row) => topY + cardH / 2 + gap + ((row + 0.5) * span) / rows;
  const slots = [];
  for (let index = 0; index < across; index += 1)
    slots.push({ x: firstX + index * (cardW + gap), y: topY, group: "top" });
  for (let row = 0; row < rows; row += 1)
    slots.push({
      x: width - margin - cardW / 2,
      y: sideY(row),
      group: "right",
    });
  for (let index = across - 1; index >= 0; index -= 1)
    slots.push({
      x: firstX + index * (cardW + gap),
      y: bottomY,
      group: "bottom",
    });
  for (let row = rows - 1; row >= 0; row -= 1)
    slots.push({ x: margin + cardW / 2, y: sideY(row), group: "left" });
  return slots;
}

// Cards ring the yard (top, right, bottom, left) and the track fills the space left in the middle.
function frameLayout(count, width, height, cardH, gap, margin) {
  let cardW = 200;
  let slots = frameSlots(width, height, cardW, cardH, gap, margin);
  for (let attempt = 0; attempt < 5 && slots.length < count; attempt += 1) {
    cardW *= 0.88;
    slots = frameSlots(width, height, cardW, cardH, gap, margin);
  }
  const positions = Array.from(
    { length: count },
    (_, index) =>
      slots[
        Math.min(slots.length - 1, Math.floor((index * slots.length) / count))
      ],
  );
  const used = new Set(positions.map((slot) => slot.group));
  const inset = (group, size) =>
    used.has(group) ? margin + size + gap + 20 : 20;
  return {
    cardW,
    positions,
    inset: {
      top: inset("top", cardH),
      bottom: inset("bottom", cardH),
      left: inset("left", cardW),
      right: inset("right", cardW),
    },
  };
}

// Short landscape screens: cards stack in columns down both sides so the track keeps the full height.
function columnLayout(count, width, height, cardH, gap, margin) {
  const rows = Math.max(
    1,
    Math.floor((height - margin * 2 + gap) / (cardH + gap)),
  );
  const leftCount = Math.ceil(count / 2);
  const rightCount = count - leftCount;
  const leftColumns = Math.ceil(leftCount / rows);
  const rightColumns = Math.ceil(rightCount / rows);
  const cardW = Math.max(
    100,
    Math.min(128, (width - 260) / (2 * leftColumns) - gap - margin),
  );
  const side = (total, fromRight) =>
    Array.from({ length: total }, (_, index) => {
      const column = Math.floor(index / rows);
      const inColumn = Math.min(rows, total - column * rows);
      const top = (height - (inColumn * cardH + (inColumn - 1) * gap)) / 2;
      const offset = margin + cardW / 2 + column * (cardW + gap);
      return {
        x: fromRight ? width - offset : offset,
        y: top + (index % rows) * (cardH + gap) + cardH / 2,
      };
    });
  const edge = (columns) => margin + columns * (cardW + gap) + 12;
  return {
    cardW,
    positions: [...side(leftCount, false), ...side(rightCount, true)],
    inset: {
      top: 16,
      bottom: 16,
      left: edge(leftColumns),
      right: edge(rightColumns),
    },
  };
}

function placeMarkers() {
  [...markersElement.children].forEach((marker, index) => {
    const point = pointOnTrack(bins[index].progress);
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
  });
}

function placeStations() {
  if (!bins.length) return;
  const rect = yardElement.getBoundingClientRect();
  const compact = compactQuery.matches;
  const gap = compact ? 4 : 10;
  const margin = compact ? 4 : 8;
  const buttons = [...stationsElement.children];
  yardElement.style.setProperty("--station-width", compact ? "112px" : "200px");
  const cardH = buttons[0].offsetHeight;
  const layout = (compact ? columnLayout : frameLayout)(
    bins.length,
    rect.width,
    rect.height,
    cardH,
    gap,
    margin,
  );
  yardElement.style.setProperty("--station-width", `${layout.cardW}px`);
  layout.positions.forEach((position, index) => {
    buttons[index].style.left = `${position.x}px`;
    buttons[index].style.top = `${position.y}px`;
  });
  const { inset } = layout;
  trackMapElement.style.left = `${inset.left}px`;
  trackMapElement.style.top = `${inset.top}px`;
  trackMapElement.style.width = `${Math.max(120, rect.width - inset.left - inset.right)}px`;
  trackMapElement.style.height = `${Math.max(100, rect.height - inset.top - inset.bottom)}px`;
  buildTrackTable();
  sizeRiders();
  placeMarkers();
}

function buildBins() {
  const dumpsterCount = plan.dumpsterCount;
  sectionsPerBin = plan.sectionsPerBin;
  const sectionCount = dumpsterCount * sectionsPerBin;
  const random = seededRandom(plan.seed);
  const colorLoad = shuffled(
    Array.from(
      { length: sectionCount },
      (_, index) =>
        COLORS[
          Math.floor(index / Math.ceil(sectionCount / COLORS.length)) %
            COLORS.length
        ].id,
    ),
    random,
  );
  bins = Array.from({ length: dumpsterCount }, (_, index) => ({
    id: index,
    name: `Dumpster ${String(index + 1).padStart(2, "0")}`,
    progress: index / dumpsterCount,
    streamEnd: 0,
    sections: colorLoad
      .slice(index * sectionsPerBin, (index + 1) * sectionsPerBin)
      .map((color, sectionIndex) => ({
        color,
        amount: race.volumes[(sectionIndex + index) % race.volumes.length],
      })),
  }));
  totalTokens = bins.reduce(
    (sum, bin) =>
      sum +
      bin.sections.reduce((binSum, section) => binSum + section.amount, 0),
    0,
  );
  stationsElement.replaceChildren();
  bins.forEach(createStationButton);
  markersElement.replaceChildren(
    ...bins.map((bin, index) => {
      const marker = document.createElement("span");
      marker.className = "track-marker";
      marker.textContent = String(index + 1);
      return marker;
    }),
  );
  renderStations();
  placeStations();
  sortedTotalElement.textContent = `/ ${String(totalTokens).padStart(2, "0")}`;
  raceDetailsElement.textContent = `${race.name} / ${dumpsterCount} DUMPSTERS / ${sectionsPerBin} SECTIONS`;
}

function newLevel(nextLevel = false) {
  clearInterval(timerId);
  clearTimeout(advanceId);
  flushSorted();
  if (nextLevel) level += 1;
  plan = createLevelPlan();
  track = plan.track;
  race = raceForLevel();
  riders = [];
  riderId = 0;
  sorted = 0;
  score = 0;
  streak = 0;
  acceptingReleases = true;
  finished = false;
  levelNumberElement.textContent = String(level).padStart(2, "0");
  trackCapElement.textContent = `/ ${race.capacity}`;
  yardStatusElement.textContent = `LEVEL ${String(level).padStart(2, "0")} - ${race.name} / ${track.name}`;
  gameMessageElement.textContent = race.description;
  setTrackShape();
  buildBins();
  timeLeft = race.seconds + Math.ceil(totalTokens / 10);
  render();
  saveProgress(true);
  timerId = window.setInterval(() => {
    flushSorted();
    if (finished || isPaused()) return;
    timeLeft -= 1;
    renderClock();
    if (timeLeft <= 0) finishRace(false);
  }, 1000);
}

function renderStations() {
  const canRelease =
    acceptingReleases && !finished && riders.length < race.capacity;
  bins.forEach((bin, index) => {
    const button = stationsElement.children[index];
    const nextIndex = bin.sections.findIndex((section) => section.amount > 0);
    const sections = button.querySelector(".dumpster-sections");
    sections.replaceChildren();
    for (
      let sectionIndex = 0;
      sectionIndex < sectionsPerBin;
      sectionIndex += 1
    ) {
      const stack = bin.sections[sectionIndex];
      const section = document.createElement("span");
      section.className = "dumpster-section";
      if (stack && stack.amount > 0) {
        const color = COLORS.find((item) => item.id === stack.color);
        section.style.setProperty("--swatch", color.hex);
        section.style.setProperty("--swatch-ink", color.ink);
        section.classList.toggle(
          "is-next",
          sectionIndex === nextIndex && canRelease,
        );
        section.setAttribute(
          "aria-label",
          `${color.name}, ${stack.amount} pieces`,
        );
        const amount = document.createElement("span");
        amount.className = "section-amount";
        amount.textContent = String(stack.amount);
        section.append(amount);
      } else {
        section.classList.add("is-empty");
      }
      sections.append(section);
    }
    const stackAmount = bin.sections.reduce(
      (sum, section) => sum + section.amount,
      0,
    );
    const nextStack = bin.sections.find((section) => section.amount > 0);
    button.querySelector(".station-count").textContent =
      `${bin.sections.filter((section) => section.amount > 0).length}/${sectionsPerBin} SECTIONS`;
    button.querySelector(".station-volume").textContent = nextStack
      ? `${nextStack.amount} PCS`
      : "EMPTY";
    button.disabled = !nextStack || !canRelease;
    button.setAttribute(
      "aria-label",
      `${bin.name}, ${bin.sections.filter((section) => section.amount > 0).length} active sections, ${stackAmount} pieces${nextStack ? `, release ${nextStack.amount} ${COLORS.find((color) => color.id === nextStack.color).name} pieces` : ", empty"}`,
    );
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
      element.style.backgroundColor = COLORS.find(
        (color) => color.id === rider.color,
      ).hex;
      ridersElement.append(element);
    }
    const point = pointOnTrack(rider.progress);
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    existing.delete(rider.id);
  }
  for (const element of existing.values()) element.remove();
}

function renderClock() {
  raceClockElement.textContent = String(Math.max(0, timeLeft)).padStart(2, "0");
  raceClockElement.classList.toggle("is-urgent", timeLeft <= 10);
}

function render() {
  sortedCountElement.textContent = String(sorted).padStart(2, "0");
  trackCountElement.textContent = String(riders.length).padStart(2, "0");
  trackStatElement.classList.toggle("is-full", riders.length >= race.capacity);
  bestStreakElement.textContent = String(bestStreak).padStart(2, "0");
  renderClock();
  renderStations();
  renderRiders();
}

function releaseColor(stationId) {
  const bin = bins[stationId];
  const stack = bin?.sections.find((section) => section.amount > 0);
  if (
    !acceptingReleases ||
    finished ||
    !stack ||
    riders.length >= race.capacity
  )
    return;
  const available = race.capacity - riders.length;
  const amount = Math.min(stack.amount, available);
  const colorId = stack.color;
  stack.amount -= amount;
  // Pieces leave one by one, a piece-width apart, so the stack becomes a solid line that keeps moving.
  const pieceGap = riderSize / ((race.speed / trackLength) * trackTable.length);
  const streamStart = bin.streamEnd;
  for (let index = 0; index < amount; index += 1) {
    riders.push({
      id: riderId++,
      color: colorId,
      source: stationId,
      progress: bin.progress,
      nextStation: (stationId + 1) % bins.length,
      laps: 0,
      wait: streamStart + index * pieceGap,
    });
  }
  bin.streamEnd = streamStart + amount * pieceGap;
  if (riders.length >= race.capacity) {
    acceptingReleases = false;
    yardStatusElement.textContent = "TRACK FULL - WAIT FOR A DUMPSTER TO CLEAR";
  } else {
    yardStatusElement.textContent = `${amount} ${COLORS.find((color) => color.id === colorId).name} PIECES RELEASED - FOLLOW THE ${track.name}`;
  }
  window.KG?.event("color_released", {
    level,
    station: stationId + 1,
    color: colorId,
    amount,
    race: race.name,
  });
  window.KG?.setStatus(
    `Level ${level} · ${sorted} sorted · ${riders.length} on track`,
  );
  render();
  saveProgress(true);
}

function canDock(rider, bin) {
  if (bin.id === rider.source && rider.laps === 0) return false;
  const matchingStack = bin.sections.find(
    (section) =>
      section.color === rider.color && section.amount < SECTION_CAPACITY,
  );
  const emptyStack = bin.sections.find((section) => section.amount === 0);
  if (matchingStack) return matchingStack;
  if (emptyStack) return emptyStack;
  return null;
}

function visitStation(rider, station) {
  const stack = canDock(rider, station);
  if (!stack) return false;
  const matched = stack.color === rider.color;
  stack.color = rider.color;
  stack.amount += 1;
  sorted += 1;
  if (matched) {
    streak += 1;
    score += 15 + Math.min(streak, 10);
    if (streak > bestStreak) {
      bestStreak = streak;
      try {
        localStorage.setItem("color-magic-best-streak", String(bestStreak));
      } catch {}
    }
    yardStatusElement.textContent = `${COLORS.find((color) => color.id === rider.color).name} MATCHED - STREAK ${streak}`;
    gameMessageElement.textContent = `${streak} matching ${streak === 1 ? "color" : "colors"} in a row.`;
  } else {
    streak = 0;
    score += 5;
    yardStatusElement.textContent = `NEW COLOR DOCKED IN ${station.name.toUpperCase()}`;
    gameMessageElement.textContent = "That empty dumpster is now a color home.";
  }
  rider.dockedAt = station.id;
  rider.matched = matched;
  return true;
}

function saveProgress(force = false) {
  const now = performance.now();
  if (!force && now - lastSavedAt < 350) return;
  lastSavedAt = now;
  const data = { level, bestStreak, score, sorted };
  try {
    localStorage.setItem("color-magic-level", String(level));
    localStorage.setItem("color-magic-save", JSON.stringify(data));
  } catch {}
  if (window.KG) {
    window.KG.save(data);
    window.KG.report({
      level,
      score,
      sorted,
      bestStreak,
      onTrack: riders.length,
      race: race.name,
      dumpsters: bins.length,
    });
    saveIndicatorElement.textContent =
      window.KG.saveState === "error" ? "SAVE ERROR" : "ACCOUNT SAVE";
    saveIndicatorElement.classList.toggle(
      "is-error",
      window.KG.saveState === "error",
    );
    saveIndicatorElement.classList.toggle(
      "is-saved",
      window.KG.saveState === "saved",
    );
  } else {
    saveIndicatorElement.textContent = "LOCAL GAME";
  }
}

function finishRace(won) {
  if (finished) return;
  flushSorted();
  finished = true;
  acceptingReleases = false;
  clearInterval(timerId);
  if (won) {
    yardStatusElement.textContent = `LEVEL ${String(level).padStart(2, "0")} COMPLETE - NEXT TRACK UP`;
    gameMessageElement.textContent = `${race.name} cleared on the ${track.name.toLowerCase()} with ${score} points.`;
    window.KG?.event("race_won", {
      level,
      race: race.name,
      track: track.name,
      score,
      sorted,
    });
    advanceId = window.setTimeout(() => newLevel(true), 2200);
  } else {
    yardStatusElement.textContent = "TIME UP - RESET TO RACE AGAIN";
    gameMessageElement.textContent = `You sorted ${sorted} of ${totalTokens} pieces. Try this track again.`;
    window.KG?.event("race_lost", {
      level,
      race: race.name,
      track: track.name,
      score,
      sorted,
    });
  }
  render();
  saveProgress();
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
  const docked = [];
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
    const advance = lapsPerSecond * moveSeconds;
    const oldProgress = rider.progress;
    rider.progress = (oldProgress + advance) % 1;
    const station = bins[rider.nextStation];
    const distance = (station.progress - oldProgress + 1) % 1;
    if (distance <= advance + 0.0001) {
      if (visitStation(rider, station)) {
        docked.push({ rider, station });
        riders.splice(riderIndex, 1);
        if (riders.length < race.capacity) acceptingReleases = true;
      }
      rider.nextStation = (rider.nextStation + 1) % bins.length;
      if (rider.nextStation === 0) rider.laps += 1;
    }
  }
  if (docked.length) {
    pendingSorted ??= { amount: 0, stations: new Set(), colors: new Set() };
    for (const { rider, station } of docked) {
      pendingSorted.amount += 1;
      pendingSorted.stations.add(station.id + 1);
      pendingSorted.colors.add(rider.color);
    }
    if (performance.now() - lastSortedEventAt > 750) flushSorted();
    window.KG?.setStatus(
      `Level ${level} · ${sorted} sorted · ${riders.length} on track`,
    );
    if (sorted === totalTokens && riders.length === 0) finishRace(true);
    else {
      render();
      saveProgress();
    }
  }
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
window.addEventListener("resize", relayout);
compactQuery.addEventListener("change", relayout);
window.KG?.setStatus(`Level ${level} · ${track?.name || "starting"}`);
newLevel(false);
requestAnimationFrame(animate);
