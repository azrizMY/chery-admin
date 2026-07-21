// script.js - Chery Quotation Calculator

// ---------- GLOBAL STATE ----------
let vehicles = [];
let consultants = [];
let defaultConsultantId = "";
let selectedVehicle = null;
let selectedModelYear = 2025;
let selectedRebateAmount = 4000;
let includeOkuanRebate = false;
let selectedNcdPercent = 0;
let selectedInterestRate = 3.0;
let selectedDownpaymentPercent = 10;
let customDownpaymentAmount = 0;
let selectedTenureMonths = 108;
let customTenureMonths = 36;
let isCustomDownpayment = false;
let isCustomTenure = false;
let downpaymentType = "percent";
let addOnPrices = {};
let eligibilitySalary = 3000;
let salaryCommitmentRatio = 35;
let eligibilityLoanMode = "ten-percent";
const MOBILE_LAYOUT_BREAKPOINT = 980;
const DESKTOP_BASELINE_HEIGHT = 1080;
const MAX_DESKTOP_UI_SCALE = 2;
const EIR_EQUIVALENT_FACTOR = 1.86;
const AVAILABLE_MODEL_YEARS = [2025, 2026];
const VEHICLE_DATA_URL = "https://chery-shared-data.data-quotation.workers.dev/chery-car-data.json";
const ADVISOR_SETTINGS_STORAGE_KEY = "chery-advisor-settings";
const DISPLAY_MODE_STORAGE_KEY = "chery-display-mode";
const CONSULTANT_QUERY_PARAM = "consultant";
const APP_PAGE_ROUTES = new Set(["index", "eligibility", "contact"]);
const DEFAULT_ADVISOR_SETTINGS = {
  consultantId: "",
  photo: "",
  qrImage: "",
  name: "AZRI",
  phone: "01154055441",
  instagram: "@azri.cherykb",
  tiktok: "@azri.cherykb",
  facebook: "https://www.facebook.com/azri.cherykb",
  threads: "@azri.cherykb",
};
const ELIGIBILITY_STATUS_ICONS = {
  eligible: "&#10003;",
  potential: "?",
  ineligible: "&#215;",
};

function usesCompactLayout() {
  return window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
}

// Add-on availability and prices are loaded from the vehicle-data Worker.
let selectedAddOns = {};

// ---------- HELPER FUNCTIONS ----------
function formatCurrency(value) {
  if (isNaN(value)) return "0";
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getVehicleImageUrl(vehicle) {
  return vehicle?.image || "";
}

function getEligibilityVehicleImageUrl(vehicle) {
  return vehicle?.imageSP || vehicle?.image || "";
}

function setupVehicleImageLoadingState(image) {
  if (!image || image.dataset.loadStateReady === "true") return;

  image.dataset.loadStateReady = "true";
  image.classList.toggle("is-loaded", image.complete && image.naturalWidth > 0);
  image.addEventListener("load", () => {
    image.classList.add("is-loaded");
    scheduleCardFit();
  });
  image.addEventListener("error", () => {
    image.classList.remove("is-loaded");
  });
}

function setVehicleImageSource(image, source) {
  if (!image || !source) return;

  setupVehicleImageLoadingState(image);
  if (image.getAttribute("src") === source && image.complete && image.naturalWidth > 0) {
    image.classList.add("is-loaded");
    return;
  }

  image.classList.remove("is-loaded");
  image.src = source;
}

function calculateInsuranceAfterNcd(vehicle, ncdPercent) {
  if (!vehicle) return 0;

  const basicPremium = Number(vehicle.basicPremium);
  const additionalBenefits = Number(vehicle.addBenefits);
  const ncd = isNaN(parseFloat(ncdPercent)) ? 0 : parseFloat(ncdPercent);

  if (!Number.isFinite(basicPremium) || !Number.isFinite(additionalBenefits)) return 0;

  const ncdDiscount = basicPremium * (ncd / 100);
  const annualPremium = basicPremium - ncdDiscount + additionalBenefits;
  const insurance = (
    annualPremium * 1.08
    + 10
    + 94.24
  ).toFixed(2);

  return Number(insurance);
}

function getSelectedAddOnsTotal() {
  return Object.entries(selectedAddOns).reduce((total, [key, isSelected]) => {
    const price = Number(addOnPrices[key]);
    return isSelected && Number.isFinite(price) ? total + price : total;
  }, 0);
}

function getVehicleRebateAmount(vehicle, includeOkuan = false) {
  const camTactical = Number(vehicle?.camTactical);
  const okuanTactical = Number(vehicle?.okuanTactical);

  if (Number.isFinite(camTactical) || Number.isFinite(okuanTactical)) {
    return (Number.isFinite(camTactical) ? camTactical : 0)
      + (includeOkuan && Number.isFinite(okuanTactical) ? okuanTactical : 0);
  }

  const directRebate = Number(vehicle?.rebate);
  return Number.isFinite(directRebate) ? directRebate : 0;
}

function getVehicleOkuanRebateAmount(vehicle) {
  const okuanTactical = Number(vehicle?.okuanTactical);
  return Number.isFinite(okuanTactical) ? okuanTactical : 0;
}

function updateSpecialOffersOverflow() {
  const offersList = document.getElementById("quoteSpecialRemark");
  const viewport = offersList?.closest(".special-offers-viewport");
  if (!offersList || !viewport) return;

  offersList.classList.remove("is-scrolling");
  offersList.style.removeProperty("--offers-scroll-distance");
  offersList.style.removeProperty("--offers-scroll-duration");

  requestAnimationFrame(() => {
    const overflowDistance = Math.ceil(offersList.scrollWidth - viewport.clientWidth);
    if (overflowDistance > 4) {
      const durationSeconds = Math.max(10, Math.min(18, overflowDistance / 32));
      offersList.style.setProperty("--offers-scroll-distance", `${overflowDistance}px`);
      offersList.style.setProperty("--offers-scroll-duration", `${durationSeconds}s`);
      offersList.classList.add("is-scrolling");
    }
  });
}

function formatAddOnLabel(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatVehicleSpecValue(value) {
  const text = String(value ?? "").trim();
  return text ? text.toUpperCase() : "-";
}

function renderAddOnControls() {
  const container = document.getElementById("addOnCheckboxList");
  if (!container) return;

  container.innerHTML = "";

  Object.entries(addOnPrices).forEach(([key, rawPrice]) => {
    const price = Number(rawPrice);
    if (!Number.isFinite(price)) return;

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.addOnKey = key;
    checkbox.checked = Boolean(selectedAddOns[key]);

    label.append(checkbox, ` ${formatAddOnLabel(key)} - RM${formatCurrency(price)}`);
    container.appendChild(label);
  });
}

function calculateEirEquivalent(fixedRatePercent) {
  const rate = isNaN(parseFloat(fixedRatePercent)) ? 0 : parseFloat(fixedRatePercent);
  return rate * EIR_EQUIVALENT_FACTOR;
}

function calculateMonthlyPayment(vehicle, rebateAmount, ncdPercent, fixedRatePercent, downpaymentAmount, tenureMonths) {
  if (!vehicle) return 0;
  const addOnsTotal = getSelectedAddOnsTotal();
  const priceWithAddOns = vehicle.price + addOnsTotal;
  const afterRebate = priceWithAddOns - rebateAmount;
  const insuranceCost = calculateInsuranceAfterNcd(vehicle, ncdPercent);
  let financedAmount = afterRebate + insuranceCost - downpaymentAmount;
  if (financedAmount < 0) financedAmount = 0;

  const months = Math.max(0, parseInt(tenureMonths, 10) || 0);
  if (months === 0 || financedAmount === 0) return 0;

  const tenureYears = months / 12;
  const flatRate = fixedRatePercent / 100;
  const totalInterest = financedAmount * flatRate * tenureYears;
  return (financedAmount + totalInterest) / months;
}

function calculateEligibilityPayment(vehicle) {
  if (!vehicle) return 0;
  const rebateAmount = getVehicleRebateAmount(vehicle);
  const insuranceCost = calculateInsuranceAfterNcd(vehicle, 0);
  const loanBasePrice = vehicle.price + insuranceCost;
  const otrPrice = vehicle.price - rebateAmount + insuranceCost;
  const loanAmount = eligibilityLoanMode === "full-loan"
    ? otrPrice
    : roundDownToHundred(loanBasePrice * 0.9);
  const downpayment = eligibilityLoanMode === "full-loan"
    ? 0
    : Math.max(0, otrPrice - loanAmount);
  const financedAmount = Math.max(0, vehicle.price - rebateAmount + insuranceCost - downpayment);
  const fixedRatePercent = vehicle.interestRate || 3.0;
  const months = 108;

  if (financedAmount === 0) return 0;

  const tenureYears = months / 12;
  const flatRate = fixedRatePercent / 100;
  const totalInterest = financedAmount * flatRate * tenureYears;
  return (financedAmount + totalInterest) / months;
}

function roundDownToHundred(value) {
  return Math.floor(value / 100) * 100;
}

function roundCurrencyAmount(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateCashDownpayment(onRoadPrice, loanAmount) {
  if (loanAmount >= onRoadPrice) {
    return roundCurrencyAmount(Math.max(0, onRoadPrice - roundDownToHundred(onRoadPrice)));
  }

  return roundCurrencyAmount(Math.max(0, onRoadPrice - loanAmount));
}

function calculateOnRoadPrice(vehicle, rebateAmount, ncdPercent) {
  if (!vehicle) return 0;
  const addOnsTotal = getSelectedAddOnsTotal();
  const insurance = calculateInsuranceAfterNcd(vehicle, ncdPercent);
  const priceWithAddOns = vehicle.price + addOnsTotal;
  const result = priceWithAddOns - rebateAmount + insurance;
  return result;
}

let cardFitFrame = null;

function getDesktopUiScale() {
  if (usesCompactLayout()) return 1;
  return Math.min(MAX_DESKTOP_UI_SCALE, Math.max(1, window.innerHeight / DESKTOP_BASELINE_HEIGHT));
}

function syncDesktopUiScale() {
  document.documentElement.style.setProperty("--desktop-ui-scale", getDesktopUiScale().toFixed(4));
}

function fitCardToPanel(panelSelector, cardSelector, scaleProperty, options = {}) {
  const panel = document.querySelector(panelSelector);
  const card = document.querySelector(cardSelector);

  if (!panel || !card) return;

  if (usesCompactLayout()) {
    card.style.setProperty(scaleProperty, "1");
    card.style.removeProperty("--summary-card-shell-panel-width");
    card.style.removeProperty("--summary-card-shell-panel-height");
    panel.style.removeProperty("height");
    return;
  }

  panel.style.removeProperty("height");
  card.style.setProperty(scaleProperty, "1");

  const panelStyles = window.getComputedStyle(panel);
  const panelInnerWidth = panel.clientWidth
    - parseFloat(panelStyles.paddingLeft || 0)
    - parseFloat(panelStyles.paddingRight || 0);
  const panelFitWidth = options.useOuterPanelWidth ? panel.clientWidth : panelInnerWidth;
  const panelHeight = panel.clientHeight
    - parseFloat(panelStyles.paddingTop || 0)
    - parseFloat(panelStyles.paddingBottom || 0);

  if (panelFitWidth) {
    card.style.setProperty("--summary-card-shell-panel-width", `${panelFitWidth}px`);
  }

  if (panelHeight && options.syncPanelHeight) {
    card.style.setProperty("--summary-card-shell-panel-height", `${panelHeight}px`);
  }

  const cardStyles = window.getComputedStyle(card);
  const cardWidth = parseFloat(cardStyles.getPropertyValue("--summary-card-shell-design-width")) || card.offsetWidth;
  const cardHeight = card.scrollHeight;

  if (!panelFitWidth || !panelHeight || !cardWidth || !cardHeight) return;

  const desktopScaleLimit = getDesktopUiScale();
  const fitHeightScale = options.fitHeight === false ? desktopScaleLimit : panelHeight / cardHeight;
  const scale = Math.min(desktopScaleLimit, panelFitWidth / cardWidth, fitHeightScale);
  card.style.setProperty(scaleProperty, scale.toFixed(4));

}

function fitQuoteSummaryCardToPanel() {
  if (!usesCompactLayout()) {
    const panel = document.querySelector(".quote-preview-panel");
    const card = document.querySelector(".quote-summary-card");
    if (!panel || !card) return;

    const panelStyles = window.getComputedStyle(panel);
    const panelInnerWidth = panel.clientWidth
      - parseFloat(panelStyles.paddingLeft || 0)
      - parseFloat(panelStyles.paddingRight || 0);
    const panelInnerHeight = panel.clientHeight
      - parseFloat(panelStyles.paddingTop || 0)
      - parseFloat(panelStyles.paddingBottom || 0);

    card.style.setProperty("--summary-card-shell-fit-scale", "1");
    card.style.setProperty("--summary-card-shell-panel-width", `${panelInnerWidth}px`);
    card.style.setProperty("--summary-card-shell-panel-height", `${panelInnerHeight}px`);
    panel.style.removeProperty("height");
    return;
  }

  fitCardToPanel(".quote-preview-panel", ".quote-summary-card", "--summary-card-shell-fit-scale");
}

function fitEligibilitySummaryCardToPanel() {
  fitCardToPanel(".eligibility-preview-panel", ".eligibility-summary-card", "--summary-card-shell-fit-scale", {
    fitHeight: false,
    syncPanelHeight: true,
    useOuterPanelWidth: true,
  });
}

function scheduleCardFit() {
  if (cardFitFrame) cancelAnimationFrame(cardFitFrame);

  cardFitFrame = requestAnimationFrame(() => {
    fitQuoteSummaryCardToPanel();
    fitEligibilitySummaryCardToPanel();
    cardFitFrame = null;
  });
}

function syncResponsiveLabels() {
  const otrLabel = document.querySelector(".on-road-price-label-text");
  const isMobileOrTablet = usesCompactLayout();
  if (otrLabel) {
    otrLabel.innerHTML = window.innerWidth <= 560
      ? 'OTR PRICE <span class="no-claim-discount-note price-breakdown-label-subline">(W/O INSURANCE)</span>'
      : 'OTR PRICE <span class="no-claim-discount-note price-breakdown-label-subline">(WITHOUT INSURANCE)</span>';
  }

  const shouldUseFullYears = isMobileOrTablet && window.innerWidth >= 641;
  document.querySelectorAll("#tenureOptions .option-button").forEach((button) => {
    const months = parseInt(button.getAttribute("data-months"), 10);
    const years = Number.isFinite(months) ? months / 12 : null;
    if (years) button.textContent = `${years} ${shouldUseFullYears ? "Years" : "Yrs"}`;
  });
}

function setAddOnsPanelVisible(isVisible) {
  const addOnsPanel = document.getElementById("addOnsPanel");
  if (addOnsPanel) addOnsPanel.classList.toggle("add-ons-expanded", Boolean(isVisible));

  const addOnsToggleButton = document.getElementById("addOnsToggleButton");
  if (addOnsToggleButton) addOnsToggleButton.classList.toggle("add-ons-expanded", Boolean(isVisible));
}

window.toggleAddOnsPanel = () => {
  const addOnsPanel = document.getElementById("addOnsPanel");
  if (addOnsPanel) setAddOnsPanelVisible(!addOnsPanel.classList.contains("add-ons-expanded"));
};

function setupAddOnsToggle() {
  const addOnsToggleButton = document.getElementById("addOnsToggleButton");
  if (addOnsToggleButton) addOnsToggleButton.addEventListener("click", window.toggleAddOnsPanel);
}

function getStoredAdvisorSettings() {
  try {
    const storedSettings = JSON.parse(window.localStorage.getItem(ADVISOR_SETTINGS_STORAGE_KEY) || "{}");
    return { ...DEFAULT_ADVISOR_SETTINGS, ...storedSettings };
  } catch {
    return { ...DEFAULT_ADVISOR_SETTINGS };
  }
}

function saveAdvisorSettings(settings) {
  try {
    window.localStorage.setItem(ADVISOR_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Advisor settings still apply during this session when storage is unavailable.
  }
}

function getAdvisorSettingValue(key) {
  const input = document.querySelector(`[data-advisor-setting="${key}"]`);
  return input ? input.value.trim() : "";
}

function normalizePhoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

function formatAdvisorPhoneDisplay(phone) {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.startsWith("60")) digits = `0${digits.slice(2)}`;
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)} ${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)} ${digits.slice(6)}`;

  return String(phone || "").trim();
}

function formatAdvisorNameTitleCase(name) {
  return String(name || "")
    .trim()
    .toLocaleLowerCase("en-MY")
    .replace(/(^|\s)\S/g, (character) => character.toLocaleUpperCase("en-MY"));
}

function buildWhatsappUrl(phone) {
  const digits = normalizePhoneDigits(phone);
  const message = "Saya berminat dengan kereta Chery!";
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

function buildTelUrl(phone) {
  const digits = normalizePhoneDigits(phone);
  return digits ? `tel:+${digits}` : "#";
}

function stripSocialHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|facebook\.com|threads\.net)\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}

function buildSocialUrl(platform, value) {
  const rawValue = String(value || "").trim();
  if (/^https?:\/\//i.test(rawValue)) return rawValue;

  const handle = stripSocialHandle(rawValue);
  if (!handle) return "#";

  if (platform === "instagram") return `https://www.instagram.com/${handle}`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (platform === "facebook") return `https://www.facebook.com/${handle}`;
  if (platform === "threads") return `https://www.threads.net/@${handle}`;
  return "#";
}

