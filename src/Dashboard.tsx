import React, { useEffect, useMemo, useState } from "react";
import {
  apiListSeries,
  apiListMeasurements,
  apiCreateMeasurement,
  apiUpdateMeasurement,
  apiDeleteMeasurement,
  apiCreateSeries,
  apiUpdateSeries,
  apiDeleteSeries,
  apiChangePassword,
} from "./api";
import type { Series, Measurement } from "./api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DashboardProps = {
  onLogout: () => void;
  isAdmin: boolean;
};

function fmtFull(ts: string) {
  return new Date(ts).toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInputValue(ts: string) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
}

const responsiveCSS = `
@media (max-width: 1280px) {
  div[data-dashboard-grid]{ grid-template-columns: 1fr !important; }
}
`;

const printCSS = `
@page {
  size: A4 portrait;
  margin: 10mm;
}
.chart-print {
  display: none;
}
@media print {
  html, body {
    margin: 0;
    padding: 0;
  }
  html, body, #root {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: #1a1a1a !important;
    color: #fff !important;
  }
  .no-print {
    display: none !important;
  }
  .page-wrap {
    min-height: auto !important;
    height: auto !important;
    padding: 0 !important;
  }
  div[data-dashboard-grid] {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 8mm !important;
  }
  .card {
    background: #1f1f1f !important;
    border: 1px solid #333 !important;
    page-break-inside: auto;
    break-inside: auto;
  }
  .chart-screen {
    display: none !important;
  }
  .chart-print {
    display: block !important;
    width: 100% !important;
  }
  .chart-card {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .table-card {
    page-break-inside: auto;
    break-inside: auto;
  }
  .table-card table {
    page-break-inside: auto;
  }
  .table-card tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  [style*="position: fixed"] {
    display: none !important;
  }
}
`;

