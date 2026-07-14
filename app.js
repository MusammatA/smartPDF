const ALLOWED_SOURCES = [
  "PDF",
  "DOCX",
  "TXT",
  "JPG",
  "PNG",
  "HEIC",
  "MP4",
  "MP3",
  "MOV",
  "XLSX",
  "CSV",
  "PPTX",
  "ZIP",
  "EPUB",
];

const SOURCE_COLORS = {
  AAC: "#9b5de5",
  AI: "#f97316",
  AIFF: "#5f6caf",
  AVI: "#0ea5a4",
  AVIF: "#9d4edd",
  BMP: "#94a3b8",
  CSV: "#6fbf73",
  DOCX: "#3b82f6",
  EPUB: "#8e7dff",
  FLAC: "#00b894",
  FLV: "#ef4444",
  GIF: "#e76fba",
  HEIC: "#48bfe3",
  HTML: "#ff8a3d",
  ICO: "#4361ee",
  JPG: "#f59f00",
  JSON: "#ffd166",
  M4A: "#c77dff",
  MD: "#7b8794",
  MKV: "#7c3aed",
  MOV: "#4f46e5",
  MP3: "#7c4dff",
  MP4: "#2563eb",
  ODP: "#f29e4c",
  ODT: "#3fa377",
  OGG: "#6c63ff",
  PDF: "#d84c45",
  PNG: "#4dabf7",
  PPTX: "#ff7b54",
  RAR: "#8d6e63",
  RTF: "#e67e22",
  SQL: "#9c89b8",
  SVG: "#14b8a6",
  TAR: "#9c6644",
  TSV: "#8cd17d",
  TXT: "#f4d35e",
  TIFF: "#8b5cf6",
  WAV: "#3a86ff",
  WEBM: "#16a34a",
  WEBP: "#2ec4b6",
  WMV: "#4b5563",
  XLS: "#3b8a5a",
  XLSX: "#2e9d66",
  XML: "#cba6f7",
  ZIP: "#b08968",
};

const FALLBACK_COLORS = [
  "#4dabf7",
  "#ff8a3d",
  "#2e9d66",
  "#9b5de5",
  "#f59f00",
  "#14b8a6",
  "#ef4444",
  "#7c6cf6",
];

const STATUS_LABELS = {
  available: "Ready",
  partial: "Partial",
  unavailable: "Extra Tools",
};

const urlState = new URL(window.location.href);
const initialSource = urlState.searchParams.get("source");

const state = {
  activeSource: ALLOWED_SOURCES.includes(initialSource) ? initialSource : ALLOWED_SOURCES[0],
  apiAvailable: false,
  conversions: [],
  loadError: "",
  query: "",
};

const appBaseUrl = new URL(".", window.location.href);
const conversionGrid = document.getElementById("conversion-grid");
const searchInput = document.getElementById("search-input");
const sourceTabs = document.getElementById("source-tabs");
const toast = document.getElementById("toast");

async function boot() {
  bindEvents();
  await loadCatalog();
  render();
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = normalizeSearchText(event.target.value);
    render();
  });

  if (sourceTabs) {
    sourceTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-source-filter]");
      if (!button) {
        return;
      }

      const nextSource = button.dataset.sourceFilter || ALLOWED_SOURCES[0];
      if (nextSource === state.activeSource) {
        return;
      }

      state.activeSource = nextSource;
      state.query = "";
      searchInput.value = "";
      updateSourceUrl();
      render();
    });
  }
}

function resolveAppUrl(path) {
  return new URL(path, appBaseUrl);
}

async function loadCatalog() {
  try {
    const data = await fetchCatalog("api/conversions");
    state.apiAvailable = true;
    state.conversions = filterAllowedConversions(data.conversions || []);
    state.loadError = "";
  } catch (error) {
    try {
      const data = await fetchCatalog("catalog.json");
      state.apiAvailable = false;
      state.conversions = filterAllowedConversions(Array.isArray(data) ? data : data.conversions || []);
      state.loadError = "";
    } catch {
      state.apiAvailable = false;
      state.conversions = [];
      state.loadError = error.message || "Could not load conversions.";
      showToast(state.loadError, "error");
    }
  }
}

async function fetchCatalog(path) {
  const response = await fetch(resolveAppUrl(path));
  if (!response.ok) {
    throw new Error("Could not load conversions.");
  }
  return response.json();
}

function filterAllowedConversions(entries) {
  return entries.filter((entry) => ALLOWED_SOURCES.includes(entry.source));
}

function getSourceConversions() {
  return state.conversions.filter((entry) => entry.source === state.activeSource);
}

function getVisibleConversions() {
  return getSourceConversions().filter((entry) => {
    const haystack = normalizeSearchText(
      `${entry.label} ${entry.source} ${entry.target} ${entry.category} ${entry.note} ${entry.status}`
    );
    return !state.query || haystack.includes(state.query);
  });
}

