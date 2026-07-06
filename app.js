const storageKey = "plomeroGasistaPresupuesto";
const savedQuotesKey = "plomeroGasistaPresupuestosGuardados";
const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

const fields = [
  "businessName",
  "businessSubtitle",
  "businessPhone",
  "businessLicense",
  "businessArea",
  "quoteNumber",
  "quoteDate",
  "quotePlace",
  "documentTitle",
  "recipientLine",
  "clientName",
  "clientPhone",
  "jobAddress",
  "jobDescription",
  "introText",
  "totalAmount",
  "discount",
  "deposit",
  "showSignature",
  "validUntil",
  "paymentTerms",
  "notes",
  "footerText",
  "signatureText"
];

const state = {
  logoDataUrl: ""
};

const preview = document.querySelector("#quotePreview");
const saveStatus = document.querySelector("#saveStatus");
const savedQuotesList = document.querySelector("#savedQuotesList");
const logoStatus = document.querySelector("#logoStatus");
const updateBanner = document.querySelector("#updateBanner");
const updateAppBtn = document.querySelector("#updateAppBtn");
const forceUpdateBtn = document.querySelector("#forceUpdateBtn");
const exportHint = document.querySelector("#exportHint");
let waitingServiceWorker = null;
let refreshingForUpdate = false;
let exportHintTimeout = null;
let serviceWorkerRegistration = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextQuoteNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `P-${year}${month}${day}-001`;
}

function parseMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFormData() {
  const data = {};
  fields.forEach((id) => {
    const field = document.querySelector(`#${id}`);
    data[id] = field.type === "checkbox" ? field.checked : field.value.trim();
  });
  data.logoDataUrl = state.logoDataUrl;
  return data;
}

function setFormData(data) {
  const migratedData = { ...data };
  if (!migratedData.totalAmount && Array.isArray(migratedData.items)) {
    migratedData.totalAmount = migratedData.items.reduce((sum, item) => sum + itemTotal(item), 0);
  }

  fields.forEach((id) => {
    const field = document.querySelector(`#${id}`);
    if (field.type === "checkbox") {
      field.checked = Boolean(migratedData[id]);
    } else {
      field.value = migratedData[id] || "";
    }
  });
  state.logoDataUrl = data.logoDataUrl || "";
  logoStatus.textContent = state.logoDataUrl ? "Logo cargado" : "Sin logo cargado";
  renderPreview();
}

function itemTotal(item) {
  return parseMoney(item.quantity) * parseMoney(item.price);
}

function calculateTotals(data) {
  const subtotal = parseMoney(data.totalAmount);
  const discount = parseMoney(data.discount);
  const deposit = parseMoney(data.deposit);
  const total = Math.max(subtotal - discount, 0);
  const balance = Math.max(total - deposit, 0);
  return { subtotal, discount, deposit, total, balance };
}

function getSavedQuotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(savedQuotesKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function setSavedQuotes(quotes) {
  localStorage.setItem(savedQuotesKey, JSON.stringify(quotes));
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(getFormData()));
  saveStatus.textContent = "Guardado automaticamente";
}

function scheduleSave() {
  renderPreview();
  save();
}

function setLogoFromFile(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.logoDataUrl = String(reader.result || "");
    logoStatus.textContent = state.logoDataUrl ? "Logo cargado" : "Sin logo cargado";
    scheduleSave();
  });
  reader.readAsDataURL(file);
}

function removeLogo() {
  state.logoDataUrl = "";
  document.querySelector("#logoFile").value = "";
  logoStatus.textContent = "Sin logo cargado";
  scheduleSave();
}

function quoteLabel(data) {
  const parts = [data.quoteNumber, data.clientName, data.quoteDate].filter(Boolean);
  return parts.length ? parts.join(" - ") : "Presupuesto sin datos";
}

