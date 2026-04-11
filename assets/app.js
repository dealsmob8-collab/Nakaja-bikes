const WA_BASE = "https://wa.me/254729595077";
const PRICING_DATA_URL = "/assets/pricing-data.json";
const PROMO_MESSAGE =
  "Free full tank + first service on every purchase until 1 May 2026.";

const PAYMENT_PERIOD_LABELS = {
  weekly: "per week",
  monthly: "per month",
  quote_request: "on request"
};

const FINANCIER_LABELS = {
  fortune_credit: "Fortune Credit",
  watu: "Watu"
};

const FINANCIER_CONFIG = {
  fortune_credit: {
    heading: "Fortune Credit",
    tag: "Weekly payment",
    highlight: "Start with KSh 30,000",
    positioning: "Low deposit. Faster finish.",
    helper: "Best if you want lower starting capital and weekly repayment.",
    ctaLabel: "Enquire on WhatsApp",
    eventName: "fortune_cta_clicked"
  },
  watu: {
    heading: "Watu",
    tag: "Monthly payment",
    highlight: "Structured monthly option",
    positioning: "Higher deposit. Lower pressure monthly.",
    helper: "Best if you prefer a structured monthly payment schedule.",
    ctaLabel: "Ask about Watu",
    eventName: "watu_cta_clicked"
  }
};

let pricingDataPromise;

const analytics = {
  track(eventName, payload = {}) {
    try {
      if (window.plausible) window.plausible(eventName, { props: payload });
      if (window.gtag) window.gtag("event", eventName, payload);
      if (window.__cfWebAnalytics) window.__cfWebAnalytics.track(eventName, payload);
      if (window.dataLayer) window.dataLayer.push({ event: eventName, ...payload });
    } catch (_) {}
  }
};

function parseTrackPayload(rawPayload) {
  if (!rawPayload) return {};
  try {
    return JSON.parse(rawPayload);
  } catch (_) {
    return {};
  }
}

function bindTrackedClicks(root = document) {
  root.querySelectorAll("[data-track]").forEach((el) => {
    if (el.dataset.trackBound === "true") return;
    if (el.matches(".accordion, select, input, textarea, form")) return;
    el.dataset.trackBound = "true";
    el.addEventListener("click", () => {
      analytics.track(el.dataset.track, {
        label: el.dataset.trackLabel || el.textContent.trim(),
        ...parseTrackPayload(el.dataset.trackPayload)
      });
    });
  });
}

function initPromoStrip() {
  const slides = [
    PROMO_MESSAGE,
    "1 year / 12,000 km warranty, WhatsApp support, and PDL help from our Nairobi team."
  ];

  document.querySelectorAll("[data-promo-message]").forEach((promo) => {
    let slideIndex = 0;
    promo.textContent = slides[slideIndex];

    if (promo.dataset.promoTimerBound === "true") return;
    promo.dataset.promoTimerBound = "true";

    setInterval(() => {
      slideIndex = (slideIndex + 1) % slides.length;
      promo.textContent = slides[slideIndex];
    }, 3000);
  });
}

function initAccordions() {
  document.querySelectorAll(".accordion").forEach((btn) => {
    if (btn.dataset.accordionBound === "true") return;
    btn.dataset.accordionBound = "true";
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      panel?.classList.toggle("open", !expanded);
      if (btn.dataset.track) analytics.track(btn.dataset.track, { question: btn.textContent.trim() });
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatKes(value) {
  return `KSh ${new Intl.NumberFormat("en-KE").format(Number(value) || 0)}`;
}

function formatCashPrice(value) {
  return value && Number(value) > 0 ? formatKes(value) : "Ask on WhatsApp";
}

function getPaymentPeriodLabel(paymentFrequency) {
  return PAYMENT_PERIOD_LABELS[paymentFrequency] || `per ${paymentFrequency}`;
}

function normalizeProduct(product) {
  const normalizedCashPrice =
    product.cash_price == null || product.cash_price === ""
      ? null
      : Number(product.cash_price) || null;

  return {
    id: String(product.id || product.slug || "").trim(),
    slug: String(product.slug || product.id || "").trim(),
    name: String(product.name || "").trim(),
    brand: String(product.brand || "UM Motorcycles").trim(),
    modelCode: String(product.model_code || "").trim(),
    variant: String(product.variant || "").trim(),
    category: String(product.category || "").trim(),
    engineCc: Number(product.engine_cc) || null,
    cashPrice: normalizedCashPrice,
    currency: String(product.currency || "KES").trim(),
    heroImageUrl: String(product.hero_image_url || "").trim(),
    galleryImages: Array.isArray(product.gallery_images)
      ? product.gallery_images.map((imageUrl) => String(imageUrl || "").trim()).filter(Boolean)
      : [],
    imageAlt: String(product.image_alt || product.name || "Nakaja Bikes product image").trim(),
    shortDescription: String(product.short_description || "").trim(),
    features: Array.isArray(product.features)
      ? product.features.map((feature) => String(feature || "").trim()).filter(Boolean)
      : [],
    promoEnabled: product.promo_enabled !== false,
    promoText: String(product.promo_text || PROMO_MESSAGE).trim(),
    displayOrder: Number(product.display_order) || 100,
    isActive: product.is_active !== false
  };
}

function normalizeFinancePlan(plan) {
  return {
    id: String(plan.id || "").trim(),
    productId: String(plan.product_id || "").trim(),
    financier: String(plan.financier || "").trim(),
    planCode: String(plan.plan_code || "").trim(),
    paymentFrequency: String(plan.payment_frequency || "").trim(),
    tenureMonths: Number(plan.tenure_months) || 0,
    depositAmount: Number(plan.deposit_amount) || 0,
    installmentAmount: Number(plan.installment_amount) || 0,
    interestRate: plan.interest_rate == null || plan.interest_rate === "" ? null : Number(plan.interest_rate),
    processingFee: plan.processing_fee == null || plan.processing_fee === "" ? null : Number(plan.processing_fee),
    insuranceFee: plan.insurance_fee == null || plan.insurance_fee === "" ? null : Number(plan.insurance_fee),
    totalPayable: plan.total_payable == null || plan.total_payable === "" ? null : Number(plan.total_payable),
    isAvailable: plan.is_available !== false,
    sortOrder: Number(plan.sort_order) || 100,
    notes: String(plan.notes || "").trim()
  };
}

function sortProducts(products) {
  return [...products].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)
  );
}

function sortFinancePlans(plans) {
  return [...plans].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.tenureMonths - b.tenureMonths ||
      a.installmentAmount - b.installmentAmount
  );
}

