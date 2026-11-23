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

let idCounter = 0;

function newId(prefix) {
  // Date.now() alone repeats within the same millisecond; the counter never does
  idCounter++;
  return prefix + "-" + Date.now() + "-" + idCounter;
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

// --- Last time (previous session of the same exercise) ---

function findLastTime(exerciseId, currentSession) {
  let best = null;

  data.sessions.forEach(function (s) {
    // Only sessions dated before the open one
    if (s.date >= currentSession.date) {
      return;
    }

    // This exercise in that session, only if it has at least one set
    const entry = s.exercises.find(function (e) {
      return e.exerciseId === exerciseId && e.sets.length > 0;
    });
    if (!entry) {
      return;
    }

    // Keep it if it is more recent than the best one found so far
    if (best === null || s.date > best.date) {
      best = { date: s.date, entry: entry };
    }
  });

  return best;
}

function formatSets(sets) {
  // 1. Group consecutive sets with the same weight, unit and type
  const groups = [];

  sets.forEach(function (set) {
    const last = groups[groups.length - 1];
    const sameAsLast = last &&
      last.weight === set.weight &&
      last.unit === set.unit &&
      last.type === set.type;

    if (sameAsLast) {
      last.reps.push(set.reps);
    } else {
      groups.push({ weight: set.weight, unit: set.unit, type: set.type, reps: [set.reps] });
    }
  });

  // 2. Turn each group into text, e.g. "20 kg: 12-10-8"
  return groups.map(function (g) {
    const reps = g.reps.map(function (r) {
      return r ?? "?";
    }).join("-");
    const weight = g.weight === null ? "" : g.weight + " " + UNIT_LABELS[g.unit] + ": ";
    const drop = g.type === "drop" ? " (drop)" : "";
    return weight + reps + drop;
  }).join(" · ");
}
// --- Backup (CSV) ---

const CSV_COLUMNS = [
  "session_id", "date", "session", "session_notes",
  "exercise", "exercise_notes", "set", "weight", "unit", "reps", "type"
];

function csvCell(value) {
  // Missing values (null or undefined) become an empty cell
  if (value === null || value === undefined) return "";

  const text = String(value);
  const needsQuotes =
    text.includes(",") || text.includes('"') ||
    text.includes("\n") || text.includes("\r");

  if (needsQuotes) {
    // Wrap in quotes and double any quote inside: He said "hi" -> "He said ""hi"""
    return '"' + text.replaceAll('"', '""') + '"';
  }
  return text;
}

function csvRow(row) {
  // Take the values in the order of CSV_COLUMNS; missing ones become empty cells
  return CSV_COLUMNS.map(function (column) {
    return csvCell(row[column]);
  }).join(",");
}

function buildCsv() {
  const lines = [CSV_COLUMNS.join(",")];

  // Oldest first, like a logbook
  const sorted = data.sessions.slice().sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });

  sorted.forEach(function (s) {
    const sessionInfo = {
      session_id: s.id,
      date: s.date,
      session: s.name,
      session_notes: s.notes
    };

    // A session with no exercises still gets one row, so it is not lost
    if (s.exercises.length === 0) {
      lines.push(csvRow(sessionInfo));
    }

    s.exercises.forEach(function (entry) {
      const exerciseInfo = {
        ...sessionInfo,
        exercise: findExercise(entry.exerciseId).name,
        exercise_notes: entry.notes
      };

      // An exercise with no sets still gets one row, so its notes are not lost
      if (entry.sets.length === 0) {
        lines.push(csvRow(exerciseInfo));
      }

      entry.sets.forEach(function (set, setIndex) {
        lines.push(csvRow({
          ...exerciseInfo,
          set: setIndex + 1,
          weight: set.weight,
          unit: set.unit,
          reps: set.reps,
          type: set.type
        }));
      });
    });
  });

  return lines.join("\r\n");
}
function parseCsv(text) {
  // Remove the BOM if the file starts with it
  if (text.startsWith("\uFEFF")) {
    text = text.slice(1);
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // "" inside quotes means one real quote
          cell += '"';
          i++;   // skip the second quote
        } else {
          inQuotes = false;   // closing quote
        }
      } else {
        cell += char;   // commas and line breaks are plain text here
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (char === "\r") {
        // ignore: in "\r\n" the "\n" already ends the row
      } else {
        cell += char;
      }
    }
  }

  // The last row may not end with a line break
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}
function toNumber(text) {
  // Empty cell = no value; anything else becomes a number (NaN if it is not one)
  return text === "" ? null : Number(text);
}

