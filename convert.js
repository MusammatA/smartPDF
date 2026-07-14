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

const appBaseUrl = new URL(".", window.location.href);
const pageUrl = new URL(window.location.href);
const requestedKey = pageUrl.searchParams.get("key") || "";
const requestedSource = pageUrl.searchParams.get("source") || "";

const state = {
  activeConversion: null,
  apiAvailable: false,
  conversions: [],
  file: null,
  fileUrl: "",
  isBusy: false,
  loadError: "",
  progress: 0,
  progressLabel: "Waiting for a file.",
  result: null,
};

const backButton = document.getElementById("back-button");
const convertScreen = document.getElementById("convert-screen");
const fileInput = document.getElementById("file-input");
const routeChip = document.getElementById("route-chip");
const toast = document.getElementById("toast");

async function boot() {
  bindEvents();
  await loadCatalog();
  selectRequestedConversion();
  render();
}

function bindEvents() {
  backButton.addEventListener("click", () => {
    navigateBack();
  });

  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    state.file = file || null;
    if (!state.file) {
      return;
    }

    state.fileUrl = "";
    clearResult();
    resetProgress();
    startConversion();
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

function selectRequestedConversion() {
  state.activeConversion = state.conversions.find((entry) => entry.key === requestedKey) || null;

  if (!state.activeConversion) {
    routeChip.textContent = requestedSource || "Conversion";
    return;
  }

  routeChip.textContent = state.activeConversion.label;
  fileInput.accept = (state.activeConversion.accept || []).join(",");
  state.progressLabel = state.apiAvailable ? "Waiting for a file." : "Local server required.";
}

function render() {
  convertScreen.innerHTML = "";

  if (!state.activeConversion) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "This conversion could not be found.";
    convertScreen.appendChild(empty);
    return;
  }

  const workspace = document.createElement("section");
  workspace.className = "converter-app convert-workspace";
  workspace.style.setProperty("--workspace-border", "rgba(18, 32, 47, 0.12)");
  workspace.style.setProperty("--workspace-accent", "#12202f");
  workspace.style.setProperty("--workspace-ink", "#ffffff");
  workspace.style.setProperty("--workspace-glow", "rgba(18, 32, 47, 0.14)");

  const progressPanel = document.createElement("div");
  progressPanel.className = "progress-panel";

  const progressMeta = document.createElement("div");
  progressMeta.className = "progress-meta";

  const progressValue = document.createElement("span");
  progressValue.className = "progress-value";
  progressValue.textContent = `${Math.round(state.progress)}%`;

  progressMeta.appendChild(progressValue);

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
  inputPanel.className = "input-panel compact-panel";

  const linkInput = document.createElement("input");
  linkInput.className = "field-input";
  linkInput.type = "url";
  linkInput.placeholder = "Paste file link and press Enter";
  linkInput.value = state.fileUrl;
  linkInput.setAttribute("aria-label", "Paste file link");
  linkInput.addEventListener("input", (event) => {
    state.fileUrl = event.target.value;
  });
  linkInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    state.file = null;
    fileInput.value = "";
    clearResult();
    resetProgress();
    startConversion();
  });

  const uploadButton = document.createElement("button");
  uploadButton.type = "button";
  uploadButton.className = "upload-button";
  uploadButton.textContent = state.file ? shortenName(state.file.name) : "Upload from your computer";
  uploadButton.disabled = state.isBusy;
  uploadButton.addEventListener("click", () => {
    fileInput.click();
  });

  const uploadMeta = document.createElement("p");
  uploadMeta.className = "upload-meta";
  uploadMeta.textContent = state.file
    ? `${state.file.name} selected`
    : formatAcceptList(state.activeConversion.accept);

  inputPanel.append(linkInput, uploadButton, uploadMeta);
  workspace.appendChild(inputPanel);

  if (state.result) {
    const resultPanel = document.createElement("div");
    resultPanel.className = "result-panel";

    const resultRow = document.createElement("div");
    resultRow.className = "result-row";

    const resultInput = document.createElement("input");
    resultInput.className = "result-name";
    resultInput.type = "text";
    resultInput.value = state.result.name;
    resultInput.setAttribute("aria-label", "Output file name");
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
    resultMeta.textContent = `${formatBytes(state.result.blob.size)} ready`;

    resultPanel.append(resultRow, resultMeta);
    workspace.appendChild(resultPanel);
  }

  convertScreen.appendChild(workspace);
}

async function startConversion() {
  const active = state.activeConversion;
  const fileUrl = state.fileUrl.trim();
  const useUrl = Boolean(fileUrl);
  const useFile = !useUrl && Boolean(state.file);

  if (!active || state.isBusy) {
    return;
  }

  if (!state.apiAvailable) {
    showToast("Start the local server to enable conversion.", "error");
    return;
  }

  if (active.status === "unavailable") {
    showToast(active.note || "This route needs extra tools.", "error");
    return;
  }

  if (!useFile && !useUrl) {
    showToast("Upload a file or paste a link first.", "error");
    return;
  }

  state.isBusy = true;
  clearResult();
  state.progress = useFile ? 8 : 14;
  state.progressLabel = useFile ? "Uploading..." : "Fetching link...";
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
    state.progressLabel = "Ready to download.";
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
        state.progressLabel = hasLocalFile ? "Uploading..." : "Fetching link...";
      } else if (stagedProgress < 76) {
        stagedProgress += 3;
        state.progressLabel = "Transforming...";
      } else {
        stagedProgress += 2;
        state.progressLabel = "Finalizing...";
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
        state.progressLabel = "Uploading...";
        render();
      });
    }

    xhr.onload = async () => {
      window.clearInterval(progressTimer);

      if (xhr.status >= 200 && xhr.status < 300) {
        const disposition = xhr.getResponseHeader("Content-Disposition") || "";
        const downloadName =
          extractDownloadName(disposition) || `converted.${state.activeConversion?.target.toLowerCase() || "file"}`;
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

function navigateBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  const nextUrl = resolveAppUrl("index.html");
  nextUrl.searchParams.set("source", state.activeConversion?.source || requestedSource || "PDF");
  window.location.assign(nextUrl.toString());
}

function clearResult() {
  state.result = null;
}

function resetProgress() {
  state.progress = 0;
  state.progressLabel = state.apiAvailable ? "Waiting for a file." : "Local server required.";
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
