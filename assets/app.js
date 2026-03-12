const WA_BASE = "https://wa.me/254729595077";
const PRICING_DATA_URL = "/assets/pricing-data.json";
const PAYMENT_PERIOD_LABELS = {
  daily: "per day",
  weekly: "per week",
  monthly: "per month"
};
const ANNOUNCEMENTS = [
  "March Special: Free 11L Full Tank on Duty Max XL & DSRX models.",
  "Built for daily work: 150kg max load and 1 Year / 12,000KM Warranty.",
  "No license yet? We can guide you on PDL so you can start working."
];

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

function bindTrackedClicks() {
  document.querySelectorAll("[data-track]").forEach((el) => {
    if (el.matches(".accordion, select, input, textarea, form")) return;
    el.addEventListener("click", () => analytics.track(el.dataset.track, { label: el.textContent.trim() }));
  });
}

function initPromoStrip() {
  const promo = document.querySelector("[data-promo-message]");
  if (!promo) return;

  let i = 0;
  setInterval(() => {
    i = (i + 1) % ANNOUNCEMENTS.length;
    promo.textContent = ANNOUNCEMENTS[i];
  }, 3000);
}

function initAccordions() {
  document.querySelectorAll(".accordion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      panel.classList.toggle("open", !expanded);
      if (btn.dataset.track) analytics.track(btn.dataset.track, { question: btn.textContent.trim() });
    });
  });
}

function formatKes(value) {
  return new Intl.NumberFormat("en-KE").format(value);
}

function getPricingData() {
  if (!pricingDataPromise) {
    pricingDataPromise = fetch(PRICING_DATA_URL, {
      headers: { Accept: "application/json" }
    }).then((response) => {
      if (!response.ok) throw new Error("Pricing data unavailable");
      return response.json();
    });
  }

  return pricingDataPromise;
}

function getModel(data, modelId) {
  return data.models.find((model) => model.id === modelId) || data.models[0];
}

function buildPlanValue(plan) {
  return `${plan.durationMonths}:${plan.paymentType}:${plan.amount}`;
}

function parsePlanValue(value) {
  const [durationMonths, paymentType, amount] = String(value || "").split(":");
  return {
    durationMonths: Number(durationMonths),
    paymentType: paymentType || "",
    amount: Number(amount)
  };
}

function getPlan(model, planValue) {
  const parsed = parsePlanValue(planValue);
  return (
    model.plans.find((plan) => (
      plan.durationMonths === parsed.durationMonths &&
      plan.paymentType === parsed.paymentType &&
      plan.amount === parsed.amount
    )) || model.plans[0]
  );
}

function isQuoteRequestPlan(plan) {
  return plan?.paymentType === "quote_request";
}

function formatPlanLabel(plan) {
  if (isQuoteRequestPlan(plan)) {
    return plan.label || "Ask on WhatsApp for today's price";
  }

  return `${plan.durationMonths} months - Kes. ${formatKes(plan.amount)} ${getPaymentPeriodLabel(plan.paymentType)}`;
}

function getPaymentPeriodLabel(paymentType) {
  return PAYMENT_PERIOD_LABELS[paymentType] || `per ${paymentType}`;
}

function populateModelSelect(select, models) {
  select.innerHTML = "";
  models.forEach((model) => {
    const opt = document.createElement("option");
    opt.value = model.id;
    opt.textContent = model.name;
    select.appendChild(opt);
  });
}

function populatePlanSelect(select, model, preferredValue) {
  select.innerHTML = "";

  model.plans.forEach((plan) => {
    const opt = document.createElement("option");
    opt.value = buildPlanValue(plan);
    opt.textContent = formatPlanLabel(plan);
    select.appendChild(opt);
  });

  if (preferredValue && Array.from(select.options).some((option) => option.value === preferredValue)) {
    select.value = preferredValue;
  }
}

