const state = {
  conversions: [],
  activeKey: null,
  file: null,
  isBusy: false,
  query: "",
};

const conversionGrid = document.getElementById("conversion-grid");
const fileInput = document.getElementById("file-input");
const searchInput = document.getElementById("search-input");
const toast = document.getElementById("toast");

async function boot() {
  bindEvents();
  await loadCatalog();
  render();
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/conversions");
    if (!response.ok) {
      throw new Error("Could not load conversions.");
    }
    const data = await response.json();
    state.conversions = data.conversions || [];
  } catch (error) {
    showToast(error.message || "Could not load conversions.", "error");
  }
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = normalizeSearchText(event.target.value);
    if (!getVisibleConversions().some((entry) => entry.key === state.activeKey)) {
      state.activeKey = null;
      clearSelectedFile();
    }
    render();
  });

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
    return !state.query || haystack.includes(state.query);
  });
}

function getActiveConversion() {
  return state.conversions.find((entry) => entry.key === state.activeKey) || null;
}

function clearSelectedFile() {
  state.file = null;
  fileInput.value = "";
}

function render() {
  const visible = getVisibleConversions();
  conversionGrid.innerHTML = "";

  visible.forEach((entry) => {
    const card = document.createElement("article");
    const isActive = entry.key === state.activeKey;
    const isUnavailable = entry.status === "unavailable";

    card.className = `conversion-card${isActive ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "conversion-select";
    selectButton.innerHTML = `
      <span class="conversion-title">${entry.label}</span>
      <span class="route-dot ${entry.status}" aria-hidden="true"></span>
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

async function convertActive() {
  const active = getActiveConversion();
  if (!active || active.status === "unavailable" || !state.file || state.isBusy) {
    return;
  }

  state.isBusy = true;
  render();

  const formData = new FormData();
  formData.append("file", state.file);
  formData.append("conversionKey", active.key);

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