export default function Dashboard({ onLogout, isAdmin }: DashboardProps) {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [activeSeriesIds, setActiveSeriesIds] = useState<number[]>([]);
  const [measurementsBySeries, setMeasurementsBySeries] = useState<Record<number, Measurement[]>>({});
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingMeas, setLoadingMeas] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newValue, setNewValue] = useState<string>("");
  const [newUseNow, setNewUseNow] = useState(true);
  const [newTimestamp, setNewTimestamp] = useState("");

  const [filterMode, setFilterMode] = useState<"date" | "datetime">("date");
  const [fromTs, setFromTs] = useState("");
  const [toTs, setToTs] = useState("");

  const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
  const [selectedMeasurementIds, setSelectedMeasurementIds] = useState<number[]>([]);

  const [editMeasurement, setEditMeasurement] = useState<Measurement | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editTs, setEditTs] = useState("");

  const [seriesEditName, setSeriesEditName] = useState("");
  const [seriesEditMin, setSeriesEditMin] = useState("");
  const [seriesEditMax, setSeriesEditMax] = useState("");
  const [seriesEditColor, setSeriesEditColor] = useState("#61dafb");

  const [newSeriesName, setNewSeriesName] = useState("");
  const [newSeriesMin, setNewSeriesMin] = useState("");
  const [newSeriesMax, setNewSeriesMax] = useState("");
  const [newSeriesColor, setNewSeriesColor] = useState("#ff7f50");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSeries() {
      try {
        setLoadingSeries(true);
        setErrorMsg(null);
        const res = await apiListSeries({ limit: 200, offset: 0 });
        const items: Series[] = res.items ?? [];
        setSeriesList(items);
        if (items.length > 0 && selectedSeriesId === null) setSelectedSeriesId(items[0].id);
        if (items.length > 0 && activeSeriesIds.length === 0) setActiveSeriesIds(items.map((s) => s.id));
      } catch {
        setErrorMsg("Nie udało się pobrać listy serii.");
      } finally {
        setLoadingSeries(false);
      }
    }
    loadSeries();
  }, []);

  useEffect(() => {
    async function loadAll() {
      if (activeSeriesIds.length === 0) {
        setMeasurementsBySeries({});
        return;
      }
      try {
        setLoadingMeas(true);
        setErrorMsg(null);
        const next: Record<number, Measurement[]> = {};

        const buildIso = (value: string, endOfDay: boolean) => {
          if (!value) return null;
          if (filterMode === "datetime") {
            let v = value;
            if (v.length === 16) v += ":00";
            return v;
          } else {
            return `${value}${endOfDay ? "T23:59:59" : "T00:00:00"}`;
          }
        };

        const fromIso = buildIso(fromTs, false);
        const toIso = buildIso(toTs, true);

        for (const id of activeSeriesIds) {
          const params: any = { series_id: id, limit: 500 };
          if (fromIso) params.ts_from = fromIso;
          if (toIso) params.ts_to = toIso;
          const res = await apiListMeasurements(params);
          next[id] = (res.items ?? []).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        }
        setMeasurementsBySeries(next);
        setSelectedMeasurementId(null);
        setSelectedMeasurementIds([]);
        setEditMeasurement(null);
        setEditTs("");
      } catch {
        setErrorMsg("Nie udało się pobrać pomiarów.");
      } finally {
        setLoadingMeas(false);
      }
    }
    loadAll();
  }, [activeSeriesIds, fromTs, toTs, filterMode]);

  useEffect(() => {
    const s = seriesList.find((x) => x.id === selectedSeriesId);
    if (!s) return;
    setSeriesEditName(s.name);
    setSeriesEditMin(String(s.min_value));
    setSeriesEditMax(String(s.max_value));
    setSeriesEditColor(s.color || "#61dafb");
  }, [selectedSeriesId, seriesList]);

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId);

  async function handleAddMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    if (selectedSeriesId === null) {
      setErrorMsg("Wybierz serię.");
      return;
    }
    const series = selectedSeries;
       if (!series) {
      setErrorMsg("Nie znaleziono serii.");
      return;
    }
    const valueNum = Number(newValue);
    if (Number.isNaN(valueNum)) {
      setErrorMsg("Wartość musi być liczbą.");
      return;
    }
    if (valueNum < series.min_value || valueNum > series.max_value) {
      setErrorMsg(`Wartość musi być w zakresie ${series.min_value} – ${series.max_value}.`);
      return;
    }

    let timestampIso: string;
    if (newUseNow) {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const hours = pad(now.getHours());
      const mins = pad(now.getMinutes());
      const secs = pad(now.getSeconds());
      timestampIso = `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
    } else {
      if (!newTimestamp) {
        setErrorMsg("Podaj czas pomiaru.");
        return;
      }
      let ts = newTimestamp;
      if (ts.length === 16) ts += ":00";
      timestampIso = ts;
    }

    try {
      setErrorMsg(null);
      const created = await apiCreateMeasurement({
        series_id: selectedSeriesId,
        value: valueNum,
        timestamp: timestampIso,
      });
      setMeasurementsBySeries((prev) => {
        const arr = prev[selectedSeriesId] ? [...prev[selectedSeriesId]] : [];
        arr.push(created);
        arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return { ...prev, [selectedSeriesId]: arr };
      });
      setNewValue("");
      if (!newUseNow) setNewTimestamp("");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "Nie udało się dodać pomiaru.");
    }
  }

  async function handleDeleteMeasurement(m: Measurement) {
    if (!isAdmin) return;

    const hasMulti = selectedMeasurementIds.length > 1 && selectedMeasurementIds.includes(m.id);

    if (hasMulti) {
      if (
        !window.confirm(
          "Czy usunąć pomiary? Wszystkie zaznaczone pomiary zostaną usunięte."
        )
      ) {
        return;
      }
      const idsToDelete = [...selectedMeasurementIds];
      try {
        await Promise.all(idsToDelete.map((id) => apiDeleteMeasurement(id)));
        setMeasurementsBySeries((prev) => {
          const clone: Record<number, Measurement[]> = {};
          for (const [seriesIdStr, list] of Object.entries(prev)) {
            const seriesId = Number(seriesIdStr);
            clone[seriesId] = list.filter((meas) => !idsToDelete.includes(meas.id));
          }
          return clone;
        });
        setSelectedMeasurementId(null);
        setSelectedMeasurementIds([]);
        if (editMeasurement && idsToDelete.includes(editMeasurement.id)) {
          setEditMeasurement(null);
          setEditTs("");
        }
      } catch {
        setErrorMsg("Nie udało się usunąć pomiarów.");
      }
      return;
    }

    if (!window.confirm("Na pewno usunąć ten pomiar?")) return;
    try {
      await apiDeleteMeasurement(m.id);
      setMeasurementsBySeries((prev) => {
        const arr = prev[m.series_id] || [];
        return { ...prev, [m.series_id]: arr.filter((x) => x.id !== m.id) };
      });
      if (selectedMeasurementId === m.id) setSelectedMeasurementId(null);
      setSelectedMeasurementIds((prev) => prev.filter((id) => id !== m.id));
      if (editMeasurement?.id === m.id) {
        setEditMeasurement(null);
        setEditTs("");
      }
    } catch {
      setErrorMsg("Nie udało się usunąć pomiaru.");
    }
  }

  async function handleUpdateMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !editMeasurement) return;
    const series = seriesList.find((s) => s.id === editMeasurement.series_id);
    const valueNum = Number(editValue);
    if (Number.isNaN(valueNum)) {
      setErrorMsg("Wartość musi być liczbą.");
      return;
    }
    if (series && (valueNum < series.min_value || valueNum > series.max_value)) {
      setErrorMsg(`Wartość musi być w zakresie ${series.min_value} – ${series.max_value}.`);
      return;
    }

    let timestampIso = editMeasurement.timestamp;
    if (editTs) {
      let ts = editTs;
      if (ts.length === 16) ts += ":00";
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) {
        setErrorMsg("Niepoprawny format czasu pomiaru.");
        return;
      }
      timestampIso = ts;
    }

    try {
      setErrorMsg(null);
      const updated = await apiUpdateMeasurement(editMeasurement.id, {
        series_id: editMeasurement.series_id,
        value: valueNum,
        timestamp: timestampIso,
      });
      setMeasurementsBySeries((prev) => {
        const arr = prev[updated.series_id] ? [...prev[updated.series_id]] : [];
        const idx = arr.findIndex((x) => x.id === updated.id);
        if (idx !== -1) arr[idx] = updated;
        else arr.push(updated);
        arr.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return { ...prev, [updated.series_id]: arr };
      });
      setEditMeasurement(null);
      setEditTs("");
      setSelectedMeasurementId(updated.id);
      setSelectedMeasurementIds([updated.id]);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "Nie udało się zaktualizować pomiaru.");
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleUpdateSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || selectedSeriesId === null) return;
    const min = Number(seriesEditMin);
    const max = Number(seriesEditMax);
    if (!seriesEditName.trim() || Number.isNaN(min) || Number.isNaN(max)) {
      setErrorMsg("Uzupełnij nazwę oraz min/max.");
      return;
    }
    if (min > max) {
      setErrorMsg("Min nie może być > max.");
      return;
    }
    try {
      setErrorMsg(null);
      const updated = await apiUpdateSeries(selectedSeriesId, {
        name: seriesEditName.trim(),
        min_value: min,
        max_value: max,
        color: seriesEditColor || "#61dafb",
        icon: selectedSeries?.icon,
      });
      setSeriesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "Nie udało się zaktualizować serii.");
    }
  }

  async function handleCreateSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    const name = newSeriesName.trim();
    const min = Number(newSeriesMin);
    const max = Number(newSeriesMax);
    if (!name || Number.isNaN(min) || Number.isNaN(max)) {
      setErrorMsg("Podaj nazwę i min/max.");
      return;
    }
    if (min > max) {
      setErrorMsg("Min nie może być > max.");
      return;
    }
    try {
      setErrorMsg(null);
      const created = await apiCreateSeries({
        name,
        min_value: min,
        max_value: max,
        color: newSeriesColor || "#ff7f50",
      });
      setSeriesList((prev) => [...prev, created]);
      setNewSeriesName("");
      setNewSeriesMin("");
      setNewSeriesMax("");
      setNewSeriesColor("#ff7f50");
      setSelectedSeriesId(created.id);
      setActiveSeriesIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || "Nie udało się utworzyć serii.");
    }
  }

  async function handleDeleteSeriesClick() {
    if (!isAdmin || selectedSeriesId === null) return;
    const s = selectedSeries;
    if (!s) return;
    if (!window.confirm(`Na pewno usunąć serię "${s.name}"?`)) return;
    try {
      await apiDeleteSeries(s.id);
      setSeriesList((prev) => prev.filter((x) => x.id !== s.id));
      setMeasurementsBySeries((prev) => {
        const clone = { ...prev };
        delete clone[s.id];
        return clone;
      });
      setActiveSeriesIds((prev) => prev.filter((id) => id !== s.id));
      const remaining = seriesList.filter((x) => x.id !== s.id);
      setSelectedSeriesId(remaining.length ? remaining[0].id : null);
    } catch {
      setErrorMsg("Nie udało się usunąć serii.");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    if (!oldPassword || !newPassword) {
      setPasswordMsg("Podaj oba hasła.");
      return;
    }
    try {
      await apiChangePassword(oldPassword, newPassword);
      setPasswordMsg("Hasło zostało zmienione.");
      setOldPassword("");
      setNewPassword("");
    } catch (e: any) {
      setPasswordMsg(String(e?.response?.data?.detail || "Nie udało się zmienić hasła."));
    }
  }

  const pageWrapStyle: React.CSSProperties = {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "8px 0 16px",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "none",
    margin: 0,
    padding: "0 16px",
    boxSizing: "border-box",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "380px minmax(0, 1fr) 420px",
    gap: "16px",
    alignItems: "start",
  };

  const cardStyle: React.CSSProperties = {
    boxSizing: "border-box",
    backgroundColor: "#1f1f1f",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "12px",
    color: "#fff",
    fontSize: "14px",
    display: "flex",
    flexDirection: "column",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: "14px",
    fontWeight: 600,
    color: "#fff",
    marginBottom: "8px",
    textAlign: "left",
  };

  const sectionHeaderCenterStyle: React.CSSProperties = {
    ...sectionHeaderStyle,
    textAlign: "center",
  };

  const tableHeadStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "6px 8px",
    color: "#ccc",
    fontWeight: 600,
    borderBottom: "1px solid #333",
    whiteSpace: "nowrap",
  };

  const tdStyleLeft: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: "1px solid #333",
    whiteSpace: "nowrap",
    color: "#eee",
    textAlign: "center",
  };

  const tdStyleCenter: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: "1px solid #333",
    textAlign: "center",
    whiteSpace: "nowrap",
    color: "#fff",
  };

  const mutedStyle: React.CSSProperties = { color: "#bbb", fontSize: "13px" };

  const errorStyle: React.CSSProperties = {
    backgroundColor: "#400",
    color: "#fff",
    fontSize: "13px",
    padding: "6px 8px",
    borderRadius: "4px",
    marginTop: "8px",
  };

  const topBarCentered: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    marginBottom: 12,
  };

  const buttonGhost: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid #666",
    backgroundColor: "#2a2a2a",
    color: "#fff",
    cursor: "pointer",
  };

  const smallButton: React.CSSProperties = {
    padding: "4px 6px",
    fontSize: "10px",
    borderRadius: 6,
    border: "1px solid #555",
    backgroundColor: "#2a2a2a",
    color: "#fff",
    cursor: "pointer",
    marginTop: 2,
  };

  const rightColumnStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    alignItems: "stretch",
    width: "100%",
    minWidth: 0,
  };

  const rightCardStyle: React.CSSProperties = {
    ...cardStyle,
    width: "100%",
    alignSelf: "stretch",
    flexShrink: 0,
  };

  const rightInputBase: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#2a2a2a",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    boxSizing: "border-box",
  };

  const leftFilterInputBase: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#2a2a2a",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 6,
    padding: "4px 6px",
    fontSize: 11,
    boxSizing: "border-box",
  };

  type TableRow = { timestamp: string; measurements: Record<number, Measurement> };

  function buildTableRows(): TableRow[] {
    const map = new Map<string, TableRow>();
    for (const seriesId of activeSeriesIds) {
      const list = measurementsBySeries[seriesId] || [];
      for (const m of list) {
        let row = map.get(m.timestamp);
        if (!row) {
          row = { timestamp: m.timestamp, measurements: {} };
          map.set(m.timestamp, row);
        }
        row.measurements[seriesId] = m;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  const tableRows = buildTableRows();

  const rankMap = useMemo(() => {
    const m = new Map<number, number>();
    activeSeriesIds.forEach((id, idx) => m.set(id, idx + 1));
    return m;
  }, [activeSeriesIds]);

  function renderSeriesSelect() {
    return (
      <div style={cardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Seria i filtr czasu</div>
        {loadingSeries ? (
          <div style={mutedStyle}>ładowanie…</div>
        ) : (
          <>
            <label
              className="no-print"
              style={{ display: "block", marginBottom: 6, fontSize: 12 }}
            >
              Seria do edycji / dodawania:
              <select
                style={{
                  width: "100%",
                  marginTop: 2,
                  backgroundColor: "#2a2a2a",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: "6px",
                  padding: "6px 8px",
                  fontSize: "13px",
                }}
                value={selectedSeriesId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedSeriesId(v === "" ? null : Number(v));
                }}
              >
                <option value="">(wybierz serię…)</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (min {s.min_value} / max {s.max_value})
                  </option>
                ))}
              </select>
            </label>

            <div
              className="no-print"
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "#bbb",
                maxHeight: 220,
                overflowY: "auto",
                borderTop: "1px solid #333",
                paddingTop: 4,
              }}
            >
              <div style={{ marginBottom: 2 }}>Widoczne serie (wykres + tabela):</div>
              {seriesList.map((s) => {
                const checked = activeSeriesIds.includes(s.id);
                const rank = rankMap.get(s.id);
                return (
                  <label
                    key={s.id}
                    style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setActiveSeriesIds((prev) =>
                          checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        );
                      }}
                    />
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: s.color || "#61dafb",
                        borderRadius: 2,
                        display: "inline-block",
                      }}
                    />
                    <span>{checked && rank ? `s${rank}: ` : ""}{s.name}</span>
                  </label>
                );
              })}
              {seriesList.length === 0 && <div>Brak zdefiniowanych serii.</div>}
            </div>

            <div
              className="no-print"
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 11,
                color: "#bbb",
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    name="filter-mode"
                    value="date"
                    checked={filterMode === "date"}
                    onChange={() => setFilterMode("date")}
                  />
                  <span>Po dacie</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    name="filter-mode"
                    value="datetime"
                    checked={filterMode === "datetime"}
                    onChange={() => setFilterMode("datetime")}
                  />
                  <span>Data i czas</span>
                </label>
              </div>
              <label>
                Od:
                <input
                  type={filterMode === "datetime" ? "datetime-local" : "date"}
                  step={filterMode === "datetime" ? "1" : undefined}
                  value={fromTs}
                  onChange={(e) => setFromTs(e.target.value)}
                  style={{ ...leftFilterInputBase, marginTop: 2 }}
                />
              </label>
              <label>
                Do:
                <input
                  type={filterMode === "datetime" ? "datetime-local" : "date"}
                  step={filterMode === "datetime" ? "1" : undefined}
                  value={toTs}
                  onChange={(e) => setToTs(e.target.value)}
                  style={{ ...leftFilterInputBase, marginTop: 2 }}
                />
              </label>
              {(fromTs || toTs) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromTs("");
                    setToTs("");
                  }}
                  style={smallButton}
                >
                  Wyczyść filtr czasu
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderChartCard() {
    const map = new Map<string, any>();
    for (const seriesId of activeSeriesIds) {
      const list = measurementsBySeries[seriesId] || [];
      for (const m of list) {
        let row = map.get(m.timestamp);
        if (!row) {
          row = { timestamp: m.timestamp, label: fmtTime(m.timestamp) };
          map.set(m.timestamp, row);
        }
        const rank = rankMap.get(seriesId);
        if (rank) {
          const key = `s${rank}`;
          row[key] = m.value;
          row[`mId_${key}`] = m.id;
        }
      }
    }
    const chartData = Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const renderLines = (forPrint: boolean) =>
      activeSeriesIds.map((id, idx) => {
        const s = seriesList.find((x) => x.id === id);
        const color = s?.color || "#61dafb";
        const rank = rankMap.get(id) || idx + 1;
        const dataKey = `s${rank}`;
        const mIdKey = `mId_${dataKey}`;
        const renderDot = (props: any) => {
          const { cx, cy, payload } = props;
          const val = payload[dataKey];
          const isActive = selectedMeasurementIds.includes(payload[mIdKey]);
          const isPrimary = payload[mIdKey] === selectedMeasurementId;
          const baseColor = color;
          const r = val == null ? 0 : isPrimary ? 6 : isActive ? 4 : 3;
          const fillColor = isActive || isPrimary || forPrint ? baseColor : "#ffffff";
          const strokeColor = fillColor;
          return <circle cx={cx} cy={cy} r={r} fill={fillColor} stroke={strokeColor} />;
        };
        return (
          <Line
            key={id}
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            dot={renderDot as any}
          />
        );
      });

    return (
      <div style={{ ...cardStyle, marginBottom: 16 }} className="card chart-card">
        <div style={sectionHeaderCenterStyle}>Wykres wartości w czasie</div>
        {loadingMeas ? (
          <div style={mutedStyle}>ładowanie…</div>
        ) : activeSeriesIds.length === 0 ? (
          <div style={mutedStyle}>Wybierz co najmniej jedną serię.</div>
        ) : chartData.length === 0 ? (
          <div style={mutedStyle}>Brak danych.</div>
        ) : (
          <>
            <div className="chart-screen" style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}>
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  {renderLines(false)}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-print">
              <LineChart
                width={700}
                height={250}
                data={chartData}
                margin={{ left: 4, right: 8, top: 8, bottom: 8 }}
              >
                <XAxis dataKey="label" />
                <YAxis />
                {renderLines(true)}
              </LineChart>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderTable() {
    return (
      <div style={cardStyle} className="card table-card">
        <div style={sectionHeaderCenterStyle}>Zestawienie pomiarów</div>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Czas</th>
              {activeSeriesIds.map((id, idx) => {
                const s = seriesList.find((x) => x.id === id);
                const rank = rankMap.get(id) || idx + 1;
                return (
                  <th key={id} style={tableHeadStyle}>
                    {s ? `s${rank}: ${s.name}` : `s${rank}`}
                  </th>
                );
              })}
              {isAdmin && (
                <th style={tableHeadStyle} className="no-print">
                  Akcje
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loadingMeas ? (
              <tr>
                <td
                  style={tdStyleLeft}
                  colSpan={1 + activeSeriesIds.length + (isAdmin ? 1 : 0)}
                >
                  ładowanie…
                </td>
              </tr>
            ) : activeSeriesIds.length === 0 ? (
              <tr>
                <td style={tdStyleLeft} colSpan={1 + (isAdmin ? 1 : 0)}>
                  Wybierz serie do wyświetlenia.
                </td>
              </tr>
            ) : tableRows.length === 0 ? (
              <tr>
                <td
                  style={tdStyleLeft}
                  colSpan={1 + activeSeriesIds.length + (isAdmin ? 1 : 0)}
                >
                  Brak pomiarów.
                </td>
              </tr>
            ) : (
              tableRows.map((row) => {
                const rowMeasurementsList: Measurement[] = activeSeriesIds
                  .map((id) => row.measurements[id])
                  .filter((m): m is Measurement => Boolean(m));

                return (
                  <tr key={row.timestamp}>
                    <td style={tdStyleLeft}>{fmtFull(row.timestamp)}</td>
                    {activeSeriesIds.map((id) => {
                      const m = row.measurements[id];
                      const isSelected = m && selectedMeasurementIds.includes(m.id);
                      return (
                        <td
                          key={id}
                          style={{
                            ...tdStyleCenter,
                            backgroundColor: isSelected ? "#333" : "transparent",
                            userSelect: "none",
                          }}
                          onClick={(e) => {
                            if (!m) return;
                            setSelectedSeriesId(m.series_id);

                            if (e.ctrlKey || e.metaKey) {
                              setSelectedMeasurementIds((prev) =>
                                prev.includes(m.id) ? prev : [...prev, m.id]
                              );
                              setSelectedMeasurementId(m.id);
                            } else {
                              setSelectedMeasurementIds([m.id]);
                              setSelectedMeasurementId(m.id);
                            }

                            if (isAdmin) {
                              setEditMeasurement(m);
                              setEditValue(String(m.value));
                              setEditTs(toLocalInputValue(m.timestamp));
                            }
                          }}
                        >
                          {m ? m.value : "–"}
                          {isAdmin && m && (
                            <button
                              className="no-print"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMeasurement(m);
                              }}
                              style={{
                                marginLeft: 6,
                                padding: "2px 6px",
                                fontSize: 9,
                                borderRadius: 4,
                                border: "1px solid #555",
                                backgroundColor: "#2a2a2a",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Usuń
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {isAdmin && (
                      <td style={tdStyleLeft} className="no-print">
                        {rowMeasurementsList.length > 0 && (
                          <button
                            onClick={() => {
                              const list = rowMeasurementsList;
                              if (list.length === 0) return;

                              let target: Measurement;
                              if (
                                editMeasurement &&
                                editMeasurement.timestamp === row.timestamp
                              ) {
                                const currentIdx = list.findIndex(
                                  (m) => m.id === editMeasurement.id
                                );
                                const nextIdx =
                                  currentIdx === -1
                                    ? 0
                                    : (currentIdx + 1) % list.length;
                                target = list[nextIdx];
                              } else {
                                target = list[0];
                              }

                              setSelectedSeriesId(target.series_id);
                              setSelectedMeasurementId(target.id);
                              setSelectedMeasurementIds([target.id]);
                              setEditMeasurement(target);
                              setEditValue(String(target.value));
                              setEditTs(toLocalInputValue(target.timestamp));
                            }}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              borderRadius: 6,
                              border: "1px solid #555",
                              backgroundColor: "#2a2a2a",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            Edytuj wartość
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAddMeasurementBox() {
    if (!isAdmin) return null;
    return (
      <div style={rightCardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Dodaj nowy pomiar</div>
        <form onSubmit={handleAddMeasurement}>
          <div style={{ marginBottom: 6, ...mutedStyle }}>
            Dodaj wartość do wybranej serii. Czas możesz ustawić na bieżący lub podać ręcznie.
          </div>

          <div style={{ marginBottom: 6 }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <input
                type="checkbox"
                checked={newUseNow}
                onChange={(e) => setNewUseNow(e.target.checked)}
              />
              <span>Użyj bieżącego czasu</span>
            </label>
          </div>

          {!newUseNow && (
            <input
              type="datetime-local"
              step="1"
              value={newTimestamp}
              onChange={(e) => setNewTimestamp(e.target.value)}
              style={{ ...rightInputBase, marginBottom: 8 }}
            />
          )}

          <input
            type="number"
            step="any"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Wartość pomiaru"
            style={{ ...rightInputBase, marginBottom: 8 }}
          />
          <button
            type="submit"
            style={{
              padding: "6px 10px",
              fontSize: "13px",
              borderRadius: "6px",
              border: "1px solid #666",
              backgroundColor: "#2f7d32",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Dodaj pomiar (Enter)
          </button>
        </form>
      </div>
    );
  }

  function renderEditMeasurementBox() {
    if (!isAdmin || !editMeasurement) return null;
    const series = seriesList.find((s) => s.id === editMeasurement.series_id);
    return (
      <div style={rightCardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Edytuj pomiar</div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>
          Seria: {series?.name} (min {series?.min_value}, max {series?.max_value})
        </div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>Czas pomiaru:</div>
        <form onSubmit={handleUpdateMeasurement}>
          <input
            type="datetime-local"
            step="1"
            value={editTs}
            onChange={(e) => setEditTs(e.target.value)}
            style={{ ...rightInputBase, marginBottom: 6 }}
          />
          <div style={{ ...mutedStyle, marginBottom: 6 }}>
            Aktualnie zapisany czas: {fmtFull(editMeasurement.timestamp)}
          </div>
          <input
            type="number"
            step="any"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{ ...rightInputBase, marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "12px",
                borderRadius: 6,
                border: "1px solid #666",
                backgroundColor: "#1e88e5",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Zapisz zmiany
            </button>
            <button
              type="button"
              onClick={() => {
                setEditMeasurement(null);
                setSelectedMeasurementId(null);
                setEditTs("");
              }}
              style={{
                padding: "6px 8px",
                fontSize: "12px",
                borderRadius: 6,
                border: "1px solid #555",
                backgroundColor: "#2a2a2a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Anuluj
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderSeriesAdminBox() {
    if (!isAdmin) return null;
    return (
      <div style={rightCardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Konfiguracja serii</div>
        {selectedSeries && (
          <>
            <div style={{ ...mutedStyle, marginBottom: 4 }}>Edytuj wybraną serię:</div>
            <form onSubmit={handleUpdateSeries}>
              <input
                value={seriesEditName}
                onChange={(e) => setSeriesEditName(e.target.value)}
                placeholder="Nazwa serii"
                style={{ ...rightInputBase, marginBottom: 4 }}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  marginBottom: 4,
                  minWidth: 0,
                }}
              >
                <input
                  type="number"
                  step="any"
                  value={seriesEditMin}
                  onChange={(e) => setSeriesEditMin(e.target.value)}
                  placeholder="Min"
                  style={{ ...rightInputBase }}
                />
                <input
                  type="number"
                  step="any"
                  value={seriesEditMax}
                  onChange={(e) => setSeriesEditMax(e.target.value)}
                  placeholder="Max"
                  style={{ ...rightInputBase }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ ...mutedStyle, marginRight: 6 }}>Kolor:</span>
                <input
                  type="color"
                  value={seriesEditColor}
                  onChange={(e) => setSeriesEditColor(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    fontSize: "12px",
                    borderRadius: 6,
                    border: "1px solid #666",
                    backgroundColor: "#1e88e5",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Zapisz serię
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSeriesClick}
                  style={{
                    padding: "6px 8px",
                    fontSize: "12px",
                    borderRadius: 6,
                    border: "1px solid #844",
                    backgroundColor: "#a00000",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Usuń serię
                </button>
              </div>
            </form>
          </>
        )}

        <div style={{ borderTop: "1px solid #333", margin: "8px 0" }} />

        <div style={{ ...mutedStyle, marginBottom: 4 }}>Dodaj nową serię:</div>
        <form onSubmit={handleCreateSeries}>
          <input
            value={newSeriesName}
            onChange={(e) => setNewSeriesName(e.target.value)}
            placeholder="Nazwa nowej serii"
            style={{ ...rightInputBase, marginBottom: 4 }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              marginBottom: 4,
            }}
          >
            <input
              type="number"
              step="any"
              value={newSeriesMin}
              onChange={(e) => setNewSeriesMin(e.target.value)}
              placeholder="Min"
              style={{ ...rightInputBase }}
            />
            <input
              type="number"
              step="any"
              value={newSeriesMax}
              onChange={(e) => setNewSeriesMax(e.target.value)}
              placeholder="Max"
              style={{ ...rightInputBase }}
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ ...mutedStyle, marginRight: 6 }}>Kolor:</span>
            <input
              type="color"
              value={newSeriesColor}
              onChange={(e) => setNewSeriesColor(e.target.value)}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "6px 8px",
              fontSize: "12px",
              borderRadius: 6,
              border: "1px solid #666",
              backgroundColor: "#388e3c",
              color: "#fff",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Dodaj serię
          </button>
        </form>
      </div>
    );
  }

  function renderChangePasswordBox() {
    if (!isAdmin) return null;
    return (
      <div style={rightCardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Zmień hasło administratora</div>
        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Obecne hasło"
            style={{ ...rightInputBase, marginBottom: 4 }}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nowe hasło"
            style={{ ...rightInputBase, marginBottom: 6 }}
          />
          <button
            type="submit"
            style={{
              padding: "6px 8px",
              fontSize: "12px",
              borderRadius: 6,
              border: "1px solid #666",
              backgroundColor: "#455a64",
              color: "#fff",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Zmień hasło
          </button>
        </form>
        {passwordMsg && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#ccc" }}>{passwordMsg}</div>
        )}
      </div>
    );
  }

  return (
    <div style={pageWrapStyle} className="page-wrap">
      <div style={containerStyle}>
        <div className="no-print" style={topBarCentered}>
          <div />
          <div style={{ textAlign: "center", fontSize: 18, fontWeight: 600 }}>
            Dashboard pomiarów
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button style={buttonGhost} onClick={handlePrint}>
              Drukuj widok
            </button>
          </div>
        </div>

        {!isAdmin && (
          <p
            className="no-print"
            style={{ marginTop: -8, marginBottom: 12, fontSize: 13, color: "#aaaaaa" }}
          >
            Jesteś w trybie <strong>tylko do odczytu</strong>. Zaloguj się jako admin, aby
            dodawać, edytować i usuwać dane.
          </p>
        )}

        {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

        <div data-dashboard-grid style={gridStyle}>
          {renderSeriesSelect()}
          <div>
            {renderChartCard()}
            {renderTable()}
          </div>
          <div className="no-print" style={rightColumnStyle}>
            {renderAddMeasurementBox()}
            {renderEditMeasurementBox()}
            {renderSeriesAdminBox()}
            {renderChangePasswordBox()}
          </div>
        </div>
      </div>
      <style>{responsiveCSS + printCSS}</style>
    </div>
  );
}
