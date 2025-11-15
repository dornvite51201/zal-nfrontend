// src/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

// Dołącz token Bearer jeśli jest w localStorage (zgodne z Axios v1 i v0.x)
api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("token");
  if (t) {
    // Axios v1: cfg.headers to AxiosHeaders -> ma metodę set()
    const h = cfg.headers as any;
    if (h?.set instanceof Function) {
      h.set("Authorization", `Bearer ${t}`);
    } else {
      // Axios v0.x lub nietypowa konfiguracja
      cfg.headers = {
        ...(cfg.headers || {}),
        Authorization: `Bearer ${t}`,
      } as any;
    }
  }
  return cfg;
});

// ===== TYPY =====

export type Series = {
  id: number;
  name: string;
  min_value: number;
  max_value: number;
  color?: string;
  icon?: string;
};

export type Measurement = {
  id: number;
  series_id: number;
  value: number;
  timestamp: string; // ISO
};

// ===== AUTH =====

export async function apiLogin(username: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);

  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  localStorage.setItem("token", data.access_token);
  return data;
}

export function apiLogout() {
  localStorage.removeItem("token");
}

export async function apiChangePassword(
  old_password: string,
  new_password: string
) {
  await api.post("/auth/change-password", { old_password, new_password });
}

// ===== SERIES =====

export async function apiListSeries(params?: {
  limit?: number;
  offset?: number;
}) {
  const { data } = await api.get("/series", { params });
  const items = Array.isArray(data) ? data : data.items;
  return { items: items as Series[] };
}

export async function apiCreateSeries(payload: {
  name: string;
  min_value: number;
  max_value: number;
  color?: string;
  icon?: string;
}) {
  const { data } = await api.post("/series", payload);
  return data as Series;
}

export async function apiUpdateSeries(
  id: number,
  payload: {
    name: string;
    min_value: number;
    max_value: number;
    color?: string;
    icon?: string;
  }
) {
  const { data } = await api.put(`/series/${id}`, payload);
  return data as Series;
}

export async function apiDeleteSeries(id: number) {
  await api.delete(`/series/${id}`);
}

// ===== MEASUREMENTS =====

export async function apiListMeasurements(params: {
  series_id?: number;
  limit?: number;
  offset?: number;
  ts_from?: string;
  ts_to?: string;
}) {
  const { data } = await api.get("/measurements", { params });
  const items = Array.isArray(data) ? data : data.items;
  return { items: items as Measurement[] };
}

export async function apiCreateMeasurement(payload: {
  series_id: number;
  value: number;
  timestamp: string;
}) {
  const { data } = await api.post("/measurements", payload);
  return data as Measurement;
}

export async function apiUpdateMeasurement(
  id: number,
  payload: { series_id: number; value: number; timestamp: string }
) {
  const { data } = await api.put(`/measurements/${id}`, payload);
  return data as Measurement;
}

export async function apiDeleteMeasurement(id: number) {
  await api.delete(`/measurements/${id}`);
}