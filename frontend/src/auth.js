const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (!exp) return false;
  return Date.now() >= exp * 1000;
};

export const getStoredToken = () => localStorage.getItem("token") || "";

export const getValidStoredToken = () => {
  const token = getStoredToken();
  if (!token) return "";
  if (isTokenExpired(token)) {
    localStorage.removeItem("token");
    return "";
  }
  return token;
};
