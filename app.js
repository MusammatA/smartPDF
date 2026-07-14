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

const state = {
  activeKey: null,
  activeSource: ALLOWED_SOURCES[0],
  apiAvailable: false,
  conversions: [],
  file: null,
  fileUrl: "",
  isBusy: false,
  loadError: "",
  progress: 0,
  progressLabel: "Choose a target output and add a file or direct link.",
  query: "",
  result: null,
  screen: "browse",
};

const fileInput = document.getElementById("file-input");
const searchInput = document.getElementById("search-input");
const searchWrap = document.querySelector(".search-wrap");
const sourceTabs = document.getElementById("source-tabs");
const toast = document.getElementById("toast");
const workspaceShell = document.getElementById("workspace-shell");
const appBaseUrl = new URL(".", window.location.href);

async function boot() {
  bindEvents();
  await loadCatalog();
  syncWorkspace();
  render();
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = normalizeSearchText(event.target.value);
    clearResult();
    resetProgress();
    syncWorkspace();
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
      state.screen = "browse";
      state.query = "";
      searchInput.value = "";
      clearInputs();
      clearResult();
      resetProgress();
      syncWorkspace();
      render();
    });
  }

  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    state.file = file || null;
    if (state.file) {
      state.fileUrl = "";
    }
    clearResult();
    resetProgress();
    render();
  });
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

function getActiveConversion() {
  return state.conversions.find((entry) => entry.key === state.activeKey) || null;
}

function syncWorkspace() {
  const visible = getVisibleConversions();
  const sourceEntries = getSourceConversions();

  updateFileAccept(sourceEntries);

  if (!sourceEntries.length) {
    state.activeKey = null;
    return;
  }

  if (visible.length && !visible.some((entry) => entry.key === state.activeKey)) {
    state.activeKey = visible[0]?.key || sourceEntries[0].key;
    return;
  }

  if (!state.activeKey || !sourceEntries.some((entry) => entry.key === state.activeKey)) {
    state.activeKey = visible[0]?.key || sourceEntries[0].key;
  }
}

function updateFileAccept(entries) {
  const nextAccept = [...new Set(entries.flatMap((entry) => entry.accept || []))].join(",");
  fileInput.accept = nextAccept;
}

