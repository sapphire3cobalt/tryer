const timerRing = document.getElementById("timerRing");
const timeRemaining = document.getElementById("timeRemaining");
const currentSessionTitle = document.getElementById("currentSessionTitle");
const sessionBadge = document.getElementById("sessionBadge");
const sessionMeta = document.getElementById("sessionMeta");
const nextSession = document.getElementById("nextSession");
const completedCount = document.getElementById("completedCount");

const settingsForm = document.getElementById("settingsForm");
const pomodoroCount = document.getElementById("pomodoroCount");
const focusDuration = document.getElementById("focusDuration");
const shortBreak = document.getElementById("shortBreak");
const longBreak = document.getElementById("longBreak");
const longBreakInterval = document.getElementById("longBreakInterval");
const sessionIntent = document.getElementById("sessionIntent");
const savePresetBtn = document.getElementById("savePresetBtn");
const presetContainer = document.getElementById("presetContainer");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const autoStartToggle = document.getElementById("autoStartToggle");
const soundToggle = document.getElementById("soundToggle");

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");

const calendarGrid = document.getElementById("calendarGrid");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const STORAGE_KEYS = {
  sessions: "pomodoro_sessions",
  settings: "pomodoro_settings",
  tasks: "pomodoro_tasks",
  presets: "pomodoro_presets",
};

let sessions = [];
let activeIndex = 0;
let remainingSeconds = 0;
let timerId = null;
let isPaused = true;

const COLORS = {
  focus: "var(--primary)",
  "short-break": "var(--green)",
  "long-break": "var(--blue)",
};

const defaultSettings = {
  pomodoros: 4,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  intention: "",
};

const loadStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    return fallback;
  }
};

const saveStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const formatClock = (date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDate = (date) =>
  date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const buildFlow = (settings, startTime = new Date()) => {
  const flow = [];
  let current = new Date(startTime);
  for (let i = 1; i <= settings.pomodoros; i += 1) {
    const focusStart = new Date(current);
    const focusEnd = new Date(
      current.getTime() + settings.focusMinutes * 60 * 1000
    );
    flow.push({
      id: crypto.randomUUID(),
      type: "focus",
      title: `Focus ${i}`,
      start: focusStart.toISOString(),
      end: focusEnd.toISOString(),
      status: "planned",
      cycle: i,
      intention: settings.intention,
    });
    current = new Date(focusEnd);

    if (i === settings.pomodoros) {
      continue;
    }

    const isLongBreak = i % settings.longBreakInterval === 0;
    const breakMinutes = isLongBreak
      ? settings.longBreakMinutes
      : settings.shortBreakMinutes;
    const breakType = isLongBreak ? "long-break" : "short-break";
    const breakStart = new Date(current);
    const breakEnd = new Date(current.getTime() + breakMinutes * 60 * 1000);
    flow.push({
      id: crypto.randomUUID(),
      type: breakType,
      title: isLongBreak ? "Long break" : "Short break",
      start: breakStart.toISOString(),
      end: breakEnd.toISOString(),
      status: "planned",
      cycle: i,
      intention: settings.intention,
    });
    current = new Date(breakEnd);
  }
  return flow;
};

const getSettings = () => {
  return {
    pomodoros: Number(pomodoroCount.value),
    focusMinutes: Number(focusDuration.value),
    shortBreakMinutes: Number(shortBreak.value),
    longBreakMinutes: Number(longBreak.value),
    longBreakInterval: Number(longBreakInterval.value),
    intention: sessionIntent.value.trim(),
  };
};

const applySettings = (settings) => {
  pomodoroCount.value = settings.pomodoros;
  focusDuration.value = settings.focusMinutes;
  shortBreak.value = settings.shortBreakMinutes;
  longBreak.value = settings.longBreakMinutes;
  longBreakInterval.value = settings.longBreakInterval;
  sessionIntent.value = settings.intention || "";
};

const updateRing = (progress) => {
  const angle = Math.max(0, Math.min(360, progress * 360));
  const color = COLORS[sessions[activeIndex]?.type] || "#e9e9f5";
  timerRing.style.background = `conic-gradient(${color} ${angle}deg, #e9e9f5 ${angle}deg 360deg)`;
};

const updateStatus = () => {
  const current = sessions[activeIndex];
  if (!current) {
    currentSessionTitle.textContent = "Ready to focus";
    sessionBadge.textContent = "Idle";
    sessionBadge.className = "badge badge--neutral";
    sessionMeta.textContent = "0 of 0 pomodoros";
    timeRemaining.textContent = formatTime(
      Number(focusDuration.value) * 60
    );
    updateRing(0);
    nextSession.textContent = "Configure a flow to get started";
    return;
  }

  const badgeClass =
    current.type === "focus" ? "badge badge--focus" : "badge badge--break";
  sessionBadge.className = badgeClass;
  sessionBadge.textContent = current.type === "focus" ? "Focus" : "Break";
  currentSessionTitle.textContent = current.title;
  sessionMeta.textContent = `${current.cycle} of ${getSettings().pomodoros} pomodoros`;

  const upcoming = sessions[activeIndex + 1];
  if (upcoming) {
    nextSession.textContent = `${upcoming.title} · ${formatClock(
      new Date(upcoming.start)
    )}`;
  } else {
    nextSession.textContent = "Flow complete. Celebrate the win!";
  }
};

const updateCalendar = () => {
  if (sessions.length === 0) {
    calendarGrid.innerHTML =
      "<p class=\"card__subtitle\">No sessions yet. Build a flow to see your calendar.</p>";
    return;
  }

  const grouped = sessions.reduce((acc, session) => {
    const dayKey = session.start.split("T")[0];
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(session);
    return acc;
  }, {});

  calendarGrid.innerHTML = Object.entries(grouped)
    .map(([day, daySessions]) => {
      const list = daySessions
        .map((session) => {
          const classes = [
            "session-card",
            session.type,
            session.status === "completed" ? "completed" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return `
            <div class="${classes}">
              <div>
                ${session.title}
                <span>${formatClock(new Date(session.start))} - ${formatClock(
                  new Date(session.end)
                )}</span>
              </div>
              <span>${session.status}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="day">
          <div class="day__header">
            <strong>${formatDate(new Date(day))}</strong>
            <span>${daySessions.length} sessions</span>
          </div>
          <div class="sessions">${list}</div>
        </div>
      `;
    })
    .join("");
};

const updateCompletedCount = () => {
  const today = new Date().toISOString().split("T")[0];
  const completed = sessions.filter(
    (session) =>
      session.status === "completed" && session.start.startsWith(today)
  );
  completedCount.textContent = `${completed.length} sessions`;
};

const setRemainingForSession = (session) => {
  const start = new Date(session.start);
  const end = new Date(session.end);
  const totalSeconds = (end - start) / 1000;
  remainingSeconds = totalSeconds;
  updateRing(1 - remainingSeconds / totalSeconds);
  timeRemaining.textContent = formatTime(remainingSeconds);
};

const playSound = () => {
  if (!soundToggle.checked) return;
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + 1
  );
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 1);
};

const persistSessions = () => {
  saveStorage(STORAGE_KEYS.sessions, sessions);
};

const tick = () => {
  if (isPaused) return;
  const current = sessions[activeIndex];
  if (!current) return;

  remainingSeconds -= 1;
  const totalSeconds =
    (new Date(current.end) - new Date(current.start)) / 1000;
  const progress = 1 - remainingSeconds / totalSeconds;
  updateRing(progress);
  timeRemaining.textContent = formatTime(remainingSeconds);

  if (remainingSeconds <= 0) {
    playSound();
    sessions[activeIndex].status = "completed";
    persistSessions();
    updateCalendar();
    updateCompletedCount();

    activeIndex += 1;
    const next = sessions[activeIndex];
    if (next) {
      next.status = "active";
      setRemainingForSession(next);
      updateStatus();
      if (!autoStartToggle.checked) {
        pauseTimer();
      }
    } else {
      pauseTimer();
      updateStatus();
    }
  }
};

const startTimer = () => {
  if (sessions.length === 0) return;
  if (!timerId) {
    timerId = setInterval(tick, 1000);
  }
  isPaused = false;
  pauseBtn.disabled = false;
  startBtn.disabled = true;
};

const pauseTimer = () => {
  isPaused = true;
  pauseBtn.disabled = true;
  startBtn.disabled = false;
};

const resetTimer = () => {
  clearInterval(timerId);
  timerId = null;
  isPaused = true;
  const flowStartIndex = [...sessions]
    .slice(0, activeIndex + 1)
    .map((session, index) => ({ session, index }))
    .filter(({ session }) => session.type === "focus" && session.cycle === 1)
    .map(({ index }) => index)
    .pop();
  const nextFlowStartIndex = sessions.findIndex(
    (session, index) =>
      index > flowStartIndex &&
      session.type === "focus" &&
      session.cycle === 1
  );
  const flowEndIndex =
    nextFlowStartIndex === -1 ? sessions.length : nextFlowStartIndex;
  activeIndex = flowStartIndex ?? 0;
  sessions = sessions.map((session, index) => {
    if (index < (flowStartIndex ?? 0) || index >= flowEndIndex) {
      return session;
    }
    return {
      ...session,
      status: index === activeIndex ? "active" : "planned",
    };
  });
  const first = sessions[activeIndex];
  if (first) {
    setRemainingForSession(first);
  }
  updateStatus();
  persistSessions();
  updateCalendar();
  pauseBtn.disabled = true;
  startBtn.disabled = false;
};

const buildNewFlow = () => {
  const settings = getSettings();
  saveStorage(STORAGE_KEYS.settings, settings);
  const newFlow = buildFlow(settings, new Date()).map((session, index) => ({
    ...session,
    status: index === 0 ? "active" : "planned",
  }));
  sessions = sessions.map((session) =>
    session.status === "active" ? { ...session, status: "completed" } : session
  );
  const startIndex = sessions.length;
  sessions = [...sessions, ...newFlow];
  activeIndex = startIndex;
  setRemainingForSession(sessions[activeIndex]);
  updateStatus();
  updateCalendar();
  updateCompletedCount();
  persistSessions();
};

const renderTasks = (tasks) => {
  taskList.innerHTML = "";
  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = "tasks__item";
    item.innerHTML = `
      <input type="checkbox" ${task.done ? "checked" : ""} />
      <span>${task.label}</span>
      <button class="btn btn--ghost" aria-label="Delete task">Remove</button>
    `;
    const checkbox = item.querySelector("input");
    const removeBtn = item.querySelector("button");
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveStorage(STORAGE_KEYS.tasks, tasks);
    });
    removeBtn.addEventListener("click", () => {
      const updated = tasks.filter((t) => t !== task);
      saveStorage(STORAGE_KEYS.tasks, updated);
      renderTasks(updated);
    });
    taskList.appendChild(item);
  });
};