function fileSafeName(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function showExportHint() {
  exportHint.hidden = false;
  clearTimeout(exportHintTimeout);
  exportHintTimeout = setTimeout(() => {
    exportHint.hidden = true;
  }, 4500);
}

function exportPdf() {
  const data = getFormData();
  const previousTitle = document.title;
  const titleParts = ["Presupuesto", data.quoteNumber, data.clientName].filter(Boolean);
  document.title = fileSafeName(titleParts.join(" - ")) || "Presupuesto";
  showExportHint();
  window.print();
  setTimeout(() => {
    document.title = previousTitle;
  }, 1000);
}

function saveQuoteCopy() {
  const data = getFormData();
  const quotes = getSavedQuotes();
  const existingIndex = quotes.findIndex((quote) => quote.quoteNumber && quote.quoteNumber === data.quoteNumber);
  const record = {
    ...data,
    id: existingIndex >= 0 ? quotes[existingIndex].id : String(Date.now()),
    savedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    quotes[existingIndex] = record;
  } else {
    quotes.unshift(record);
  }

  setSavedQuotes(quotes);
  renderSavedQuotes();
  saveStatus.textContent = "Copia guardada";
}

function loadSavedQuote(id) {
  const quote = getSavedQuotes().find((savedQuote) => savedQuote.id === id);
  if (!quote) {
    return;
  }
  setFormData(quote);
  save();
}

function deleteSavedQuote(id) {
  const quotes = getSavedQuotes().filter((quote) => quote.id !== id);
  setSavedQuotes(quotes);
  renderSavedQuotes();
}

function renderSavedQuotes() {
  const quotes = getSavedQuotes();
  if (!quotes.length) {
    savedQuotesList.innerHTML = `<p class="empty">Todavia no hay presupuestos guardados.</p>`;
    return;
  }

  savedQuotesList.innerHTML = quotes
    .map(
      (quote) => `
        <div class="saved-quote-row">
          <button class="saved-quote-load" type="button" data-load-quote="${escapeHtml(quote.id)}">
            <strong>${escapeHtml(quoteLabel(quote))}</strong>
            <span>Guardado: ${escapeHtml((quote.savedAt || "").slice(0, 10) || "-")}</span>
          </button>
          <button class="icon-button" type="button" data-delete-quote="${escapeHtml(quote.id)}" aria-label="Eliminar presupuesto">x</button>
        </div>
      `
    )
    .join("");
}

function renderPreview() {
  const data = getFormData();
  const totals = calculateTotals(data);
  const businessName = data.businessName || "Plomeria y Gas";
  const businessSubtitle = data.businessSubtitle || "Servicios de plomeria, gas e instalaciones domiciliarias";
  const showSignature = Boolean(data.showSignature);
  const signatureBlock = showSignature
    ? `
        <div class="signature-box">
          <span>${escapeHtml(data.signatureText || "Firma / aclaracion")}</span>
        </div>
      `
    : "";
  const logoBlock = data.logoDataUrl ? `<img class="preview-logo" src="${escapeHtml(data.logoDataUrl)}" alt="Logo" />` : "";

  preview.innerHTML = `
    <div class="document-page">
      <div class="preview-head">
        <div class="business-heading">
          ${logoBlock}
          <div>
            <h2>${escapeHtml(businessName)}</h2>
            <p>${escapeHtml(businessSubtitle)}</p>
            <p>${escapeHtml(data.businessLicense || "")}</p>
          </div>
        </div>
        <div class="preview-meta">
          <strong>PRESUPUESTO</strong>
          <span>Nro: ${escapeHtml(data.quoteNumber || "-")}</span>
          <span>Fecha: ${escapeHtml(data.quoteDate || "-")}</span>
          <span>${escapeHtml(data.businessPhone || "")}</span>
          <span>${escapeHtml(data.businessArea || "")}</span>
        </div>
      </div>

      <div class="document-title">${escapeHtml(data.documentTitle || "Presupuesto por trabajos a realizar")}</div>

      <div class="letter-meta">
        <p>${escapeHtml(data.quotePlace || "Buenos Aires")}, ${escapeHtml(data.quoteDate || "-")}</p>
        <p><strong>${escapeHtml(data.recipientLine || "A quien corresponda")}</strong></p>
      </div>

      <div class="client-grid preview-block">
        <div>
          <h3>Cliente</h3>
          <p><strong>${escapeHtml(data.clientName || "Cliente sin nombre")}</strong></p>
          <p>${escapeHtml(data.clientPhone || "")}</p>
        </div>
        <div>
          <h3>Domicilio de obra</h3>
          <p>${escapeHtml(data.jobAddress || "-")}</p>
        </div>
      </div>

      <div class="intro-text">
        ${escapeHtml(data.introText || "Por medio de la presente se detalla presupuesto por los trabajos solicitados.")}
      </div>

      <div class="preview-block">
        <h3>Trabajo a realizar</h3>
        <p>${escapeHtml(data.jobDescription || "Sin descripcion general.")}</p>
      </div>

      <div class="totals budget-totals">
        <div class="total-row"><span>Subtotal</span><strong>${currency.format(totals.subtotal)}</strong></div>
        <div class="total-row"><span>Descuento</span><strong>${currency.format(totals.discount)}</strong></div>
        <div class="total-row grand-total"><span>Total presupuesto</span><strong>${currency.format(totals.total)}</strong></div>
        <div class="total-row"><span>Sena / anticipo</span><strong>${currency.format(totals.deposit)}</strong></div>
        <div class="total-row"><span>Saldo restante</span><strong>${currency.format(totals.balance)}</strong></div>
      </div>

      <div class="${showSignature ? "conditions-grid" : "conditions-grid no-signature"} preview-block">
        <div>
          <h3>Condiciones</h3>
          <p><strong>Validez:</strong> ${escapeHtml(data.validUntil || "-")}</p>
          <p><strong>Forma de pago:</strong> ${escapeHtml(data.paymentTerms || "-")}</p>
          <p>${escapeHtml(data.notes || "")}</p>
          <p>${escapeHtml(data.footerText || "Presupuesto sujeto a verificacion en obra. No incluye trabajos adicionales no detallados.")}</p>
        </div>
        ${signatureBlock}
      </div>
    </div>
  `;
}

function showUpdateBanner(registration) {
  waitingServiceWorker = registration.waiting;
  if (!waitingServiceWorker) {
    return;
  }
  updateBanner.hidden = false;
}

function checkForAppUpdate() {
  if (serviceWorkerRegistration) {
    serviceWorkerRegistration.update();
  }
}

function reloadWithCacheBust() {
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}

function forceUpdateApp() {
  if (!("serviceWorker" in navigator)) {
    reloadWithCacheBust();
    return;
  }

  Promise.all([
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
  ]).finally(reloadWithCacheBust);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("./sw.js").then((registration) => {
    serviceWorkerRegistration = registration;
    if (registration.waiting) {
      showUpdateBanner(registration);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) {
        return;
      }

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner(registration);
        }
      });
    });

    setTimeout(checkForAppUpdate, 1500);
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForUpdate) {
      return;
    }
    refreshingForUpdate = true;
    window.location.reload();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForAppUpdate();
    }
  });
}

