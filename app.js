// ── Configuracion GitHub ─────────────────────────────────────────────────────
// Reemplaza estos dos valores con los de tu repositorio de GitHub
const GITHUB_OWNER = "lrlubricentro";
const GITHUB_REPO  = "LubricentroLR";
const GITHUB_BRANCH = "main";
const GITHUB_FILE_PATH = "data/services.json";
const LOCAL_BACKUP_KEY = "lubricentro-services-backup-v1";
const LOCAL_PENDING_SYNC_KEY = "lubricentro-services-pending-sync-v1";
const SYNC_RETRY_BASE_MS = 10000;
const SYNC_RETRY_MAX_MS = 60000;
const GITHUB_SYNC_TIMEOUT_MS = 15000;
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 10;
const OWNER_PASSWORD_SALT = 17;
const OWNER_PASSWORD_BYTES = [93, 99, 67, 65, 67, 71];

const defaultServices = {
  AB123CD: [
    {
      id: "svc-1",
      cliente: "Juan Perez",
      trabajo: "Cambio de aceite + Filtro de aceite. Detalle: Aceite 10W40 semisintetico.",
      fechaService: "2026-03-04",
      proximoKm: "55000",
    },
  ],
  AC456EF: [
    {
      id: "svc-2",
      cliente: "Maria Gomez",
      trabajo: "Cambio de aceite + Filtro de aire.",
      fechaService: "2026-02-20",
      proximoKm: "62000",
    },
  ],
  AAA123: [
    {
      id: "svc-3",
      cliente: "Carlos Ruiz",
      trabajo: "Service completo + Revision de fluidos.",
      fechaService: "2026-01-12",
      proximoKm: "73000",
    },
  ],
};

let selectedPlate = null;
let editingEntry = null;
let ownerPanelUnlocked = false;

const customerView = document.getElementById("customer-view");
const ownerView = document.getElementById("owner-view");
const tabCustomer = document.getElementById("tab-customer");
const tabOwner = document.getElementById("tab-owner");

const searchForm = document.getElementById("search-form");
const plateInput = document.getElementById("patente");
const resultSection = document.getElementById("result");
const emptySection = document.getElementById("empty");
const historySection = document.getElementById("history");
const historyList = document.getElementById("res-history-list");

const ownerForm = document.getElementById("owner-form");
const ownerSubmit = document.getElementById("owner-submit");
const ownerCancel = document.getElementById("owner-cancel");
const ownerFormStatus = document.getElementById("owner-form-status");
const ownerTableBody = document.getElementById("owner-table-body");
const ownerHistorySection = document.getElementById("owner-history");
const ownerHistoryTitle = document.getElementById("owner-history-title");
const ownerHistoryBody = document.getElementById("owner-history-body");
const ownerExportBackupBtn = document.getElementById("owner-export-backup");
const ownerImportBackupBtn = document.getElementById("owner-import-backup");
const ownerChangeTokenBtn = document.getElementById("owner-change-token");
const ownerImportFileInput = document.getElementById("owner-import-file");
const ownerTokenStatus = document.getElementById("owner-token-status");
const ownerSyncIndicator = document.getElementById("owner-sync-indicator");
const ownerSyncState = document.getElementById("owner-sync-state");
const ownerSyncDetail = document.getElementById("owner-sync-detail");
const dataSourceIndicator = document.getElementById("data-source-indicator");
const dataSourceState = document.getElementById("data-source-state");
const dataSourceDetail = document.getElementById("data-source-detail");

const ownerPlateInput = document.getElementById("owner-patente");
const ownerClienteInput = document.getElementById("owner-cliente");
const ownerModelInput = document.getElementById("owner-model");
const ownerFechaInput = document.getElementById("owner-fecha");
const ownerCurrentKmInput = document.getElementById("owner-km-actual");
const ownerKmInput = document.getElementById("owner-km");
const ownerAceiteInput = document.getElementById("owner-aceite");
const ownerAditivoCarterInput = document.getElementById("owner-aditivo-carter");
const ownerAditivoTransmisionInput = document.getElementById("owner-aditivo-transmision");
const ownerAditivoCombustibleInput = document.getElementById("owner-aditivo-combustible");
const ownerTrabajoDetalleInput = document.getElementById("owner-trabajo-detalle");
const checklistRows = Array.from(document.querySelectorAll(".check-row[data-check-key]"));

const checklistLabels = checklistRows.reduce((acc, row) => {
  const key = row.dataset.checkKey;
  if (key) {
    acc[key] = row.dataset.checkLabel || key;
  }
  return acc;
}, {});

