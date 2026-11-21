// ===== 1. DATA: what gets saved =====

const STORAGE_KEY = "gymTracker.data";
const UNITS = ["kg", "lb", "plates"];
const UNIT_LABELS = { kg: "kg", lb: "lb", plates: "pl" };

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  return { exercises: [], sessions: [] };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function newId(prefix) {
  return prefix + "-" + Date.now();
}

let data = loadData();

// --- Sessions ---

function createSession() {
  return {
    id: newId("session"),
    date: new Date().toLocaleDateString("en-CA"),
    name: "",
    notes: "",
    exercises: []
  };
}

function findSession(sessionId) {
  return data.sessions.find(function (s) {
    return s.id === sessionId;
  });
}

function deleteSession(sessionId) {
  data.sessions = data.sessions.filter(function (s) {
    return s.id !== sessionId;
  });
}

function isEmptySession(s) {
  return s.exercises.length === 0 && s.name === "" && s.notes === "";
}

function countSets(s) {
  let total = 0;
  s.exercises.forEach(function (entry) {
    total += entry.sets.length;
  });
  return total;
}

function getSessionNames() {
  const names = [];
  data.sessions.forEach(function (s) {
    if (s.name !== "" && !names.includes(s.name)) {
      names.push(s.name);
    }
  });
  return names;
}

// --- Exercise catalog ---

function findExercise(exerciseId) {
  return data.exercises.find(function (exercise) {
    return exercise.id === exerciseId;
  });
}

function createExercise(name) {
  const exercise = { id: newId("ex"), name: name, defaultUnit: "kg" };
  data.exercises.push(exercise);
  return exercise;
}

// --- Exercises and sets inside the open session ---

function addExerciseToSession(exerciseId) {
  session.exercises.push({ exerciseId: exerciseId, notes: "", sets: [] });
}

function removeExercise(exIndex) {
  session.exercises.splice(exIndex, 1);
}

function getSet(exIndex, setIndex) {
  return session.exercises[exIndex].sets[setIndex];
}

function addSet(exIndex) {
  const entry = session.exercises[exIndex];
  const lastSet = entry.sets[entry.sets.length - 1];
  const exercise = findExercise(entry.exerciseId);
  entry.sets.push({
    weight: lastSet ? lastSet.weight : null,
    unit: lastSet ? lastSet.unit : exercise.defaultUnit,
    reps: null,
    type: "normal"
  });
}

function cycleUnit(exIndex, setIndex) {
  const set = getSet(exIndex, setIndex);
  const position = UNITS.indexOf(set.unit);
  set.unit = UNITS[(position + 1) % UNITS.length];

  // Remember the last unit used as this exercise's default
  const exercise = findExercise(session.exercises[exIndex].exerciseId);
  exercise.defaultUnit = set.unit;
}

function toggleDrop(exIndex, setIndex) {
  const set = getSet(exIndex, setIndex);
  set.type = set.type === "drop" ? "normal" : "drop";
}

function deleteSet(exIndex, setIndex) {
  session.exercises[exIndex].sets.splice(setIndex, 1);
}

// ===== 2. UI STATE: what is on screen (not saved) =====

let view = "history";   // "history", "session" or "picker"
let session = null;     // the session currently open
let search = "";

// ===== 3. RENDER: draw the screen from the data =====

const app = document.getElementById("app");

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(isoDate) {
  // "T00:00" makes JavaScript read the date in local time, not UTC
  const date = new Date(isoDate + "T00:00");
  return date.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
}

function render() {
  if (view === "history") {
    renderHistory();
  } else if (view === "session") {
    renderSession();
  } else if (view === "picker") {
    renderPicker();
  }
}

function renderHistory() {
  let html = `<button class="primary" data-action="new-session">+ New session</button>`;

  const sorted = data.sessions.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  if (sorted.length === 0) {
    html += `<p class="empty">No sessions yet.</p>`;
  }

  sorted.forEach(function (s) {
    const title = s.name ? formatDate(s.date) + " · " + escapeHtml(s.name) : formatDate(s.date);
    html += `
      <button class="history-item" data-action="open-session" data-id="${s.id}">
        <strong>${title}</strong>
        <span>${s.exercises.length} exercises · ${countSets(s)} sets</span>
      </button>`;
  });

  app.innerHTML = html;
}

