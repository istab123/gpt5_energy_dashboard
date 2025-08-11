export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round2 = (v) => Math.round(v * 100) / 100;
export const round1 = (v) => Math.round(v * 10) / 10;
export const formatKw = (v) => `${Number(v).toFixed(2)} kW`;
export const formatKwh = (v) => `${Number(v).toFixed(1)} kWh`;

export const COLORS = {
  pv: "#0ea5e9", // cyan-500
  load: "#3b82f6", // blue-500
  gridPos: "#ef4444", // red-500
  gridNeg: "#f59e0b", // amber-500
  battery: "#10b981", // emerald-500
  hp: "#a855f7", // violet-500
  ev: "#14b8a6", // teal-500
};

export function colorFromSource(src) {
  switch (src) {
    case "PV": return COLORS.pv;
    case "Batterie": return COLORS.battery;
    case "Netz": return COLORS.gridPos;
    case "Haus": return COLORS.load;
    case "Wärmepumpe": return COLORS.hp;
    case "E‑Auto": return COLORS.ev;
    default: return "#ffffff";
  }
}

export function runSelfTests(series, point) {
  const results = [];
  const latest = point || series[series.length - 1];

  results.push({
    name: "SOC innerhalb 5..100% (Batterie)",
    pass: latest && latest.batterySoc >= 5 && latest.batterySoc <= 100,
    message: latest ? `SOC=${latest.batterySoc}` : "keine Daten",
  });
  results.push({
    name: "SOC innerhalb 5..100% (EV)",
    pass: latest && latest.evSoc >= 5 && latest.evSoc <= 100,
    message: latest ? `SOC=${latest.evSoc}` : "keine Daten",
  });

  const keys = ["pv", "loadBase", "heatPump", "evPower", "batteryPower", "grid", "loadTotal"];
  const nanKeys = keys.filter((k) => Number.isNaN(latest?.[k]));
  results.push({ name: "Keine NaNs", pass: nanKeys.length === 0, message: nanKeys.length ? `NaN in ${nanKeys.join(", ")}` : "ok" });

  results.push({ name: "Series Länge > 10", pass: series && series.length > 10, message: series ? `len=${series.length}` : "keine" });

  const flows = [
    Math.min(latest.pv, Math.max(0, latest.loadBase + latest.heatPump)),
    Math.max(0, latest.batteryPower),
    Math.max(0, -Math.min(0, latest.grid)),
  ];
  const allPos = flows.every((f) => f >= 0);
  results.push({ name: "Flüsse ≥ 0", pass: allPos, message: allPos ? "ok" : `flows=${flows.join(",")}` });

  try { console.table(results); } catch {}
  return results;
}
