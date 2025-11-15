import React, { useEffect, useState } from "react";
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

// RWD tylko dla grida; max-width robi resztę.
const responsiveCSS = `
@media (max-width: 1200px) {
  div[data-dashboard-grid] {
    grid-template-columns: minmax(260px, 320px) minmax(480px, 2fr);
    grid-auto-rows: auto;
  }
  div[data-dashboard-right] {
    grid-column: 1 / span 2;
  }
}

@media (max-width: 900px) {
  div[data-dashboard-grid] {
    grid-template-columns: 1fr;
  }
  div[data-dashboard-right] {
    grid-column: auto;
  }
}
`;

const printCSS = `
@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: #ffffff !important;
    color: #000000 !important;
    margin: 0;
  }
}
`;

export default function Dashboard({ onLogout, isAdmin }: DashboardProps) {
  // --- STATE ---

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [activeSeriesIds, setActiveSeriesIds] = useState<number[]>([]);

  const [measurementsBySeries, setMeasurementsBySeries] = useState<
    Record<number, Measurement[]>
  >({});

  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingMeas, setLoadingMeas] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newValue, setNewValue] = useState("");
  const [fromTs, setFromTs] = useState("");
  const [toTs, setToTs] = useState("");

  const [selectedMeasurementId, setSelectedMeasurementId] = useState<
    number | null
  >(null);

  const [editMeasurement, setEditMeasurement] = useState<Measurement | null>(
    null
  );
  const [editValue, setEditValue] = useState("");

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

  // --- LOAD SERIES ---

  useEffect(() => {
    async function loadSeries() {
      try {
        setLoadingSeries(true);
        setErrorMsg(null);
        const res = await apiListSeries({ limit: 200, offset: 0 });
        const items: Series[] = res.items ?? [];
        setSeriesList(items);
        if (items.length > 0 && selectedSeriesId === null) {
          setSelectedSeriesId(items[0].id);
        }
        if (items.length > 0 && activeSeriesIds.length === 0) {
          setActiveSeriesIds(items.map((s) => s.id)); // domyślnie wszystkie
        }
      } catch (e) {
        console.error(e);
        setErrorMsg("Nie udało się pobrać listy serii.");
      } finally {
        setLoadingSeries(false);
      }
    }
    loadSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- LOAD MEASUREMENTS ---

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

        for (const id of activeSeriesIds) {
          const params: any = { series_id: id, limit: 500 };
          if (fromTs) params.ts_from = new Date(fromTs).toISOString();
          if (toTs) params.ts_to = new Date(toTs).toISOString();

          const res = await apiListMeasurements(params);
          next[id] = (res.items ?? []).sort(
            (a, b) =>
              new Date(a.timestamp).getTime() -
              new Date(b.timestamp).getTime()
          );
        }

        setMeasurementsBySeries(next);
        setSelectedMeasurementId(null);
        setEditMeasurement(null);
      } catch (e) {
        console.error(e);
        setErrorMsg("Nie udało się pobrać pomiarów.");
      } finally {
        setLoadingMeas(false);
      }
    }
    loadAll();
  }, [activeSeriesIds, fromTs, toTs]);

  // --- SYNC FORM SERII ---

  useEffect(() => {
    const s = seriesList.find((x) => x.id === selectedSeriesId);
    if (!s) return;
    setSeriesEditName(s.name);
    setSeriesEditMin(String(s.min_value));
    setSeriesEditMax(String(s.max_value));
    setSeriesEditColor(s.color || "#61dafb");
  }, [selectedSeriesId, seriesList]);

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId);

  // === HANDLERY POMIARÓW ===

  async function handleAddMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;

    if (!selectedSeriesId) {
      setErrorMsg("Wybierz serię, do której chcesz dodać pomiar.");
      return;
    }

    const series = selectedSeries;
    if (!series) {
      setErrorMsg("Nie znaleziono wybranej serii.");
      return;
    }

    const valueNum = Number(newValue);
    if (Number.isNaN(valueNum)) {
      setErrorMsg("Wartość musi być liczbą.");
      return;
    }

    if (valueNum < series.min_value || valueNum > series.max_value) {
      setErrorMsg(
        `Wartość musi być w zakresie ${series.min_value} – ${series.max_value}.`
      );
      return;
    }

    try {
      setErrorMsg(null);
      const timestamp = new Date().toISOString();
      const created = await apiCreateMeasurement({
        series_id: selectedSeriesId,
        value: valueNum,
        timestamp,
      });

      setMeasurementsBySeries((prev) => {
        const arr = prev[selectedSeriesId] ? [...prev[selectedSeriesId]] : [];
        arr.push(created);
        arr.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
        );
        return { ...prev, [selectedSeriesId]: arr };
      });

      setNewValue("");
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e?.response?.data?.detail ||
          "Nie udało się dodać pomiaru (sprawdź zakres i uprawnienia)."
      );
    }
  }

  async function handleDeleteMeasurement(m: Measurement) {
    if (!isAdmin) return;
    if (!window.confirm("Na pewno usunąć ten pomiar?")) return;

    try {
      await apiDeleteMeasurement(m.id);
      setMeasurementsBySeries((prev) => {
        const arr = prev[m.series_id] || [];
        return {
          ...prev,
          [m.series_id]: arr.filter((x) => x.id !== m.id),
        };
      });
      if (selectedMeasurementId === m.id) setSelectedMeasurementId(null);
      if (editMeasurement?.id === m.id) setEditMeasurement(null);
    } catch (e) {
      console.error(e);
      setErrorMsg("Nie udało się usunąć pomiaru.");
    }
  }

  async function handleUpdateMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !editMeasurement) return;

    const series = seriesList.find(
      (s) => s.id === editMeasurement.series_id
    );
    const valueNum = Number(editValue);

    if (Number.isNaN(valueNum)) {
      setErrorMsg("Wartość musi być liczbą.");
      return;
    }

    if (
      series &&
      (valueNum < series.min_value || valueNum > series.max_value)
    ) {
      setErrorMsg(
        `Wartość musi być w zakresie ${series.min_value} – ${series.max_value}.`
      );
      return;
    }

    try {
      setErrorMsg(null);
      const updated = await apiUpdateMeasurement(editMeasurement.id, {
        series_id: editMeasurement.series_id,
        value: valueNum,
        timestamp: editMeasurement.timestamp,
      });

      setMeasurementsBySeries((prev) => {
        const arr = prev[updated.series_id] ? [...prev[updated.series_id]] : [];
        const idx = arr.findIndex((x) => x.id === updated.id);
        if (idx !== -1) arr[idx] = updated;
        else arr.push(updated);
        arr.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
        );
        return { ...prev, [updated.series_id]: arr };
      });

      setEditMeasurement(null);
      setSelectedMeasurementId(updated.id);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e?.response?.data?.detail || "Nie udało się zaktualizować pomiaru."
      );
    }
  }

  function handlePrint() {
    window.print();
  }

  // === HANDLERY SERII ===

  async function handleUpdateSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !selectedSeriesId) return;

    const min = Number(seriesEditMin);
    const max = Number(seriesEditMax);

    if (!seriesEditName.trim() || Number.isNaN(min) || Number.isNaN(max)) {
      setErrorMsg("Uzupełnij poprawnie nazwę oraz min/max.");
      return;
    }
    if (min > max) {
      setErrorMsg("Wartość minimalna nie może być większa niż maksymalna.");
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

      setSeriesList((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e?.response?.data?.detail || "Nie udało się zaktualizować serii."
      );
    }
  }

  async function handleCreateSeries(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;

    const name = newSeriesName.trim();
    const min = Number(newSeriesMin);
    const max = Number(newSeriesMax);

    if (!name || Number.isNaN(min) || Number.isNaN(max)) {
      setErrorMsg("Podaj nazwę i poprawne wartości min/max.");
      return;
    }
    if (min > max) {
      setErrorMsg("Dla nowej serii: min nie może być > max.");
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
      setActiveSeriesIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id]
      );
    } catch (e: any) {
      console.error(e);
      setErrorMsg(
        e?.response?.data?.detail || "Nie udało się utworzyć nowej serii."
      );
    }
  }

  async function handleDeleteSeriesClick() {
    if (!isAdmin || !selectedSeriesId) return;
    const s = selectedSeries;
    if (!s) return;
    if (
      !window.confirm(
        `Na pewno usunąć serię "${s.name}"? (spowoduje to usunięcie jej pomiarów)`
      )
    ) {
      return;
    }

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
    } catch (e) {
      console.error(e);
      setErrorMsg("Nie udało się usunąć serii.");
    }
  }

  // === ZMIANA HASŁA ===

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
      console.error(e);
      const detail =
        e?.response?.data?.detail || "Nie udało się zmienić hasła.";
      setPasswordMsg(String(detail));
    }
  }

  // === STYLE (layout) ===

  const appShellStyle: React.CSSProperties = {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "24px",
    backgroundColor: "#111",
    color: "#fff",
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
    display: "flex",
    justifyContent: "center",
  };

  const contentStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "1600px",
  };

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns:
      "minmax(260px, 320px) minmax(520px, 2fr) minmax(260px, 340px)",
    gap: "20px",
    alignItems: "flex-start",
  };

  const cardStyle: React.CSSProperties = {
    boxSizing: "border-box",
    backgroundColor: "#1b1b1b",
    border: "1px solid #262626",
    borderRadius: "10px",
    padding: "10px",
    color: "#fff",
    fontSize: "13px",
    boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "#f5f5f5",
    marginBottom: "6px",
    letterSpacing: "0.02em",
  };

  const tableHeadStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    color: "#c5c5c5",
    fontWeight: 600,
    borderBottom: "1px solid #333",
    whiteSpace: "nowrap",
    backgroundColor: "#151515",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  const tdStyleLeft: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: "1px solid #242424",
    whiteSpace: "nowrap",
    color: "#e0e0e0",
  };

  const tdStyleRight: React.CSSProperties = {
    ...tdStyleLeft,
    textAlign: "right",
  };

  const mutedStyle: React.CSSProperties = {
    color: "#9e9e9e",
    fontSize: "12px",
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: "#5a1111",
    color: "#fff",
    fontSize: "12px",
    padding: "8px 10px",
    borderRadius: "6px",
    margin: "0 0 10px 0",
  };

  const topBarStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  };

  const buttonGhost: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: "12px",
    borderRadius: "8px",
    border: "1px solid #555",
    backgroundColor: "#202020",
    color: "#f5f5f5",
    cursor: "pointer",
    marginLeft: "8px",
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

  // === TABELA: wspólna oś czasu ===

  type TableRow = {
    timestamp: string;
    measurements: Record<number, Measurement>;
  };

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
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  const tableRows = buildTableRows();

  // === UI BLOKI ===

  function renderSeriesSelect() {
    return (
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>Seria i filtr czasu</div>
        {loadingSeries ? (
          <div style={mutedStyle}>ładowanie…</div>
        ) : (
          <>
            <label
              className="no-print"
              style={{ display: "block", marginBottom: 6, fontSize: 11 }}
            >
              Seria do edycji / dodawania:
              <select
                style={{
                  width: "100%",
                  marginTop: 2,
                  backgroundColor: "#262626",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: "12px",
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
                marginTop: 6,
                fontSize: 11,
                color: "#bbb",
                maxHeight: 150,
                overflowY: "auto",
                borderTop: "1px solid #303030",
                paddingTop: 4,
              }}
            >
              <div style={{ marginBottom: 2 }}>
                Widoczne serie (wykres + tabela):
              </div>
              {seriesList.map((s) => {
                const checked = activeSeriesIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setActiveSeriesIds((prev) =>
                          checked
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id]
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
                    <span>{s.name}</span>
                  </label>
                );
              })}
              {seriesList.length === 0 && (
                <div>Brak zdefiniowanych serii.</div>
              )}
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
              <label>
                Od:
                <input
                  type="datetime-local"
                  value={fromTs}
                  onChange={(e) => setFromTs(e.target.value)}
                  style={{
                    marginTop: 2,
                    width: "100%",
                    backgroundColor: "#262626",
                    color: "#fff",
                    border: "1px solid #444",
                    borderRadius: 8,
                    padding: "4px 6px",
                    fontSize: 11,
                  }}
                />
              </label>
              <label>
                Do:
                <input
                  type="datetime-local"
                  value={toTs}
                  onChange={(e) => setToTs(e.target.value)}
                  style={{
                    marginTop: 2,
                    width: "100%",
                    backgroundColor: "#262626",
                    color: "#fff",
                    border: "1px solid #444",
                    borderRadius: 8,
                    padding: "4px 6px",
                    fontSize: 11,
                  }}
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
          row = {
            timestamp: m.timestamp,
            label: fmtTime(m.timestamp),
          };
          map.set(m.timestamp, row);
        }
        row[`s${seriesId}`] = m.value;
        row[`mId_s${seriesId}`] = m.id;
      }
    }

    const chartData = Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={sectionHeaderStyle}>Wykres wartości w czasie</div>
        {loadingMeas ? (
          <div style={mutedStyle}>ładowanie…</div>
        ) : activeSeriesIds.length === 0 ? (
          <div style={mutedStyle}>
            Wybierz co najmniej jedną serię do wyświetlenia.
          </div>
        ) : chartData.length === 0 ? (
          <div style={mutedStyle}>Brak danych dla wybranego zakresu.</div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ left: 4, right: 8, top: 8, bottom: 8 }}
              >
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                {activeSeriesIds.map((id) => {
                  const s = seriesList.find((x) => x.id === id);
                  const color = s?.color || "#61dafb";
                  const dataKey = `s${id}`;
                  const mIdKey = `mId_s${id}`;
                  return (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={dataKey}
                      stroke={color}
                      activeDot={{ r: 5 }}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const val = payload[dataKey];
                        if (val == null) return <></>; // ważne: nie null
                        const isActive =
                          payload[mIdKey] === selectedMeasurementId;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isActive ? 6 : 3}
                            fill={isActive ? color : "#ffffff"}
                            stroke={isActive ? color : "#ffffff"}
                            style={{ transition: "all 0.15s ease-out" }}
                          />
                        );
                      }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  function renderTable() {
    return (
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          Pomiary (serie w osobnych kolumnach)
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr>
                <th style={tableHeadStyle}>Czas</th>
                {activeSeriesIds.map((id) => {
                  const s = seriesList.find((x) => x.id === id);
                  return (
                    <th key={id} style={tableHeadStyle}>
                      {s?.name ?? `Seria ${id}`}
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
                    colSpan={
                      1 + activeSeriesIds.length + (isAdmin ? 1 : 0)
                    }
                  >
                    ładowanie…
                  </td>
                </tr>
              ) : activeSeriesIds.length === 0 ? (
                <tr>
                  <td
                    style={tdStyleLeft}
                    colSpan={1 + (isAdmin ? 1 : 0)}
                  >
                    Wybierz serie do wyświetlenia.
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td
                    style={tdStyleLeft}
                    colSpan={
                      1 + activeSeriesIds.length + (isAdmin ? 1 : 0)
                    }
                  >
                    Brak pomiarów dla wybranego zakresu.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const any = Object.values(row.measurements)[0];
                  return (
                    <tr
                      key={row.timestamp}
                      style={{
                        cursor: any ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (any) {
                          setSelectedMeasurementId(any.id);
                          if (isAdmin) {
                            setEditMeasurement(any);
                            setEditValue(String(any.value));
                          }
                        }
                      }}
                    >
                      <td style={tdStyleLeft}>
                        {fmtFull(row.timestamp)}
                      </td>
                      {activeSeriesIds.map((id) => {
                        const m = row.measurements[id];
                        const isSelected =
                          m && m.id === selectedMeasurementId;
                        return (
                          <td
                            key={id}
                            style={{
                              ...tdStyleRight,
                              backgroundColor: isSelected
                                ? "#272727"
                                : "transparent",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (m) {
                                setSelectedMeasurementId(m.id);
                                if (isAdmin) {
                                  setEditMeasurement(m);
                                  setEditValue(String(m.value));
                                }
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
                        <td
                          style={tdStyleLeft}
                          className="no-print"
                        >
                          {any && (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#777",
                              }}
                            >
                              Kliknij wartość, aby edytować
                            </span>
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
      </div>
    );
  }

  function renderAddMeasurementBox() {
    if (!isAdmin) return null;
    return (
      <div style={cardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Dodaj nowy pomiar</div>
        <form onSubmit={handleAddMeasurement}>
          <div style={{ marginBottom: 6, ...mutedStyle }}>
            Dodaj wartość do wybranej serii. Czas = bieżący moment.
          </div>
          <input
            type="number"
            step="any"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Wartość pomiaru"
            style={{
              width: "100%",
              backgroundColor: "#262626",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 8,
              padding: "7px 9px",
              fontSize: "12px",
              marginBottom: "6px",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "7px 9px",
              fontSize: "12px",
              borderRadius: 8,
              border: "1px solid #2e7d32",
              backgroundColor: "#2e7d32",
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
    const series = seriesList.find(
      (s) => s.id === editMeasurement.series_id
    );
    return (
      <div style={cardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Edytuj pomiar</div>
        <div style={{ ...mutedStyle, marginBottom: 2 }}>
          Seria: {series?.name} (min {series?.min_value}, max{" "}
          {series?.max_value})
        </div>
        <div style={{ ...mutedStyle, marginBottom: 4 }}>
          Czas: {fmtFull(editMeasurement.timestamp)}
        </div>
        <form onSubmit={handleUpdateMeasurement}>
          <input
            type="number"
            step="any"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            style={{
              width: "100%",
              marginBottom: 6,
              padding: "6px 8px",
              backgroundColor: "#262626",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: "11px",
                borderRadius: 8,
                border: "1px solid #1e88e5",
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
              }}
              style={{
                padding: "6px 8px",
                fontSize: "11px",
                borderRadius: 8,
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
      <div style={cardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Konfiguracja serii</div>

        {selectedSeries && (
          <>
            <div style={{ ...mutedStyle, marginBottom: 4 }}>
              Edytuj wybraną serię:
            </div>
            <form onSubmit={handleUpdateSeries}>
              <input
                value={seriesEditName}
                onChange={(e) => setSeriesEditName(e.target.value)}
                placeholder="Nazwa serii"
                style={{
                  width: "100%",
                  marginBottom: 4,
                  padding: "6px 8px",
                  backgroundColor: "#262626",
                  border: "1px solid #444",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
              />
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                <input
                  type="number"
                  step="any"
                  value={seriesEditMin}
                  onChange={(e) => setSeriesEditMin(e.target.value)}
                  placeholder="Min"
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    backgroundColor: "#262626",
                    border: "1px solid #444",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <input
                  type="number"
                  step="any"
                  value={seriesEditMax}
                  onChange={(e) => setSeriesEditMax(e.target.value)}
                  placeholder="Max"
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    backgroundColor: "#262626",
                    border: "1px solid #444",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ ...mutedStyle, marginRight: 6 }}>
                  Kolor:
                </span>
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
                    fontSize: "11px",
                    borderRadius: 8,
                    border: "1px solid #1e88e5",
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
                    fontSize: "11px",
                    borderRadius: 8,
                    border: "1px solid #a00000",
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

        <div
          style={{
            borderTop: "1px solid #333",
            margin: "8px 0",
          }}
        />

        <div style={{ ...mutedStyle, marginBottom: 4 }}>
          Dodaj nową serię:
        </div>
        <form onSubmit={handleCreateSeries}>
          <input
            value={newSeriesName}
            onChange={(e) => setNewSeriesName(e.target.value)}
            placeholder="Nazwa nowej serii"
            style={{
              width: "100%",
              marginBottom: 4,
              padding: "6px 8px",
              backgroundColor: "#262626",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
          />
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            <input
              type="number"
              step="any"
              value={newSeriesMin}
              onChange={(e) => setNewSeriesMin(e.target.value)}
              placeholder="Min"
              style={{
                flex: 1,
                padding: "6px 8px",
                backgroundColor: "#262626",
                border: "1px solid #444",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
              }}
            />
            <input
              type="number"
              step="any"
              value={newSeriesMax}
              onChange={(e) => setNewSeriesMax(e.target.value)}
              placeholder="Max"
              style={{
                flex: 1,
                padding: "6px 8px",
                backgroundColor: "#262626",
                border: "1px solid #444",
                borderRadius: 8,
                color: "#fff",
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ ...mutedStyle, marginRight: 6 }}>
              Kolor:
            </span>
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
              fontSize: "11px",
              borderRadius: 8,
              border: "1px solid #388e3c",
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
      <div style={cardStyle} className="no-print">
        <div style={sectionHeaderStyle}>Zmień hasło administratora</div>
        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Obecne hasło"
            style={{
              width: "100%",
              marginBottom: 4,
              padding: "6px 8px",
              backgroundColor: "#262626",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nowe hasło"
            style={{
              width: "100%",
              marginBottom: 6,
              padding: "6px 8px",
              backgroundColor: "#262626",
              border: "1px solid #444",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "6px 8px",
              fontSize: "11px",
              borderRadius: 8,
              border: "1px solid #455a64",
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
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#ccc",
            }}
          >
            {passwordMsg}
          </div>
        )}
      </div>
    );
  }

  // === RENDER ===

  return (
    <div style={appShellStyle}>
      <div style={contentStyle}>
        <div style={topBarStyle} className="no-print">
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            Measurement Dashboard
          </div>
          <div style={{ fontSize: 12 }}>
            {isAdmin && (
              <span style={{ marginRight: 12 }}>
                Zalogowano jako{" "}
                <span style={{ fontWeight: 600 }}>admin</span>
              </span>
            )}
            <button style={buttonGhost} onClick={handlePrint}>
              Drukuj widok
            </button>
            <button style={buttonGhost} onClick={onLogout}>
              Wyloguj
            </button>
          </div>
        </div>

        {!isAdmin && (
          <p
            className="no-print"
            style={{
              marginBottom: 10,
              fontSize: 12,
              color: "#b0bec5",
            }}
          >
            Jesteś w trybie <strong>tylko do odczytu</strong>. Zaloguj się jako
            admin, aby dodawać, edytować i usuwać dane.
          </p>
        )}

        {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

        <div data-dashboard-grid style={gridStyle}>
          <div>{renderSeriesSelect()}</div>

          <div>
            {renderChartCard()}
            {renderTable()}
          </div>

          <div
            data-dashboard-right
            className="no-print"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
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