function normalizeCatalog(data) {
  const products = sortProducts(
    (Array.isArray(data.products) ? data.products : [])
      .map(normalizeProduct)
      .filter((product) => product.isActive && product.id && product.slug && product.name)
  );

  const plans = sortFinancePlans(
    (Array.isArray(data.product_finance_plans) ? data.product_finance_plans : [])
      .map(normalizeFinancePlan)
      .filter(
        (plan) =>
          plan.isAvailable &&
          plan.id &&
          plan.productId &&
          FINANCIER_LABELS[plan.financier] &&
          ["weekly", "monthly"].includes(plan.paymentFrequency) &&
          plan.tenureMonths > 0 &&
          plan.depositAmount > 0 &&
          plan.installmentAmount > 0
      )
  );

  const productsById = new Map(products.map((product) => [product.id, product]));
  const plansByProductId = new Map();
  plans.forEach((plan) => {
    if (!productsById.has(plan.productId)) return;
    const existing = plansByProductId.get(plan.productId) || [];
    existing.push(plan);
    plansByProductId.set(plan.productId, sortFinancePlans(existing));
  });

  return {
    currency: String(data.currency || "KES"),
    defaultDepositAmount: Number(data.default_deposit_amount) || 30000,
    promoText: String(data.promo_text || PROMO_MESSAGE).trim(),
    products,
    plans,
    productsById,
    plansByProductId
  };
}

function getPricingData() {
  if (!pricingDataPromise) {
    pricingDataPromise = fetch(PRICING_DATA_URL, {
      headers: { Accept: "application/json" }
    }).then((response) => {
      if (!response.ok) throw new Error("Pricing data unavailable");
      return response.json().then(normalizeCatalog);
    });
  }

  return pricingDataPromise;
}

function getProductById(catalog, productId) {
  return catalog.productsById.get(productId) || catalog.products[0] || null;
}

function getProductBySlug(catalog, slug) {
  return catalog.products.find((product) => product.slug === slug) || null;
}

function getPlansForProduct(catalog, productId, financier = "") {
  const plans = catalog.plansByProductId.get(productId) || [];
  return financier ? plans.filter((plan) => plan.financier === financier) : plans;
}

function getFallbackQuotePlan(product, catalog) {
  return {
    id: `${product.id}-quote-request`,
    productId: product.id,
    financier: "quote_request",
    planCode: "quote_request",
    paymentFrequency: "quote_request",
    tenureMonths: 0,
    depositAmount: catalog.defaultDepositAmount,
    installmentAmount: 0,
    notes: "Ask on WhatsApp for currently available finance options."
  };
}

function getPlanById(product, catalog, planId) {
  const plans = getPlansForProduct(catalog, product.id);
  return plans.find((plan) => plan.id === planId) || plans[0] || getFallbackQuotePlan(product, catalog);
}

function getFinanceAvailabilityText(plans) {
  const labels = [...new Set(plans.map((plan) => FINANCIER_LABELS[plan.financier]).filter(Boolean))];
  return labels.length ? labels.join(" + ") : "Ask on WhatsApp";
}

function getMinimumDeposit(plans) {
  const deposits = plans.map((plan) => plan.depositAmount).filter((amount) => amount > 0);
  return deposits.length ? Math.min(...deposits) : 0;
}

function getStartPlan(plans) {
  if (!plans.length) return null;
  return sortFinancePlans(plans)[0];
}

function appendPromoLine(lines, promoText) {
  const promoLine = "I also saw the free full tank + first service offer running until 1 May 2026.";
  const nextMessage = [...lines, promoLine].filter(Boolean).join("\n");
  if (!promoText || nextMessage.length > 420) return lines;
  return [...lines, promoLine];
}

function buildCashWhatsappMessage(product) {
  return appendPromoLine(
    [
      `Hello, I'm interested in the ${product.name}.`,
      product.cashPrice ? `Cash price shown is ${formatKes(product.cashPrice)}.` : "Please share today's cash price for this model.",
      "Please confirm availability and next step."
    ],
    product.promoEnabled ? product.promoText : ""
  )
    .filter(Boolean)
    .join("\n");
}

function buildFinanceWhatsappMessage(product, plan) {
  if (!plan || plan.financier === "quote_request") {
    return appendPromoLine(
      [
        `Hello, I'm interested in the ${product.name}.`,
        "Please guide me on the available finance options for this model."
      ],
      product.promoEnabled ? product.promoText : ""
    )
      .filter(Boolean)
      .join("\n");
  }

  const financierName = FINANCIER_LABELS[plan.financier] || "finance";
  return appendPromoLine(
    [
      `Hello, I'm interested in the ${product.name} on ${financierName}.`,
      `Deposit: ${formatKes(plan.depositAmount)}`,
      `Plan: ${plan.tenureMonths} months`,
      `Repayment: ${formatKes(plan.installmentAmount)} ${getPaymentPeriodLabel(plan.paymentFrequency)}`,
      "Please assist me with the next step."
    ],
    product.promoEnabled ? product.promoText : ""
  )
    .filter(Boolean)
    .join("\n");
}