const renderPresets = (presets) => {
  presetContainer.innerHTML = "";
  presets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = preset.name;
    button.addEventListener("click", () => {
      applySettings(preset.settings);
    });
    presetContainer.appendChild(button);
  });
};

const exportData = (format) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    sessions,
    tasks: loadStorage(STORAGE_KEYS.tasks, []),
  };

  if (format === "json") {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pomodoro-data.json";
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const rows = [
    ["title", "type", "start", "end", "status", "intention"],
    ...sessions.map((session) => [
      session.title,
      session.type,
      session.start,
      session.end,
      session.status,
      session.intention || "",
    ]),
  ];
  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pomodoro-sessions.csv";
  link.click();
  URL.revokeObjectURL(url);
};

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  buildNewFlow();
});

startBtn.addEventListener("click", () => {
  if (sessions.length === 0) {
    buildNewFlow();
  }
  startTimer();
});

pauseBtn.addEventListener("click", () => {
  pauseTimer();
});

resetBtn.addEventListener("click", () => {
  resetTimer();
});

savePresetBtn.addEventListener("click", () => {
  const presets = loadStorage(STORAGE_KEYS.presets, []);
  const settings = getSettings();
  const name = `Preset ${presets.length + 1} · ${settings.focusMinutes}m`;
  const updated = [...presets, { name, settings }];
  saveStorage(STORAGE_KEYS.presets, updated);
  renderPresets(updated);
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = taskInput.value.trim();
  if (!value) return;
  const tasks = loadStorage(STORAGE_KEYS.tasks, []);
  const updated = [...tasks, { label: value, done: false }];
  saveStorage(STORAGE_KEYS.tasks, updated);
  taskInput.value = "";
  renderTasks(updated);
});

exportJsonBtn.addEventListener("click", () => exportData("json"));
exportCsvBtn.addEventListener("click", () => exportData("csv"));

clearHistoryBtn.addEventListener("click", () => {
  clearInterval(timerId);
  timerId = null;
  isPaused = true;
  sessions = [];
  persistSessions();
  updateCalendar();
  updateCompletedCount();
  updateStatus();
});

const init = () => {
  const storedSettings = loadStorage(STORAGE_KEYS.settings, defaultSettings);
  applySettings(storedSettings);

  sessions = loadStorage(STORAGE_KEYS.sessions, []);
  if (sessions.length > 0) {
    activeIndex = sessions.findIndex((session) => session.status === "active");
    if (activeIndex === -1) {
      activeIndex = sessions.findIndex(
        (session) => session.status === "planned"
      );
    }
    if (activeIndex === -1) activeIndex = 0;
    const current = sessions[activeIndex];
    if (current) {
      const end = new Date(current.end);
      const start = new Date(current.start);
      const now = new Date();
      const totalSeconds = Math.max(0, (end - start) / 1000);
      remainingSeconds = Math.max(0, (end - now) / 1000);
      if (remainingSeconds === 0) {
        current.status = "completed";
      }
      timeRemaining.textContent = formatTime(remainingSeconds || 0);
      updateRing(totalSeconds ? 1 - remainingSeconds / totalSeconds : 0);
    }
  }

  updateStatus();
  updateCalendar();
  updateCompletedCount();

  renderTasks(loadStorage(STORAGE_KEYS.tasks, []));
  renderPresets(loadStorage(STORAGE_KEYS.presets, []));
};

init();
