import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BACKEND}/api`,
});

// Attach the right token depending on the request URL
api.interceptors.request.use((config) => {
  const url = config.url || "";
  const isAdmin = url.startsWith("/admin") || url.includes("/auth/admin");
  const token = isAdmin
    ? localStorage.getItem("admin_token")
    : localStorage.getItem("candidate_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Ocorreu um erro. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
