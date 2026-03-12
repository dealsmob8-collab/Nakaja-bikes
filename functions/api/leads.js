function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=UTF-8"
    }
  });
}

const DEFAULT_SUPABASE_URL = "https://dwrvycpeyknmidrmnnby.supabase.co";

function normalizePhone(phone) {
  const compact = String(phone || "").replace(/[^\d+]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("254")) return `+${compact}`;
  if (compact.startsWith("0")) return `+254${compact.slice(1)}`;
  return compact;
}

function sanitizeString(value) {
  return String(value || "").trim();
}

function getSupabaseRestUrl(env) {
  const baseUrl = sanitizeString(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const table = sanitizeString(env.SUPABASE_LEADS_TABLE || "leads");
  if (!baseUrl) return "";
  return `${baseUrl}/rest/v1/${table}`;
}

function getSupabaseAuthKey(env) {
  return sanitizeString(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
}

async function readPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const formData = await request.formData();
  return {
    source: {
      formName: formData.get("formName"),
      pageUrl: formData.get("pageUrl"),
      pagePath: formData.get("pagePath"),
      referrer: formData.get("referrer"),
      utmSource: formData.get("utmSource"),
      utmMedium: formData.get("utmMedium"),
      utmCampaign: formData.get("utmCampaign"),
      utmContent: formData.get("utmContent"),
      utmTerm: formData.get("utmTerm")
    },
    contact: {
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      ridingArea: formData.get("ridingArea")
    },
    purchaseIntent: {
      deposit: Number(formData.get("deposit") || 0),
      modelId: formData.get("bikeModel"),
      modelName: formData.get("bikeModel"),
      planDurationMonths: Number(formData.get("planDurationMonths") || 0),
      paymentType: formData.get("paymentType"),
      paymentAmount: Number(formData.get("paymentAmount") || 0),
      pdlStatus: formData.get("pdlStatus"),
      depositTimeline: formData.get("depositTimeline"),
      notes: formData.get("notes")
    },
    consent: Boolean(formData.get("consent"))
  };
}

function validatePayload(payload) {
  const fullName = sanitizeString(payload?.contact?.fullName);
  const phone = sanitizeString(payload?.contact?.phone);
  const ridingArea = sanitizeString(payload?.contact?.ridingArea);
  const modelId = sanitizeString(payload?.purchaseIntent?.modelId);
  const modelName = sanitizeString(payload?.purchaseIntent?.modelName);
  const paymentType = sanitizeString(payload?.purchaseIntent?.paymentType);
  const isQuoteRequest = paymentType === "quote_request";
  const pdlStatus = sanitizeString(payload?.purchaseIntent?.pdlStatus);
  const depositTimeline = sanitizeString(payload?.purchaseIntent?.depositTimeline);
  const consent = Boolean(payload?.consent);
  const planDurationMonths = Number(payload?.purchaseIntent?.planDurationMonths || 0);
  const paymentAmount = Number(payload?.purchaseIntent?.paymentAmount || 0);
  const deposit = Number(payload?.purchaseIntent?.deposit || 0);

  if (!fullName || !phone || !ridingArea || !modelId || !modelName) {
    return { ok: false, error: "Missing required lead fields." };
  }

  if (!paymentType || !pdlStatus || !depositTimeline) {
    return { ok: false, error: "Missing required purchase intent fields." };
  }

  if (!isQuoteRequest && (!planDurationMonths || !paymentAmount)) {
    return { ok: false, error: "Missing required financing plan fields." };
  }

  if (!consent) {
    return { ok: false, error: "Lead consent is required." };
  }

  return {
    ok: true,
    lead: {
      leadId: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      source: {
        formName: sanitizeString(payload?.source?.formName || "nakaja-lead-form"),
        pageUrl: sanitizeString(payload?.source?.pageUrl),
        pagePath: sanitizeString(payload?.source?.pagePath),
        referrer: sanitizeString(payload?.source?.referrer),
        utmSource: sanitizeString(payload?.source?.utmSource),
        utmMedium: sanitizeString(payload?.source?.utmMedium),
        utmCampaign: sanitizeString(payload?.source?.utmCampaign),
        utmContent: sanitizeString(payload?.source?.utmContent),
        utmTerm: sanitizeString(payload?.source?.utmTerm)
      },
      contact: {
        fullName,
        phoneRaw: phone,
        phoneNormalized: normalizePhone(phone),
        ridingArea
      },
      purchaseIntent: {
        deposit,
        modelId,
        modelName,
        planDurationMonths,
        paymentType,
        paymentAmount,
        pdlStatus,
        depositTimeline,
        notes: sanitizeString(payload?.purchaseIntent?.notes)
      }
    }
  };
}

function prepareSupabaseRecord(lead) {
  return {
    id: lead.leadId,
    submitted_at: lead.submittedAt,
    lead_status: "new",
    form_name: lead.source.formName,
    source_page_url: lead.source.pageUrl,
    source_page_path: lead.source.pagePath,
    source_referrer: lead.source.referrer,
    utm_source: lead.source.utmSource,
    utm_medium: lead.source.utmMedium,
    utm_campaign: lead.source.utmCampaign,
    utm_content: lead.source.utmContent,
    utm_term: lead.source.utmTerm,
    full_name: lead.contact.fullName,
    phone_raw: lead.contact.phoneRaw,
    phone_normalized: lead.contact.phoneNormalized,
    riding_area: lead.contact.ridingArea,
    deposit_amount: lead.purchaseIntent.deposit,
    model_id: lead.purchaseIntent.modelId,
    model_name: lead.purchaseIntent.modelName,
    plan_duration_months: lead.purchaseIntent.planDurationMonths,
    payment_type: lead.purchaseIntent.paymentType,
    payment_amount: lead.purchaseIntent.paymentAmount,
    pdl_status: lead.purchaseIntent.pdlStatus,
    deposit_timeline: lead.purchaseIntent.depositTimeline,
    notes: lead.purchaseIntent.notes,
    consent: true,
    technical: lead.technical,
    raw_payload: lead
  };
}

async function storeInSupabase(lead, env) {
  const endpoint = getSupabaseRestUrl(env);
  const authKey = getSupabaseAuthKey(env);
  if (!endpoint || !authKey) return false;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      "content-type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(prepareSupabaseRecord(lead))
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase insert failed with ${response.status}: ${errorText.slice(0, 300)}`);
  }

  return true;
}

async function forwardToWebhook(lead, env) {
  if (!env.CRM_WEBHOOK_URL) return false;

  const headers = {
    "content-type": "application/json"
  };

  if (env.CRM_WEBHOOK_TOKEN) {
    const headerName = env.CRM_WEBHOOK_TOKEN_HEADER || "Authorization";
    const prefix = env.CRM_WEBHOOK_TOKEN_PREFIX !== undefined ? env.CRM_WEBHOOK_TOKEN_PREFIX : "Bearer ";
    headers[headerName] = `${prefix}${env.CRM_WEBHOOK_TOKEN}`;
  }

  if (env.CRM_WEBHOOK_SECRET) {
    headers["x-crm-webhook-secret"] = env.CRM_WEBHOOK_SECRET;
  }

  const response = await fetch(env.CRM_WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(lead)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CRM webhook request failed with ${response.status}: ${errorText.slice(0, 300)}`);
  }

  return true;
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "OPTIONS, POST"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const payload = await readPayload(context.request);
    const validation = validatePayload(payload);
    if (!validation.ok) return jsonResponse({ ok: false, error: validation.error }, 400);

    const lead = {
      ...validation.lead,
      technical: {
        userAgent: context.request.headers.get("user-agent") || "",
        ipCountry: context.request.cf?.country || "",
        ipCity: context.request.cf?.city || "",
        colo: context.request.cf?.colo || ""
      }
    };

    console.log(JSON.stringify({ event: "nakaja_lead_capture", lead }));

    const stored = await storeInSupabase(lead, context.env);
    const routed = await forwardToWebhook(lead, context.env);
    return jsonResponse({ ok: true, leadId: lead.leadId, stored, routed }, 200);
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Lead submission failed. Please continue on WhatsApp." }, 500);
  }
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
}
