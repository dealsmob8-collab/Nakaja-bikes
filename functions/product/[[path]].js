const PRODUCT_PAGE_PATH = "/product.html";

function getProductPageRequest(request) {
  const assetUrl = new URL(PRODUCT_PAGE_PATH, request.url);
  return new Request(assetUrl.toString(), {
    method: request.method,
    headers: request.headers
  });
}

export async function onRequestGet({ env, request }) {
  return env.ASSETS.fetch(getProductPageRequest(request));
}

export async function onRequestHead({ env, request }) {
  return env.ASSETS.fetch(getProductPageRequest(request));
}
