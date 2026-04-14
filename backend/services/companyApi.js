const COMPANY_AUTH_URL =
  process.env.COMPANY_AUTH_URL ||
  "https://hasura-auth-api-960327267159.us-east4.run.app";
const COMPANY_GRAPHQL_URL =
  process.env.COMPANY_GRAPHQL_URL ||
  "https://hasura-graphql-engine-960327267159.us-east4.run.app/v1/graphql";

const COMPANY_API_EMAIL = process.env.COMPANY_API_EMAIL || "";
const COMPANY_API_PASSWORD = process.env.COMPANY_API_PASSWORD || "";
const STATIC_JWT = process.env.COMPANY_API_JWT || "";

let tokenCache = {
  jwt: STATIC_JWT,
  refreshToken: process.env.COMPANY_API_REFRESH_TOKEN || "",
  expiresAtMs: STATIC_JWT ? Date.now() + 45 * 60 * 1000 : 0,
};

const authHeaders = {
  "Content-Type": "application/json",
};

const isTokenFresh = () =>
  Boolean(tokenCache.jwt) && Date.now() < Number(tokenCache.expiresAtMs || 0);

const parseJsonSafe = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const loginForJwt = async () => {
  if (!COMPANY_API_EMAIL || !COMPANY_API_PASSWORD) {
    throw new Error(
      "Company API auth missing: set COMPANY_API_EMAIL and COMPANY_API_PASSWORD (or COMPANY_API_JWT).",
    );
  }

  const url = new URL("/api/login", COMPANY_AUTH_URL);
  url.searchParams.set("email", COMPANY_API_EMAIL);
  url.searchParams.set("password", COMPANY_API_PASSWORD);

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders,
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(
      `Company API login failed: ${res.status} ${JSON.stringify(body || {})}`,
    );
  }

  const jwt = body?.jwt || body?.token || body?.accessToken || body?.access_token;
  const refreshToken =
    body?.refreshToken || body?.refresh_token || tokenCache.refreshToken || "";
  if (!jwt) {
    throw new Error("Company API login succeeded but JWT missing in response.");
  }

  tokenCache = {
    jwt,
    refreshToken,
    expiresAtMs: Date.now() + 55 * 60 * 1000,
  };
  return tokenCache.jwt;
};

const refreshJwt = async () => {
  if (!tokenCache.refreshToken) {
    return loginForJwt();
  }
  const url = new URL(
    `/api/refresh/refreshToken=${encodeURIComponent(tokenCache.refreshToken)}`,
    COMPANY_AUTH_URL,
  );
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders,
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    return loginForJwt();
  }
  const jwt = body?.jwt || body?.token || body?.accessToken || body?.access_token;
  if (!jwt) {
    return loginForJwt();
  }
  tokenCache = {
    ...tokenCache,
    jwt,
    expiresAtMs: Date.now() + 55 * 60 * 1000,
  };
  return tokenCache.jwt;
};

const getJwt = async () => {
  if (isTokenFresh()) {
    return tokenCache.jwt;
  }
  if (tokenCache.jwt && tokenCache.refreshToken) {
    return refreshJwt();
  }
  return loginForJwt();
};

export const runCompanyGraphql = async (query, variables = {}) => {
  const jwt = await getJwt();
  const execute = async (bearer) =>
    fetch(COMPANY_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ query, variables }),
    });

  let res = await execute(jwt);
  let body = await parseJsonSafe(res);
  if (
    (res.status === 401 ||
      body?.errors?.some((e) =>
        String(e?.extensions?.code || "").toLowerCase().includes("jwt"),
      )) &&
    !STATIC_JWT
  ) {
    const refreshed = await refreshJwt();
    res = await execute(refreshed);
    body = await parseJsonSafe(res);
  }

  if (!res.ok || body?.errors?.length) {
    throw new Error(
      `Company GraphQL request failed: ${res.status} ${JSON.stringify(body?.errors || body || {})}`,
    );
  }
  return body?.data || {};
};