function renderSession() {
  let nameOptions = "";
  getSessionNames().forEach(function (name) {
    nameOptions += `<option value="${escapeHtml(name)}">`;
  });

  let html = `
    <button class="back" data-action="close-session">← History</button>
    <input type="date" class="field" value="${session.date}" data-field="session-date">
    <input type="text" class="field" list="session-names" autocomplete="off"
           placeholder="Session name (e.g. Upper 1)"
           value="${escapeHtml(session.name)}" data-field="session-name">
    <datalist id="session-names">${nameOptions}</datalist>`;

  session.exercises.forEach(function (entry, exIndex) {
    const exercise = findExercise(entry.exerciseId);

    html += `
      <section class="exercise">
        <div class="exercise-header">
          <h3>${escapeHtml(exercise.name)}</h3>
          <button class="delete" data-action="remove-exercise" data-ex="${exIndex}"
                  aria-label="Remove exercise">×</button>
        </div>`;

    if (entry.sets.length > 0) {
      html += `
        <div class="set-header">
          <span>Set</span><span>Weight</span><span>Unit</span><span>Reps</span><span></span>
        </div>`;
    }

    entry.sets.forEach(function (set, setIndex) {
      const dropClass = set.type === "drop" ? "is-drop" : "";
      html += `
        <div class="set-row ${dropClass}">
          <button class="set-number" data-action="toggle-drop"
                  data-ex="${exIndex}" data-set="${setIndex}">${setIndex + 1}</button>
          <input type="number" inputmode="decimal" step="any" placeholder="–"
                 value="${set.weight ?? ""}"
                 data-ex="${exIndex}" data-set="${setIndex}" data-field="weight">
          <button class="unit" data-action="cycle-unit"
                  data-ex="${exIndex}" data-set="${setIndex}">${UNIT_LABELS[set.unit]}</button>
          <input type="number" inputmode="numeric" placeholder="–"
                 value="${set.reps ?? ""}"
                 data-ex="${exIndex}" data-set="${setIndex}" data-field="reps">
          <button class="delete" data-action="delete-set" aria-label="Delete set"
                  data-ex="${exIndex}" data-set="${setIndex}">×</button>
        </div>`;
    });

    html += `
        <button class="add-set" data-action="add-set" data-ex="${exIndex}">+ Add set</button>
        <input type="text" class="field note" placeholder="Notes"
               value="${escapeHtml(entry.notes)}" data-ex="${exIndex}" data-field="entry-notes">
      </section>`;
  });

  html += `
    <button class="primary" data-action="open-picker">+ Add exercise</button>
    <input type="text" class="field note" placeholder="Session notes"
           value="${escapeHtml(session.notes)}" data-field="session-notes">
    <button class="danger" data-action="delete-session">Delete session</button>`;

  app.innerHTML = html;
}

function renderPicker() {
  app.innerHTML = `
    <button class="back" data-action="close-picker">← Cancel</button>
    <input id="search" class="search" type="text" autocomplete="off"
           placeholder="Search or create exercise" value="${escapeHtml(search)}">
    <div id="picker-list"></div>`;
  renderPickerList();
  document.getElementById("search").focus();
}

function renderPickerList() {
  const query = search.trim().toLowerCase();

  const matches = data.exercises
    .filter(function (exercise) {
      return exercise.name.toLowerCase().includes(query);
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

  let html = "";
  matches.forEach(function (exercise) {
    html += `<button class="picker-item" data-action="pick-exercise"
                     data-id="${exercise.id}">${escapeHtml(exercise.name)}</button>`;
  });

  const exactMatch = data.exercises.some(function (exercise) {
    return exercise.name.toLowerCase() === query;
  });
  if (query !== "" && !exactMatch) {
    html += `<button class="picker-item create" data-action="create-exercise">
               + Create "${escapeHtml(search.trim())}"</button>`;
  }

  if (html === "") {
    html = `<p class="empty">No exercises yet. Type a name to create one.</p>`;
  }

  document.getElementById("picker-list").innerHTML = html;
}

// ===== 4. EVENTS: react to what the user does =====

app.addEventListener("click", function (event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  const exIndex = Number(target.dataset.ex);
  const setIndex = Number(target.dataset.set);

  if (action === "new-session") {
    session = createSession();
    data.sessions.push(session);
    view = "session";
  } else if (action === "open-session") {
    session = findSession(target.dataset.id);
    view = "session";
  } else if (action === "close-session") {
    if (isEmptySession(session)) deleteSession(session.id);
    session = null;
    view = "history";
  } else if (action === "delete-session") {
    if (!confirm("Delete this whole session? This cannot be undone.")) return;
    deleteSession(session.id);
    session = null;
    view = "history";
  } else if (action === "add-set") {
    addSet(exIndex);
  } else if (action === "cycle-unit") {
    cycleUnit(exIndex, setIndex);
  } else if (action === "toggle-drop") {
    toggleDrop(exIndex, setIndex);
  } else if (action === "delete-set") {
    deleteSet(exIndex, setIndex);
  } else if (action === "remove-exercise") {
    const hasSets = session.exercises[exIndex].sets.length > 0;
    if (hasSets && !confirm("Remove this exercise and its sets?")) return;
    removeExercise(exIndex);
  } else if (action === "open-picker") {
    view = "picker";
    search = "";
  } else if (action === "close-picker") {
    view = "session";
  } else if (action === "pick-exercise") {
    addExerciseToSession(target.dataset.id);
    view = "session";
  } else if (action === "create-exercise") {
    const exercise = createExercise(search.trim());
    addExerciseToSession(exercise.id);
    view = "session";
  }

  saveData();
  render();
});

app.addEventListener("input", function (event) {
  const input = event.target;

  if (input.id === "search") {
    search = input.value;
    renderPickerList();
    return;
  }

  const field = input.dataset.field;
  const exIndex = Number(input.dataset.ex);
  const setIndex = Number(input.dataset.set);

  if (field === "session-date") {
    if (input.value !== "") session.date = input.value;
  } else if (field === "session-name") {
    session.name = input.value;
  } else if (field === "session-notes") {
    session.notes = input.value;
  } else if (field === "entry-notes") {
    session.exercises[exIndex].notes = input.value;
  } else {
    const value = input.value === "" ? null : Number(input.value);
    session.exercises[exIndex].sets[setIndex][field] = value;
  }

  saveData();
});

// ===== 5. START =====

render();
// Register the service worker (only if the browser supports it)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}