function getSocialLabel(platform, value, advisorName) {
  const rawValue = String(value || "").trim();
  const handle = stripSocialHandle(rawValue);

  if (platform === "facebook") {
    return rawValue && !/^https?:\/\//i.test(rawValue) && !rawValue.startsWith("@")
      ? rawValue
      : `${advisorName} Chery Sales Consultant`;
  }

  return handle ? `@${handle}` : "";
}

function syncAdvisorSettingInputs(settings) {
  document.querySelectorAll("[data-advisor-setting]").forEach((input) => {
    const key = input.dataset.advisorSetting;
    if (Object.prototype.hasOwnProperty.call(settings, key) && document.activeElement !== input) {
      input.value = settings[key] || "";
    }
  });
}

function getConsultantSettings(consultant) {
  return {
    consultantId: consultant.id,
    photo: consultant.photo || "",
    qrImage: consultant.qrImage || "",
    name: consultant.name || "",
    phone: consultant.phone || "",
    instagram: consultant.socials?.instagram || "",
    tiktok: consultant.socials?.tiktok || "",
    facebook: consultant.socials?.facebook || "",
    threads: consultant.socials?.threads || "",
  };
}

function renderConsultantProfileOptions(selectedConsultantId = getStoredAdvisorSettings().consultantId) {
  const container = document.getElementById("consultantProfileOptions");
  if (!container) return;

  container.innerHTML = "";

  consultants.forEach((consultant) => {
    const button = document.createElement("button");
    const isSelected = consultant.id === selectedConsultantId;
    button.type = "button";
    button.className = "consultant-profile-button";
    button.classList.toggle("selected-consultant", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.textContent = consultant.name;
    button.addEventListener("click", () => selectConsultantProfile(consultant.id, { updateUrl: true }));
    container.appendChild(button);
  });
}

function selectConsultantProfile(consultantId, { updateUrl = false } = {}) {
  const consultant = consultants.find((item) => item.id === consultantId);
  if (!consultant) return;

  const settings = getConsultantSettings(consultant);
  saveAdvisorSettings(settings);
  applyAdvisorSettings(settings);
  renderConsultantProfileOptions(consultant.id);

  if (updateUrl) {
    setCurrentConsultantInUrl(consultant.id);
  }
}

function applyAdvisorSettings(settings = getStoredAdvisorSettings()) {
  const advisorName = (settings.name || DEFAULT_ADVISOR_SETTINGS.name).trim() || DEFAULT_ADVISOR_SETTINGS.name;
  const phoneValue = (settings.phone || DEFAULT_ADVISOR_SETTINGS.phone).trim() || DEFAULT_ADVISOR_SETTINGS.phone;
  const phone = formatAdvisorPhoneDisplay(phoneValue);

  document.querySelectorAll("[data-advisor-name]").forEach((element) => {
    element.textContent = advisorName;
  });

  document.querySelectorAll("[data-advisor-name-title-case]").forEach((element) => {
    element.textContent = formatAdvisorNameTitleCase(advisorName);
  });

  document.querySelectorAll("[data-advisor-phone-text]").forEach((element) => {
    element.textContent = phone;
  });

  document.querySelectorAll("[data-advisor-whatsapp-link]").forEach((link) => {
    link.href = buildWhatsappUrl(phoneValue);
    link.setAttribute("aria-label", `WhatsApp ${advisorName} at ${phone}`);
  });

  document.querySelectorAll("[data-advisor-call-link]").forEach((link) => {
    link.href = buildTelUrl(phoneValue);
    link.setAttribute("aria-label", `Call ${advisorName} at ${phone}`);
  });

  document.querySelectorAll("[data-advisor-qr-image]").forEach((image) => {
    const qrImage = String(settings.qrImage || "").trim();
    image.hidden = !qrImage;
    if (qrImage) image.src = qrImage;
    image.alt = `${advisorName} WhatsApp QR code`;
  });

  ["instagram", "tiktok", "facebook", "threads"].forEach((platform) => {
    const value = String(settings[platform] ?? DEFAULT_ADVISOR_SETTINGS[platform] ?? "").trim();
    const href = buildSocialUrl(platform, value);
    const label = getSocialLabel(platform, value, advisorName);

    document.querySelectorAll(`[data-advisor-social-link="${platform}"]`).forEach((link) => {
      const renderedLabel = platform === "facebook" && link.closest(".contact-page")
        ? formatAdvisorNameTitleCase(label)
        : label;

      link.hidden = !value;
      link.href = href;
      link.setAttribute("aria-label", `${platform} ${renderedLabel}`);
    });

    document.querySelectorAll(`[data-advisor-social-text="${platform}"]`).forEach((element) => {
      element.textContent = platform === "facebook" && element.closest(".contact-page")
        ? formatAdvisorNameTitleCase(label)
        : label;
    });
  });

  document.querySelectorAll("[data-advisor-photo-slot]").forEach((slot) => {
    const photo = String(settings.photo || "").trim();
    const placeholder = slot.querySelector("[data-advisor-photo-placeholder]");
    let image = slot.querySelector("img[data-advisor-photo]");

    if (photo) {
      if (!image) {
        image = document.createElement("img");
        image.dataset.advisorPhoto = "";
        image.alt = advisorName;
        image.addEventListener("load", () => {
          image.hidden = false;
          if (placeholder) placeholder.hidden = true;
          scheduleCardFit();
        });
        image.addEventListener("error", () => {
          image.hidden = true;
          if (placeholder) {
            placeholder.hidden = false;
            placeholder.textContent = advisorName;
          }
          scheduleCardFit();
        });
        slot.appendChild(image);
      }
      image.src = photo;
      image.alt = advisorName;
      if (image.complete) {
        image.hidden = image.naturalWidth === 0;
        if (placeholder) {
          placeholder.hidden = image.naturalWidth > 0;
          placeholder.textContent = advisorName;
        }
      }
    } else {
      if (image) image.remove();
      if (placeholder) {
        placeholder.hidden = false;
        placeholder.textContent = advisorName;
      }
    }
  });

  syncAdvisorSettingInputs(settings);
  updateContactSocialLayout();
  refreshContactLiveScript(settings);
  scheduleCardFit();
}

function updateContactSocialLayout() {
  document.querySelectorAll(".contact-socials").forEach((container) => {
    const visibleLinks = [...container.querySelectorAll(".contact-social-link")]
      .filter((link) => !link.hidden);

    container.querySelectorAll(".contact-social-link").forEach((link) => {
      link.classList.remove("contact-social-link-centered");
    });

    if (visibleLinks.length % 2 === 1) {
      visibleLinks.at(-1)?.classList.add("contact-social-link-centered");
    }
  });
}

function updateAdvisorSettingsFromControls() {
  const currentSettings = getStoredAdvisorSettings();
  const nextSettings = {
    ...currentSettings,
    photo: getAdvisorSettingValue("photo"),
    name: getAdvisorSettingValue("name") || DEFAULT_ADVISOR_SETTINGS.name,
    phone: getAdvisorSettingValue("phone") || DEFAULT_ADVISOR_SETTINGS.phone,
    instagram: getAdvisorSettingValue("instagram"),
    tiktok: getAdvisorSettingValue("tiktok"),
    facebook: getAdvisorSettingValue("facebook"),
    threads: getAdvisorSettingValue("threads"),
  };

  saveAdvisorSettings(nextSettings);
  applyAdvisorSettings(nextSettings);
}

function setupAdvisorSettingsControls() {
  const settings = getStoredAdvisorSettings();
  syncAdvisorSettingInputs(settings);
  applyAdvisorSettings(settings);

  document.querySelectorAll("[data-advisor-setting]").forEach((input) => {
    input.addEventListener("input", updateAdvisorSettingsFromControls);
  });
}

function getControlDrawerPanels() {
  return Array.from(document.querySelectorAll("[data-control-drawer]"));
}

function hasDiscoveredControlDrawer() {
  try {
    return window.localStorage.getItem("chery-control-drawer-discovered") === "true";
  } catch {
    return false;
  }
}

function markControlDrawerDiscovered() {
  document.body.classList.add("control-drawer-discovered");
  try {
    window.localStorage.setItem("chery-control-drawer-discovered", "true");
  } catch {
    // Keep the compact icon state for this page when storage is unavailable.
  }
}

function closeControlDrawers() {
  getControlDrawerPanels().forEach((panel) => {
    panel.classList.remove("drawer-open");
    if (usesCompactLayout()) {
      panel.setAttribute("aria-hidden", "true");
    } else {
      panel.removeAttribute("aria-hidden");
    }
  });

  document.querySelectorAll("[data-drawer-open]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });

  document.body.classList.remove("control-drawer-open");
  scheduleCardFit();
}

function openControlDrawer(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  markControlDrawerDiscovered();

  getControlDrawerPanels().forEach((drawerPanel) => {
    const isTarget = drawerPanel === panel;
    drawerPanel.classList.toggle("drawer-open", isTarget);
    drawerPanel.setAttribute("aria-hidden", isTarget ? "false" : "true");
  });

  document.querySelectorAll("[data-drawer-open]").forEach((button) => {
    button.setAttribute("aria-expanded", String(button.getAttribute("data-drawer-open") === panelId));
  });

  document.body.classList.add("control-drawer-open");
  scheduleCardFit();
}

function syncControlDrawerState() {
  if (!usesCompactLayout()) {
    closeControlDrawers();
    document.body.classList.remove("control-drawer-trigger-hidden");
    getControlDrawerPanels().forEach((panel) => panel.removeAttribute("aria-hidden"));
    return;
  }

  getControlDrawerPanels().forEach((panel) => {
    panel.setAttribute("aria-hidden", panel.classList.contains("drawer-open") ? "false" : "true");
  });
}

function setupControlDrawers() {
  document.body.classList.toggle("control-drawer-discovered", hasDiscoveredControlDrawer());

  document.querySelectorAll("[data-drawer-open]").forEach((button) => {
    button.addEventListener("click", () => openControlDrawer(button.getAttribute("data-drawer-open")));
  });

  document.querySelectorAll("[data-drawer-close]").forEach((button) => {
    button.addEventListener("click", closeControlDrawers);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("control-drawer-open")) {
      closeControlDrawers();
    }
  });

  let lastControlDrawerScrollY = window.scrollY || 0;
  document.addEventListener("scroll", () => {
    if (!usesCompactLayout() || document.body.classList.contains("control-drawer-open")) {
      document.body.classList.remove("control-drawer-trigger-hidden");
      lastControlDrawerScrollY = window.scrollY || 0;
      return;
    }

    const currentScrollY = Math.max(0, window.scrollY || 0);
    const scrollDelta = currentScrollY - lastControlDrawerScrollY;

    if (currentScrollY <= 8 || scrollDelta < -6) {
      document.body.classList.remove("control-drawer-trigger-hidden");
    } else if (scrollDelta > 6) {
      document.body.classList.add("control-drawer-trigger-hidden");
    }

    lastControlDrawerScrollY = currentScrollY;
  }, { passive: true, capture: true });

  syncControlDrawerState();
}

function getConsultantIdFromUrl() {
  return String(new URLSearchParams(window.location.search).get(CONSULTANT_QUERY_PARAM) || "")
    .trim()
    .toLowerCase();
}

function getPageRoute(url) {
  const pathname = new URL(url, window.location.origin).pathname
    .replace(/\/+$/, "")
    .toLowerCase();
  const pageName = pathname.split("/").pop().replace(/\.html$/, "");

  return pageName === "" || pageName === "index" ? "index" : pageName;
}

function syncConsultantNavigationLinks(consultantId = getConsultantIdFromUrl()) {
  const normalizedConsultantId = String(consultantId || "").trim().toLowerCase();
  if (!normalizedConsultantId) return;

  document.querySelectorAll("a[href]").forEach((link) => {
    const rawHref = String(link.getAttribute("href") || "").trim();
    if (!rawHref || rawHref.startsWith("#")) return;

    let targetUrl;
    try {
      targetUrl = new URL(rawHref, window.location.href);
    } catch {
      return;
    }

    if (targetUrl.origin !== window.location.origin || !APP_PAGE_ROUTES.has(getPageRoute(targetUrl.href))) {
      return;
    }

    targetUrl.searchParams.set(CONSULTANT_QUERY_PARAM, normalizedConsultantId);
    link.setAttribute("href", `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
  });
}

function setCurrentConsultantInUrl(consultantId) {
  const normalizedConsultantId = String(consultantId || "").trim().toLowerCase();
  if (!normalizedConsultantId) return;

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set(CONSULTANT_QUERY_PARAM, normalizedConsultantId);
  window.history.replaceState(null, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  syncConsultantNavigationLinks(normalizedConsultantId);
}

function setupPageNavigation() {
  syncConsultantNavigationLinks();

  const currentPage = getPageRoute(window.location.href);

  document.querySelectorAll(".page-navigation-link[href]").forEach((link) => {
    const targetPage = getPageRoute(link.href);
    const isCurrentPage = targetPage === currentPage;

    if (isCurrentPage) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function getStoredDisplayMode() {
  try {
    return window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === "live" ? "live" : "quotation";
  } catch (error) {
    return "quotation";
  }
}

function storeDisplayMode(mode) {
  try {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
  } catch (error) {
    // The mode still works for the current page when browser storage is unavailable.
  }
}

function setCalculatorMode(mode, { persist = true } = {}) {
  const nextMode = mode === "live" ? "live" : "quotation";

  document.body.classList.toggle("calculator-live-mode", nextMode === "live");
  document.body.classList.toggle("live-mode", nextMode === "live");
  document.body.dataset.displayMode = nextMode;
  document.querySelectorAll("[data-calculator-mode]").forEach((button) => {
    const isActive = button.dataset.calculatorMode === nextMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (persist) storeDisplayMode(nextMode);

  scheduleCardFit();
}

function setupCalculatorModeSwitch() {
  const modeButtons = document.querySelectorAll("[data-calculator-mode]");
  if (!modeButtons.length) return;

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setCalculatorMode(button.dataset.calculatorMode));
  });

  setCalculatorMode(getStoredDisplayMode(), { persist: false });
}

function groupVehiclesByModel() {
  return vehicles.reduce((groups, car) => {
    if (!groups[car.model]) groups[car.model] = [];
    groups[car.model].push(car);
    return groups;
  }, {});
}

function getVehicleImageClass(model) {
  return `vehicle-model-${String(model || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function getVehicleModelYear(vehicle) {
  const rawYear = vehicle?.modelYear ?? vehicle?.year ?? vehicle?.model_year;
  const yearMatch = String(rawYear ?? "").match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : Number(rawYear);

  return AVAILABLE_MODEL_YEARS.includes(year) ? year : null;
}

function getVehicleTrimKey(vehicle) {
  return `${vehicle?.model || ""}||${vehicle?.variant || ""}`;
}

function getAvailableModelYearsForVehicle(vehicle) {
  if (!vehicle) return AVAILABLE_MODEL_YEARS;

  const availableYears = vehicles
    .filter((candidate) => getVehicleTrimKey(candidate) === getVehicleTrimKey(vehicle))
    .map(getVehicleModelYear)
    .filter((year, index, years) => year !== null && years.indexOf(year) === index)
    .sort((a, b) => a - b);

  return availableYears.length ? availableYears : AVAILABLE_MODEL_YEARS;
}

function getDefaultModelYearForVehicle(vehicle) {
  const availableYears = getAvailableModelYearsForVehicle(vehicle);
  return availableYears.includes(2025) ? 2025 : availableYears[0];
}

function getMatchingVehicleForYear(vehicle, modelYear) {
  if (!vehicle) return null;

  return vehicles.find((candidate) =>
    getVehicleTrimKey(candidate) === getVehicleTrimKey(vehicle)
    && getVehicleModelYear(candidate) === modelYear
  ) || vehicle;
}

function getVehicleForDefaultYear(vehicle) {
  selectedModelYear = getDefaultModelYearForVehicle(vehicle);
  return getMatchingVehicleForYear(vehicle, selectedModelYear);
}

function buildCalculatorLink(car) {
  const modelYear = getVehicleModelYear(car) ?? getDefaultModelYearForVehicle(car);
  const params = new URLSearchParams({
    car: car.id,
    year: modelYear,
    loanMode: eligibilityLoanMode
  });
  const consultantId = getConsultantIdFromUrl();
  if (consultantId) {
    params.set(CONSULTANT_QUERY_PARAM, consultantId);
  }
  return `index.html?${params.toString()}`;
}

function getEligibilityVariantLabel(car) {
  const modelYear = getVehicleModelYear(car);
  const variant = car?.variant || car?.model || "";

  return modelYear ? `${modelYear} ${variant}` : variant;
}

function getMinimumSalary(car) {
  const value = String(car?.minimumSalary ?? "").replace(/[^\d.]/g, "");
  const minimumSalary = Number(value);
  return Number.isFinite(minimumSalary) && minimumSalary > 0 ? minimumSalary : null;
}

function assessEligibilityModels() {
  const meetsMinimumSalary = eligibilitySalary >= 1500;
  const salaryLimit = eligibilitySalary * (salaryCommitmentRatio / 100);

  return Object.entries(groupVehiclesByModel()).map(([model, cars]) => {
    const assessedCars = cars.map((car) => {
      const monthlyPayment = calculateEligibilityPayment(car);
      const isHighEligibility = meetsMinimumSalary && monthlyPayment <= salaryLimit;
      const minimumSalary = getMinimumSalary(car);
      const isPotentiallyEligible = !isHighEligibility
        && minimumSalary !== null
        && eligibilitySalary >= minimumSalary;

      return { car, monthlyPayment, isHighEligibility, isPotentiallyEligible };
    });
    const visibleCars = assessedCars.filter(({ isHighEligibility, isPotentiallyEligible }) =>
      isHighEligibility || isPotentiallyEligible
    );
    const hasHighEligibility = assessedCars.some(({ isHighEligibility }) => isHighEligibility);
    const hasPotentialEligibility = assessedCars.some(({ isPotentiallyEligible }) => isPotentiallyEligible);
    const rowState = hasHighEligibility
      ? "eligible"
      : hasPotentialEligibility
        ? "potential"
        : "ineligible";

    return { model, cars, assessedCars, visibleCars, rowState };
  });
}

function renderEligibilityRows() {
  const container = document.getElementById("eligibilityRows");
  if (!container || !vehicles.length) return;

  const assessments = assessEligibilityModels();

  container.innerHTML = assessments.map(({ model, cars, visibleCars, rowState }) => {
    const modelImage = getEligibilityVehicleImageUrl(
      cars.find((car) => getEligibilityVehicleImageUrl(car))
    );
    const modelClass = getVehicleImageClass(model);
    const statusText = rowState === "eligible"
      ? "LAYAK"
      : rowState === "potential"
        ? "POTENSI LAYAK"
        : "BELUM LAYAK";
    const chips = visibleCars.length
      ? visibleCars.map(({ car, isHighEligibility }) => {
        const variantLabel = getEligibilityVariantLabel(car);

        return `
        <a class="eligible-variant-link ${isHighEligibility ? "high-eligibility" : "potential-eligibility"}"
          href="${buildCalculatorLink(car)}"
          aria-label="Open ${model} ${variantLabel} calculator">
          ${variantLabel}
        </a>
      `;
      }).join("")
      : '<span class="eligible-variant-link">-</span>';

    return `
      <div class="eligibility-row ${rowState}">
        <span class="eligibility-model"><img src="${modelImage}" alt="${model}" class="eligibility-car-img ${modelClass}"><strong>${model}</strong></span>
        <span class="eligibility-status"><span class="status-icon" aria-hidden="true">${ELIGIBILITY_STATUS_ICONS[rowState]}</span>${statusText}</span>
        <span class="eligible-variants">${chips}</span>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".eligibility-car-img").forEach(setupVehicleImageLoadingState);

  refreshEligibilityLiveScript(assessments);
  scheduleCardFit();
}

function updateSalaryInputs(sourceInput) {
  const salaryInput = document.getElementById("salaryInput");
  const salarySettingsInput = document.getElementById("salarySettingsInput");
  const loanModeInput = document.querySelector('input[name="salaryLoanMode"]:checked');

  if (sourceInput === salaryInput || sourceInput === salarySettingsInput) {
    eligibilitySalary = isNaN(parseFloat(sourceInput.value)) ? 0 : parseFloat(sourceInput.value);
  }

  if (loanModeInput) eligibilityLoanMode = loanModeInput.value;

  if (salaryInput && salaryInput !== sourceInput) salaryInput.value = eligibilitySalary;
  if (salarySettingsInput && salarySettingsInput !== sourceInput) salarySettingsInput.value = eligibilitySalary;

  renderEligibilityRows();
}

function setupEligibilityCalculator() {
  const salaryInput = document.getElementById("salaryInput");
  const salarySettingsInput = document.getElementById("salarySettingsInput");
  const loanModeInputs = document.querySelectorAll('input[name="salaryLoanMode"]');

  if (salaryInput) salaryInput.addEventListener("input", () => updateSalaryInputs(salaryInput));
  if (salarySettingsInput) salarySettingsInput.addEventListener("input", () => updateSalaryInputs(salarySettingsInput));
  loanModeInputs.forEach((input) => {
    input.addEventListener("change", () => updateSalaryInputs(input));
  });
}

// ---------- CALCULATE ROUNDED LOAN AND DOWNPAYMENT ----------
function calculateRoundedLoan(vehicle, rebateAmount, ncdPercent, downpaymentPercent, customDownpayment, useCustomDownpayment) {
  const addOnsTotal = getSelectedAddOnsTotal();
  const priceWithAddOns = vehicle.price + addOnsTotal;
  const afterRebate = priceWithAddOns - rebateAmount;
  const insuranceCost = calculateInsuranceAfterNcd(vehicle, ncdPercent);
  const loanBaseInsurance = calculateInsuranceAfterNcd(vehicle, 0);
  const otrPrice = afterRebate + insuranceCost;
  const loanBasePrice = vehicle.price + loanBaseInsurance;

  const priceAfterRebate = otrPrice;
  const maxLoanAmount = roundDownToHundred(priceAfterRebate);

  let downpayment = 0;
  let loanAmount = 0;
  let isZeroDownpaymentLoan = false;

  const isZeroDownpayment = (useCustomDownpayment && customDownpayment === 0)
    || (!useCustomDownpayment && downpaymentPercent === 0);

  if (isZeroDownpayment) {
    isZeroDownpaymentLoan = true;
    loanAmount = roundDownToHundred(priceAfterRebate);
    downpayment = priceAfterRebate - loanAmount;
  } else {
    if (useCustomDownpayment && customDownpayment > 0) {
      loanAmount = priceAfterRebate - customDownpayment;
      loanAmount = roundDownToHundred(loanAmount);
      downpayment = priceAfterRebate - loanAmount;
    } else {
      const loanPercent = 100 - downpaymentPercent;
      loanAmount = roundDownToHundred((loanBasePrice * loanPercent) / 100);
      loanAmount = Math.min(loanAmount, maxLoanAmount);
      downpayment = priceAfterRebate - loanAmount;
    }
  }

  return {
    loanAmount: loanAmount,
    downpayment: downpayment,
    otrPrice: otrPrice,
    priceAfterRebate: priceAfterRebate,
    isZeroDownpaymentLoan: isZeroDownpaymentLoan,
    addOnsTotal: addOnsTotal
  };
}

// ---------- RESET CAR-SPECIFIC VALUES ----------
function resetCalculatorForVehicle(vehicle) {
  includeOkuanRebate = false;
  selectedRebateAmount = getVehicleRebateAmount(vehicle, includeOkuanRebate);
  selectedNcdPercent = 0;
  selectedInterestRate = vehicle.interestRate || 3.0;
  selectedDownpaymentPercent = 10;
  customDownpaymentAmount = 0;
  isCustomDownpayment = false;
  downpaymentType = "percent";

  selectedAddOns = Object.fromEntries(
    Object.keys(addOnPrices).map((key) => [key, key.toLowerCase() === "dashcam"])
  );
  renderAddOnControls();

  const rebateInput = document.getElementById("rebateInput");
  if (rebateInput) rebateInput.value = selectedRebateAmount;

  const okuanRebateInput = document.getElementById("includeOkuanRebate");
  if (okuanRebateInput) okuanRebateInput.checked = includeOkuanRebate;

  const okuanRebateAmount = document.getElementById("okuanRebateAmount");
  if (okuanRebateAmount) okuanRebateAmount.value = `RM ${formatCurrency(getVehicleOkuanRebateAmount(vehicle))}`;

  const ncdSelect = document.getElementById("ncdSelect");
  if (ncdSelect) ncdSelect.value = selectedNcdPercent;

  const interestInput = document.getElementById("interestRateInput");
  if (interestInput && document.activeElement !== interestInput) interestInput.value = selectedInterestRate;

  updateDownpaymentControl();
}

function applyEligibilityLoanPreset(loanMode) {
  if (loanMode === "full-loan") {
    selectedDownpaymentPercent = 0;
    customDownpaymentAmount = 0;
    isCustomDownpayment = false;
    downpaymentType = "percent";
  } else if (loanMode === "ten-percent") {
    selectedDownpaymentPercent = 10;
    customDownpaymentAmount = 0;
    isCustomDownpayment = false;
    downpaymentType = "percent";
  }
}

// ---------- UPDATE SELECTED TENURE ----------
function updateSelectedTenure() {
  const tenureOptionButtons = document.querySelectorAll("#tenureOptions .option-button");
  tenureOptionButtons.forEach((button) => {
    const months = parseInt(button.getAttribute("data-months"), 10);
    if (!isCustomTenure && months === selectedTenureMonths) {
      button.classList.add("selected-tenure");
    } else {
      button.classList.remove("selected-tenure");
    }
  });

  const repaymentRows = document.querySelectorAll(".repayment-row[data-months]");
  repaymentRows.forEach((row) => {
    const months = parseInt(row.getAttribute("data-months"), 10);
    const isSelected = isCustomTenure
      ? row.id === "customTenureRepaymentRow"
      : months === selectedTenureMonths;
    if (isSelected) {
      row.classList.add("selected-repayment-row");
    } else {
      row.classList.remove("selected-repayment-row");
    }
  });

  const customTenureInput = document.getElementById("customTenureMonthsInput");
  if (customTenureInput && document.activeElement !== customTenureInput) {
    customTenureInput.value = selectedTenureMonths || "";
  }
}

function updateDownpaymentControl() {
  const downpaymentInput = document.getElementById("downpaymentValueInput");
  if (downpaymentInput) {
    const isAmountMode = downpaymentType === "amount";
    downpaymentInput.value = isAmountMode ? customDownpaymentAmount : selectedDownpaymentPercent;
    downpaymentInput.step = isAmountMode ? "1000" : "1";
    downpaymentInput.max = isAmountMode ? "" : "50";
    downpaymentInput.placeholder = isAmountMode ? "e.g., 10000.50" : "10";
  }

  document.querySelectorAll("#downpaymentTypeOptions .downpayment-type-button").forEach((button) => {
    const isActive = button.getAttribute("data-downpayment-type") === downpaymentType;
    button.classList.toggle("selected-downpayment-type", isActive);
  });
}

function updateModelYearSelection() {
  document.querySelectorAll("#modelYearOptions .option-button").forEach((button) => {
    const year = Number(button.getAttribute("data-model-year"));
    button.classList.toggle("selected-model-year", year === selectedModelYear);
  });
}

function renderModelYearOptions() {
  const container = document.getElementById("modelYearOptions");
  if (!container) return;

  container.innerHTML = "";

  const availableYears = getAvailableModelYearsForVehicle(selectedVehicle);
  AVAILABLE_MODEL_YEARS.forEach((year) => {
    const isAvailable = availableYears.includes(year);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.dataset.modelYear = String(year);
    button.textContent = String(year);
    button.disabled = !isAvailable;
    button.setAttribute("aria-disabled", String(!isAvailable));
    if (!isAvailable) button.title = `${year} model data is not available for this variant`;
    if (isAvailable) button.addEventListener("click", () => selectModelYear(year));
    container.appendChild(button);
  });

  container.style.setProperty("--model-year-count", AVAILABLE_MODEL_YEARS.length);
  updateModelYearSelection();
}

function setLiveScriptText(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = value;
}

function formatLiveScriptMoney(value, step = 100) {
  const numericValue = Math.max(0, Number(value) || 0);
  const roundedDownValue = Math.floor(numericValue / step) * step;
  if (numericValue > 0 && roundedDownValue === 0) return `bawah RM ${step.toLocaleString("en-MY")}`;
  return `RM ${roundedDownValue.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function formatLiveScriptExactMoney(value) {
  const numericValue = Math.max(0, Number(value) || 0);
  return `RM ${numericValue.toLocaleString("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatLiveScriptOfferList(value) {
  const offers = String(value || "")
    .split(/\s+\+\s+|[;\n]+/)
    .map((offer) => offer.trim())
    .filter(Boolean);

  if (offers.length <= 1) return offers[0] || "";
  if (offers.length === 2) return offers.join(" dan ");
  return `${offers.slice(0, -1).join(", ")} dan ${offers.at(-1)}`;
}

function formatLiveScriptTextList(values) {
  const items = [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return items.join(" dan ");
  return `${items.slice(0, -1).join(", ")} dan ${items.at(-1)}`;
}

function refreshEligibilityLiveScript(assessments = assessEligibilityModels()) {
  if (!document.getElementById("eligibilityLiveScriptTitle")) return;

  const salaryLimit = eligibilitySalary * (salaryCommitmentRatio / 100);
  const eligibleCars = assessments.flatMap(({ assessedCars }) =>
    assessedCars.filter(({ isHighEligibility }) => isHighEligibility)
  );
  const potentialCars = assessments.flatMap(({ assessedCars }) =>
    assessedCars.filter(({ isPotentiallyEligible }) => isPotentiallyEligible)
  );
  const eligibleModels = assessments
    .filter(({ rowState }) => rowState === "eligible")
    .map(({ model }) => getLiveScriptModelName(model));
  const potentialModels = assessments
    .filter(({ rowState }) => rowState === "potential")
    .map(({ model }) => getLiveScriptModelName(model));
  const loanSetup = eligibilityLoanMode === "full-loan" ? "full loan" : "10% downpayment";
  const loanBadge = eligibilityLoanMode === "full-loan" ? "FULL LOAN" : "10% DOWNPAYMENT";
  const resultParts = [];

  if (eligibleModels.length) resultParts.push(`${eligibleModels.length} LAYAK`);
  if (potentialModels.length) resultParts.push(`${potentialModels.length} POTENSI`);
  if (!resultParts.length) resultParts.push("BELUM ADA PILIHAN");

  setLiveScriptText("eligibilityLiveSalaryBadge", formatLiveScriptMoney(eligibilitySalary, 1));
  setLiveScriptText("eligibilityLiveLimitBadge", `${formatLiveScriptMoney(salaryLimit, 1)} / BULAN`);
  setLiveScriptText("eligibilityLiveLoanBadge", loanBadge);
  setLiveScriptText("eligibilityLiveResultBadge", resultParts.join(" · "));

  setLiveScriptText(
    "eligibilityLiveOpening",
    `Okay, saya jawab untuk yang baru comment gaji bersih ${formatLiveScriptMoney(eligibilitySalary, 1)} tadi. Untuk semakan awal ini, saya gunakan setup ${loanSetup} dengan tempoh 9 tahun.`
  );
  setLiveScriptText(
    "eligibilityLiveBudget",
    `Dengan guideline ansuran 35% daripada gaji, had bayaran bulanan yang kita gunakan ialah sekitar ${formatLiveScriptMoney(salaryLimit, 1)} sebulan.`
  );

  if (eligibleModels.length) {
    const lowestEligiblePayment = Math.min(...eligibleCars.map(({ monthlyPayment }) => monthlyPayment));
    setLiveScriptText(
      "eligibilityLiveEligible",
      `Model yang masuk kategori Layak ialah ${formatLiveScriptTextList(eligibleModels)}. Anggaran bayaran paling rendah bermula sekitar ${formatLiveScriptMoney(lowestEligiblePayment, 1)} sebulan.`
    );
  } else if (potentialModels.length) {
    setLiveScriptText(
      "eligibilityLiveEligible",
      `Buat masa ini belum ada model dalam zon Layak berdasarkan had 35%, tetapi masih ada pilihan yang boleh kita cuba semak dengan pihak bank.`
    );
  } else {
    setLiveScriptText(
      "eligibilityLiveEligible",
      `Untuk angka gaji ini, belum ada model yang melepasi semakan awal. Kita boleh cuba susun semula downpayment atau semak bersama pemohon kedua.`
    );
  }

  if (potentialModels.length) {
    const lowestPotentialPayment = Math.min(...potentialCars.map(({ monthlyPayment }) => monthlyPayment));
    setLiveScriptText(
      "eligibilityLivePotential",
      `Dalam kategori Potensi Layak pula ada ${formatLiveScriptTextList(potentialModels)}, dengan anggaran bayaran bermula sekitar ${formatLiveScriptMoney(lowestPotentialPayment, 1)} sebulan. Yang ini masih perlukan semakan profile dengan lebih detail.`
    );
  } else {
    setLiveScriptText(
      "eligibilityLivePotential",
      eligibleModels.length
        ? "Pilihan yang saya sebut tadi berada dalam had kiraan semasa, jadi kita boleh teruskan kepada personalized quotation."
        : "Kalau ada extra income atau pemohon bersama, beritahu saya supaya saya boleh buat semakan yang lebih sesuai."
    );
  }

  setLiveScriptText(
    "eligibilityLiveNote",
    "Ini anggaran awal sahaja. Bank tetap akan tengok komitmen sedia ada, rekod CCRIS atau CTOS, jenis pekerjaan, tempoh bekerja dan dokumen pendapatan sebelum beri final approval."
  );
  setLiveScriptText(
    "eligibilityLiveClosing",
    "Kalau nak saya semak lebih tepat, tekan dan isi beg oren di bawah. Korang yang lain, boleh komen gaji bersih korang sahaja—iaitu baki selepas tolak semua komitmen bulanan seperti EPF, SOCSO serta komitmen lain. Saya akan semak satu per satu."
  );
}

function refreshContactLiveScript(settings = getStoredAdvisorSettings()) {
  if (!document.getElementById("contactLiveScriptTitle")) return;

  const resolvedSettings = { ...DEFAULT_ADVISOR_SETTINGS, ...settings };
  const advisorName = formatAdvisorNameTitleCase(resolvedSettings.name || DEFAULT_ADVISOR_SETTINGS.name);

  setLiveScriptText("contactLiveNameBadge", advisorName.toUpperCase());
  setLiveScriptText(
    "contactLiveOpening",
    `Okay, untuk awak yang baru tanya macam mana nak dapatkan quotation Chery, tekan dan isi beg oren di bawah. Saya, ${advisorName}, akan bantu awak dari situ.`
  );
  setLiveScriptText(
    "contactLiveServices",
    "Saya boleh bantu sediakan personalized car quotation, semak kelayakan loan, terangkan downpayment dan bayaran bulanan, susun test drive, terima urusan trade-in, serta semak promo dan rebate yang sedang available."
  );
  setLiveScriptText(
    "contactLiveRequirements",
    "Untuk saya kira dengan cepat, berikan model dan varian yang awak minat, jumlah downpayment, tempoh loan, NCD insurance, komitmen bulanan dan maklumat trade-in jika ada."
  );
  setLiveScriptText(
    "contactLiveSocials",
    "Follow akaun ini untuk update model, promo dan content Chery yang terbaru."
  );
  setLiveScriptText(
    "contactLiveClosing",
    `Kalau awak dah ready, tekan dan isi beg oren di bawah. Bagi viewers lain boleh komen “NAK QUOTATION”, dan saya akan guide langkah seterusnya.`
  );
}

function formatLiveScriptTenure(months) {
  const normalizedMonths = Math.max(1, Math.round(Number(months) || 0));
  if (normalizedMonths % 12 === 0) return `${normalizedMonths / 12} tahun`;
  return `${normalizedMonths} bulan`;
}

function getLiveScriptModelName(model) {
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) return "model ini";
  if (/^chery\s+o5\b/i.test(normalizedModel)) {
    return normalizedModel.replace(/^chery\b/i, "Chery");
  }
  return normalizedModel.replace(/^chery\s+/i, "");
}

function refreshLiveScript({
  onRoadPrice,
  insuranceAmount,
  loanAmount,
  calculatedDownpayment,
  selectedMonthlyPayment,
  monthlyPayments,
}) {
  if (!selectedVehicle) return;

  const modelName = getLiveScriptModelName(selectedVehicle.model);
  const variantName = String(selectedVehicle.variant || "").trim();
  const modelDescription = `${modelName}${variantName ? ` ${variantName}` : ""} ${selectedModelYear}`;
  const selectedMonths = isCustomTenure ? customTenureMonths : selectedTenureMonths;
  const selectedTenureLabel = formatLiveScriptTenure(selectedMonths);
  const priceWithoutInsurance = selectedVehicle.price + getSelectedAddOnsTotal();
  const advisorName = formatAdvisorNameTitleCase(
    String(document.querySelector("[data-advisor-name]")?.textContent || "saya").trim()
  );
  const ncdDescription = selectedNcdPercent > 0
    ? `dengan ${selectedNcdPercent}% NCD`
    : "tanpa NCD";
  const interestRateLabel = Number(selectedInterestRate.toFixed(2));
  const viewerDownpayment = isCustomDownpayment
    ? (customDownpaymentAmount > 0 ? `downpayment ${formatLiveScriptMoney(customDownpaymentAmount)}` : "zero downpayment")
    : (selectedDownpaymentPercent > 0 ? `downpayment ${selectedDownpaymentPercent}%` : "zero downpayment");

  const downpaymentBadge = !isCustomDownpayment
    ? `${selectedDownpaymentPercent}% · ${formatLiveScriptMoney(calculatedDownpayment)}`
    : formatLiveScriptMoney(customDownpaymentAmount || calculatedDownpayment);

  setLiveScriptText("liveScriptModelBadge", modelDescription);
  setLiveScriptText("liveScriptDownpaymentBadge", downpaymentBadge);
  setLiveScriptText("liveScriptTenureBadge", selectedTenureLabel.toUpperCase());
  setLiveScriptText("liveScriptMonthlyBadge", formatLiveScriptMoney(selectedMonthlyPayment, 1));

  setLiveScriptText(
    "liveScriptOpening",
    `Okay, saya jawab untuk yang baru comment tadi. Untuk ${modelDescription} dengan ${viewerDownpayment}, ini kiraan yang paling senang untuk awak faham.`
  );

  setLiveScriptText(
    "liveScriptPrice",
    `Harga tanpa insurance ialah ${formatLiveScriptMoney(priceWithoutInsurance)}. Kemudian tambah insurance sekitar ${formatLiveScriptMoney(insuranceAmount)} ${ncdDescription}, dan tolak rebate ${formatLiveScriptExactMoney(selectedRebateAmount)}. Jadi harga on-the-road termasuk insurance lebih kurang ${formatLiveScriptMoney(onRoadPrice)}.`
  );

  let loanScript = "";
  if (isCustomDownpayment && customDownpaymentAmount > 0) {
    loanScript = `Dengan downpayment ${formatLiveScriptMoney(customDownpaymentAmount)}, jumlah loan sebanyak ${formatLiveScriptMoney(loanAmount)} pada interest rate ${interestRateLabel}%.`;
  } else if ((!isCustomDownpayment && selectedDownpaymentPercent === 0) || (isCustomDownpayment && customDownpaymentAmount === 0)) {
    loanScript = `Untuk zero downpayment setup ini, jumlah loan sebanyak ${formatLiveScriptMoney(loanAmount)} pada interest rate ${interestRateLabel}%.`;
  } else {
    loanScript = `Downpayment ${selectedDownpaymentPercent}% bersamaan lebih kurang ${formatLiveScriptMoney(calculatedDownpayment)}, dan jumlah loan sebanyak ${formatLiveScriptMoney(loanAmount)} pada interest rate dianggarkan sebanyak ${interestRateLabel}%.`;
  }
  loanScript += ` Jadi, dengan tempoh ${selectedTenureLabel}, anggaran bayaran bulanan awak ialah ${formatLiveScriptMoney(selectedMonthlyPayment, 1)}.`;
  setLiveScriptText("liveScriptLoan", loanScript);

  setLiveScriptText(
    "liveScriptMonthly",
    `Kalau ambil loan tempoh ${selectedTenureLabel}, anggaran bayaran bulanan ialah ${formatLiveScriptMoney(selectedMonthlyPayment, 1)} sebulan.`
  );
  setLiveScriptText(
    "liveScriptComparison",
    `Untuk pilihan tempoh lain, anggaran bayaran bulanan ialah ${formatLiveScriptMoney(monthlyPayments[108], 1)} bagi 9 tahun, ${formatLiveScriptMoney(monthlyPayments[84], 1)} bagi 7 tahun, ${formatLiveScriptMoney(monthlyPayments[60], 1)} bagi 5 tahun, dan ${formatLiveScriptMoney(monthlyPayments[36], 1)} bagi 3 tahun.`
  );

  const specialRemark = String(selectedVehicle.specialRemark || "").trim();
  const hasSpecialRemark = specialRemark !== ""
    && !["-", "n/a", "none", "null"].includes(specialRemark.toLowerCase());
  const offerScript = hasSpecialRemark
    ? `Untuk model ni, offer yang included ialah: ${formatLiveScriptOfferList(specialRemark)} Saya akan confirm semula availability sebelum booking.`
    : "Untuk promo semasa, saya akan confirm ikut stock dan campaign terkini sebelum awak booking.";
  setLiveScriptText("liveScriptOffer", offerScript);

  setLiveScriptText(
    "liveScriptClosing",
    `Jadi kalau awak berminat dengan ${modelDescription}, tekan dan isi beg oren di bawah. Saya akan hubungi awak untuk semak kelayakan dan sediakan personalized quotation dengan lebih detail. Untuk viewers lain yang nak quotation berbeza, komen model kereta Chery, jumlah downpayment, insurance jika ada trade-in, dan tempoh yang awak mahu—saya buat kiraan seterusnya.`
  );
}

// ---------- REFRESH QUOTE SUMMARY ----------
function refreshQuoteSummary() {
  if (!selectedVehicle) return;

  const totalRebate = selectedRebateAmount;

  const sellingPriceElement = document.getElementById("quoteSellingPrice");
  if (sellingPriceElement) {
    const addOnsTotal = getSelectedAddOnsTotal();
    const priceWithAddOns = selectedVehicle.price + addOnsTotal;
    sellingPriceElement.innerHTML = `RM ${formatCurrency(priceWithAddOns)}`;
  }

  const rebateElement = document.getElementById("quoteRebate");
  if (rebateElement) rebateElement.innerHTML = `- RM ${formatCurrency(selectedRebateAmount)}`;

  const insuranceAmount = calculateInsuranceAfterNcd(selectedVehicle, selectedNcdPercent);
  const insuranceElement = document.getElementById("quoteInsurance");
  if (insuranceElement) insuranceElement.innerHTML = `RM ${formatCurrency(insuranceAmount)}`;

  const insuranceBreakdownLabel = document.getElementById("insuranceBreakdownLabel");
  if (insuranceBreakdownLabel) {
    insuranceBreakdownLabel.innerHTML = `INSURANCE <span class="no-claim-discount-note">(${selectedNcdPercent}% NCD)</span>`;
  }

  const interestElement = document.getElementById("quoteInterest");
  if (interestElement) interestElement.innerHTML = `${selectedInterestRate.toFixed(2)}%`;

  const specialRemarkElement = document.getElementById("quoteSpecialRemark");
  const specialOffersRow = document.getElementById("quoteSpecialOffers");
  if (specialRemarkElement && specialOffersRow) {
    const specialRemark = String(selectedVehicle?.specialRemark || "").trim();
    const hasSpecialRemark = specialRemark !== ""
      && !["-", "n/a", "none", "null"].includes(specialRemark.toLowerCase());
    const offers = hasSpecialRemark
      ? specialRemark.split(/\s+\+\s+|[;\n]+/).map((offer) => offer.trim()).filter(Boolean)
      : [];

    const displayedOffers = offers.length > 0 ? offers : ["N/A"];
    specialRemarkElement.replaceChildren(...displayedOffers.map((offer) => {
      const item = document.createElement("span");
      item.className = offer === "N/A" ? "special-offer-item special-offer-empty" : "special-offer-item";
      item.textContent = offer;
      return item;
    }));
    specialOffersRow.hidden = false;
    updateSpecialOffersOverflow();
  }

  const eirDisplayElement = document.getElementById("eirDisplay");
  if (eirDisplayElement) {
    const eirEquivalent = calculateEirEquivalent(selectedInterestRate);
    eirDisplayElement.value = `${eirEquivalent.toFixed(2)}%`;
  }

  const vehicleModelElement = document.getElementById("quoteVehicleModel");
  const vehicleVariantElement = document.getElementById("quoteVehicleVariant");

  if (vehicleModelElement) {
    vehicleModelElement.textContent = selectedVehicle.model.toUpperCase();
  }

  if (vehicleVariantElement) {
    vehicleVariantElement.textContent = `${selectedModelYear} ${(selectedVehicle.variant || "").toUpperCase()}`;
  }

  const vehicleEngineElement = document.getElementById("quoteVehicleEngine");
  if (vehicleEngineElement) vehicleEngineElement.textContent = formatVehicleSpecValue(selectedVehicle.engine);

  const vehicleDrivetrainElement = document.getElementById("quoteVehicleDrivetrain");
  if (vehicleDrivetrainElement) vehicleDrivetrainElement.textContent = formatVehicleSpecValue(selectedVehicle.drivetrain);

  const vehicleTransmissionElement = document.getElementById("quoteVehicleTransmission");
  if (vehicleTransmissionElement) vehicleTransmissionElement.textContent = formatVehicleSpecValue(selectedVehicle.transmission);

  const vehicleImageElement = document.getElementById("quoteVehicleImage");
  if (vehicleImageElement && getVehicleImageUrl(selectedVehicle)) {
    setVehicleImageSource(vehicleImageElement, getVehicleImageUrl(selectedVehicle));
    vehicleImageElement.classList.remove(...Array.from(vehicleImageElement.classList).filter((className) => className.startsWith("vehicle-model-")));
    vehicleImageElement.classList.add(getVehicleImageClass(selectedVehicle.model));
  }

  const onRoadPrice = Math.max(0, calculateOnRoadPrice(selectedVehicle, totalRebate, selectedNcdPercent));
  const onRoadPriceElement = document.getElementById("quoteOnRoadPrice");
  if (onRoadPriceElement) onRoadPriceElement.innerHTML = `RM ${formatCurrency(onRoadPrice)}`;

  const loanResult = calculateRoundedLoan(
    selectedVehicle,
    selectedRebateAmount,
    selectedNcdPercent,
    selectedDownpaymentPercent,
    customDownpaymentAmount,
    isCustomDownpayment
  );

  const loanAmount = Math.max(0, loanResult.loanAmount);
  const calculatedDownpayment = calculateCashDownpayment(onRoadPrice, loanAmount);

  const downpaymentElement = document.getElementById("quoteDownpayment");
  if (downpaymentElement) {
    if (loanResult.isZeroDownpaymentLoan) {
      downpaymentElement.innerHTML = `RM ${formatCurrency(calculatedDownpayment)}`;
    } else if (isCustomDownpayment && customDownpaymentAmount > 0) {
      downpaymentElement.innerHTML = `RM ${formatCurrency(calculatedDownpayment)}`;
    } else {
      downpaymentElement.innerHTML = `${selectedDownpaymentPercent}% <span class="amount-nowrap">(RM&nbsp;${formatCurrency(calculatedDownpayment)})</span>`;
    }
  }

  const loanAmountElement = document.getElementById("quoteLoanAmount");
  if (loanAmountElement) loanAmountElement.innerHTML = `RM ${formatCurrency(loanAmount)}`;

  const monthlyPayment9Years = calculateMonthlyPayment(selectedVehicle, totalRebate, selectedNcdPercent, selectedInterestRate, calculatedDownpayment, 108);
  const monthlyPayment7Years = calculateMonthlyPayment(selectedVehicle, totalRebate, selectedNcdPercent, selectedInterestRate, calculatedDownpayment, 84);
  const monthlyPayment5Years = calculateMonthlyPayment(selectedVehicle, totalRebate, selectedNcdPercent, selectedInterestRate, calculatedDownpayment, 60);
  const monthlyPayment3Years = calculateMonthlyPayment(selectedVehicle, totalRebate, selectedNcdPercent, selectedInterestRate, calculatedDownpayment, 36);
  const dynamicTenureMonths = isCustomTenure ? customTenureMonths : null;
  const monthlyPaymentDynamic = isCustomTenure
    ? calculateMonthlyPayment(selectedVehicle, totalRebate, selectedNcdPercent, selectedInterestRate, calculatedDownpayment, dynamicTenureMonths)
    : null;
  const selectedPaymentMonths = isCustomTenure ? customTenureMonths : selectedTenureMonths;
  const monthlyPayments = {
    108: monthlyPayment9Years,
    84: monthlyPayment7Years,
    60: monthlyPayment5Years,
    36: monthlyPayment3Years,
  };
  const selectedMonthlyPayment = monthlyPayments[selectedPaymentMonths]
    ?? calculateMonthlyPayment(selectedVehicle, totalRebate, selectedNcdPercent, selectedInterestRate, calculatedDownpayment, selectedPaymentMonths);

  const nineYearPaymentElement = document.getElementById("monthlyPayment9Years");
  if (nineYearPaymentElement) nineYearPaymentElement.innerHTML = `RM ${monthlyPayment9Years.toFixed(2)}`;

  const sevenYearPaymentElement = document.getElementById("monthlyPayment7Years");
  if (sevenYearPaymentElement) sevenYearPaymentElement.innerHTML = `RM ${monthlyPayment7Years.toFixed(2)}`;

  const fiveYearPaymentElement = document.getElementById("monthlyPayment5Years");
  if (fiveYearPaymentElement) fiveYearPaymentElement.innerHTML = `RM ${monthlyPayment5Years.toFixed(2)}`;

  const threeYearPaymentElement = document.getElementById("monthlyPayment3Years");
  if (threeYearPaymentElement) threeYearPaymentElement.innerHTML = `RM ${monthlyPayment3Years.toFixed(2)}`;

  const customPaymentElement = document.getElementById("monthlyPaymentCustomTenure");
  if (customPaymentElement) {
    customPaymentElement.innerHTML = isCustomTenure && monthlyPaymentDynamic !== null
      ? `RM ${monthlyPaymentDynamic.toFixed(2)}`
      : "-";
  }

  const customTenureLabelElement = document.getElementById("customTenureLabel");
  if (customTenureLabelElement) {
    const customTenureLabel = isCustomTenure ? `${customTenureMonths || 0} MONTHS` : "CUSTOM TENURE";
    customTenureLabelElement.textContent = customTenureLabel;
    customTenureLabelElement.dataset.label = customTenureLabel;
  }

  const customTenureRow = document.getElementById("customTenureRepaymentRow");
  if (customTenureRow) customTenureRow.dataset.months = isCustomTenure ? String(dynamicTenureMonths || 0) : "";

  const insuranceAmountDisplayElement = document.getElementById("insuranceAmountDisplay");
  if (insuranceAmountDisplayElement) insuranceAmountDisplayElement.value = `RM ${formatCurrency(insuranceAmount)}`;

  refreshLiveScript({
    onRoadPrice,
    insuranceAmount,
    loanAmount,
    calculatedDownpayment,
    selectedMonthlyPayment,
    monthlyPayments,
  });

  updateSelectedTenure();
  updateModelYearSelection();
  scheduleCardFit();
}

// ---------- SYNC CONTROL INPUTS ----------
function updateCalculatorControls() {
  const rebateInput = document.getElementById("rebateInput");
  if (rebateInput) rebateInput.value = selectedRebateAmount;

  const okuanRebateInput = document.getElementById("includeOkuanRebate");
  if (okuanRebateInput) okuanRebateInput.checked = includeOkuanRebate;

  const okuanRebateAmount = document.getElementById("okuanRebateAmount");
  if (okuanRebateAmount) {
    okuanRebateAmount.value = `RM ${formatCurrency(getVehicleOkuanRebateAmount(selectedVehicle))}`;
  }

  const ncdSelect = document.getElementById("ncdSelect");
  if (ncdSelect) ncdSelect.value = selectedNcdPercent;

  const interestInput = document.getElementById("interestRateInput");
  if (interestInput && document.activeElement !== interestInput) {
  interestInput.value = selectedInterestRate;
  }

  updateDownpaymentControl();
  updateModelYearSelection();

  document.querySelectorAll(".variant-options .option-button").forEach((button) => {
    if (button.dataset.trimKey === getVehicleTrimKey(selectedVehicle)) {
      button.classList.add("selected-vehicle");
    } else {
      button.classList.remove("selected-vehicle");
    }
  });

  updateSelectedTenure();
}

// ---------- UPDATE FROM CONTROLS ----------
function updateQuoteFromControls() {
  const rebateInput = document.getElementById("rebateInput");
  if (rebateInput) selectedRebateAmount = isNaN(parseFloat(rebateInput.value)) ? 0 : parseFloat(rebateInput.value);

  const ncdSelect = document.getElementById("ncdSelect");
  if (ncdSelect) selectedNcdPercent = isNaN(parseFloat(ncdSelect.value)) ? 0 : parseFloat(ncdSelect.value);

  const interestInput = document.getElementById("interestRateInput");
  if (interestInput) {
    selectedInterestRate = isNaN(parseFloat(interestInput.value)) ? 3.0 : parseFloat(interestInput.value);
  }

  const downpaymentInput = document.getElementById("downpaymentValueInput");

  if (downpaymentInput && downpaymentType === "amount") {
    isCustomDownpayment = true;
    customDownpaymentAmount = isNaN(parseFloat(downpaymentInput.value)) ? 0 : parseFloat(downpaymentInput.value);
    selectedDownpaymentPercent = 0;
  } else {
    isCustomDownpayment = false;
    if (downpaymentInput) {
      selectedDownpaymentPercent = isNaN(parseFloat(downpaymentInput.value)) ? 0 : parseFloat(downpaymentInput.value);
    }
    customDownpaymentAmount = 0;
  }

  refreshQuoteSummary();
  updateCalculatorControls();
}

function updateOkuanRebateSelection() {
  const okuanRebateInput = document.getElementById("includeOkuanRebate");
  includeOkuanRebate = Boolean(okuanRebateInput?.checked);
  selectedRebateAmount = getVehicleRebateAmount(selectedVehicle, includeOkuanRebate);
  refreshQuoteSummary();
  updateCalculatorControls();
}

function setDownpaymentType(type) {
  downpaymentType = type === "amount" ? "amount" : "percent";
  isCustomDownpayment = downpaymentType === "amount";
  updateDownpaymentControl();
  refreshQuoteSummary();
  updateCalculatorControls();
}

// ---------- SELECT VEHICLE ----------
function selectVehicle(vehicleId) {
  const matchingVehicle = vehicles.find((c) => c.id === vehicleId);
  if (matchingVehicle) {
    selectedVehicle = getVehicleForDefaultYear(matchingVehicle);
    resetCalculatorForVehicle(selectedVehicle);
    renderModelYearOptions();
    refreshQuoteSummary();
    updateCalculatorControls();
  }
}

function selectModelYear(modelYear) {
  if (!selectedVehicle) {
    selectedModelYear = AVAILABLE_MODEL_YEARS.includes(modelYear) ? modelYear : 2025;
    updateModelYearSelection();
    return;
  }

  const availableYears = getAvailableModelYearsForVehicle(selectedVehicle);
  if (!availableYears.includes(modelYear)) {
    updateModelYearSelection();
    return;
  }

  selectedModelYear = modelYear;
  selectedVehicle = getMatchingVehicleForYear(selectedVehicle, selectedModelYear);
  resetCalculatorForVehicle(selectedVehicle);
  renderModelYearOptions();
  refreshQuoteSummary();
  updateCalculatorControls();
}

// ---------- RENDER VEHICLE SELECTOR ----------
function renderVehicleSelector() {
  const container = document.getElementById("vehicleSelector");
  if (!container) return;

  container.innerHTML = "";

  if (vehicles.length === 0) {
    container.innerHTML = '<div style="color: #ff5e7e; padding: 10px;">Loading cars...</div>';
    return;
  }

  const vehiclesByModel = {};
  vehicles.forEach((car) => {
    if (!vehiclesByModel[car.model]) {
      vehiclesByModel[car.model] = [];
    }
    vehiclesByModel[car.model].push(car);
  });

  const preferredModelOrder = ["Tiggo Cross", "Chery O5", "Omoda E5", "Tiggo 7", "Tiggo 8", "Tiggo 9"];
  const modelOrder = [
    ...preferredModelOrder.filter((model) => vehiclesByModel[model]),
    ...Object.keys(vehiclesByModel).filter((model) => !preferredModelOrder.includes(model)).sort()
  ];

  modelOrder.forEach((model) => {
    const vehicleRowElement = document.createElement("div");
    vehicleRowElement.className = "vehicle-option-row";

    const modelLabelElement = document.createElement("span");
    modelLabelElement.className = "vehicle-option-model";
    modelLabelElement.textContent = model;
    vehicleRowElement.appendChild(modelLabelElement);

    const variantOptionsElement = document.createElement("div");
    variantOptionsElement.className = "variant-options";
    const uniqueVariants = Array.from(
      new Map(vehiclesByModel[model].map((car) => [getVehicleTrimKey(car), car])).values()
    );

    uniqueVariants.forEach((car) => {
      const button = document.createElement("button");
      button.className = "option-button";
      if (getVehicleTrimKey(selectedVehicle) === getVehicleTrimKey(car)) button.classList.add("selected-vehicle");
      button.textContent = car.variant || car.model;
      button.dataset.trimKey = getVehicleTrimKey(car);
      button.addEventListener("click", () => selectVehicle(car.id));
      variantOptionsElement.appendChild(button);
    });

    vehicleRowElement.appendChild(variantOptionsElement);
    container.appendChild(vehicleRowElement);
  });
}

function renderVehicleDataError() {
  const message = "Unable to load live Chery vehicle data. Check your connection and try again.";
  const vehicleContainer = document.getElementById("vehicleSelector");
  const eligibilityContainer = document.getElementById("eligibilityRows");

  if (vehicleContainer) {
    vehicleContainer.textContent = "";
    const errorElement = document.createElement("div");
    errorElement.className = "data-load-error";
    errorElement.textContent = message;
    vehicleContainer.appendChild(errorElement);
  }

  if (eligibilityContainer) {
    eligibilityContainer.innerHTML = `
      <div class="eligibility-row ineligible">
        <span class="eligibility-model"><strong>Live data unavailable</strong></span>
        <span class="eligibility-status"><span class="status-icon" aria-hidden="true">${ELIGIBILITY_STATUS_ICONS.ineligible}</span>ERROR</span>
        <span class="eligible-variants"><span class="eligible-variant-link">${message}</span></span>
      </div>
    `;
  }

  scheduleCardFit();
}

// ---------- SETUP ADD-ON CONTROLS ----------
function setupAddOnControls() {
  const container = document.getElementById("addOnCheckboxList");
  if (!container) return;

  container.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-add-on-key]");
    if (!checkbox) return;

    selectedAddOns[checkbox.dataset.addOnKey] = checkbox.checked;
    refreshQuoteSummary();
  });
}

// ---------- SETUP TENURE BUTTONS ----------
function updateQuoteFromCustomTenureInput() {
  const customTenureInput = document.getElementById("customTenureMonthsInput");
  if (!customTenureInput) return;

  customTenureMonths = Math.max(1, Math.round(parseFloat(customTenureInput.value) || 0));
  selectedTenureMonths = customTenureMonths;
  isCustomTenure = true;
  refreshQuoteSummary();
  updateCalculatorControls();
}

function setupTenureOptions() {
  const tenureOptionButtons = document.querySelectorAll("#tenureOptions .option-button");
  const customTenureInput = document.getElementById("customTenureMonthsInput");

  tenureOptionButtons.forEach((button) => {
    button.removeEventListener("click", button._tenureHandler);

    const handler = function (e) {
      e.preventDefault();
      const months = parseInt(this.getAttribute("data-months"), 10);
      if (!isNaN(months)) {
        selectedTenureMonths = months;
        isCustomTenure = false;
        refreshQuoteSummary();
        updateCalculatorControls();
      }
    };

    button._tenureHandler = handler;
    button.addEventListener("click", handler);
  });

  if (customTenureInput) customTenureInput.addEventListener("input", updateQuoteFromCustomTenureInput);

  updateSelectedTenure();
}

function setupModelYearOptions() {
  renderModelYearOptions();
}

function setupDownpaymentTypeOptions() {
  const downpaymentTypeOptionButtons = document.querySelectorAll("#downpaymentTypeOptions .downpayment-type-button");

  downpaymentTypeOptionButtons.forEach((button) => {
    button.removeEventListener("click", button._downpaymentTypeHandler);

    const handler = function (e) {
      e.preventDefault();
      setDownpaymentType(this.getAttribute("data-downpayment-type"));
    };

    button._downpaymentTypeHandler = handler;
    button.addEventListener("click", handler);
  });

  updateDownpaymentControl();
}

// ---------- BIND CONTROL EVENTS ----------
function setupCalculatorControls() {
  const rebateInput = document.getElementById("rebateInput");
  if (rebateInput) rebateInput.addEventListener("input", updateQuoteFromControls);

  const okuanRebateInput = document.getElementById("includeOkuanRebate");
  if (okuanRebateInput) okuanRebateInput.addEventListener("change", updateOkuanRebateSelection);

  const ncdSelect = document.getElementById("ncdSelect");
  if (ncdSelect) ncdSelect.addEventListener("change", updateQuoteFromControls);

  const interestInput = document.getElementById("interestRateInput");
  if (interestInput) interestInput.addEventListener("input", updateQuoteFromControls);

  const downpaymentInput = document.getElementById("downpaymentValueInput");
  if (downpaymentInput) downpaymentInput.addEventListener("input", updateQuoteFromControls);

  setupTenureOptions();
  setupModelYearOptions();
  setupDownpaymentTypeOptions();
  setupAddOnControls();
  setupAddOnsToggle();
}

// ---------- LOAD VEHICLE DATA ----------
async function loadVehicleData() {
  try {
    const response = await fetch(VEHICLE_DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    consultants = Array.isArray(data.consultants)
      ? data.consultants
        .filter((consultant) => consultant?.active !== false && consultant?.id)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      : [];
    defaultConsultantId = data.defaultConsultantId || consultants[0]?.id || "";

    const requestedConsultantId = getConsultantIdFromUrl();
    const requestedConsultant = consultants.find(
      (consultant) => String(consultant.id).toLowerCase() === requestedConsultantId
    );
    const storedAdvisorSettings = getStoredAdvisorSettings();
    const storedConsultantExists = consultants.some(
      (consultant) => consultant.id === storedAdvisorSettings.consultantId
    );
    let activeConsultantId = "";

    if (requestedConsultant) {
      selectConsultantProfile(requestedConsultant.id);
      activeConsultantId = requestedConsultant.id;
    } else if (storedConsultantExists) {
      applyAdvisorSettings(storedAdvisorSettings);
      renderConsultantProfileOptions(storedAdvisorSettings.consultantId);
      activeConsultantId = storedAdvisorSettings.consultantId;
    } else if (defaultConsultantId) {
      selectConsultantProfile(defaultConsultantId);
      activeConsultantId = defaultConsultantId;
    } else {
      renderConsultantProfileOptions();
    }

    if (requestedConsultantId && activeConsultantId) {
      setCurrentConsultantInUrl(activeConsultantId);
    }

    if (data.markups) {
      addOnPrices = data.markups;
    }

    if (Array.isArray(data.cars)) {
      vehicles = data.cars;
    } else if (Array.isArray(data)) {
      vehicles = data;
    } else {
      vehicles = [];
    }

    if (vehicles.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const requestedVehicleId = params.get("car");
      const requestedModelYear = Number(params.get("year"));
      const requestedVehicle = vehicles.find((car) => car.id === requestedVehicleId) || vehicles[0];
      const availableYears = getAvailableModelYearsForVehicle(requestedVehicle);
      selectedModelYear = availableYears.includes(requestedModelYear)
        ? requestedModelYear
        : getDefaultModelYearForVehicle(requestedVehicle);
      selectedVehicle = getMatchingVehicleForYear(requestedVehicle, selectedModelYear);
    }

    renderVehicleSelector();
    renderModelYearOptions();
    resetCalculatorForVehicle(selectedVehicle);
    applyEligibilityLoanPreset(new URLSearchParams(window.location.search).get("loanMode"));
    refreshQuoteSummary();
    updateCalculatorControls();
    renderEligibilityRows();

  } catch (err) {
    console.error("Error loading Chery car data:", err);
    vehicles = [];
    selectedVehicle = null;
    renderVehicleDataError();
  }
}

function syncResponsiveLayout() {
  syncDesktopUiScale();
  syncResponsiveLabels();
  syncControlDrawerState();
  scheduleCardFit();
  updateSpecialOffersOverflow();
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.update();
    })
    .catch((err) => console.error("Service Worker failed:", err));
}

// ---------- INITIALIZE ----------
function initializeApp() {
  setupAdvisorSettingsControls();
  setupCalculatorControls();
  loadVehicleData();
  setupControlDrawers();
  syncResponsiveLayout();
  setupPageNavigation();
  setupCalculatorModeSwitch();
  setupEligibilityCalculator();
  scheduleCardFit();
  window.addEventListener("resize", syncResponsiveLayout);
  window.addEventListener("orientationchange", syncResponsiveLayout);
  window.addEventListener("load", scheduleCardFit);

  document.querySelectorAll(".quote-summary-card img").forEach((img) => {
    img.addEventListener("load", scheduleCardFit);
  });

  document.querySelectorAll(".eligibility-summary-card img").forEach((img) => {
    img.addEventListener("load", scheduleCardFit);
  });

  setupServiceWorker();
}

document.addEventListener("DOMContentLoaded", initializeApp);
