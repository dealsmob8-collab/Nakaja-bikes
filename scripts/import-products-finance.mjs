#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PROMO_TEXT =
  "Running up to 1st May — Full tank and first service free on all purchases on any model.";
const APPROVED_FINANCIERS = new Set(["fortune_credit", "watu"]);
const APPROVED_PAYMENT_FREQUENCIES = new Set(["weekly", "monthly"]);

function parseArgs(argv) {
  const options = {
    productsCsv: "",
    financeCsv: "",
    outputJson: "assets/pricing-data.json",
    syncSupabase: false
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output") {
      options.outputJson = argv[i + 1] || options.outputJson;
      i += 1;
      continue;
    }
    if (arg === "--sync-supabase") {
      options.syncSupabase = true;
      continue;
    }
    positional.push(arg);
  }

  [options.productsCsv, options.financeCsv] = positional;
  if (!options.productsCsv || !options.financeCsv) {
    throw new Error(
      "Usage: node scripts/import-products-finance.mjs <products.csv> <finance_plans.csv> [--output assets/pricing-data.json] [--sync-supabase]"
    );
  }

  return options;
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        insideQuotes = false;
        continue;
      }

      field += char;
      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field.trim());
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      continue;
    }

    if (char === "\r") continue;
    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field.trim());
    if (row.some((value) => value !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values, index) => {
    const record = { __rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] === undefined ? "" : values[headerIndex].trim();
    });
    return record;
  });
}

function parseBoolean(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function parseInteger(value, fieldName, rowNumber) {
  const raw = String(value || "").trim();
  const numberValue = Number(raw);
  if (!raw || !Number.isFinite(numberValue)) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be a numeric value.`);
  }
  return Math.round(numberValue);
}

function parseOptionalNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const numberValue = Number(raw);
  if (!Number.isFinite(numberValue)) return null;
  return numberValue;
}

function normalizeFeatureList(row) {
  return ["feature_1", "feature_2", "feature_3", "feature_4"]
    .map((key) => String(row[key] || "").trim())
    .filter(Boolean);
}

function normalizeGalleryImages(row) {
  const heroImage = String(row.hero_image_url || "").trim();
  return [
    "gallery_image_1",
    "gallery_image_2",
    "gallery_image_3",
    "gallery_image_4",
    "gallery_image_5"
  ]
    .map((key) => String(row[key] || "").trim())
    .filter(Boolean)
    .filter((imageUrl, index, images) => imageUrl !== heroImage && images.indexOf(imageUrl) === index);
}

function normalizeProductRow(row) {
  const slug = String(row.slug || "").trim();
  const name = String(row.name || "").trim();

  if (!slug) throw new Error(`Row ${row.__rowNumber}: slug is required.`);
  if (!name) throw new Error(`Row ${row.__rowNumber}: name is required.`);

  const cashPrice = parseInteger(row.cash_price, "cash_price", row.__rowNumber);
  const promoEnabled = row.promo_enabled === "" ? true : parseBoolean(row.promo_enabled);
  const promoText = String(row.promo_text || "").trim() || (promoEnabled ? DEFAULT_PROMO_TEXT : "");
  const modelCode = String(row.model_code || "").trim() || slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-");

  return {
    id: slug,
    slug,
    name,
    brand: String(row.brand || "").trim() || "UM Motorcycles",
    model_code: modelCode,
    variant: String(row.variant || "").trim(),
    category: String(row.category || "").trim(),
    engine_cc: row.engine_cc ? parseInteger(row.engine_cc, "engine_cc", row.__rowNumber) : null,
    cash_price: cashPrice,
    currency: String(row.currency || "").trim() || "KES",
    hero_image_url: String(row.hero_image_url || "").trim(),
    gallery_images: normalizeGalleryImages(row),
    image_alt: String(row.image_alt || "").trim() || `${name} motorcycle`,
    short_description: String(row.short_description || "").trim(),
    features: normalizeFeatureList(row),
    promo_enabled: promoEnabled,
    promo_text: promoText,
    display_order: row.display_order ? parseInteger(row.display_order, "display_order", row.__rowNumber) : 100,
    is_active: row.is_active === "" ? true : parseBoolean(row.is_active)
  };
}

function normalizeFinanceRow(row, productBySlug, seenFinanceKeys) {
  const productSlug = String(row.product_slug || "").trim();
  if (!productSlug) throw new Error(`Row ${row.__rowNumber}: product_slug is required.`);

  const product = productBySlug.get(productSlug);
  if (!product) {
    throw new Error(`Row ${row.__rowNumber}: product_slug "${productSlug}" does not match products.csv.`);
  }

  const financier = String(row.financier || "").trim();
  const planCode = String(row.plan_code || "").trim();
  const paymentFrequency = String(row.payment_frequency || "").trim();

  if (!financier) throw new Error(`Row ${row.__rowNumber}: financier is required.`);
  if (!APPROVED_FINANCIERS.has(financier)) {
    throw new Error(`Row ${row.__rowNumber}: financier must be fortune_credit or watu.`);
  }
  if (!planCode) throw new Error(`Row ${row.__rowNumber}: plan_code is required.`);
  if (!paymentFrequency) throw new Error(`Row ${row.__rowNumber}: payment_frequency is required.`);
  if (!APPROVED_PAYMENT_FREQUENCIES.has(paymentFrequency)) {
    throw new Error(`Row ${row.__rowNumber}: payment_frequency must be weekly or monthly.`);
  }

  const tenureMonths = parseInteger(row.tenure_months, "tenure_months", row.__rowNumber);
  const depositAmount = parseInteger(row.deposit_amount, "deposit_amount", row.__rowNumber);
  const installmentAmount = parseInteger(row.installment_amount, "installment_amount", row.__rowNumber);
  const financeKey = `${productSlug}:${financier}:${paymentFrequency}:${tenureMonths}`;

  if (seenFinanceKeys.has(financeKey)) {
    throw new Error(
      `Row ${row.__rowNumber}: duplicate finance row for ${productSlug} / ${financier} / ${paymentFrequency} / ${tenureMonths} months.`
    );
  }
  seenFinanceKeys.add(financeKey);

  return {
    id: `${productSlug}-${financier}-${tenureMonths}-${paymentFrequency}`,
    product_id: product.id,
    financier,
    plan_code: planCode,
    payment_frequency: paymentFrequency,
    tenure_months: tenureMonths,
    deposit_amount: depositAmount,
    installment_amount: installmentAmount,
    interest_rate: parseOptionalNumber(row.interest_rate),
    processing_fee: row.processing_fee ? parseInteger(row.processing_fee, "processing_fee", row.__rowNumber) : null,
    insurance_fee: row.insurance_fee ? parseInteger(row.insurance_fee, "insurance_fee", row.__rowNumber) : null,
    total_payable: row.total_payable ? parseInteger(row.total_payable, "total_payable", row.__rowNumber) : null,
    is_available: row.is_available === "" ? true : parseBoolean(row.is_available),
    sort_order: row.sort_order ? parseInteger(row.sort_order, "sort_order", row.__rowNumber) : 100,
    notes: String(row.notes || "").trim()
  };
}

function buildCatalog(productRows, financeRows) {
  const productBySlug = new Map();
  const products = productRows.map((row) => {
    const product = normalizeProductRow(row);
    if (productBySlug.has(product.slug)) {
      throw new Error(`Row ${row.__rowNumber}: duplicate product slug "${product.slug}".`);
    }
    productBySlug.set(product.slug, product);
    return product;
  });

  const seenFinanceKeys = new Set();
  const productFinancePlans = financeRows.map((row) =>
    normalizeFinanceRow(row, productBySlug, seenFinanceKeys)
  );

  return {
    currency: products[0]?.currency || "KES",
    default_deposit_amount: productFinancePlans.find((plan) => plan.is_available)?.deposit_amount || 30000,
    promo_text: DEFAULT_PROMO_TEXT,
    products: products.sort((a, b) => a.display_order - b.display_order || a.slug.localeCompare(b.slug)),
    product_finance_plans: productFinancePlans.sort(
      (a, b) =>
        a.product_id.localeCompare(b.product_id) ||
        a.financier.localeCompare(b.financier) ||
        a.sort_order - b.sort_order ||
        a.tenure_months - b.tenure_months
    )
  };
}

function getSupabaseConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const apiKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
  ).trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) before using --sync-supabase."
    );
  }

  return { baseUrl, apiKey };
}

async function supabaseRequest(config, endpoint, init) {
  const response = await fetch(`${config.baseUrl}/rest/v1/${endpoint}`, {
    ...init,
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${endpoint} failed with ${response.status}: ${responseText.slice(0, 500)}`);
  }

  return responseText ? JSON.parse(responseText) : null;
}