function findOrPrepareExercise(name, unit, newExercises) {
  const key = name.trim().toLowerCase();
  const sameName = function (exercise) {
    return exercise.name.trim().toLowerCase() === key;
  };

  // Look in the real catalog first, then among the ones prepared in this import
  const existing = data.exercises.find(sameName) || newExercises.find(sameName);
  if (existing) return existing;

  const exercise = {
    id: newId("ex"),
    name: name.trim(),
    defaultUnit: UNITS.includes(unit) ? unit : "kg"
  };
  newExercises.push(exercise);   // NOT data.exercises: nothing is saved yet
  return exercise;
}

function readBackup(text) {
  // Skip blank lines (Excel sometimes adds one at the end)
  const rows = parseCsv(text).filter(function (cells) {
    return !(cells.length === 1 && cells[0] === "");
  });

  if (rows.length === 0 || rows[0].join(",") !== CSV_COLUMNS.join(",")) {
    return { error: "This doesn't look like a Gym Tracker backup." };
  }

  const sessions = [];
  const newExercises = [];
  const skippedIds = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const line = i + 1;   // line number as you would see it in the file

    if (cells.length !== CSV_COLUMNS.length) {
      return { error: "Line " + line + " has " + cells.length +
                      " columns instead of " + CSV_COLUMNS.length + "." };
    }

    // Turn the cells into an object: { session_id: "...", date: "...", ... }
    const row = {};
    CSV_COLUMNS.forEach(function (column, c) {
      row[column] = cells[c];
    });

    if (row.session_id === "" || row.date === "") {
      return { error: "Line " + line + " is missing the session id or date." };
    }

    // 1. Sessions already on this device are skipped: the device wins
    if (findSession(row.session_id)) {
      if (!skippedIds.includes(row.session_id)) skippedIds.push(row.session_id);
      continue;
    }

    // 2. Find this row's session in the import, or start it
    let s = sessions.find(function (x) {
      return x.id === row.session_id;
    });
    if (!s) {
      s = {
        id: row.session_id,
        date: row.date,
        name: row.session,
        notes: row.session_notes,
        exercises: []
      };
      sessions.push(s);
    }

    // A row with no exercise is a session with no exercises
    if (row.exercise === "") continue;

    // 3. New exercise entry if the exercise changes or the set number goes back to 1
    const exercise = findOrPrepareExercise(row.exercise, row.unit, newExercises);
    let entry = s.exercises[s.exercises.length - 1];
    if (!entry || entry.exerciseId !== exercise.id || row.set === "1") {
      entry = { exerciseId: exercise.id, notes: row.exercise_notes, sets: [] };
      s.exercises.push(entry);
    }

    // A row with no set number is an exercise with no sets
    if (row.set === "") continue;

    // 4. The set itself
    const weight = toNumber(row.weight);
    const reps = toNumber(row.reps);
    if (Number.isNaN(weight) || Number.isNaN(reps)) {
      return { error: "Line " + line + " has a weight or reps that is not a number " +
                      "(use a dot for decimals: 22.5)." };
    }

    entry.sets.push({
      weight: weight,
      unit: UNITS.includes(row.unit) ? row.unit : "kg",
      reps: reps,
      type: row.type === "drop" ? "drop" : "normal"
    });
  }

  return { sessions: sessions, newExercises: newExercises, skipped: skippedIds.length };
}

// ===== 2. UI STATE: what is on screen (not saved) =====