const fields = {
  patente: document.getElementById("res-patente"),
  cliente: document.getElementById("res-cliente"),
  trabajo: document.getElementById("res-trabajo"),
  fecha: document.getElementById("res-fecha"),
  kmActual: document.getElementById("res-km-actual"),
  proximoKm: document.getElementById("res-proximo-km"),
};

function normalizePlate(value) {
  return value.toUpperCase().replace(/\s+/g, "").trim();
}

function formatDisplayDate(dateStr) {
  if (!dateStr) {
    return "-";
  }

  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatKm(value) {
  const numeric = Number(String(value).replace(/\D/g, ""));
  if (!numeric) {
    return "-";
  }

  return `${numeric.toLocaleString("es-AR")} km`;
}

function buildServiceId() {
  return `svc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function decodeOwnerPassword() {
  return OWNER_PASSWORD_BYTES.map((value) => String.fromCharCode(value - OWNER_PASSWORD_SALT)).join("");
}

function readCheckValue(key) {
  const selected = document.querySelector(`input[name="check-${key}"]:checked`);
  return selected ? selected.value : "";
}

function resetChecklistForm() {
  ownerAceiteInput.value = "";
  ownerAditivoCarterInput.value = "";
  ownerAditivoTransmisionInput.value = "";
  ownerAditivoCombustibleInput.value = "";
  ownerTrabajoDetalleInput.value = "";

  checklistRows.forEach((row) => {
    const key = row.dataset.checkKey;
    if (!key) {
      return;
    }

    document
      .querySelectorAll(`input[name="check-${key}"]`)
      .forEach((input) => {
        input.checked = false;
      });
  });
}

function buildChecklistFromForm() {
  const checks = {};

  checklistRows.forEach((row) => {
    const key = row.dataset.checkKey;
    if (!key) {
      return;
    }
    checks[key] = readCheckValue(key);
  });

  const checklist = {
    aceite: ownerAceiteInput.value.trim(),
    aditivoCarter: ownerAditivoCarterInput.value.trim(),
    aditivoTransmision: ownerAditivoTransmisionInput.value.trim(),
    aditivoCombustible: ownerAditivoCombustibleInput.value.trim(),
    detalle: ownerTrabajoDetalleInput.value.trim(),
    checks,
  };

  const hasCheckInSi = Object.values(checks).some((value) => value === "si");
  const hasText = Boolean(
    checklist.aceite ||
      checklist.aditivoCarter ||
      checklist.aditivoTransmision ||
      checklist.aditivoCombustible ||
      checklist.detalle
  );

  if (!hasCheckInSi && !hasText) {
    return null;
  }

  return checklist;
}

function summarizeChecklist(checklist) {
  if (!checklist) {
    return null;
  }

  const parts = [];

  if (checklist.aceite) {
    parts.push(`Aceite: ${checklist.aceite}`);
  }

  const checksInSi = Object.entries(checklist.checks || {})
    .filter(([, value]) => value === "si")
    .map(([key]) => checklistLabels[key] || key);

  if (checksInSi.length > 0) {
    parts.push(`Checks SI: ${checksInSi.join(", ")}`);
  }

  if (checklist.aditivoCarter) {
    parts.push(`Aditivo Carter: ${checklist.aditivoCarter}`);
  }

  if (checklist.aditivoTransmision) {
    parts.push(`Aditivo Transmision: ${checklist.aditivoTransmision}`);
  }

  if (checklist.aditivoCombustible) {
    parts.push(`Aditivo Combustible: ${checklist.aditivoCombustible}`);
  }

  if (checklist.detalle) {
    parts.push(`Detalle: ${checklist.detalle}`);
  }

  return parts.join(" | ");
}

function normalizeChecklist(rawChecklist) {
  if (!rawChecklist || typeof rawChecklist !== "object") {
    return null;
  }

  const checks = {};

  Object.keys(checklistLabels).forEach((key) => {
    const value = rawChecklist.checks && rawChecklist.checks[key];
    checks[key] = value === "si" || value === "no" ? value : "";
  });

  const checklist = {
    aceite: String(rawChecklist.aceite || "").trim(),
    aditivoCarter: String(rawChecklist.aditivoCarter || "").trim(),
    aditivoTransmision: String(rawChecklist.aditivoTransmision || "").trim(),
    aditivoCombustible: String(rawChecklist.aditivoCombustible || "").trim(),
    detalle: String(rawChecklist.detalle || "").trim(),
    checks,
  };

  const hasCheckInSi = Object.values(checks).some((value) => value === "si");
  const hasText = Boolean(
    checklist.aceite ||
      checklist.aditivoCarter ||
      checklist.aditivoTransmision ||
      checklist.aditivoCombustible ||
      checklist.detalle
  );

  return hasCheckInSi || hasText ? checklist : null;
}

function applyChecklistToForm(checklist) {
  resetChecklistForm();

  if (!checklist) {
    return;
  }

  ownerAceiteInput.value = checklist.aceite || "";
  ownerAditivoCarterInput.value = checklist.aditivoCarter || "";
  ownerAditivoTransmisionInput.value = checklist.aditivoTransmision || "";
  ownerAditivoCombustibleInput.value = checklist.aditivoCombustible || "";
  ownerTrabajoDetalleInput.value = checklist.detalle || "";

  Object.entries(checklist.checks || {}).forEach(([key, value]) => {
    if (value !== "si" && value !== "no") {
      return;
    }
    const radio = document.querySelector(`input[name="check-${key}"][value="${value}"]`);
    if (radio) {
      radio.checked = true;
    }
  });
}

async function loadServices() {
  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_FILE_PATH}?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    if (parsed && typeof parsed === "object") return parsed;
  } catch (error) {
    console.error("No se pudo leer services.json desde GitHub", error);
  }
  return null;
}

function normalizeStorageShape(data) {
  const normalized = {};

  for (const [rawPlate, value] of Object.entries(data)) {
    const plate = normalizePlate(rawPlate);
    if (!plate) {
      continue;
    }

    let history = [];

    if (Array.isArray(value)) {
      history = value;
    } else if (value && typeof value === "object" && value.fechaService) {
      history = [value];
    }

    normalized[plate] = history
      .filter((item) => item && item.fechaService && item.trabajo && item.cliente)
      .map((item) => ({
        id: item.id || buildServiceId(),
        cliente: item.cliente,
        model: String(item.model || item.modelo || "").trim(),
        checklist: normalizeChecklist(item.checklist),
        trabajo: item.trabajo,
        fechaService: item.fechaService,
        currentKm: String(item.currentKm || item.kmActual || "").replace(/\D/g, ""),
        proximoKm: String(item.proximoKm || "").replace(/\D/g, ""),
      }))
      .map((item) => ({
        ...item,
        trabajo: item.trabajo || summarizeChecklist(item.checklist) || "Service sin detalle",
      }))
      .slice(0, MAX_HISTORY);
  }

  return normalized;
}

let servicesByPlate = {};
let pendingSyncServices = null;
let syncInProgress = false;
let syncRetryTimer = null;
let syncRetryAttempt = 0;

function setSyncStatus(mode, detail) {
  if (!ownerSyncIndicator || !ownerSyncState || !ownerSyncDetail) {
    return;
  }

  ownerSyncIndicator.classList.remove("owner-sync-idle", "owner-sync-pending", "owner-sync-syncing", "owner-sync-synced");

  const labels = {
    idle: "Estado de sync: esperando",
    pending: "Estado de sync: pendiente",
    syncing: "Estado de sync: sincronizando",
    synced: "Estado de sync: sincronizado",
  };

  ownerSyncIndicator.classList.add(`owner-sync-${mode}`);
  ownerSyncState.textContent = labels[mode] || labels.idle;
  ownerSyncDetail.textContent = detail || "";
}

function setDataSourceStatus(mode, detail) {
  if (!dataSourceIndicator || !dataSourceState || !dataSourceDetail) {
    return;
  }

  dataSourceIndicator.classList.remove(
    "data-source-github",
    "data-source-local",
    "data-source-default",
    "data-source-unknown"
  );

  const labels = {
    github: "Origen de datos: GitHub",
    local: "Origen de datos: respaldo local",
    default: "Origen de datos: datos por defecto",
    unknown: "Origen de datos: verificando",
  };

  dataSourceIndicator.classList.add(`data-source-${mode}`);
  dataSourceState.textContent = labels[mode] || labels.unknown;
  dataSourceDetail.textContent = detail || "";
}

function maskToken(token) {
  if (!token) {
    return "";
  }

  if (token.length <= 8) {
    return "********";
  }

  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function setTokenStatus(mode, detail) {
  if (!ownerTokenStatus) {
    return;
  }

  ownerTokenStatus.classList.remove("owner-token-valid", "owner-token-invalid", "owner-token-unknown");
  ownerTokenStatus.classList.add(`owner-token-${mode}`);
  ownerTokenStatus.textContent = detail;
}

function refreshTokenStatusFromSession() {
  const token = sessionStorage.getItem("gh-token");

  if (!token) {
    setTokenStatus("unknown", "Token GitHub: no cargado en esta sesion.");
    return;
  }

  setTokenStatus("unknown", `Token GitHub: cargado (${maskToken(token)}), pendiente de validacion.`);
}

function loadLocalBackup() {
  try {
    const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("No se pudo leer el respaldo local", error);
    return null;
  }
}

function saveLocalBackup(services) {
  try {
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(services));
  } catch (error) {
    console.error("No se pudo guardar el respaldo local", error);
  }
}

function hasPendingLocalSync() {
  return localStorage.getItem(LOCAL_PENDING_SYNC_KEY) === "1";
}

function setPendingLocalSync(value) {
  try {
    if (value) {
      localStorage.setItem(LOCAL_PENDING_SYNC_KEY, "1");
    } else {
      localStorage.removeItem(LOCAL_PENDING_SYNC_KEY);
    }
  } catch (error) {
    console.error("No se pudo actualizar el estado de sincronizacion local", error);
  }
}

function exportLocalBackupFile() {
  const payload = JSON.stringify(servicesByPlate, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  link.href = url;
  link.download = `respaldo-services-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importLocalBackupFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Formato JSON invalido");
  }

  servicesByPlate = normalizeStorageShape(parsed);
  saveLocalBackup(servicesByPlate);
  renderOwnerTable();
  ownerHistorySection.classList.add("hidden");
  clearOwnerForm();
}