function buildLeadWhatsappMessage(payload) {
  const lines = [
    `Hello, I'm interested in the ${payload.purchaseIntent.modelName}.`,
    payload.contact.fullName ? `Name: ${payload.contact.fullName}` : "",
    payload.contact.phone ? `Phone: ${payload.contact.phone}` : "",
    payload.contact.ridingArea ? `Riding area: ${payload.contact.ridingArea}` : ""
  ];

  if (payload.purchaseIntent.financier && payload.purchaseIntent.financier !== "quote_request") {
    lines.push(
      `Financier: ${FINANCIER_LABELS[payload.purchaseIntent.financier] || payload.purchaseIntent.financier}`,
      `Deposit: ${formatKes(payload.purchaseIntent.deposit)}`,
      `Plan: ${payload.purchaseIntent.planDurationMonths} months`,
      `Repayment: ${formatKes(payload.purchaseIntent.paymentAmount)} ${getPaymentPeriodLabel(payload.purchaseIntent.paymentFrequency)}`
    );
  } else {
    lines.push("Please guide me on the available finance options for this model.");
  }

  if (payload.purchaseIntent.depositTimeline) {
    lines.push(`Deposit timeline: ${payload.purchaseIntent.depositTimeline}`);
  }
  if (payload.purchaseIntent.pdlStatus) {
    lines.push(`PDL status: ${payload.purchaseIntent.pdlStatus}`);
  }
  if (payload.purchaseIntent.notes) {
    lines.push(`Notes: ${payload.purchaseIntent.notes}`);
  }

  return appendPromoLine(lines, payload.purchaseIntent.promoText).filter(Boolean).join("\n");
}

function buildWhatsappUrl(message) {
  return `${WA_BASE}?text=${encodeURIComponent(message)}`;
}

function populateProductSelect(select, products) {
  select.innerHTML = "";
  products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    select.appendChild(option);
  });
}

function formatPlanOptionLabel(plan) {
  if (plan.financier === "quote_request") return "Ask on WhatsApp for available finance";
  return `${FINANCIER_LABELS[plan.financier]} · ${plan.tenureMonths} months · ${formatKes(plan.installmentAmount)} ${getPaymentPeriodLabel(plan.paymentFrequency)}`;
}

function populatePlanSelect(select, product, catalog, preferredPlanId = "") {
  select.innerHTML = "";
  const plans = getPlansForProduct(catalog, product.id);
  const options = plans.length ? plans : [getFallbackQuotePlan(product, catalog)];

  options.forEach((plan) => {
    const option = document.createElement("option");
    option.value = plan.id;
    option.textContent = formatPlanOptionLabel(plan);
    select.appendChild(option);
  });

  if (preferredPlanId && Array.from(select.options).some((option) => option.value === preferredPlanId)) {
    select.value = preferredPlanId;
  }
}

function buildProductCard(product, catalog) {
  const plans = getPlansForProduct(catalog, product.id);
  const bestPlan = getStartPlan(plans);
  const financeLine = bestPlan
    ? `${FINANCIER_LABELS[bestPlan.financier]} from ${formatKes(bestPlan.depositAmount)} deposit`
    : "Ask on WhatsApp for finance availability";

  return `
    <article class="card model-card">
      <a class="model-card-link" href="/product/${escapeHtml(product.slug)}" data-track="model_card_open" data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug }))}'>
        <span class="badge">${escapeHtml(product.category || "Nakaja model")}</span>
        <img
          class="card-media"
          loading="lazy"
          width="768"
          height="892"
          src="${escapeHtml(product.heroImageUrl)}"
          alt="${escapeHtml(product.imageAlt || `${product.name} motorcycle`)}"
        />
        <h3>${escapeHtml(product.name)}</h3>
      </a>
      <p class="model-price">${escapeHtml(formatCashPrice(product.cashPrice))}</p>
      <p>${escapeHtml(product.shortDescription || "Open the product page to review details and payment options.")}</p>
      <p class="small-note">${escapeHtml(financeLine)}</p>
      <div class="card-actions">
        <a class="text-link" href="/product/${escapeHtml(product.slug)}" data-track="model_details_open" data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug }))}'>View full details</a>
        <a class="text-link" href="${escapeHtml(buildWhatsappUrl(buildCashWhatsappMessage(product)))}" data-track="cash_cta_clicked" data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug, source: "home_card" }))}'>Check cash price</a>
      </div>
    </article>
  `;
}

function buildFinanceGuideCard(product, catalog) {
  const plans = getPlansForProduct(catalog, product.id);
  const fortunePlan = getStartPlan(plans.filter((plan) => plan.financier === "fortune_credit"));
  const watuPlan = getStartPlan(plans.filter((plan) => plan.financier === "watu"));
  const planBlocks = [fortunePlan, watuPlan]
    .filter(Boolean)
    .map(
      (plan) => `
        <p class="finance-guide-row">
          <span>${escapeHtml(FINANCIER_LABELS[plan.financier])}</span>
          <strong>${escapeHtml(formatKes(plan.depositAmount))} deposit · ${escapeHtml(formatKes(plan.installmentAmount))} ${escapeHtml(getPaymentPeriodLabel(plan.paymentFrequency))}</strong>
        </p>
      `
    )
    .join("");

  return `
    <article class="table-card finance-guide-card">
      <h3>${escapeHtml(product.name)}</h3>
      <p class="model-price">${escapeHtml(formatCashPrice(product.cashPrice))}</p>
      ${
        planBlocks ||
        `<p class="small-note">No Fortune/Watu plans are listed online for this model yet. Ask on WhatsApp for current finance options.</p>`
      }
      <a class="text-link" href="/product/${escapeHtml(product.slug)}" data-track="plan_viewed" data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug, financier: fortunePlan?.financier || watuPlan?.financier || "none", tenure: fortunePlan?.tenureMonths || watuPlan?.tenureMonths || 0, payment_frequency: fortunePlan?.paymentFrequency || watuPlan?.paymentFrequency || "none" }))}'>Open finance details</a>
    </article>
  `;
}

