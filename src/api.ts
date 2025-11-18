import axios from "axios";

export const API_URL =
  (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

const http = axios.create({ baseURL: API_URL });
http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export type Series = {
  id: number;
  name: string;
  min_value: number;
  max_value: number;
  color?: string | null;
  icon?: string | null;
};

export type Measurement = {
  id: number;
  series_id: number;
  value: number;
  timestamp: string;
};

export async function apiLogin(username: string, password: string) {
  const res = await http.post("/auth/login", { username, password }, {
    headers: { "Content-Type": "application/json" },
  });
  const token: string | undefined = res.data?.access_token;
  if (!token) throw new Error("Brak tokenu w odpowiedzi z /auth/login");
  localStorage.setItem("token", token);
  return res.data;
}

export function apiLogout() {
  localStorage.removeItem("token");
}

export async function apiChangePassword(old_password: string, new_password: string) {
  await http.post("/auth/change-password", { old_password, new_password });
}

export async function apiListSeries(params?: { limit?: number; offset?: number }) {
  const res = await http.get<Series[]>("/series", { params });
  return { items: res.data };
}

export async function apiCreateSeries(data: {
  name: string;
  min_value: number;
  max_value: number;
  color?: string | null;
  icon?: string | null;
}) {
  const res = await http.post<Series>("/series", data);
  return res.data;
}

export async function apiUpdateSeries(
  id: number,
  data: Partial<Pick<Series, "name" | "min_value" | "max_value" | "color" | "icon">>
) {
  const res = await http.put<Series>(`/series/${id}`, data);
  return res.data;
}

export async function apiDeleteSeries(id: number) {
  await http.delete(`/series/${id}`);
}

export async function apiListMeasurements(params: {
  series_id: number;
  ts_from?: string;
  ts_to?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await http.get<Measurement[]>("/measurements", { params });
  return { items: res.data };
}

export async function apiCreateMeasurement(data: {
  series_id: number;
  value: number;
  timestamp: string;
}) {
  const res = await http.post<Measurement>("/measurements", data);
  return res.data;
}

export async function apiUpdateMeasurement(
  id: number,
  data: { series_id: number; value: number; timestamp: string }
) {
  const res = await http.put<Measurement>(`/measurements/${id}`, data);
  return res.data;
}

export async function apiDeleteMeasurement(id: number) {
  await http.delete(`/measurements/${id}`);
}
