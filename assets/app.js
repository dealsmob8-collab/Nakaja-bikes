const WA_BASE = "https://wa.me/254729595077";
const PRICING_DATA_URL = "/assets/pricing-data.json";

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

  const slides = [
    "Free full tank + first service on every purchase until 1 May 2026.",
    "1 year / 12,000 km warranty, WhatsApp support, and PDL help from our Nairobi team."
  ];

  let i = 0;
  setInterval(() => {
    i = (i + 1) % slides.length;
    promo.textContent = slides[i];
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
  return String(plan?.id || plan?.paymentType || "cash");
}

function getPlan(model, planValue) {
  return model.plans.find((plan) => buildPlanValue(plan) === String(planValue || "")) || model.plans[0];
}

function isQuoteRequestPlan(plan) {
  return plan?.paymentType === "quote_request";
}

function getCadenceLabel(plan) {
  if (plan?.paymentCadence === "week") return "per week";
  if (plan?.paymentCadence === "month") return "per month";
  return "cash price";
}

function formatPlanSummary(plan) {
  if (!plan) return "";
  if (isQuoteRequestPlan(plan)) {
    return plan.label || "Current quote on request";
  }

  if (plan.paymentType === "cash") {
    return `Cash price KSh ${formatKes(plan.amount)}`;
  }

  const approvalNote = plan.requiresApproval ? " (when approved)" : "";
  return `${plan.provider}${approvalNote}: KSh ${formatKes(plan.deposit)} deposit + KSh ${formatKes(plan.amount)} ${getCadenceLabel(plan)}`;
}

function formatPlanLabel(plan) {
  if (isQuoteRequestPlan(plan)) {
    return plan.label || "Current quote on request";
  }

  return formatPlanSummary(plan);
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
          <p><strong>${plan.label || "Current quote on request"}</strong></p>
          <p>WhatsApp us to confirm stock and next steps.</p>
        `;
      } else {
        output.innerHTML = `
          <p><strong>${model.name}</strong></p>
          <p><strong>${formatPlanSummary(plan)}</strong></p>
          <p>Warranty: ${model.warranty || "1 year / 12,000 km"}</p>
          ${plan.requiresApproval ? "<p>Watu financing shows only where approval is available for that model.</p>" : ""}
        `;
      }

      const msg = quoteOnly
        ? `Hello Nakaja Bikes, I want the current quote and stock status for ${model.name}.`
        : `Hello Nakaja Bikes, I want ${model.name}. Please confirm this option: ${formatPlanSummary(plan)}.`;
      cta.href = `${WA_BASE}?text=${encodeURIComponent(msg)}`;
      cta.textContent = quoteOnly ? `Request ${model.name} quote` : `Get this price now`;
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
      <p><strong>Pricing is temporarily unavailable online.</strong></p>
      <p>Continue on WhatsApp for the latest Duty Max prices and financing options.</p>
    `;
    cta.href = `${WA_BASE}?text=${encodeURIComponent("Hello Nakaja Bikes, pricing did not load on the site. Please send me the latest Duty Max cash, Fortune Credit, and Watu options.")}`;
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
      deposit: Number(plan?.deposit || model?.cashPrice || data.deposit || 0),
      modelId: model.id,
      modelName: model.name,
      planDurationMonths: Number(plan?.durationMonths || 0),
      planProvider: String(plan?.provider || ""),
      paymentCadence: String(plan?.paymentCadence || ""),
      requiresApproval: Boolean(plan?.requiresApproval),
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
  const planLine = quoteOnly
    ? "Plan: Current quote on request"
    : payload.purchaseIntent.paymentType === "cash"
      ? `Plan: Cash price KSh ${formatKes(payload.purchaseIntent.paymentAmount)}`
      : `Plan: ${payload.purchaseIntent.planProvider}${payload.purchaseIntent.requiresApproval ? " (when approved)" : ""} - KSh ${formatKes(payload.purchaseIntent.deposit)} deposit + KSh ${formatKes(payload.purchaseIntent.paymentAmount)} per ${payload.purchaseIntent.paymentCadence}`;

  const lines = [
    `Hello Nakaja Bikes, I want help with ${payload.purchaseIntent.modelName}.`,
    payload.contact.fullName ? `Name: ${payload.contact.fullName}` : "",
    payload.contact.phone ? `Phone: ${payload.contact.phone}` : "",
    payload.contact.ridingArea ? `Riding area: ${payload.contact.ridingArea}` : "",
    planLine,
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

        const deliveryLabel = result.stored
          ? "saved to the sales backend"
          : result.routed
            ? "forwarded to the sales workflow"
            : "validated in preview mode";

        const statusMessage = result.stored || result.routed
          ? `Request received. Ref ${result.leadId}. Your lead was ${deliveryLabel}.`
          : `Request received. Ref ${result.leadId}. It was ${deliveryLabel}. Add Supabase env vars in Cloudflare to persist new leads.`;

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
          "We could not save your details online. Continue on WhatsApp below for faster help.",
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
    setFormStatus(status, "Lead form is temporarily unavailable. Continue on WhatsApp below.", "error");
    submitButton.disabled = true;
  }
}

function initSupportWidget() {
  const btn = document.getElementById("supportWidget");
  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = `${WA_BASE}?text=${encodeURIComponent("Hello Nakaja Bikes, I need help choosing a Duty Max bike, checking payment options, and sorting PDL support.")}`;
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
