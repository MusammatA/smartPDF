const state = {
  conversions: [],
  activeCategory: "All",
  activeKey: null,
  query: "",
  file: null,
};

const categoryTabs = document.getElementById("category-tabs");
const conversionGrid = document.getElementById("conversion-grid");
const selectedLabel = document.getElementById("selected-label");
const selectedStatus = document.getElementById("selected-status");
const selectedAccept = document.getElementById("selected-accept");
const selectedNote = document.getElementById("selected-note");
const convertForm = document.getElementById("convert-form");
const fileInput = document.getElementById("file-input");
const uploadMeta = document.getElementById("upload-meta");
const convertButton = document.getElementById("convert-button");
const messageBox = document.getElementById("message-box");
const resultSummary = document.getElementById("result-summary");
const searchInput = document.getElementById("search-input");
const serverStatus = document.getElementById("server-status");
const catalogCount = document.getElementById("catalog-count");

async function boot() {
  await Promise.all([loadHealth(), loadCatalog()]);
  bindEvents();
  render();
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error("Health check failed");
    }
    serverStatus.textContent = "Online";
  } catch (error) {
    serverStatus.textContent = "Offline";
  }
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/conversions");
    if (!response.ok) {
      throw new Error("Could not load conversions");
    }
    const data = await response.json();
    state.conversions = data.conversions || [];
    catalogCount.textContent = `${state.conversions.length} routes`;
    const firstAvailable = state.conversions.find((entry) => entry.status !== "unavailable");
    state.activeKey = firstAvailable?.key || state.conversions[0]?.key || null;
  } catch (error) {
    state.conversions = [];
    setMessage("Could not load the local conversion catalog.", "error");
  }
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/↔|→/g, " to ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = normalizeSearchText(event.target.value);
    const visible = getVisibleConversions();
    if (!visible.some((entry) => entry.key === state.activeKey)) {
      state.activeKey = visible[0]?.key || null;
    }
    render();
  });

  fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    state.file = file || null;
    uploadMeta.textContent = state.file
      ? `${state.file.name} • ${formatFileSize(state.file.size)}`
      : "No file selected yet.";
    renderButtonState();
  });

  convertForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const active = getActiveConversion();
    if (!active) {
      setMessage("Select a conversion before uploading.", "error");
      return;
    }
    if (active.status === "unavailable") {
      setMessage(active.note, "error");
      return;
    }
    if (!state.file) {
      setMessage("Upload a file before converting.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", state.file);
    formData.append("conversionKey", active.key);

    convertButton.disabled = true;
    setMessage(`Transforming ${state.file.name} into ${active.target}...`, "processing");

    try {
      const response = await fetch("/api/convert", {
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
      setMessage(`Done. Downloaded ${downloadName}.`, "success");
    } catch (error) {
      setMessage(error.message || "Conversion failed.", "error");
    } finally {
      renderButtonState();
    }
  });
}

function safeJson(response) {
  return response
    .json()
    .catch(() => null);
}

function getActiveConversion() {
  return state.conversions.find((entry) => entry.key === state.activeKey) || null;
}

function getVisibleConversions() {
  return state.conversions.filter((entry) => {
    const matchesCategory = state.activeCategory === "All" || entry.category === state.activeCategory;
    const haystack = normalizeSearchText(`${entry.label} ${entry.category} ${entry.note} ${entry.status}`);
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesCategory && matchesQuery;
  });
}

function getCategories() {
  const categories = ["All", ...new Set(state.conversions.map((entry) => entry.category))];
  return categories;
}

function render() {
  renderTabs();
  renderGrid();
  renderSelected();
  renderButtonState();
}

function renderTabs() {
  const categories = getCategories();
  categoryTabs.innerHTML = "";

  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button${category === state.activeCategory ? " active" : ""}`;
    const count = category === "All"
      ? state.conversions.length
      : state.conversions.filter((entry) => entry.category === category).length;

    button.innerHTML = `
      <span class="tab-title">${category}</span>
      <span class="tab-count">${count} routes</span>
    `;
    button.addEventListener("click", () => {
      state.activeCategory = category;
      const visible = getVisibleConversions();
      if (!visible.some((entry) => entry.key === state.activeKey)) {
        state.activeKey = visible[0]?.key || null;
      }
      render();
    });
    categoryTabs.appendChild(button);
  });
}

function renderGrid() {
  const visible = getVisibleConversions();
  resultSummary.textContent = `${visible.length} result${visible.length === 1 ? "" : "s"} in view`;
  conversionGrid.innerHTML = "";

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No transformations matched your search. Try a broader keyword like PDF, image, spreadsheet, or audio.";
    conversionGrid.appendChild(empty);
    return;
  }

  visible.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversion-card${entry.key === state.activeKey ? " active" : ""}`;
    button.innerHTML = `
      <h3>${entry.label}</h3>
      <div class="conversion-meta">
        <span class="badge ${entry.status}">${statusLabel(entry.status)}</span>
        <span class="badge">${entry.category}</span>
      </div>
      <p class="conversion-note">${entry.note}</p>
    `;
    button.addEventListener("click", () => {
      state.activeKey = entry.key;
      setMessage(entry.status === "unavailable" ? entry.note : "Route ready. Upload a file to transform.", entry.status === "unavailable" ? "error" : "");
      render();
    });
    conversionGrid.appendChild(button);
  });
}

function renderSelected() {
  const active = getActiveConversion();
  if (!active) {
    selectedLabel.textContent = "Choose a transformation";
    selectedStatus.textContent = "Waiting";
    selectedAccept.textContent = "-";
    selectedNote.textContent = "Pick a tile from the catalog to activate upload and conversion.";
    return;
  }

  selectedLabel.textContent = active.label;
  selectedStatus.textContent = statusLabel(active.status);
  selectedAccept.textContent = active.accept?.length ? active.accept.join(", ") : "Any";
  selectedNote.textContent = active.note;
}

function renderButtonState() {
  const active = getActiveConversion();
  const disabled = !active || !state.file || active.status === "unavailable";
  convertButton.disabled = disabled;
}

function setMessage(text, kind = "") {
  messageBox.textContent = text;
  messageBox.className = `message-box${kind ? ` ${kind}` : ""}`;
}

function statusLabel(status) {
  if (status === "available") return "Available Now";
  if (status === "partial") return "Local Export";
  return "Needs Extra Engine";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