async function initCalculator() {
  const modelSelect = document.getElementById("modelSelect");
  const planSelect = document.getElementById("planSelect");
  const output = document.getElementById("calcOutput");
  const cta = document.getElementById("calcCta");
  if (!modelSelect || !planSelect || !output || !cta) return;

  try {
    const data = await getPricingData();
    populateModelSelect(modelSelect, data.models);

    const renderOutput = () => {
      const model = getModel(data, modelSelect.value);
      const plan = getPlan(model, planSelect.value);
      const quoteOnly = isQuoteRequestPlan(plan);

      if (quoteOnly) {
        output.innerHTML = `
          <p><strong>${model.name}</strong></p>
          <p>Starting deposit: <strong>Kes. ${formatKes(data.deposit)}</strong></p>
          <p>Today's price: <strong>${plan.label || "Ask on WhatsApp"}</strong></p>
          <p>Ask on WhatsApp for today's price, stock, and booking steps.</p>
        `;
      } else {
        output.innerHTML = `
          <p><strong>Bike:</strong> ${model.name}</p>
          <p>Deposit: <strong>Kes. ${formatKes(data.deposit)}</strong></p>
          <p>Plan: ${plan.durationMonths} months · <strong>Kes. ${formatKes(plan.amount)} ${getPaymentPeriodLabel(plan.paymentType)}</strong></p>
          ${model.cashPrice ? `<p>Cash price: Kes. ${formatKes(model.cashPrice)}</p>` : ""}
        `;
      }

      const msg = quoteOnly
        ? `Hello Nakaja Bikes, I want today's price and stock for ${model.name}. Please guide me on the Kes. 30,000 deposit and booking process.`
        : `Hello Nakaja Bikes, I want to book the ${model.name} on the ${plan.durationMonths} month ${plan.paymentType} plan at Kes. ${formatKes(plan.amount)} ${getPaymentPeriodLabel(plan.paymentType)}. Please guide me on the Kes. 30,000 deposit process.`;
      cta.href = `${WA_BASE}?text=${encodeURIComponent(msg)}`;
      cta.textContent = quoteOnly ? `Ask About ${model.name}` : `Book ${model.name} on WhatsApp`;
    };

    const updatePlans = () => {
      const model = getModel(data, modelSelect.value);
      populatePlanSelect(planSelect, model);
      renderOutput();
    };

    modelSelect.addEventListener("change", () => {
      analytics.track("calculator_model_select", { model: modelSelect.value });
      updatePlans();
    });

    planSelect.addEventListener("change", () => {
      const plan = getPlan(getModel(data, modelSelect.value), planSelect.value);
      analytics.track("calculator_plan_select", {
        duration: String(plan.durationMonths),
        paymentType: plan.paymentType
      });
      renderOutput();
    });

    updatePlans();
  } catch (_) {
    output.innerHTML = `
      <p><strong>Prices are not showing online right now.</strong></p>
      <p>Message us on WhatsApp and we'll send the latest price and plan options.</p>
    `;
    cta.href = `${WA_BASE}?text=${encodeURIComponent("Hello Nakaja Bikes, prices are not showing on the site. Please send me today's price and plan options for Duty Max, Duty Punda, DSRX 200, and MAX XL models.")}`;
    cta.textContent = "Check Bikes on WhatsApp";
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

function buildLeadPayload(form, data) {
  const formData = new FormData(form);
  const model = getModel(data, formData.get("bikeModel"));
  const plan = getPlan(model, formData.get("planKey"));

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
      deposit: data.deposit,
      modelId: model.id,
      modelName: model.name,
      planDurationMonths: plan.durationMonths,
      paymentType: plan.paymentType,
      paymentAmount: plan.amount,
      pdlStatus: String(formData.get("pdlStatus") || ""),
      depositTimeline: String(formData.get("depositTimeline") || ""),
      notes: String(formData.get("notes") || "").trim()
    },
    consent: Boolean(formData.get("consent"))
  };
}

function createLeadWhatsappMessage(payload) {
  const quoteOnly = payload.purchaseIntent.paymentType === "quote_request";
  const lines = [
    `Hello Nakaja Bikes, I want help with ${payload.purchaseIntent.modelName}.`,
    payload.contact.fullName ? `Name: ${payload.contact.fullName}` : "",
    payload.contact.phone ? `Phone: ${payload.contact.phone}` : "",
    payload.contact.ridingArea ? `Riding area: ${payload.contact.ridingArea}` : "",
    quoteOnly
      ? "Today's price: Ask on WhatsApp"
      : payload.purchaseIntent.planDurationMonths
      ? `Plan: ${payload.purchaseIntent.planDurationMonths} months - ${payload.purchaseIntent.paymentType} Kes. ${formatKes(payload.purchaseIntent.paymentAmount)} ${getPaymentPeriodLabel(payload.purchaseIntent.paymentType)}`
      : "",
    payload.purchaseIntent.depositTimeline ? `Deposit timeline: ${payload.purchaseIntent.depositTimeline}` : "",
    payload.purchaseIntent.pdlStatus ? `PDL status: ${payload.purchaseIntent.pdlStatus}` : "",
    payload.purchaseIntent.notes ? `Notes: ${payload.purchaseIntent.notes}` : ""
  ];

  return lines.filter(Boolean).join("\n");
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
    const data = await getPricingData();
    populateModelSelect(modelSelect, data.models);
    hydrateLeadContext(form);

    const refreshWhatsappLink = () => {
      const payload = buildLeadPayload(form, data);
      whatsappLink.href = `${WA_BASE}?text=${encodeURIComponent(createLeadWhatsappMessage(payload))}`;
    };

    const syncPlans = (preferredValue) => {
      const model = getModel(data, modelSelect.value);
      populatePlanSelect(planSelect, model, preferredValue);
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

      const payload = buildLeadPayload(form, data);
      analytics.track("lead_form_submit", {
        model: payload.purchaseIntent.modelId,
        duration: String(payload.purchaseIntent.planDurationMonths),
        paymentType: payload.purchaseIntent.paymentType
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
          model: payload.purchaseIntent.modelId,
          stored: String(result.stored),
          routed: String(result.routed)
        });

        const statusMessage = `Thanks. We've received your request. Ref ${result.leadId}. A Nakaja Bikes team member will contact you shortly.`;

        setFormStatus(
          status,
          statusMessage,
          "success"
        );

        form.reset();
        hydrateLeadContext(form);
        populateModelSelect(modelSelect, data.models);
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
        submitButton.textContent = "Send My Request";
        refreshWhatsappLink();
      }
    });

    syncPlans();
  } catch (_) {
    setFormStatus(status, "This form is not available right now. Continue on WhatsApp below.", "error");
    submitButton.disabled = true;
  }
}

function initSupportWidget() {
  const btn = document.getElementById("supportWidget");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = `${WA_BASE}?text=${encodeURIComponent("Hello Nakaja Bikes, I need help choosing the right bike and plan.")}`;
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
initCalculator();
initLeadForm();
initSupportWidget();
injectFaqSchema();