function render() {
  renderSourceTabs();
  renderGrid();
  searchInput.placeholder = `Search ${state.activeSource} outputs`;
}

function renderSourceTabs() {
  if (!sourceTabs) {
    return;
  }

  const counts = new Map();
  state.conversions.forEach((entry) => {
    counts.set(entry.source, (counts.get(entry.source) || 0) + 1);
  });

  sourceTabs.innerHTML = "";

  ALLOWED_SOURCES.forEach((source) => {
    const tab = document.createElement("button");
    const theme = getSourceTabTheme(source);
    const isActive = source === state.activeSource;

    tab.type = "button";
    tab.className = `source-tab${isActive ? " active" : ""}`;
    tab.dataset.sourceFilter = source;
    tab.style.setProperty("--tab-accent", theme.accent);
    tab.style.setProperty("--tab-ink", theme.ink);
    tab.style.setProperty("--tab-shadow", theme.shadow);
    tab.style.setProperty("--tab-tint", theme.tint);
    tab.style.setProperty("--tab-border", theme.border);

    const label = document.createElement("span");
    label.className = "source-tab-label";
    label.textContent = source;

    const count = document.createElement("span");
    count.className = "source-tab-count";
    count.textContent = String(counts.get(source) || 0);

    tab.append(label, count);
    sourceTabs.appendChild(tab);
  });
}

function renderGrid() {
  const visible = getVisibleConversions();
  conversionGrid.innerHTML = "";

  if (!state.conversions.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.loadError || "No conversions available.";
    conversionGrid.appendChild(empty);
    return;
  }

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `No ${state.activeSource} outputs matched your search.`;
    conversionGrid.appendChild(empty);
    return;
  }

  visible.forEach((entry) => {
    const targetTheme = getSourceTheme(entry.target);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `target-card${entry.status === "unavailable" ? " blocked" : ""}`;
    button.style.setProperty("--target-border", targetTheme.border);
    button.style.setProperty("--target-shadow", targetTheme.shadow);
    button.style.setProperty(
      "--target-tint",
      `rgba(${targetTheme.rgb.r}, ${targetTheme.rgb.g}, ${targetTheme.rgb.b}, 0.09)`
    );
    button.addEventListener("click", () => {
      openConversionPage(entry);
    });

    const label = document.createElement("span");
    label.className = "target-card-label";
    label.textContent = entry.target;

    const route = document.createElement("span");
    route.className = "target-card-route";
    route.textContent = entry.label;

    const status = document.createElement("span");
    status.className = `target-card-status ${entry.status}`;
    status.textContent = STATUS_LABELS[entry.status] || "Ready";

    button.append(label, route, status);
    conversionGrid.appendChild(button);
  });
}

function openConversionPage(entry) {
  const nextUrl = resolveAppUrl("convert.html");
  nextUrl.searchParams.set("key", entry.key);
  nextUrl.searchParams.set("source", state.activeSource);
  window.location.assign(nextUrl.toString());
}

function updateSourceUrl() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("source", state.activeSource);
  window.history.replaceState({}, "", nextUrl);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/↔|→/g, " to ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSourceTabTheme(source) {
  const theme = getSourceTheme(source);
  const { r, g, b } = theme.rgb;

  return {
    accent: theme.background,
    border: `rgba(${r}, ${g}, ${b}, 0.26)`,
    ink: theme.ink,
    shadow: `0 12px 24px rgba(${r}, ${g}, ${b}, 0.22)`,
    tint: `rgba(${r}, ${g}, ${b}, 0.12)`,
  };
}

function getSourceTheme(source) {
  const background = SOURCE_COLORS[source] || fallbackColorFor(source);
  const rgb = hexToRgb(background);
  const lightBackground = getRelativeLuminance(rgb) > 0.56;
  const ink = lightBackground ? "#12202f" : "#ffffff";
  const borderBase = lightBackground ? "18, 32, 47" : "255, 255, 255";

  return {
    background,
    border: `rgba(${borderBase}, ${lightBackground ? "0.18" : "0.24"})`,
    ink,
    rgb,
    shadow: `0 16px 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`,
  };
}

function fallbackColorFor(value) {
  const source = String(value || "fallback");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const safe = value.length === 3
    ? value.split("").map((part) => `${part}${part}`).join("")
    : value;

  return {
    b: parseInt(safe.slice(4, 6), 16),
    g: parseInt(safe.slice(2, 4), 16),
    r: parseInt(safe.slice(0, 2), 16),
  };
}

function getRelativeLuminance({ r, g, b }) {
  const channel = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channel[0] * 0.2126 + channel[1] * 0.7152 + channel[2] * 0.0722;
}

function showToast(message, kind = "") {
  toast.textContent = message;
  toast.className = `toast show${kind ? ` ${kind}` : ""}`;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.className = "toast";
  }, 2200);
}

boot();