function newQuote() {
  localStorage.removeItem(storageKey);
  setFormData({
    businessName: "",
    businessSubtitle: "Servicios de plomeria, gas e instalaciones domiciliarias",
    logoDataUrl: "",
    businessPhone: "",
    businessLicense: "",
    businessArea: "",
    quoteNumber: nextQuoteNumber(),
    quoteDate: today(),
    quotePlace: "Buenos Aires",
    documentTitle: "Presupuesto por trabajos a realizar",
    recipientLine: "A quien corresponda",
    showSignature: true,
    totalAmount: "0",
    validUntil: "7 dias",
    paymentTerms: "Efectivo / transferencia",
    introText: "Por medio de la presente se detalla presupuesto por los trabajos solicitados.",
    footerText: "Presupuesto sujeto a verificacion en obra. No incluye trabajos adicionales no detallados.",
    signatureText: "Firma / aclaracion",
    discount: "0",
    deposit: "0"
  });
  save();
}

function boot() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      setFormData(JSON.parse(saved));
    } catch {
      newQuote();
    }
  } else {
    newQuote();
  }

  fields.forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", scheduleSave);
  });

  document.querySelector("#logoFile").addEventListener("change", (event) => {
    setLogoFromFile(event.target.files[0]);
  });

  document.querySelector("#removeLogoBtn").addEventListener("click", removeLogo);

  savedQuotesList.addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-quote]");
    const deleteButton = event.target.closest("[data-delete-quote]");

    if (loadButton) {
      loadSavedQuote(loadButton.dataset.loadQuote);
    }

    if (deleteButton && confirm("Eliminar este presupuesto guardado?")) {
      deleteSavedQuote(deleteButton.dataset.deleteQuote);
    }
  });

  document.querySelector("#newQuoteBtn").addEventListener("click", () => {
    if (confirm("Crear un presupuesto nuevo? Se reemplaza el borrador guardado en este navegador.")) {
      newQuote();
    }
  });

  document.querySelector("#saveQuoteBtn").addEventListener("click", saveQuoteCopy);
  document.querySelector("#printBtn").addEventListener("click", exportPdf);
  forceUpdateBtn.addEventListener("click", forceUpdateApp);
  updateAppBtn.addEventListener("click", () => {
    if (waitingServiceWorker) {
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      forceUpdateApp();
    }
  });
  renderSavedQuotes();
  registerServiceWorker();
}

boot();