async function initHomeCatalogSections() {
  const modelCards = document.getElementById("modelCards");
  const financeGuide = document.getElementById("financeGuideGrid");
  if (!modelCards && !financeGuide) return;

  try {
    const catalog = await getPricingData();
    if (modelCards) {
      modelCards.innerHTML = catalog.products.map((product) => buildProductCard(product, catalog)).join("");
    }
    if (financeGuide) {
      financeGuide.innerHTML = catalog.products
        .map((product) => buildFinanceGuideCard(product, catalog))
        .join("");
    }
    bindTrackedClicks(document);
  } catch (_) {
    if (modelCards) {
      modelCards.innerHTML = `
        <article class="card">
          <h3>Models are not loading right now.</h3>
          <p>Message Nakaja Bikes on WhatsApp and we will send the current model list and prices.</p>
          <a class="text-link" href="${escapeHtml(buildWhatsappUrl("Hello Nakaja Bikes, please send me the current model list and cash prices."))}">Ask on WhatsApp</a>
        </article>
      `;
    }
  }
}

async function initCalculator() {
  const modelSelect = document.getElementById("modelSelect");
  const planSelect = document.getElementById("planSelect");
  const output = document.getElementById("calcOutput");
  const cta = document.getElementById("calcCta");
  if (!modelSelect || !planSelect || !output || !cta) return;

  try {
    const catalog = await getPricingData();
    const calculatorProducts = catalog.products.filter((product) => getPlansForProduct(catalog, product.id).length);
    if (!calculatorProducts.length) {
      throw new Error("No finance-linked products are available for the calculator");
    }

    populateProductSelect(modelSelect, calculatorProducts);

    const renderOutput = () => {
      const product = getProductById(catalog, modelSelect.value);
      if (!product) return;
      const plan = getPlanById(product, catalog, planSelect.value);

      if (plan.financier === "quote_request") {
        output.innerHTML = `
          <p><strong>${escapeHtml(product.name)}</strong></p>
          <p>Cash price: <strong>${escapeHtml(formatCashPrice(product.cashPrice))}</strong></p>
          <p>No Fortune/Watu plans are listed online for this model yet.</p>
          <p>Ask on WhatsApp for current finance options and stock.</p>
        `;
        cta.href = buildWhatsappUrl(buildFinanceWhatsappMessage(product, plan));
        cta.textContent = `Ask about ${product.name}`;
        return;
      }

      output.innerHTML = `
        <p><strong>Bike:</strong> ${escapeHtml(product.name)}</p>
        <p><strong>Cash price:</strong> ${escapeHtml(formatCashPrice(product.cashPrice))}</p>
        <p><strong>${escapeHtml(FINANCIER_LABELS[plan.financier])} deposit:</strong> ${escapeHtml(formatKes(plan.depositAmount))}</p>
        <p><strong>Plan:</strong> ${plan.tenureMonths} months · ${escapeHtml(formatKes(plan.installmentAmount))} ${escapeHtml(getPaymentPeriodLabel(plan.paymentFrequency))}</p>
      `;
      cta.href = buildWhatsappUrl(buildFinanceWhatsappMessage(product, plan));
      cta.textContent = `Ask about ${FINANCIER_LABELS[plan.financier]}`;
    };

    const syncPlans = (preferredPlanId = "") => {
      const product = getProductById(catalog, modelSelect.value);
      if (!product) return;
      populatePlanSelect(planSelect, product, catalog, preferredPlanId);
      renderOutput();
    };

    modelSelect.addEventListener("change", () => {
      const product = getProductById(catalog, modelSelect.value);
      analytics.track("calculator_model_select", {
        product_slug: product?.slug || ""
      });
      syncPlans();
    });

    planSelect.addEventListener("change", () => {
      const product = getProductById(catalog, modelSelect.value);
      if (!product) return;
      const plan = getPlanById(product, catalog, planSelect.value);
      analytics.track("calculator_plan_select", {
        product_slug: product.slug,
        financier: plan.financier,
        tenure: plan.tenureMonths,
        payment_frequency: plan.paymentFrequency
      });
      renderOutput();
    });

    syncPlans();
  } catch (_) {
    output.innerHTML = `
      <p><strong>Pricing is temporarily unavailable online.</strong></p>
      <p>Continue on WhatsApp for the latest Duty Max prices and financing options.</p>
    `;
    cta.href = buildWhatsappUrl(
      "Hello Nakaja Bikes, pricing did not load on the site. Please send me the latest Duty Max cash, Fortune Credit, and Watu options."
    );
    cta.textContent = "Ask about Duty Max prices";
  }
}

function hydrateLeadContext(form) {
  const params = new URLSearchParams(window.location.search);
  const values = {
    pageUrl: window.location.href,
    pagePath: window.location.pathname,
    referrer: document.referrer,
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || ""
  };

  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  });
}