function render() {
  syncWorkspace();
  renderSourceTabs();
  renderWorkspace();
  searchInput.placeholder = `Search ${state.activeSource} outputs`;
  if (searchWrap) {
    searchWrap.classList.toggle("is-hidden", state.screen === "detail");
  }
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

function renderWorkspace() {
  const visible = getVisibleConversions();
  const sourceEntries = getSourceConversions();
  const active = getActiveConversion();
  const sourceTheme = getSourceTheme(state.activeSource);
  const showDetailScreen = state.screen === "detail" && active;

  workspaceShell.innerHTML = "";

  if (!sourceEntries.length) {
    state.screen = "browse";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.loadError || "No conversions available for this source tab.";
    workspaceShell.appendChild(empty);
    return;
  }

  if (!showDetailScreen) {
    renderBrowseScreen({ sourceTheme, sourceEntries, visible });
    return;
  }

  renderDetailScreen({ active, sourceTheme });
}

function renderBrowseScreen({ sourceTheme, sourceEntries, visible }) {
  const hero = document.createElement("section");
  hero.className = "workspace-hero";
  hero.style.setProperty("--hero-border", sourceTheme.border);
  hero.style.setProperty("--hero-shadow", sourceTheme.shadow);
  hero.style.setProperty("--hero-tint", `rgba(${sourceTheme.rgb.r}, ${sourceTheme.rgb.g}, ${sourceTheme.rgb.b}, 0.1)`);

  const heroBadge = document.createElement("span");
  heroBadge.className = "hero-badge";
  heroBadge.textContent = `${state.activeSource} Workspace`;

  const heroTitle = document.createElement("h1");
  heroTitle.className = "hero-title";
  heroTitle.textContent = `Turn ${state.activeSource} files into a new format`;

  const heroText = document.createElement("p");
  heroText.className = "hero-text";
  heroText.textContent =
    "Choose the output type below, then paste a direct file link or upload a file from your computer.";

  hero.append(heroBadge, heroTitle, heroText);
  workspaceShell.appendChild(hero);

  const targetsSection = document.createElement("section");
  targetsSection.className = "target-section";

  const targetsHeader = document.createElement("div");
  targetsHeader.className = "section-header";

  const targetsTitle = document.createElement("h2");
  targetsTitle.className = "section-title";
  targetsTitle.textContent = `${state.activeSource} outputs`;

  const targetsMeta = document.createElement("p");
  targetsMeta.className = "section-text";
  targetsMeta.textContent = `${visible.length} target${visible.length === 1 ? "" : "s"} shown`;

  targetsHeader.append(targetsTitle, targetsMeta);
  targetsSection.appendChild(targetsHeader);

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `No ${state.activeSource} outputs matched your search.`;
    targetsSection.appendChild(empty);
    workspaceShell.appendChild(targetsSection);
    return;
  }

  const targetGrid = document.createElement("div");
  targetGrid.className = "target-grid";

  visible.forEach((entry) => {
    const targetTheme = getSourceTheme(entry.target);
    const isActive = entry.key === state.activeKey;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `target-card${isActive ? " active" : ""}${entry.status === "unavailable" ? " blocked" : ""}`;
    button.style.setProperty("--target-border", targetTheme.border);
    button.style.setProperty("--target-shadow", targetTheme.shadow);
    button.style.setProperty(
      "--target-tint",
      `rgba(${targetTheme.rgb.r}, ${targetTheme.rgb.g}, ${targetTheme.rgb.b}, ${isActive ? "0.16" : "0.09"})`
    );
    button.addEventListener("click", () => {
      openConversionScreen(entry.key);
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
    targetGrid.appendChild(button);
  });

  targetsSection.appendChild(targetGrid);
  workspaceShell.appendChild(targetsSection);
}

function renderDetailScreen({ active, sourceTheme }) {
  const detailScreen = document.createElement("div");
  detailScreen.className = "detail-screen";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "back-button";
  backButton.textContent = `Back to ${state.activeSource} outputs`;
  backButton.addEventListener("click", () => {
    state.screen = "browse";
    render();
  });

  detailScreen.appendChild(backButton);

  const workspace = document.createElement("section");
  workspace.className = "converter-app";
  workspace.style.setProperty("--workspace-accent", sourceTheme.background);
  workspace.style.setProperty("--workspace-ink", sourceTheme.ink);
  workspace.style.setProperty("--workspace-border", sourceTheme.border);
  workspace.style.setProperty(
    "--workspace-glow",
    `rgba(${sourceTheme.rgb.r}, ${sourceTheme.rgb.g}, ${sourceTheme.rgb.b}, 0.18)`
  );

  const appHeader = document.createElement("div");
  appHeader.className = "converter-header";

  const appTitleWrap = document.createElement("div");
  appTitleWrap.className = "converter-title-wrap";

  const appEyebrow = document.createElement("span");
  appEyebrow.className = "converter-eyebrow";
  appEyebrow.textContent = "Selected transformation";

  const appTitle = document.createElement("h2");
  appTitle.className = "converter-title";
  appTitle.textContent = active.label;

  const appText = document.createElement("p");
  appText.className = "converter-text";
  appText.textContent = getWorkspaceNote(active);

  appTitleWrap.append(appEyebrow, appTitle, appText);

  const statusBadge = document.createElement("span");
  statusBadge.className = `workspace-status ${active.status}`;
  statusBadge.textContent = STATUS_LABELS[active.status] || "Ready";

  appHeader.append(appTitleWrap, statusBadge);
  workspace.appendChild(appHeader);

  const progressPanel = document.createElement("div");
  progressPanel.className = "progress-panel";

  const progressMeta = document.createElement("div");
  progressMeta.className = "progress-meta";

  const progressLabel = document.createElement("span");
  progressLabel.className = "progress-title";
  progressLabel.textContent = "Transformation progress";

  const progressValue = document.createElement("span");
  progressValue.className = "progress-value";
  progressValue.textContent = `${Math.round(state.progress)}%`;

  progressMeta.append(progressLabel, progressValue);

  const progressTrack = document.createElement("div");
  progressTrack.className = "progress-track";

  const progressBar = document.createElement("span");
  progressBar.className = "progress-bar";
  progressBar.style.width = `${Math.max(0, Math.min(100, state.progress))}%`;
  progressTrack.appendChild(progressBar);

  const progressText = document.createElement("p");
  progressText.className = "progress-text";
  progressText.textContent = state.progressLabel;

  progressPanel.append(progressMeta, progressTrack, progressText);
  workspace.appendChild(progressPanel);

  const inputPanel = document.createElement("div");
  inputPanel.className = "input-panel";

  const linkField = document.createElement("label");
  linkField.className = "field-block";

  const linkLabel = document.createElement("span");
  linkLabel.className = "field-label";
  linkLabel.textContent = `Paste a direct ${state.activeSource} link`;

  const linkInput = document.createElement("input");
  linkInput.className = "field-input";
  linkInput.type = "url";
  linkInput.placeholder = `https://example.com/file${(active.accept || [".file"])[0] || ".file"}`;
  linkInput.value = state.fileUrl;
  linkInput.addEventListener("input", (event) => {
    state.fileUrl = event.target.value;
  });
  linkInput.addEventListener("change", () => {
    if (state.fileUrl.trim() && state.file) {
      state.file = null;
      fileInput.value = "";
    }
    clearResult();
    resetProgress();
    render();
  });

  linkField.append(linkLabel, linkInput);
  inputPanel.appendChild(linkField);

  const divider = document.createElement("div");
  divider.className = "input-divider";
  divider.textContent = "or";
  inputPanel.appendChild(divider);

  const uploadBlock = document.createElement("div");
  uploadBlock.className = "upload-block";

  const uploadButton = document.createElement("button");
  uploadButton.type = "button";
  uploadButton.className = "upload-button";
  uploadButton.textContent = state.file ? shortenName(state.file.name) : "Upload from your computer";
  uploadButton.addEventListener("click", () => {
    fileInput.click();
  });

  const uploadMeta = document.createElement("p");
  uploadMeta.className = "upload-meta";
  uploadMeta.textContent = state.file
    ? `${state.file.name} selected`
    : `Accepted files: ${formatAcceptList(active.accept)}`;

  uploadBlock.append(uploadButton, uploadMeta);
  inputPanel.appendChild(uploadBlock);

  const actionRow = document.createElement("div");
  actionRow.className = "action-row";

  const transformButton = document.createElement("button");
  transformButton.type = "button";
  transformButton.className = "transform-button";
  transformButton.textContent = state.isBusy ? "Transforming..." : `Transform to ${active.target}`;
  transformButton.disabled = state.isBusy || !state.apiAvailable || active.status === "unavailable";
  transformButton.addEventListener("click", () => {
    convertActive();
  });

  const helperNote = document.createElement("p");
  helperNote.className = "helper-note";
  helperNote.textContent = getActionHelper(active);

  actionRow.append(transformButton, helperNote);
  inputPanel.appendChild(actionRow);

  workspace.appendChild(inputPanel);

  if (state.result) {
    const resultPanel = document.createElement("div");
    resultPanel.className = "result-panel";

    const resultTitle = document.createElement("div");
    resultTitle.className = "result-title";
    resultTitle.textContent = "Converted file";

    const resultRow = document.createElement("div");
    resultRow.className = "result-row";

    const resultInput = document.createElement("input");
    resultInput.className = "result-name";
    resultInput.type = "text";
    resultInput.value = state.result.name;
    resultInput.addEventListener("input", (event) => {
      state.result.name = event.target.value;
    });

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "download-button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", () => {
      const downloadName = finalizeDownloadName(state.result.name, state.result.fallbackName);
      triggerDownload(state.result.blob, downloadName);
      showToast(downloadName, "success");
    });

    resultRow.append(resultInput, downloadButton);

    const resultMeta = document.createElement("p");
    resultMeta.className = "result-meta";
    resultMeta.textContent = `${formatBytes(state.result.blob.size)} ready to save`;

    resultPanel.append(resultTitle, resultRow, resultMeta);
    workspace.appendChild(resultPanel);
  }

  detailScreen.appendChild(workspace);
  workspaceShell.appendChild(detailScreen);
}

function openConversionScreen(key) {
  if (state.activeKey !== key) {
    state.activeKey = key;
    clearResult();
    resetProgress();
  }
  state.screen = "detail";
  render();
}

async function convertActive() {
  const active = getActiveConversion();
  const fileUrl = state.fileUrl.trim();
  const useUrl = Boolean(fileUrl);
  const useFile = !useUrl && Boolean(state.file);

  if (!active || state.isBusy) {
    return;
  }

  if (!state.apiAvailable) {
    showToast("Start the local server to enable file transformation.", "error");
    return;
  }

  if (active.status === "unavailable") {
    showToast(active.note || "This route needs extra tools.", "error");
    return;
  }

  if (!useFile && !useUrl) {
    showToast("Upload a file or paste a direct link first.", "error");
    return;
  }

  state.isBusy = true;
  clearResult();
  state.progress = useFile ? 8 : 14;
  state.progressLabel = useFile
    ? "Uploading your file to start the transformation..."
    : "Fetching the linked file and preparing the transformation...";
  render();

  const formData = new FormData();
  if (useFile) {
    formData.append("file", state.file);
  }
  if (useUrl) {
    formData.append("fileUrl", fileUrl);
  }
  formData.append("conversionKey", active.key);

  try {
    const result = await sendConversionRequest(formData, { hasLocalFile: useFile });
    state.result = {
      blob: result.blob,
      fallbackName: result.downloadName,
      name: result.downloadName,
    };
    state.progress = 100;
    state.progressLabel = `${result.downloadName} is ready to download.`;
    showToast(result.downloadName, "success");
  } catch (error) {
    state.progress = 0;
    state.progressLabel = error.message || "Conversion failed.";
    showToast(state.progressLabel, "error");
  } finally {
    state.isBusy = false;
    render();
  }
}

function sendConversionRequest(formData, { hasLocalFile }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stagedProgress = state.progress;

    xhr.open("POST", resolveAppUrl("api/convert"));
    xhr.responseType = "blob";

    const progressTimer = window.setInterval(() => {
      if (stagedProgress >= 92) {
        return;
      }

      if (stagedProgress < 34) {
        stagedProgress += hasLocalFile ? 4 : 5;
        state.progressLabel = hasLocalFile
          ? "Uploading your file to the converter..."
          : "Fetching the linked file...";
      } else if (stagedProgress < 76) {
        stagedProgress += 3;
        state.progressLabel = "Transforming the file...";
      } else {
        stagedProgress += 2;
        state.progressLabel = "Finalizing your converted file...";
      }

      state.progress = Math.min(92, stagedProgress);
      render();
    }, 180);

    if (hasLocalFile) {
      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const uploadPercent = Math.round((event.loaded / event.total) * 55) + 8;
        stagedProgress = Math.max(stagedProgress, Math.min(64, uploadPercent));
        state.progress = stagedProgress;
        state.progressLabel = "Uploading your file to the converter...";
        render();
      });
    }

    xhr.onload = async () => {
      window.clearInterval(progressTimer);

      if (xhr.status >= 200 && xhr.status < 300) {
        const disposition = xhr.getResponseHeader("Content-Disposition") || "";
        const downloadName =
          extractDownloadName(disposition) || `converted.${getActiveConversion()?.target.toLowerCase() || "file"}`;
        resolve({ blob: xhr.response, downloadName });
        return;
      }

      reject(new Error(await parseErrorBlob(xhr.response)));
    };

    xhr.onerror = () => {
      window.clearInterval(progressTimer);
      reject(new Error("Could not reach the converter."));
    };

    xhr.onabort = () => {
      window.clearInterval(progressTimer);
      reject(new Error("The conversion request was cancelled."));
    };

    xhr.send(formData);
  });
}

