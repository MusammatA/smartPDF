const state = {
  activeSource: "All",
  apiAvailable: false,
  loadError: "",
  conversions: [],
  activeKey: null,
  file: null,
  isBusy: false,
  query: "",
};

const SOURCE_COLORS = {
  "7Z": "#b08968",
  AAC: "#9b5de5",
  AI: "#f97316",
  AIFF: "#5f6caf",
  ALAC: "#38b6a0",
  ASS: "#f59e0b",
  AVI: "#0ea5a4",
  AVIF: "#9d4edd",
  AZW3: "#5d4fc4",
  BMP: "#94a3b8",
  CSV: "#6fbf73",
  "Black & White": "#6b7280",
  "Code Image": "#334155",
  DOC: "#4f83f1",
  DOCX: "#3b82f6",
  DWG: "#475569",
  DXF: "#6366f1",
  EML: "#f97316",
  EPUB: "#8e7dff",
  EPS: "#fb923c",
  FB2: "#7c6cf6",
  FBX: "#9a3412",
  FLAC: "#00b894",
  FLV: "#ef4444",
  GIF: "#e76fba",
  GLB: "#0ea5e9",
  GLTF: "#15803d",
  GPX: "#2dd4bf",
  GZ: "#c08552",
  GeoJSON: "#facc15",
  HEIC: "#48bfe3",
  HTML: "#ff8a3d",
  ICO: "#4361ee",
  ICS: "#22c55e",
  IGES: "#8f6cb8",
  Image: "#5bc0eb",
  Images: "#4db6ac",
  JPG: "#f59f00",
  JSON: "#ffd166",
  KML: "#0ea5e9",
  "Low Resolution": "#94a3b8",
  M4A: "#c77dff",
  MD: "#7b8794",
  MKV: "#7c3aed",
  MOBI: "#7851d7",
  MOV: "#4f46e5",
  MP3: "#7c4dff",
  MP4: "#2563eb",
  MSG: "#fb7185",
  ODP: "#f29e4c",
  ODT: "#3fa377",
  OGG: "#6c63ff",
  OBJ: "#7f5539",
  OTF: "#7c3aed",
  PDF: "#d84c45",
  PLY: "#64748b",
  PNG: "#4dabf7",
  PPTX: "#ff7b54",
  RAR: "#8d6e63",
  RTF: "#e67e22",
  SQL: "#9c89b8",
  SRT: "#60a5fa",
  STEP: "#4361ee",
  STL: "#5c677d",
  SVG: "#14b8a6",
  Sketch: "#ec4899",
  TAR: "#9c6644",
  TSV: "#8cd17d",
  TTF: "#64748b",
  TXT: "#f4d35e",
  TIFF: "#8b5cf6",
  USDZ: "#8b5cf6",
  VTT: "#22c55e",
  Video: "#6d28d9",
  WAV: "#3a86ff",
  WEBM: "#16a34a",
  WEBP: "#2ec4b6",
  WMV: "#4b5563",
  WOFF: "#0f766e",
  WOFF2: "#059669",
  XLS: "#3b8a5a",
  XLSX: "#2e9d66",
  XML: "#cba6f7",
  XZ: "#d4a373",
  ZIP: "#b08968",
  Audio: "#8e44ad",
  Text: "#6b7280",
  "Table Image": "#2a9d8f",
  "Diagram Image": "#6366f1",
  "Math Image": "#8b5cf6",
  Handwriting: "#f97316",
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

const ALL_SOURCES = "All";
const conversionGrid = document.getElementById("conversion-grid");
const fileInput = document.getElementById("file-input");
const searchInput = document.getElementById("search-input");
const sourceTabs = document.getElementById("source-tabs");
const toast = document.getElementById("toast");
const appBaseUrl = new URL(".", window.location.href);

async function boot() {
  bindEvents();
  await loadCatalog();
  render();
}

function resolveAppUrl(path) {
  return new URL(path, appBaseUrl);
}

async function loadCatalog() {
  try {
    const data = await fetchCatalog("api/conversions");
    state.apiAvailable = true;
    state.conversions = data.conversions || [];
    state.loadError = "";
  } catch (error) {
    try {
      const data = await fetchCatalog("catalog.json");
      state.apiAvailable = false;
      state.conversions = Array.isArray(data) ? data : data.conversions || [];
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

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = normalizeSearchText(event.target.value);
    syncActiveSelection();
    render();
  });

  if (sourceTabs) {
    sourceTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-source-filter]");
      if (!button) {
        return;
      }

      state.activeSource = button.dataset.sourceFilter || ALL_SOURCES;
      syncActiveSelection();
      render();
    });
  }

  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    state.file = file || null;
    render();
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/↔|→/g, " to ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getVisibleConversions() {
  return state.conversions.filter((entry) => {
    const haystack = normalizeSearchText(`${entry.label} ${entry.category} ${entry.note} ${entry.status}`);
    const matchesQuery = !state.query || haystack.includes(state.query);
    const matchesSource = state.activeSource === ALL_SOURCES || entry.source === state.activeSource;
    return matchesQuery && matchesSource;
  });
}

function getActiveConversion() {
  return state.conversions.find((entry) => entry.key === state.activeKey) || null;
}

function getSourceGroups() {
  const counts = new Map();

  state.conversions.forEach((entry) => {
    counts.set(entry.source, (counts.get(entry.source) || 0) + 1);
  });

  const sources = [...counts.keys()].sort((left, right) => {
    if (left === "PDF") {
      return -1;
    }
    if (right === "PDF") {
      return 1;
    }
    return left.localeCompare(right);
  });

  return [
    { count: state.conversions.length, source: ALL_SOURCES },
    ...sources.map((source) => ({
      count: counts.get(source) || 0,
      source,
    })),
  ];
}