function buildLeadPayload(form, catalog) {
  const formData = new FormData(form);
  const product = getProductById(catalog, formData.get("bikeModel"));
  if (!product) throw new Error("Please select a valid bike model.");
  const plan = getPlanById(product, catalog, formData.get("planKey"));

  return {
    source: {
      formName: String(formData.get("formName") || "nakaja-lead-form"),
      pageUrl: String(formData.get("pageUrl") || window.location.href),
      pagePath: String(formData.get("pagePath") || window.location.pathname),
      referrer: String(formData.get("referrer") || document.referrer || ""),
      utmSource: String(formData.get("utmSource") || ""),
      utmMedium: String(formData.get("utmMedium") || ""),
      utmCampaign: String(formData.get("utmCampaign") || ""),
      utmContent: String(formData.get("utmContent") || ""),
      utmTerm: String(formData.get("utmTerm") || "")
    },
    contact: {
      fullName: String(formData.get("fullName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      ridingArea: String(formData.get("ridingArea") || "").trim()
    },
    purchaseIntent: {
      deposit: plan.depositAmount || catalog.defaultDepositAmount,
      modelId: product.id,
      modelName: product.name,
      productSlug: product.slug,
      financier: plan.financier,
      planDurationMonths: plan.tenureMonths,
      paymentType: plan.paymentFrequency,
      paymentFrequency: plan.paymentFrequency,
      paymentAmount: plan.installmentAmount,
      promoText: product.promoEnabled ? product.promoText : "",
      pdlStatus: String(formData.get("pdlStatus") || ""),
      depositTimeline: String(formData.get("depositTimeline") || ""),
      notes: String(formData.get("notes") || "").trim()
    },
    consent: Boolean(formData.get("consent"))
  };
}

function setFormStatus(statusEl, message, state) {
  statusEl.textContent = message;
  statusEl.className = "form-status";
  if (state) statusEl.classList.add(`is-${state}`);
}

function clearFormStatus(statusEl) {
  setFormStatus(statusEl, "", "");
}

async function initLeadForm() {
  const form = document.getElementById("leadForm");
  if (!form) return;

  const modelSelect = document.getElementById("leadModelSelect");
  const planSelect = document.getElementById("leadPlanSelect");
  const status = document.getElementById("leadFormStatus");
  const whatsappLink = document.getElementById("leadFormWhatsapp");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!modelSelect || !planSelect || !status || !whatsappLink || !submitButton) return;

  try {
    const catalog = await getPricingData();
    populateProductSelect(modelSelect, catalog.products);
    hydrateLeadContext(form);

    const refreshWhatsappLink = () => {
      const payload = buildLeadPayload(form, catalog);
      whatsappLink.href = buildWhatsappUrl(buildLeadWhatsappMessage(payload));
    };

    const syncPlans = (preferredPlanId = "") => {
      const product = getProductById(catalog, modelSelect.value);
      if (!product) return;
      populatePlanSelect(planSelect, product, catalog, preferredPlanId);
      refreshWhatsappLink();
    };

    modelSelect.addEventListener("change", () => {
      clearFormStatus(status);
      syncPlans();
    });

    planSelect.addEventListener("change", () => {
      clearFormStatus(status);
      refreshWhatsappLink();
    });

    ["fullName", "phone", "ridingArea", "notes"].forEach((name) => {
      const field = form.elements.namedItem(name);
      if (!field) return;
      field.addEventListener("input", () => {
        clearFormStatus(status);
        refreshWhatsappLink();
      });
    });

    ["pdlStatus", "depositTimeline"].forEach((name) => {
      const field = form.elements.namedItem(name);
      if (!field) return;
      field.addEventListener("change", () => {
        clearFormStatus(status);
        refreshWhatsappLink();
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = buildLeadPayload(form, catalog);
      analytics.track("lead_form_submit", {
        product_slug: payload.purchaseIntent.productSlug,
        financier: payload.purchaseIntent.financier,
        tenure: payload.purchaseIntent.planDurationMonths,
        payment_frequency: payload.purchaseIntent.paymentFrequency
      });

      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
      setFormStatus(status, "Sending your request...", "");

      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Could not send your request right now.");
        }

        analytics.track("lead_form_success", {
          product_slug: payload.purchaseIntent.productSlug,
          stored: String(result.stored),
          routed: String(result.routed)
        });

        setFormStatus(
          status,
          `Thanks. We've received your request. Ref ${result.leadId}. A Nakaja Bikes team member will contact you shortly.`,
          "success"
        );

        form.reset();
        hydrateLeadContext(form);
        populateProductSelect(modelSelect, catalog.products);
        syncPlans();
      } catch (error) {
        analytics.track("lead_form_error", { message: error.message });
        setFormStatus(
          status,
          "We could not save your request online. Continue on WhatsApp below for faster help.",
          "error"
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Request Callback";
        refreshWhatsappLink();
      }
    });

    syncPlans();
  } catch (_) {
    setFormStatus(status, "This form is not available right now. Continue on WhatsApp below.", "error");
    submitButton.disabled = true;
  }
}

function getCurrentProductSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const productIndex = parts.indexOf("product");
  return productIndex >= 0 ? parts[productIndex + 1] || "" : "";
}

function buildSummaryCard(label, value, helper) {
  if (!value) return "";
  return `
    <article class="summary-card">
      <p class="summary-label">${escapeHtml(label)}</p>
      <p class="summary-value">${escapeHtml(value)}</p>
      <p class="summary-helper">${escapeHtml(helper)}</p>
    </article>
  `;
}

function buildProductSummaryCards(product, fortunePlans, watuPlans) {
  const cards = [
    buildSummaryCard(
      "Cash Price",
      formatCashPrice(product.cashPrice),
      product.cashPrice ? "Strongest public price for this model." : "Ask Nakaja Bikes for today's cash price."
    ),
    fortunePlans.length
      ? buildSummaryCard(
          "Fortune Start With",
          formatKes(getMinimumDeposit(fortunePlans)),
          "Weekly repayment plans are listed below."
        )
      : "",
    watuPlans.length
      ? buildSummaryCard(
          "Watu Start With",
          formatKes(getMinimumDeposit(watuPlans)),
          "Monthly repayment plans are listed below."
        )
      : ""
  ]
    .filter(Boolean)
    .join("");

  return cards ? `<section class="container product-summary-strip">${cards}</section>` : "";
}

function getFinanceHeroHint(product, fortunePlans, watuPlans) {
  if (fortunePlans.length) {
    const plan = getStartPlan(fortunePlans);
    return `${FINANCIER_LABELS.fortune_credit} from ${formatKes(plan.depositAmount)} deposit · ${formatKes(plan.installmentAmount)} ${getPaymentPeriodLabel(plan.paymentFrequency)}`;
  }
  if (watuPlans.length) {
    const plan = getStartPlan(watuPlans);
    return `${FINANCIER_LABELS.watu} from ${formatKes(plan.depositAmount)} deposit · ${formatKes(plan.installmentAmount)} ${getPaymentPeriodLabel(plan.paymentFrequency)}`;
  }
  return "Ask on WhatsApp for the currently available finance route.";
}

function buildGalleryMarkup(product) {
  const seen = new Set();
  const gallery = [product.heroImageUrl, ...product.galleryImages]
    .map((imageUrl) => String(imageUrl || "").trim())
    .filter(Boolean)
    .filter((imageUrl) => {
      if (seen.has(imageUrl)) return false;
      seen.add(imageUrl);
      return true;
    });

  const heroImage = gallery[0] || "/public/nakaja-bikes-logo-256.jpg";
  const thumbs =
    gallery.length > 1
      ? `
        <div class="product-thumb-rail" aria-label="Product gallery">
          ${gallery
            .map(
              (imageUrl, index) => `
                <button
                  type="button"
                  class="product-thumb-button ${index === 0 ? "is-active" : ""}"
                  data-gallery-thumb="${escapeHtml(imageUrl)}"
                  aria-label="View image ${index + 1} of ${gallery.length}"
                  aria-pressed="${index === 0 ? "true" : "false"}"
                >
                  <img src="${escapeHtml(imageUrl)}" loading="lazy" width="120" height="120" alt="${escapeHtml(product.imageAlt)} preview ${index + 1}" />
                </button>
              `
            )
            .join("")}
        </div>
      `
      : "";

  return `
    <div class="product-gallery-shell">
      <div class="product-hero-frame">
        <img
          id="productHeroImage"
          src="${escapeHtml(heroImage)}"
          alt="${escapeHtml(product.imageAlt)}"
          fetchpriority="high"
        />
      </div>
      ${thumbs}
    </div>
  `;
}

function buildProductDetails(product, plans) {
  const details = [
    ["Model", product.modelCode || product.name],
    ["Brand", product.brand],
    ["Engine", product.engineCc ? `${product.engineCc}cc` : "Ask on WhatsApp"],
    ["Category", product.category || "Nakaja model"],
    ["Cash price", formatCashPrice(product.cashPrice)],
    ["Finance availability", getFinanceAvailabilityText(plans)]
  ];

  return `
    <section class="container section product-details-section">
      <div class="section-head">
        <p class="eyebrow">Model snapshot</p>
        <h2>Product Details</h2>
      </div>
      <dl class="product-details-grid">
        ${details
          .map(
            ([label, value]) => `
              <div class="product-detail-row">
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    </section>
  `;
}

function buildProductFeatures(product) {
  if (!product.features.length) return "";
  return `
    <section class="container section">
      <div class="section-head">
        <p class="eyebrow">Model Strengths</p>
        <h2>Why buyers choose this model</h2>
      </div>
      <div class="feature-card-grid">
        ${product.features
          .map(
            (feature) => `
              <article class="feature-card">
                <p>${escapeHtml(feature)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function buildFinancePlanSummary(plan) {
  if (!plan) return "";
  return `
    <p class="finance-card-summary" data-finance-summary="${escapeHtml(plan.financier)}">
      Deposit ${escapeHtml(formatKes(plan.depositAmount))} · ${plan.tenureMonths} months · ${escapeHtml(formatKes(plan.installmentAmount))} ${escapeHtml(getPaymentPeriodLabel(plan.paymentFrequency))}
    </p>
  `;
}

function buildFinanceCard(product, plans, financier) {
  if (!plans.length) return "";
  const config = FINANCIER_CONFIG[financier];
  const selectedPlan = getStartPlan(plans);
  const ctaMessage = buildFinanceWhatsappMessage(product, selectedPlan);

  return `
    <article class="finance-card" data-finance-card="${escapeHtml(financier)}" data-selected-plan="${escapeHtml(selectedPlan.id)}">
      <div class="finance-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(config.heading)}</p>
          <h3>${escapeHtml(config.heading)}</h3>
        </div>
        <span class="finance-tag">${escapeHtml(config.tag)}</span>
      </div>

      <p class="finance-highlight">
        ${
          financier === "fortune_credit"
            ? escapeHtml(`Start with ${formatKes(selectedPlan.depositAmount)}`)
            : escapeHtml(config.highlight)
        }
      </p>
      <p class="finance-position">${escapeHtml(config.positioning)}</p>
      <p class="small-note">${escapeHtml(config.helper)}</p>

      <div class="finance-plan-list" role="group" aria-label="${escapeHtml(config.heading)} schedule">
        ${plans
          .map(
            (plan, index) => `
              <button
                type="button"
                class="finance-plan-button ${index === 0 ? "is-selected" : ""}"
                data-finance-plan-button="${escapeHtml(plan.id)}"
                data-financier="${escapeHtml(plan.financier)}"
                aria-pressed="${index === 0 ? "true" : "false"}"
              >
                <span>${plan.tenureMonths} months</span>
                <strong>${escapeHtml(formatKes(plan.installmentAmount))} ${escapeHtml(getPaymentPeriodLabel(plan.paymentFrequency))}</strong>
              </button>
            `
          )
          .join("")}
      </div>

      ${buildFinancePlanSummary(selectedPlan)}

      <a
        class="button button-primary finance-cta"
        href="${escapeHtml(buildWhatsappUrl(ctaMessage))}"
        data-finance-cta="${escapeHtml(financier)}"
        data-track="${escapeHtml(config.eventName)}"
        data-track-payload='${escapeHtml(
          JSON.stringify({
            product_slug: product.slug,
            financier: selectedPlan.financier,
            tenure: selectedPlan.tenureMonths,
            payment_frequency: selectedPlan.paymentFrequency
          })
        )}'
      >
        ${escapeHtml(config.ctaLabel)}
      </a>
    </article>
  `;
}

function buildFinanceSection(product, fortunePlans, watuPlans) {
  const financeCards = [
    buildFinanceCard(product, fortunePlans, "fortune_credit"),
    buildFinanceCard(product, watuPlans, "watu")
  ]
    .filter(Boolean)
    .join("");

  if (!financeCards) {
    return `
      <section class="container section">
        <div class="section-head">
          <p class="eyebrow">Repayment routes</p>
          <h2>Asset Finance Options</h2>
          <p>Choose the repayment option that works best for your budget.</p>
        </div>
        <article class="finance-card is-empty-finance">
          <h3>Finance plans are not listed for this model yet</h3>
          <p class="small-note">Ask on WhatsApp and we will confirm the current Fortune or Watu option if available.</p>
          <a
            class="button button-primary"
            href="${escapeHtml(buildWhatsappUrl(buildFinanceWhatsappMessage(product, null)))}"
            data-track="finance_general_cta_clicked"
            data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug, financier: "none", tenure: 0, payment_frequency: "none" }))}'
          >
            Ask about finance
          </a>
        </article>
      </section>
    `;
  }

  return `
    <section class="container section">
      <div class="section-head">
        <p class="eyebrow">Repayment routes</p>
        <h2>Asset Finance Options</h2>
        <p>Choose the repayment option that works best for your budget.</p>
      </div>
      <div class="finance-comparison-grid">
        ${financeCards}
      </div>
    </section>
  `;
}

function buildRelatedModels(currentProduct, catalog) {
  const relatedProducts = catalog.products
    .filter((product) => product.id !== currentProduct.id)
    .slice(0, 3);
  if (!relatedProducts.length) return "";

  return `
    <section class="container section">
      <div class="section-head">
        <p class="eyebrow">More Nakaja Models</p>
        <h2>Related models</h2>
      </div>
      <div class="card-grid">
        ${relatedProducts.map((product) => buildProductCard(product, catalog)).join("")}
      </div>
    </section>
  `;
}

function setMetaTag(selector, attrName, value) {
  const node = document.querySelector(selector);
  if (node && value) node.setAttribute(attrName, value);
}

function updateProductMetadata(product) {
  const title = `${product.name} | Cash Price & Finance | Nakaja Bikes`;
  const description = `${product.name}: ${product.shortDescription || "View cash price, product details, and available finance plans from Nakaja Bikes."}`;
  const productUrl = `${window.location.origin}/product/${product.slug}`;
  const imageUrl = product.heroImageUrl || "/public/nakaja-bikes-logo-256.jpg";

  document.title = title;
  setMetaTag('meta[name="description"]', "content", description);
  setMetaTag('link[rel="canonical"]', "href", productUrl);
  setMetaTag('meta[property="og:title"]', "content", title);
  setMetaTag('meta[property="og:description"]', "content", description);
  setMetaTag('meta[property="og:url"]', "content", productUrl);
  setMetaTag('meta[property="og:image"]', "content", imageUrl);
  setMetaTag('meta[name="twitter:title"]', "content", title);
  setMetaTag('meta[name="twitter:description"]', "content", description);
  setMetaTag('meta[name="twitter:image"]', "content", imageUrl);
}

function buildProductPageHtml(product, catalog) {
  const allPlans = getPlansForProduct(catalog, product.id);
  const fortunePlans = allPlans.filter((plan) => plan.financier === "fortune_credit");
  const watuPlans = allPlans.filter((plan) => plan.financier === "watu");
  const heroFinancePlan = getStartPlan(fortunePlans) || getStartPlan(watuPlans);
  const heroFinanceMessage = buildFinanceWhatsappMessage(product, heroFinancePlan);

  return `
    <section class="container product-hero-grid">
      ${buildGalleryMarkup(product)}
      <div class="product-hero-copy">
        <p class="eyebrow">${escapeHtml(product.brand)} · ${escapeHtml(product.category || "Nakaja model")}</p>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-subtitle">${escapeHtml(product.shortDescription || "Review cash price, product details, and available finance plans for this model.")}</p>
        <p class="hero-cash-price">${escapeHtml(formatCashPrice(product.cashPrice))}</p>
        <p class="hero-finance-hint">${escapeHtml(getFinanceHeroHint(product, fortunePlans, watuPlans))}</p>
        ${
          product.promoEnabled
            ? `<p class="hero-promo-note">${escapeHtml(product.promoText || catalog.promoText)}</p>`
            : ""
        }
        <div class="hero-ctas">
          <a
            class="button button-primary"
            href="${escapeHtml(buildWhatsappUrl(buildCashWhatsappMessage(product)))}"
            data-track="cash_cta_clicked"
            data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug, source: "hero" }))}'
          >
            Get this bike
          </a>
          <a
            class="button button-secondary"
            href="${escapeHtml(buildWhatsappUrl(heroFinanceMessage))}"
            data-track="finance_general_cta_clicked"
            data-track-payload='${escapeHtml(
              JSON.stringify({
                product_slug: product.slug,
                financier: heroFinancePlan?.financier || "none",
                tenure: heroFinancePlan?.tenureMonths || 0,
                payment_frequency: heroFinancePlan?.paymentFrequency || "none"
              })
            )}'
          >
            Ask about finance
          </a>
        </div>
      </div>
    </section>

    ${
      product.promoEnabled
        ? `
          <section class="container product-promo-strip" aria-label="Current offer">
            <p data-promo-message>${escapeHtml(product.promoText || catalog.promoText)}</p>
          </section>
        `
        : ""
    }

    ${buildProductSummaryCards(product, fortunePlans, watuPlans)}
    ${buildProductDetails(product, allPlans)}
    ${buildProductFeatures(product)}
    ${buildFinanceSection(product, fortunePlans, watuPlans)}

    <section class="container section final-cta product-final-cta">
      <h2>Check availability for ${escapeHtml(product.name)}</h2>
      <p>Ask Nakaja Bikes to confirm today's stock, cash sale steps, and any currently available Fortune or Watu finance route.</p>
      <div class="hero-ctas">
        <a
          class="button button-primary"
          href="${escapeHtml(buildWhatsappUrl(buildCashWhatsappMessage(product)))}"
          data-track="cash_cta_clicked"
          data-track-payload='${escapeHtml(JSON.stringify({ product_slug: product.slug, source: "footer" }))}'
        >
          Enquire on WhatsApp
        </a>
        <a class="button button-secondary" href="/">Back to all models</a>
      </div>
    </section>

    ${buildRelatedModels(product, catalog)}
  `;
}

function updateSupportWidgetMessage(message) {
  const btn = document.getElementById("supportWidget");
  if (btn && message) {
    btn.dataset.whatsappMessage = message;
  }
}

function updateFinanceCardSelection(card, plan, product) {
  if (!card || !plan || !product) return;
  card.dataset.selectedPlan = plan.id;

  card.querySelectorAll("[data-finance-plan-button]").forEach((button) => {
    const isSelected = button.dataset.financePlanButton === plan.id;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  const summary = card.querySelector("[data-finance-summary]");
  if (summary) {
    summary.textContent = `Deposit ${formatKes(plan.depositAmount)} · ${plan.tenureMonths} months · ${formatKes(plan.installmentAmount)} ${getPaymentPeriodLabel(plan.paymentFrequency)}`;
  }

  const cta = card.querySelector("[data-finance-cta]");
  if (cta) {
    cta.href = buildWhatsappUrl(buildFinanceWhatsappMessage(product, plan));
    cta.dataset.trackPayload = JSON.stringify({
      product_slug: product.slug,
      financier: plan.financier,
      tenure: plan.tenureMonths,
      payment_frequency: plan.paymentFrequency
    });
  }
}

function bindProductGallery() {
  const heroImage = document.getElementById("productHeroImage");
  if (!heroImage) return;

  document.querySelectorAll("[data-gallery-thumb]").forEach((button) => {
    if (button.dataset.galleryBound === "true") return;
    button.dataset.galleryBound = "true";
    button.addEventListener("click", () => {
      const nextImageUrl = button.dataset.galleryThumb;
      if (!nextImageUrl || heroImage.src === nextImageUrl) return;
      heroImage.src = nextImageUrl;
      document.querySelectorAll("[data-gallery-thumb]").forEach((thumbButton) => {
        const isActive = thumbButton === button;
        thumbButton.classList.toggle("is-active", isActive);
        thumbButton.setAttribute("aria-pressed", String(isActive));
      });
    });
  });
}

function bindProductFinanceInteractions(product, catalog) {
  const allPlans = getPlansForProduct(catalog, product.id);

  document.querySelectorAll("[data-finance-card]").forEach((card) => {
    const financier = card.dataset.financeCard;
    const defaultPlan = getStartPlan(allPlans.filter((plan) => plan.financier === financier));
    if (defaultPlan) {
      analytics.track("plan_viewed", {
        product_slug: product.slug,
        financier: defaultPlan.financier,
        tenure: defaultPlan.tenureMonths,
        payment_frequency: defaultPlan.paymentFrequency
      });
    }
  });

  document.querySelectorAll("[data-finance-plan-button]").forEach((button) => {
    if (button.dataset.financeBound === "true") return;
    button.dataset.financeBound = "true";
    button.addEventListener("click", () => {
      const plan = allPlans.find((item) => item.id === button.dataset.financePlanButton);
      if (!plan) return;
      const card = button.closest("[data-finance-card]");
      updateFinanceCardSelection(card, plan, product);
      analytics.track("finance_tenure_selected", {
        product_slug: product.slug,
        financier: plan.financier,
        tenure: plan.tenureMonths,
        payment_frequency: plan.paymentFrequency
      });
      analytics.track("plan_viewed", {
        product_slug: product.slug,
        financier: plan.financier,
        tenure: plan.tenureMonths,
        payment_frequency: plan.paymentFrequency
      });
    });
  });
}

function renderMissingProduct(root, slug = "") {
  document.title = "Product not found | Nakaja Bikes";
  root.innerHTML = `
    <section class="container section product-missing">
      <p class="eyebrow">Product not found</p>
      <h1>This model page is not available</h1>
      <p class="hero-copy">
        ${slug ? `We could not find a live product page for "${escapeHtml(slug)}".` : "We could not read the requested product slug."}
        Go back to all models or ask Nakaja Bikes on WhatsApp.
      </p>
      <div class="hero-ctas">
        <a class="button button-secondary" href="/">Back to all models</a>
        <a class="button button-primary" href="${escapeHtml(buildWhatsappUrl("Hello Nakaja Bikes, I opened a product page that is not available. Please send me the current model list and prices."))}">Ask on WhatsApp</a>
      </div>
    </section>
  `;
  bindTrackedClicks(root);
}

async function initProductPage() {
  const root = document.getElementById("productPageRoot");
  if (!root) return;

  const slug = getCurrentProductSlug();
  if (!slug) {
    renderMissingProduct(root);
    return;
  }

  try {
    const catalog = await getPricingData();
    const product = getProductBySlug(catalog, slug);
    if (!product) {
      renderMissingProduct(root, slug);
      return;
    }

    updateProductMetadata(product);
    root.innerHTML = buildProductPageHtml(product, catalog);
    updateSupportWidgetMessage(buildCashWhatsappMessage(product));
    bindProductGallery();
    bindProductFinanceInteractions(product, catalog);
    bindTrackedClicks(root);
  } catch (_) {
    renderMissingProduct(root, slug);
  }
}

function initSupportWidget() {
  const btn = document.getElementById("supportWidget");
  if (!btn || btn.dataset.supportBound === "true") return;
  btn.dataset.supportBound = "true";

  btn.addEventListener("click", () => {
    const message =
      btn.dataset.whatsappMessage ||
      "Hello Nakaja Bikes, I need help choosing a Duty Max bike, checking payment options, and sorting PDL support.";
    window.location.href = buildWhatsappUrl(message);
  });
}

function injectFaqSchema() {
  const schemaTag = document.getElementById("faqSchema");
  if (!schemaTag) return;

  const faqs = Array.from(document.querySelectorAll("#faq .accordion")).map((q) => ({
    "@type": "Question",
    name: q.textContent.trim(),
    acceptedAnswer: { "@type": "Answer", text: q.nextElementSibling?.textContent.trim() || "" }
  }));

  schemaTag.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs
  });
}

bindTrackedClicks();
initPromoStrip();
initAccordions();
initHomeCatalogSections();
initCalculator();
initLeadForm();
initProductPage();
initSupportWidget();
injectFaqSchema();