let view = "history";   // "history", "session", "picker" or "backup"
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
function formatShortDate(isoDate) {
  const date = new Date(isoDate + "T00:00");
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function renderHistory() {
 let html = `
  <button class="primary" data-action="new-session">+ New session</button>
  <button class="text-button" data-action="open-backup">Backup ›</button>`;

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
            const lastTime = findLastTime(entry.exerciseId, session);
    if (lastTime) {
      const lastNote = lastTime.entry.notes
        ? `<span class="last-time-note">"${escapeHtml(lastTime.entry.notes)}"</span>`
        : "";
      html += `
        <div class="last-time">
          <span>Last time · ${formatShortDate(lastTime.date)} — ${escapeHtml(formatSets(lastTime.entry.sets))}</span>
          ${lastNote}
        </div>`;
    }

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
function renderBackup() {
  let totalSets = 0;
  data.sessions.forEach(function (s) {
    totalSets += countSets(s);
  });

  app.innerHTML = `
    <button class="back" data-action="close-backup">← History</button>
    <h2>Backup</h2>
    <p class="empty">On this device: ${data.sessions.length} sessions · ${totalSets} sets</p>

    <section class="card">
      <h3>Export</h3>
      <p>Save all your sessions as a CSV file. Keep it somewhere safe
         (Files, iCloud or email it to yourself).</p>
      <button class="primary" data-action="export-csv">Export CSV</button>
    </section>
        <section class="card">
      <h3>Import</h3>
      <p>Restore sessions from a backup file. Sessions already on this device
         stay as they are; only new ones are added.</p>
      <label class="primary file-button">
        Import CSV
        <input type="file" id="import-file" accept=".csv,text/csv" hidden>
      </label>
    </section>`;
}
function render() {
  if (view === "history") {
    renderHistory();
  } else if (view === "session") {
    renderSession();
  } else if (view === "picker") {
    renderPicker();
  } else if (view === "backup") {
    renderBackup();
  }
}
// --- Export the backup as a file ---

function exportCsv() {
  const BOM = "\uFEFF";   // invisible mark that tells Excel the file is UTF-8
  const today = new Date().toLocaleDateString("en-CA");
  const fileName = "gym-tracker-backup-" + today + ".csv";
  const file = new File([BOM + buildCsv()], fileName, { type: "text/csv" });

  // Plan A: the system share menu (iPhone: Save to Files, iCloud, WhatsApp, Mail...)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(function (error) {
      // "AbortError" just means the user closed the menu: not a real error
      if (error.name !== "AbortError") {
        alert("Could not share the file: " + error.message);
      }
    });
    return;
  }

  // Plan B: a normal download
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}
// --- Import a backup file ---

function importCsv(file) {
  file.text().then(function (text) {
    const result = readBackup(text);

    if (result.error) {
      alert(result.error + "\n\nNothing was imported.");
      return;
    }

    const newCount = result.sessions.length;
    const total = newCount + result.skipped;

    if (newCount === 0) {
      alert("Found " + total + " sessions in this file. " +
            "All of them are already on this device: nothing to import.");
      return;
    }

    let message = "Found " + total + " sessions in this file: " +
                  newCount + " new, " + result.skipped + " already on this device.";
    if (result.newExercises.length > 0) {
      message += "\n" + result.newExercises.length + " new exercises will be added to your list.";
    }
    message += "\n\nImport " + newCount + " new sessions?";

    if (!confirm(message)) return;

    // Checked and confirmed: now, and only now, the real data changes
    data.exercises.push(...result.newExercises);
    data.sessions.push(...result.sessions);
    saveData();
    render();
  }).catch(function (error) {
    alert("Could not read the file: " + error.message);
  });
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
    } else if (action === "open-backup") {
    view = "backup";
  } else if (action === "close-backup") {
    view = "history";
  } else if (action === "export-csv") {
    exportCsv();
  }

  saveData();
  render();
});

app.addEventListener("input", function (event) {
  const input = event.target;
  if (input.type === "file") return;   // handled by the "change" listener

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
app.addEventListener("change", function (event) {
  const input = event.target;
  if (input.id !== "import-file") return;

  const file = input.files[0];
  if (file) importCsv(file);

  // Reset, so choosing the same file again still fires "change"
  input.value = "";
});

// ===== 5. START =====

render();
// Register the service worker (only if the browser supports it)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}