function clearSelectedFile() {
  state.file = null;
  fileInput.value = "";
}

function syncActiveSelection() {
  if (state.activeKey && !getVisibleConversions().some((entry) => entry.key === state.activeKey)) {
    state.activeKey = null;
    clearSelectedFile();
  }
}

function render() {
  const visible = getVisibleConversions();
  renderSourceTabs();
  conversionGrid.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    if (!state.conversions.length && !state.query) {
      empty.textContent = state.loadError || "No conversions available";
    } else {
      empty.textContent = "No matching conversions";
    }
    conversionGrid.appendChild(empty);
    return;
  }

  visible.forEach((entry) => {
    const card = document.createElement("article");
    const isActive = entry.key === state.activeKey;
    const isUnavailable = entry.status === "unavailable";
    const theme = getSourceTheme(entry.source);

    card.className = `conversion-card${isActive ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;
    card.style.setProperty("--card-bg", theme.background);
    card.style.setProperty("--card-ink", theme.ink);
    card.style.setProperty("--card-border", theme.border);
    card.style.setProperty("--card-shadow", theme.shadow);
    card.style.setProperty("--card-chip-bg", theme.chipBackground);
    card.style.setProperty("--card-chip-border", theme.chipBorder);
    card.style.setProperty("--card-chip-ink", theme.chipInk);

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "conversion-select";
    selectButton.innerHTML = `
      <span class="conversion-title">${entry.label}</span>
      <span class="conversion-source">${entry.source}</span>
    `;
    selectButton.addEventListener("click", () => {
      const nextKey = entry.key;
      if (state.activeKey !== nextKey) {
        state.activeKey = nextKey;
        clearSelectedFile();
      } else {
        state.activeKey = null;
        clearSelectedFile();
      }
      render();
    });
    card.appendChild(selectButton);

    if (isActive) {
      const actions = document.createElement("div");
      actions.className = "conversion-actions";

      if (isUnavailable) {
        const externalTag = document.createElement("span");
        externalTag.className = "status-chip";
        externalTag.textContent = "External";
        actions.appendChild(externalTag);
      } else if (!state.apiAvailable) {
        const localTag = document.createElement("span");
        localTag.className = "status-chip";
        localTag.textContent = "Local server";
        actions.appendChild(localTag);
      } else {
        const uploadButton = document.createElement("button");
        uploadButton.type = "button";
        uploadButton.className = "action-chip";
        uploadButton.textContent = state.file ? shortenName(state.file.name) : "Upload";
        uploadButton.addEventListener("click", () => {
          fileInput.click();
        });

        const convertButton = document.createElement("button");
        convertButton.type = "button";
        convertButton.className = "action-chip action-chip-primary";
        convertButton.textContent = state.isBusy && isActive ? "..." : "Convert";
        convertButton.disabled = state.isBusy || !state.file;
        convertButton.addEventListener("click", () => {
          convertActive();
        });

        actions.appendChild(uploadButton);
        actions.appendChild(convertButton);
      }

      card.appendChild(actions);
    }

    conversionGrid.appendChild(card);
  });
}

function renderSourceTabs() {
  if (!sourceTabs) {
    return;
  }

  sourceTabs.innerHTML = "";

  getSourceGroups().forEach(({ source, count }) => {
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
    tab.innerHTML = `
      <span class="source-tab-label">${source}</span>
      <span class="source-tab-count">${count}</span>
    `;

    sourceTabs.appendChild(tab);
  });
}

function getSourceTabTheme(source) {
  if (source === ALL_SOURCES) {
    return {
      accent: "#12202f",
      border: "rgba(18, 32, 47, 0.16)",
      ink: "#ffffff",
      shadow: "0 12px 24px rgba(18, 32, 47, 0.18)",
      tint: "rgba(18, 32, 47, 0.06)",
    };
  }

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
  const chipBackground = lightBackground ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.14)";
  const chipBorder = lightBackground ? "rgba(18, 32, 47, 0.18)" : "rgba(255, 255, 255, 0.28)";
  const chipInk = lightBackground ? "#12202f" : "#ffffff";

  return {
    background,
    border: `rgba(${borderBase}, ${lightBackground ? "0.18" : "0.24"})`,
    chipBackground,
    chipBorder,
    chipInk,
    ink,
    lightBackground,
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

async function convertActive() {
  const active = getActiveConversion();
  if (!active || active.status === "unavailable" || !state.file || state.isBusy) {
    return;
  }

  if (!state.apiAvailable) {
    showToast("Start the local server to convert files.", "error");
    return;
  }

  state.isBusy = true;
  render();

  const formData = new FormData();
  formData.append("file", state.file);
  formData.append("conversionKey", active.key);

  try {
    const response = await fetch(resolveAppUrl("api/convert"), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      throw new Error(errorPayload?.error || "Conversion failed.");
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/i);
    const downloadName = filenameMatch?.[1] || `converted.${active.target.toLowerCase()}`;
    triggerDownload(blob, downloadName);
    showToast(downloadName, "success");
  } catch (error) {
    showToast(error.message || "Conversion failed.", "error");
  } finally {
    state.isBusy = false;
    render();
  }
}

function shortenName(name) {
  return name.length > 18 ? `${name.slice(0, 15)}...` : name;
}

function safeJson(response) {
  return response.json().catch(() => null);
}

function showToast(message, kind = "") {
  toast.textContent = message;
  toast.className = `toast show${kind ? ` ${kind}` : ""}`;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.className = "toast";
  }, 2200);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

boot();