async function syncToGitHub(services) {
  const token = sessionStorage.getItem("gh-token");
  if (!token) throw new Error("Sin token de GitHub");

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;

  // Obtener SHA actual del archivo (requerido por la API para actualizar)
  const getResp = await fetchWithTimeout(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!getResp.ok) throw new Error(`No se pudo obtener el archivo (HTTP ${getResp.status})`);
  const fileData = await getResp.json();

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(services, null, 2))));

  const putResp = await fetchWithTimeout(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `Service actualizado - ${new Date().toLocaleString("es-AR")}`,
      content,
      sha: fileData.sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!putResp.ok) throw new Error(`No se pudo guardar en GitHub (HTTP ${putResp.status})`);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GITHUB_SYNC_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`Tiempo de espera agotado al conectar con GitHub (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isGitHubConfigReady() {
  const missingOwner = !GITHUB_OWNER || GITHUB_OWNER === "TU_USUARIO";
  const missingRepo = !GITHUB_REPO || GITHUB_REPO === "TU_REPOSITORIO";
  return !missingOwner && !missingRepo;
}

function isRetryableSyncError(error) {
  const message = String((error && error.message) || "");
  const permanentHttpErrors = ["HTTP 401", "HTTP 403", "HTTP 404", "HTTP 422"];
  const hasPermanentHttpError = permanentHttpErrors.some((text) => message.includes(text));
  const hasPermanentReason =
    message.includes("Sin token") ||
    message.includes("configuracion") ||
    message.includes("configuración");

  return !hasPermanentHttpError && !hasPermanentReason;
}

function cloneServicesSnapshot(services) {
  return JSON.parse(JSON.stringify(services));
}

function clearSyncRetryTimer() {
  if (syncRetryTimer) {
    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
}

function scheduleSyncRetry() {
  clearSyncRetryTimer();
  const delay = Math.min(SYNC_RETRY_BASE_MS * (syncRetryAttempt + 1), SYNC_RETRY_MAX_MS);
  setSyncStatus("pending", `GitHub no disponible. Reintentando en ${Math.round(delay / 1000)}s.`);
  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = null;
    attemptBackgroundSync();
  }, delay);
}

async function attemptBackgroundSync() {
  if (syncInProgress || !pendingSyncServices) {
    return;
  }

  if (!isGitHubConfigReady()) {
    setSyncStatus("pending", "Configura GITHUB_OWNER y GITHUB_REPO en app.js para habilitar sync con GitHub.");
    setDataSourceStatus("local", "Usando respaldo local mientras se corrige la configuracion de GitHub.");
    return;
  }

  if (!sessionStorage.getItem("gh-token")) {
    setSyncStatus("pending", "Falta token de GitHub en esta sesion del administrador.");
    setDataSourceStatus("local", "Usando respaldo local hasta validar token de GitHub.");
    return;
  }

  if (!navigator.onLine) {
    setSyncStatus("pending", "Sin conexion a internet. Se reintentara automaticamente.");
    setDataSourceStatus("local", "Sin internet: se mantiene respaldo local con reintento automatico.");
    scheduleSyncRetry();
    return;
  }

  syncInProgress = true;
  setSyncStatus("syncing", "Enviando cambios locales a GitHub...");
  const snapshot = pendingSyncServices;

  try {
    await syncToGitHub(snapshot);
    if (pendingSyncServices === snapshot) {
      pendingSyncServices = null;
      setPendingLocalSync(false);
    }
    syncRetryAttempt = 0;
    setSyncStatus("synced", `Ultima sincronizacion: ${new Date().toLocaleString("es-AR")}.`);
    setDataSourceStatus("github", "Datos sincronizados correctamente con el repositorio.");
  } catch (error) {
    console.error("Fallo la sincronizacion automatica con GitHub", error);
    const retryable = isRetryableSyncError(error);

    if (retryable) {
      syncRetryAttempt += 1;
    }

    if (ownerPanelUnlocked) {
      setOwnerStatus("Guardado local confirmado. GitHub pendiente: reintentando sincronizacion automatica.");
    }

    if (retryable) {
      scheduleSyncRetry();
      setDataSourceStatus("local", "Hubo error temporal de GitHub; se mantiene respaldo local hasta reintentar.");
    } else {
      setSyncStatus("pending", `Error de GitHub: ${error.message}. Revisa token/configuracion y vuelve a guardar.`);
      setDataSourceStatus("local", "Error de GitHub: se conserva respaldo local en este dispositivo.");
    }
  } finally {
    syncInProgress = false;
  }

  if (pendingSyncServices) {
    clearSyncRetryTimer();
    setTimeout(() => {
      attemptBackgroundSync();
    }, 0);
  }
}

function persistServices(services) {
  // Local-first: siempre queda persistido en este navegador antes de sincronizar remoto.
  saveLocalBackup(services);
  setPendingLocalSync(true);
  pendingSyncServices = cloneServicesSnapshot(services);
  setSyncStatus("pending", "Cambios guardados localmente. Pendiente de sincronizar con GitHub.");
  clearSyncRetryTimer();
  setTimeout(() => {
    attemptBackgroundSync();
  }, 0);
}

function switchView(mode) {
  const isCustomer = mode === "customer";

  customerView.classList.toggle("hidden", !isCustomer);
  ownerView.classList.toggle("hidden", isCustomer);
  tabCustomer.classList.toggle("is-active", isCustomer);
  tabOwner.classList.toggle("is-active", !isCustomer);
}

async function validateGitHubToken(token) {
  if (!token) {
    return { ok: false, message: "Falta token de GitHub." };
  }

  if (!isGitHubConfigReady()) {
    return { ok: false, message: "Configura GITHUB_OWNER y GITHUB_REPO en app.js." };
  }

  if (!navigator.onLine) {
    return { ok: false, message: "Sin conexion a internet para validar token." };
  }

  const repoUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
  const response = await fetchWithTimeout(repoUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (response.ok) {
    return { ok: true, message: "Token validado correctamente." };
  }

  if (response.status === 401) {
    return { ok: false, message: "Token invalido o vencido (HTTP 401)." };
  }

  if (response.status === 403) {
    return { ok: false, message: "Token sin permisos suficientes (HTTP 403)." };
  }

  if (response.status === 404) {
    return { ok: false, message: "Repo no encontrado o sin acceso (HTTP 404)." };
  }

  return { ok: false, message: `No se pudo validar token (HTTP ${response.status}).` };
}

async function promptAndValidateGitHubToken() {
  const token = window.prompt(
    "Ingresa tu GitHub Personal Access Token para guardar cambios en el repositorio:\n" +
    "(Podes crearlo en GitHub > Settings > Developer settings > Personal access tokens)\n" +
    "El token necesita permiso de escritura en este repositorio."
  );

  if (!token) {
    return { ok: false, message: "Ingreso de token cancelado." };
  }

  setSyncStatus("syncing", "Validando token de GitHub...");
  const validation = await validateGitHubToken(token);

  if (!validation.ok) {
    return validation;
  }

  sessionStorage.setItem("gh-token", token);
  return {
    ...validation,
    token,
  };
}

async function requestOwnerAccess() {
  if (ownerPanelUnlocked) {
    return true;
  }

  const typedPassword = window.prompt("Ingresa la clave del panel administrativo:");
  if (!typedPassword) return false;

  if (typedPassword !== decodeOwnerPassword()) {
    window.alert("Clave incorrecta. No tienes acceso al panel administrativo.");
    return false;
  }

  const currentToken = sessionStorage.getItem("gh-token");

  try {
    const validation = currentToken
      ? await validateGitHubToken(currentToken)
      : await promptAndValidateGitHubToken();

    if (!validation.ok) {
      sessionStorage.removeItem("gh-token");
      setSyncStatus("pending", validation.message);
      setTokenStatus("invalid", `Token GitHub: invalido. ${validation.message}`);
      window.alert(`No se pudo validar el token: ${validation.message}`);
      return false;
    }

    const validatedToken = validation.token || currentToken;
    setSyncStatus("synced", validation.message);
    setTokenStatus("valid", `Token GitHub: validado (${maskToken(validatedToken)}).`);
  } catch (error) {
    setSyncStatus("pending", `No se pudo validar token: ${error.message}`);
    setTokenStatus("invalid", `Token GitHub: error de validacion. ${error.message}`);
    window.alert(`No se pudo validar el token: ${error.message}`);
    return false;
  }

  ownerPanelUnlocked = true;

  if (pendingSyncServices) {
    attemptBackgroundSync();
  }

  return true;
}

function clearOwnerForm() {
  ownerForm.reset();
  resetChecklistForm();
  editingEntry = null;
  ownerSubmit.textContent = "Guardar registro";
  ownerCancel.classList.add("hidden");
}

function setOwnerStatus(message) {
  ownerFormStatus.textContent = message;
}

function parseLegacyTrabajoToForm(trabajo) {
  resetChecklistForm();
  ownerTrabajoDetalleInput.value = trabajo || "";
}

function renderOwnerTable() {
  const entries = Object.entries(servicesByPlate).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (entries.length === 0) {
    ownerTableBody.innerHTML =
      '<tr><td class="empty-row" colspan="7">No hay registros cargados.</td></tr>';
    return;
  }

  ownerTableBody.innerHTML = entries
    .map(([plate, history]) => {
      const lastService = history[0];
      return `<tr>
        <td>${plate}</td>
        <td>${lastService ? lastService.cliente : "-"}</td>
        <td>${lastService ? lastService.model || "-" : "-"}</td>
        <td>${lastService ? formatDisplayDate(lastService.fechaService) : "-"}</td>
        <td>${lastService ? formatKm(lastService.proximoKm) : "-"}</td>
        <td>${history.length} / ${MAX_HISTORY}</td>
        <td class="actions">
          <button type="button" class="row-btn edit" data-action="view-history" data-plate="${plate}">Ver historial</button>
          <button type="button" class="row-btn delete" data-action="delete-plate" data-plate="${plate}">Borrar patente</button>
        </td>
      </tr>`;
    })
    .join("");
}

function renderOwnerPlateHistory(plate) {
  const history = servicesByPlate[plate];

  if (!history || history.length === 0) {
    ownerHistorySection.classList.add("hidden");
    return;
  }

  selectedPlate = plate;
  ownerHistoryTitle.textContent = `Historial de patente ${plate}`;

  ownerHistoryBody.innerHTML = history
    .map((entry, index) => {
      return `<tr>
        <td>${index + 1}</td>
        <td>${formatDisplayDate(entry.fechaService)}</td>
        <td>${entry.trabajo}</td>
        <td>${formatKm(entry.proximoKm)}</td>
        <td class="actions">
          <button type="button" class="row-btn edit" data-action="edit-service" data-plate="${plate}" data-service-id="${entry.id}">Editar</button>
          <button type="button" class="row-btn delete" data-action="delete-service" data-plate="${plate}" data-service-id="${entry.id}">Borrar</button>
        </td>
      </tr>`;
    })
    .join("");

  ownerHistorySection.classList.remove("hidden");
}

function renderCustomerResult(plate) {
  const history = servicesByPlate[plate];

  if (!history || history.length === 0) {
    resultSection.classList.add("hidden");
    historySection.classList.add("hidden");
    emptySection.classList.remove("hidden");
    return;
  }

  const latest = history[0];

  fields.patente.textContent = plate;
  fields.cliente.textContent = latest.cliente;
  fields.trabajo.textContent = latest.trabajo;
  fields.fecha.textContent = formatDisplayDate(latest.fechaService);
  fields.kmActual.textContent = formatKm(latest.currentKm);
  fields.proximoKm.textContent = formatKm(latest.proximoKm);

  historyList.innerHTML = history
    .map(
      (item, index) =>
        `<li>${index + 1}. ${formatDisplayDate(item.fechaService)} - ${item.trabajo} (km actual: ${formatKm(item.currentKm)} | proximo km: ${formatKm(item.proximoKm)})</li>`
    )
    .join("");

  emptySection.classList.add("hidden");
  resultSection.classList.remove("hidden");
  historySection.classList.remove("hidden");
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const plate = normalizePlate(plateInput.value);
  renderCustomerResult(plate);
});

ownerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const plate = normalizePlate(ownerPlateInput.value);
  const cliente = ownerClienteInput.value.trim();
  const model = ownerModelInput.value.trim();
  const fechaService = ownerFechaInput.value;
  const currentKm = ownerCurrentKmInput.value.trim().replace(/\D/g, "");
  const proximoKm = ownerKmInput.value.trim().replace(/\D/g, "");
  const checklist = buildChecklistFromForm();
  const trabajo = summarizeChecklist(checklist);

  if (!plate || !cliente || !fechaService || !currentKm || !checklist || !proximoKm) {
    setOwnerStatus("Completa patente, cliente, fecha, kilometraje actual, proximo km y al menos un check en SI o detalle de service.");
    return;
  }

  if (Number(currentKm) <= 0 || Number(proximoKm) <= 0) {
    setOwnerStatus("Los kilometrajes deben ser mayores a 0.");
    return;
  }

  const newEntry = {
    id: editingEntry ? editingEntry.id : buildServiceId(),
    cliente,
    model,
    checklist,
    trabajo,
    fechaService,
    currentKm,
    proximoKm,
  };

  const currentHistory = servicesByPlate[plate] || [];

  if (editingEntry) {
    const sourcePlate = editingEntry.plate;
    const sourceHistory = servicesByPlate[sourcePlate] || [];
    servicesByPlate[sourcePlate] = sourceHistory.filter((item) => item.id !== editingEntry.id);
    if (servicesByPlate[sourcePlate].length === 0) {
      delete servicesByPlate[sourcePlate];
    }
  }

  servicesByPlate[plate] = [newEntry, ...(servicesByPlate[plate] || [])].slice(0, MAX_HISTORY);

  setOwnerStatus("Guardado local confirmado. Sincronizando con GitHub en segundo plano...");
  persistServices(servicesByPlate);

  renderOwnerTable();
  renderOwnerPlateHistory(plate);
  clearOwnerForm();

  if (currentHistory.length > 0 && !editingEntry) {
    setOwnerStatus(`Se agrego un nuevo service a la patente existente ${plate}.`);
  } else if (editingEntry) {
    setOwnerStatus(`Service actualizado en la patente ${plate}.`);
  } else {
    setOwnerStatus(`Patente ${plate} creada con su primer service.`);
  }
});

ownerCancel.addEventListener("click", () => {
  clearOwnerForm();
  setOwnerStatus("Edicion cancelada.");
});

ownerTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const plate = button.dataset.plate;
  const action = button.dataset.action;
  const history = servicesByPlate[plate];

  if (!history) {
    return;
  }

  if (action === "delete-plate") {
    delete servicesByPlate[plate];
    setOwnerStatus("Guardado local confirmado. Sincronizando con GitHub en segundo plano...");
    persistServices(servicesByPlate);
    renderOwnerTable();
    if (selectedPlate === plate) {
      ownerHistorySection.classList.add("hidden");
    }
    setOwnerStatus(`Patente ${plate} eliminada con todo su historial.`);
    return;
  }

  if (action === "view-history") {
    renderOwnerPlateHistory(plate);
    ownerPlateInput.value = plate;
    setOwnerStatus(`Historial cargado para ${plate}. Puedes agregar otro service.`);
  }
});

ownerHistoryBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const plate = button.dataset.plate;
  const serviceId = button.dataset.serviceId;
  const action = button.dataset.action;
  const history = servicesByPlate[plate] || [];
  const service = history.find((item) => item.id === serviceId);

  if (!service) {
    return;
  }

  if (action === "delete-service") {
    servicesByPlate[plate] = history.filter((item) => item.id !== serviceId);
    if (servicesByPlate[plate].length === 0) {
      delete servicesByPlate[plate];
      ownerHistorySection.classList.add("hidden");
    }
    setOwnerStatus("Guardado local confirmado. Sincronizando con GitHub en segundo plano...");
    persistServices(servicesByPlate);
    renderOwnerTable();
    if (servicesByPlate[plate]) {
      renderOwnerPlateHistory(plate);
    }
    setOwnerStatus(`Service eliminado de la patente ${plate}.`);
    return;
  }

  editingEntry = { plate, id: serviceId };
  ownerPlateInput.value = plate;
  ownerClienteInput.value = service.cliente;
  ownerModelInput.value = service.model || "";
  ownerFechaInput.value = service.fechaService;
  ownerCurrentKmInput.value = service.currentKm || "";
  ownerKmInput.value = service.proximoKm || "";
  if (service.checklist) {
    applyChecklistToForm(service.checklist);
  } else {
    parseLegacyTrabajoToForm(service.trabajo);
  }
  ownerSubmit.textContent = "Guardar cambios del service";
  ownerCancel.classList.remove("hidden");
  setOwnerStatus(`Editando un service de la patente ${plate}.`);
});

ownerExportBackupBtn.addEventListener("click", () => {
  exportLocalBackupFile();
  setOwnerStatus("Respaldo local exportado en archivo JSON.");
});

ownerImportBackupBtn.addEventListener("click", () => {
  ownerImportFileInput.click();
});

ownerChangeTokenBtn.addEventListener("click", async () => {
  try {
    const validation = await promptAndValidateGitHubToken();

    if (!validation.ok) {
      setSyncStatus("pending", validation.message);
      refreshTokenStatusFromSession();
      setOwnerStatus(`No se actualizo el token: ${validation.message}`);
      return;
    }

    setSyncStatus("synced", validation.message);
    setTokenStatus("valid", `Token GitHub: validado (${maskToken(validation.token)}).`);
    setOwnerStatus("Token de GitHub actualizado y validado correctamente.");

    if (pendingSyncServices) {
      attemptBackgroundSync();
    }
  } catch (error) {
    setSyncStatus("pending", `No se pudo validar token: ${error.message}`);
    refreshTokenStatusFromSession();
    setOwnerStatus(`No se pudo actualizar el token: ${error.message}`);
  }
});

ownerImportFileInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    await importLocalBackupFile(file);
    persistServices(servicesByPlate);
    setOwnerStatus("Respaldo importado localmente. Sincronizando con GitHub en segundo plano...");
  } catch (error) {
    console.error(error);
    setOwnerStatus("No se pudo importar el JSON. Revisa el formato del archivo.");
  }

  ownerImportFileInput.value = "";
});

tabCustomer.addEventListener("click", () => switchView("customer"));
tabOwner.addEventListener("click", async () => {
  if (!(await requestOwnerAccess())) {
    return;
  }
  switchView("owner");
});

window.addEventListener("online", () => {
  if (pendingSyncServices) {
    attemptBackgroundSync();
  }
});

async function initializeApp() {
  setDataSourceStatus("unknown", "Comprobando si hay datos remotos o respaldo local...");
  const remoteServices = await loadServices();
  const localBackup = loadLocalBackup();
  const localHasData = Boolean(localBackup && Object.keys(localBackup).length > 0);
  const remoteHasData = Boolean(remoteServices && Object.keys(remoteServices).length > 0);
  const localPending = hasPendingLocalSync();

  let sourceServices = { ...defaultServices };

  if (localPending && localHasData) {
    sourceServices = localBackup;
  } else if (remoteHasData) {
    sourceServices = remoteServices;
  } else if (localHasData) {
    sourceServices = localBackup;
  }

  servicesByPlate = normalizeStorageShape(sourceServices);
  saveLocalBackup(servicesByPlate);
  renderOwnerTable();
  refreshTokenStatusFromSession();

  if (localPending && localHasData) {
    pendingSyncServices = cloneServicesSnapshot(servicesByPlate);
    setSyncStatus("pending", "Se detecto respaldo local. Validando sincronizacion con GitHub...");
    setDataSourceStatus("local", "Se cargo respaldo local porque habia cambios pendientes de sincronizar.");
    setTimeout(() => {
      attemptBackgroundSync();
    }, 0);
  } else if (remoteHasData) {
    setSyncStatus("synced", "Datos cargados desde GitHub.");
    setDataSourceStatus("github", "Datos cargados directamente desde el repositorio de GitHub.");
  } else if (localHasData) {
    setSyncStatus("pending", "GitHub no disponible. Se cargaron datos locales de respaldo.");
    setDataSourceStatus("local", "GitHub no respondio; se uso el respaldo guardado en este dispositivo.");
  } else {
    setSyncStatus("synced", "Datos por defecto cargados temporalmente.");
    setDataSourceStatus("default", "No habia datos remotos ni respaldo local; se cargaron datos de ejemplo.");
  }
}

initializeApp();