function clearInputs() {
  state.file = null;
  state.fileUrl = "";
  fileInput.value = "";
}

function clearResult() {
  state.result = null;
}

function resetProgress() {
  state.progress = 0;
  state.progressLabel = "Choose a target output and add a file or direct link.";
}

function getWorkspaceNote(entry) {
  if (!state.apiAvailable) {
    return "The catalog is visible here, but you need the local Python server running to transform files.";
  }

  if (entry.status === "unavailable") {
    return entry.note;
  }

  if (entry.status === "partial") {
    return entry.note;
  }

  return "Paste a direct file URL or upload a file from your device to start the transformation.";
}

function getActionHelper(entry) {
  if (!state.apiAvailable) {
    return "Run the local server first to turn this workspace into a live converter.";
  }

  if (entry.status === "unavailable") {
    return entry.note;
  }

  if (state.fileUrl.trim()) {
    return "The pasted link will be used for this transformation.";
  }

  if (state.file) {
    return "Your uploaded file is ready for transformation.";
  }

  return `Upload a ${state.activeSource} file or paste a direct ${state.activeSource} link to begin.`;
}

function formatAcceptList(accept) {
  if (!accept || !accept.length) {
    return "Any matching file";
  }
  return accept.join(", ");
}

function finalizeDownloadName(value, fallbackName) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) {
    return fallbackName;
  }

  const fallbackExtension = fallbackName.includes(".") ? fallbackName.slice(fallbackName.lastIndexOf(".")) : "";
  if (!cleanValue.includes(".") && fallbackExtension) {
    return `${cleanValue}${fallbackExtension}`;
  }

  return cleanValue;
}

function extractDownloadName(disposition) {
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) {
    return decodeURIComponent(utfMatch[1]);
  }

  const filenameMatch = disposition.match(/filename="([^"]+)"/i);
  if (filenameMatch) {
    return filenameMatch[1];
  }

  return "";
}

async function parseErrorBlob(blob) {
  if (!blob) {
    return "Conversion failed.";
  }

  const text = await blob.text();
  if (!text) {
    return "Conversion failed.";
  }

  try {
    const payload = JSON.parse(text);
    return payload.error || "Conversion failed.";
  } catch {
    return text;
  }
}

function shortenName(name) {
  return name.length > 28 ? `${name.slice(0, 25)}...` : name;
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const rounded = size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
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
