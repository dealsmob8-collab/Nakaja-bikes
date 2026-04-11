const WA_BASE = "https://wa.me/254729595077";

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
    el.addEventListener("click", () => analytics.track(el.dataset.track, { label: el.textContent.trim() }));
  });
}

function initPromoStrip() {
  const promo = document.querySelector("[data-promo-message]");
  if (!promo) return;
  const slides = [
    "🔥 LIMITED-TIME OFFER: FREE 11L Full Tank on Duty Max XL, Duty Max, & DSRX models!",
    "💪 THE STRENGTH TO CARRY YOUR HUSTLE: 150KG Max Load & 1-Year Warranty."
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

async function initCalculator() {
  const modelSelect = document.getElementById("modelSelect");
  const planSelect = document.getElementById("planSelect");
  const output = document.getElementById("calcOutput");
  const cta = document.getElementById("calcCta");
  if (!modelSelect || !planSelect || !output || !cta) return;

  try {
    const response = await fetch("/assets/pricing-data.json");
    if (!response.ok) throw new Error(`Pricing request failed with ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data.models) || data.models.length === 0) {
      throw new Error("Pricing data does not include any models");
    }

    data.models.forEach((model) => {
      const opt = document.createElement("option");
      opt.value = model.id;
      opt.textContent = model.name;
      modelSelect.appendChild(opt);
    });

    const updatePlans = () => {
      const model = data.models.find((m) => m.id === modelSelect.value) || data.models[0];
      planSelect.innerHTML = "";
      model.plans.forEach((plan) => {
        const opt = document.createElement("option");
        opt.value = `${plan.durationMonths}`;
        opt.textContent = `${plan.durationMonths} months - ${plan.paymentType} Kes. ${formatKes(plan.amount)}`;
        planSelect.appendChild(opt);
      });
      renderOutput();
    };

    const renderOutput = () => {
      const model = data.models.find((m) => m.id === modelSelect.value) || data.models[0];
      const plan = model.plans.find((p) => `${p.durationMonths}` === planSelect.value) || model.plans[0];
      const paymentLabel = plan.paymentType === "daily" ? "per day" : "per month";

      output.innerHTML = `
        <p><strong>${model.name}</strong></p>
        <p>Deposit: <strong>Kes. ${formatKes(data.deposit)}</strong></p>
        <p>Plan: ${plan.durationMonths} months · <strong>Kes. ${formatKes(plan.amount)} ${paymentLabel}</strong></p>
        ${model.cashPrice ? `<p>Cash price: Kes. ${formatKes(model.cashPrice)}</p>` : ""}
      `;

      const msg = `Hello Nakaja Bikes, I want to book the ${model.name} on the ${plan.durationMonths} month plan. Please help me with the Kes. 30,000 deposit process.`;
      cta.href = `${WA_BASE}?text=${encodeURIComponent(msg)}`;
    };

    modelSelect.addEventListener("change", () => {
      analytics.track("calculator_model_select", { model: modelSelect.value });
      updatePlans();
    });

    planSelect.addEventListener("change", () => {
      analytics.track("calculator_plan_select", { duration: planSelect.value });
      renderOutput();
    });

    updatePlans();
  } catch (error) {
    console.error("Failed to initialize pricing calculator.", error);
    modelSelect.disabled = true;
    planSelect.disabled = true;
    output.innerHTML = `
      <p><strong>Pricing is temporarily unavailable.</strong></p>
      <p>Please message Nakaja Bikes on WhatsApp and we will confirm the latest plan options.</p>
    `;
    cta.href = `${WA_BASE}?text=${encodeURIComponent("Hello Nakaja Bikes, the pricing calculator did not load for me. Please share the latest plan options.")}`;
    cta.textContent = "Get Pricing on WhatsApp";
  }
}

function initSupportWidget() {
  const btn = document.getElementById("supportWidget");
  if (!btn) return;
  btn.addEventListener("click", () => {
    analytics.track("support_widget_open");
    window.location.href = `${WA_BASE}?text=${encodeURIComponent("Hello Nakaja Bikes, I need support choosing the right bike and financing plan.")}`;
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
  schemaTag.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs });
}

bindTrackedClicks();
initPromoStrip();
initAccordions();
initCalculator();
initSupportWidget();
injectFaqSchema();