async function syncCatalogToSupabase(catalog) {
  const config = getSupabaseConfig();

  const productPayload = catalog.products.map((product) => {
    const { id: _ignored, ...record } = product;
    return record;
  });

  const upsertedProducts = await supabaseRequest(config, "products?on_conflict=slug", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(productPayload)
  });

  const productIdBySlug = new Map(upsertedProducts.map((product) => [product.slug, product.id]));
  const planPayload = catalog.product_finance_plans.map((plan) => {
    const sourceProduct = catalog.products.find((product) => product.id === plan.product_id);
    const dbProductId = sourceProduct ? productIdBySlug.get(sourceProduct.slug) : "";
    if (!dbProductId) {
      throw new Error(`Could not map Supabase product ID for finance row "${plan.id}".`);
    }

    const { id: _ignored, product_id: _sourceProductId, ...record } = plan;
    return {
      ...record,
      product_id: dbProductId
    };
  });

  if (planPayload.length) {
    await supabaseRequest(
      config,
      "product_finance_plans?on_conflict=product_id%2Cfinancier%2Ctenure_months%2Cpayment_frequency",
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(planPayload)
      }
    );
  }

  return {
    products: upsertedProducts.length,
    financePlans: planPayload.length
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [productsCsv, financeCsv] = await Promise.all([
    readFile(path.resolve(options.productsCsv), "utf8"),
    readFile(path.resolve(options.financeCsv), "utf8")
  ]);

  const catalog = buildCatalog(parseCsv(productsCsv), parseCsv(financeCsv));
  await writeFile(path.resolve(options.outputJson), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  if (options.syncSupabase) {
    const synced = await syncCatalogToSupabase(catalog);
    console.log(
      `Imported ${catalog.products.length} products and ${catalog.product_finance_plans.length} plans to ${options.outputJson}; synced ${synced.products} products and ${synced.financePlans} plans to Supabase.`
    );
    return;
  }

  console.log(
    `Imported ${catalog.products.length} products and ${catalog.product_finance_plans.length} plans into ${options.outputJson}.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
