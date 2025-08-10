import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Battery,
  Sun,
  PlugZap,
  Home,
  Gauge,
  Zap,
  Wifi,
  WifiOff,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Car,
  Thermometer,
  Moon,
  SunMedium,
} from "lucide-react";

/**
 * =============================================================
 * Smart Energy Dashboard (PV • Netz • Batterie • Wärmepumpe • EV)
 * - Dark/Light Mode Toggle
 * - Kontraststarke Farben (auch Lightmode gut lesbar)
 * - Fluss-Animation (Partikel)
 * - Wärmepumpe + E‑Auto (bidirektional / V2X)
 * - Recharts: Tagesverlauf + Detailchart
 * - Demo-Daten + optionaler WebSocket-Echtzeitfeed
 * - Mini-Diagnose-Tests (console + UI)
 * =============================================================
 * Hinweis zu vorheriger Fehlermeldung:
 * React Fehler #130 ("Element type is invalid ... got: object") tritt typischerweise auf,
 * wenn versehentlich ein Objekt statt einer React-Komponente gerendert wird. Diese Version
 * vermeidet dynamische Komponenten in problematischen Stellen (z. B. rendert Icons jetzt
 * sicher via React.createElement) und nutzt nur Plain-HTML anstelle externer UI-Wrapper,
 * sodass keine ungültigen Elementtypen entstehen können.
 */

// ---------- Utilities ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round2 = (v) => Math.round(v * 100) / 100;
const round1 = (v) => Math.round(v * 10) / 10;
const formatKw = (v) => `${Number(v).toFixed(2)} kW`;
const formatKwh = (v) => `${Number(v).toFixed(1)} kWh`;

// ---------- Demo-Daten-Generator ----------
function useDemoData(enabled) {
  const [point, setPoint] = useState(() => genPoint(Date.now() - 60_000));
  const [series, setSeries] = useState(() => seedSeries());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setPoint((prev) => {
        const t = (prev?.time ?? Date.now()) + 60_000;
        const next = genPoint(t, prev);
        setSeries((cur) => {
          const s = [...cur, next];
          return s.length > 360 ? s.slice(-360) : s;
        });
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [enabled]);

  return { point, series };
}

function seedSeries() {
  const now = Date.now() - 60_000 * 60; // letzte Stunde
  let p = genPoint(now - 60_000);
  const arr = [];
  for (let t = now; t <= Date.now(); t += 60_000) {
    p = genPoint(t, p);
    arr.push(p);
  }
  return arr;
}

function genPoint(t, prev) {
  const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
  const sunFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)); // 0 (Nacht) .. 1 (Mittag)
  const pvPeak = 6; // kW
  const pv = (sunFactor ** 1.4) * pvPeak * (0.85 + Math.random() * 0.3);

  // Grundlast + Wärmepumpe
  const baseLoad = 0.6 + Math.sin((t / 1000 / 60 / 15) % (2 * Math.PI)) * 0.2 + (Math.random() - 0.5) * 0.1;
  const loadBase = Math.max(0.3, baseLoad);
  const hpCycle = 1 + 0.6 * Math.sin((t / 1000 / 60 / 8) % (2 * Math.PI));
  const heatPump = clamp(0.5 + hpCycle * 1.2 + (Math.random() - 0.5) * 0.2, 0.3, 2.4);

  // EV-Strategie: tagsüber PV-Laden bis 90%, abends V2H (18–22 Uhr) wenn SOC>40%
  let evSoc = prev ? prev.evSoc : 50 + Math.random() * 20;
  let evPower = 0; // + Laden, - Entladen (V2X)
  const dayChargeTarget = 90;
  const canFastCharge = 7; // kW
  const canV2H = 3; // kW
  if (sunFactor > 0.2 && evSoc < dayChargeTarget) {
    evPower = Math.min(canFastCharge, 1 + sunFactor * 6);
  }
  if (hour >= 18 && hour <= 22 && evSoc > 40) {
    evPower = -Math.min(canV2H, 1.5 + Math.random());
  }

  // Gesamthaushalt-Last (Verbraucher): Basis + WP + EV nur wenn Laden
  const loadTotal = loadBase + heatPump + Math.max(0, evPower);

  // Flusslogik inkl. EV-V2X
  const effectiveLoad = loadTotal + Math.min(0, evPower); // negatives EV senkt Last
  const surplus = pv - effectiveLoad; // Überschuss nach EV berücksichtigt

  let batteryPower = 0; // + laden, - entladen
  let grid = 0; // + Bezug, - Einspeisung

  if (surplus > 0) {
    const canCharge = Math.max(0, 4 * (1 - (prev?.batterySoc ?? 60) / 100));
    batteryPower = Math.min(surplus, canCharge);
    const rest = surplus - batteryPower;
    grid = -Math.max(0, rest); // Einspeisung (negativ)
  } else {
    const canDischarge = Math.max(0, 4 * ((prev?.batterySoc ?? 60) / 100));
    const discharge = Math.min(-surplus, canDischarge);
    batteryPower = -discharge; // entladen
    grid = -surplus - discharge; // Rest aus Netz (positiv)
  }

  // SOC-Updates (vereinfachtes Modell)
  const dtH = prev ? (t - prev.time) / 3_600_000 : 1 / 60;
  const batteryCapacityKWh = 10;
  const evCapacityKWh = 60;
  const prevBatSoc = prev?.batterySoc ?? 60;
  let batterySoc = clamp(prevBatSoc + (batteryPower * 100 * dtH) / batteryCapacityKWh, 5, 100);
  evSoc = clamp(evSoc + (evPower * 100 * dtH) / evCapacityKWh, 5, 100);

  // Energien summieren
  const pvEnergy = (prev?.pvEnergy ?? 0) + pv * dtH;
  const gridImportEnergy = (prev?.gridImportEnergy ?? 0) + Math.max(0, grid) * dtH;
  const gridExportEnergy = (prev?.gridExportEnergy ?? 0) + Math.max(0, -grid) * dtH;
  const evChargeEnergy = (prev?.evChargeEnergy ?? 0) + Math.max(0, evPower) * dtH;
  const evDischargeEnergy = (prev?.evDischargeEnergy ?? 0) + Math.max(0, -evPower) * dtH;

  return {
    time: t,
    pv: round2(pv),
    loadBase: round2(loadBase),
    heatPump: round2(heatPump),
    evPower: round2(evPower),
    evSoc: round2(evSoc),
    batterySoc: round2(batterySoc),
    batteryPower: round2(batteryPower),
    grid: round2(grid),
    pvEnergy: round1(pvEnergy),
    gridImportEnergy: round1(gridImportEnergy),
    gridExportEnergy: round1(gridExportEnergy),
    evChargeEnergy: round1(evChargeEnergy),
    evDischargeEnergy: round1(evDischargeEnergy),
    loadTotal: round2(loadTotal), // für Charts direkt nutzbar
  };
}

// ---------- Icons & Farben ----------
const COLORS = {
  pv: "#0ea5e9", // cyan-500
  load: "#3b82f6", // blue-500
  gridPos: "#ef4444", // red-500
  gridNeg: "#f59e0b", // amber-500
  battery: "#10b981", // emerald-500
  hp: "#a855f7", // violet-500
  ev: "#14b8a6", // teal-500
};

// ---------- Primitive UI-Bausteine (ohne externe UI-Lib) ----------
function Card({ className = "", children }) {
  return (
    <div className={`rounded-2xl border ${className}`}>{children}</div>
  );
}
function CardHeader({ children, className = "" }) {
  return <div className={`px-4 pt-4 ${className}`}>{children}</div>;
}
function CardTitle({ children, className = "" }) {
  return <div className={`text-sm opacity-80 ${className}`}>{children}</div>;
}
function CardContent({ children, className = "" }) {
  return <div className={`px-4 pb-4 ${className}`}>{children}</div>;
}
function Button({ children, onClick, variant = "default", className = "" }) {
  const base =
    "inline-flex items-center gap-2 px-3 h-10 rounded-xl text-sm font-medium transition-colors";
  const styles =
    variant === "secondary"
      ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
      : variant === "outline"
      ? "bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-100"
      : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200";
  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>{children}</button>
  );
}
function Input({ value, onChange, placeholder = "", className = "" }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`h-10 w-full rounded-xl px-3 outline-none border ${className}`}
    />
  );
}
function SwitchInline({ id, checked, onCheckedChange, label }) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="w-10 h-6 rounded-full bg-zinc-700 peer-checked:bg-emerald-600 relative transition-colors">
        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white peer-checked:translate-x-4 transition-transform" />
      </span>
      <span className="text-sm opacity-80">{label}</span>
    </label>
  );
}
function Badge({ children }) {
  return (
    <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-wide bg-zinc-800/80 border border-zinc-700 shadow-inner">
      {children}
    </span>
  );
}

function Ring({ value, label }) {
  const radius = 48;
  const stroke = 10;
  const C = 2 * Math.PI * radius;
  const offset = C - (value / 100) * C;
  const color = value > 60 ? "stroke-emerald-500" : value > 30 ? "stroke-amber-500" : "stroke-rose-500";
  return (
    <div className="relative w-32 h-32 grid place-items-center">
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
        <circle cx="60" cy="60" r={radius} className="stroke-zinc-600/30" strokeWidth={stroke} fill="none" />
        <circle
          cx="60" cy="60" r={radius} strokeLinecap="round" strokeWidth={stroke} fill="none"
          className={`${color} transition-[stroke-dashoffset] duration-700 ease-out`}
          style={{ strokeDasharray: C, strokeDashoffset: offset }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold">{Math.round(value)}%</div>
        <div className="text-xs opacity-80">{label}</div>
      </div>
    </div>
  );
}

function LiveBadge({ connected }) {
  return (
    <div className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-zinc-800/60 border border-zinc-700">
      <span className={`inline-flex w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
      <span className="uppercase tracking-wide">{connected ? "Live" : "Offline (Demo)"}</span>
    </div>
  );
}

// ---------- Flow Particles ----------
function FlowParticles({ from, to, power, color }) {
  const pos = {
    PV: { x: 50, y: 15 },
    Haus: { x: 50, y: 40 },
    Wärmepumpe: { x: 35, y: 65 },
    "E‑Auto": { x: 65, y: 65 },
    Batterie: { x: 35, y: 90 },
    Netz: { x: 65, y: 90 },
  };
  const a = pos[from];
  const b = pos[to];
  if (!a || !b) return null;
  const particles = Math.min(14, Math.max(3, Math.round(power * 3)));
  return (
    <>
      {Array.from({ length: particles }).map((_, i) => (
        <motion.div
          key={`${from}-${to}-${i}`}
          className="absolute w-1 h-1 rounded-full shadow"
          style={{ background: color }}
          initial={{ x: `${a.x}%`, y: `${a.y}%`, opacity: 0 }}
          animate={{ x: `${b.x}%`, y: `${b.y}%`, opacity: [0, 1, 0] }}
          transition={{ duration: 1.6 + Math.random() * 0.8, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </>
  );
}

function FlowNode({ title, Icon, value, unit, accent, suffix }) {
  const positive = value >= 0;
  const IconComp = Icon; // React component type
  return (
    <div className="">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 opacity-80">
          {IconComp ? React.createElement(IconComp, { className: "w-4 h-4", style: { color: accent } }) : null}
          <span className="text-sm">{title}</span>
        </div>
        <span className="text-xs" style={{ color: positive ? accent : COLORS.gridPos }}>{positive ? "+" : "-"}</span>
      </div>
      <div className="mt-2 rounded-lg p-3" style={{ background: `${accent}22` }}>
        <div className="text-2xl font-bold">
          {Math.abs(value).toFixed(2)} <span className="text-sm font-medium opacity-80">{unit}</span>
        </div>
        {suffix && <div className="text-xs opacity-80 mt-1">{suffix}</div>}
      </div>
    </div>
  );
}

// ---------- Haupt-Komponente ----------
export default function EnergyDashboard() {
  const [dark, setDark] = useState(true);
  const [useDemo, setUseDemo] = useState(true);
  const [wsUrl, setWsUrl] = useState("wss://example.home/energy");
  const [connected, setConnected] = useState(false);

  const { point, series } = useDemoData(useDemo);

  // Optionaler WebSocket
  const wsRef = useRef(null);
  useEffect(() => {
    if (useDemo) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      return;
    }
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          // Erwartete Struktur (Beispiel): { pv, loadBase, heatPump, evPower, evSoc, batterySoc, batteryPower, grid }
          // => Hier könntest du setPoint(data) + series-Append implementieren.
        } catch {}
      };
      return () => ws.close();
    } catch (e) {
      setConnected(false);
    }
  }, [useDemo, wsUrl]);

  const netDirection = point.grid > 0 ? "Bezug" : point.grid < 0 ? "Einspeisung" : "neutral";

  // KPIs
  const kpis = [
    { title: "PV-Leistung", value: formatKw(point.pv), icon: Sun, accent: COLORS.pv, sub: `${formatKwh(point.pvEnergy)} heute` },
    { title: "Wärmepumpe", value: formatKw(point.heatPump), icon: Thermometer, accent: COLORS.hp, sub: `Verbrauch aktuell` },
    { title: `Netz ${netDirection}`, value: `${formatKw(Math.abs(point.grid))}`, icon: PlugZap, accent: point.grid >= 0 ? COLORS.gridPos : COLORS.gridNeg, sub: point.grid >= 0 ? `${formatKwh(point.gridImportEnergy)} Bezug heute` : `${formatKwh(point.gridExportEnergy)} Einspeisung heute` },
    { title: `E‑Auto (${point.evPower >= 0 ? "Laden" : "V2X"})`, value: formatKw(Math.abs(point.evPower)), icon: Car, accent: COLORS.ev, sub: point.evPower >= 0 ? `${formatKwh(point.evChargeEnergy)} geladen` : `${formatKwh(point.evDischargeEnergy)} abgegeben` },
  ];

  const flowValue = useMemo(() => {
    const arrows = [
      { from: "PV", to: "Haus", power: Math.min(point.pv, Math.max(0, point.loadBase + point.heatPump)) },
      { from: "PV", to: "Batterie", power: Math.max(0, point.batteryPower) },
      { from: "PV", to: "Netz", power: Math.max(0, -Math.min(0, point.grid)) },
      { from: "Batterie", to: "Haus", power: Math.max(0, -point.batteryPower) },
      { from: "Netz", to: "Haus", power: Math.max(0, point.grid) },
      { from: "Haus", to: "Wärmepumpe", power: Math.max(0, point.heatPump) },
      { from: "PV", to: "E‑Auto", power: Math.max(0, point.evPower) },
      { from: "Batterie", to: "E‑Auto", power: Math.max(0, point.evPower - Math.max(0, point.pv - (point.loadBase + point.heatPump))) },
      { from: "E‑Auto", to: "Haus", power: Math.max(0, -point.evPower) },
      { from: "E‑Auto", to: "Netz", power: Math.max(0, -point.evPower - Math.max(0, (point.loadBase + point.heatPump) - point.pv)) },
    ];
    return arrows.filter((a) => a.power > 0.05);
  }, [point]);

  // ---------- Mini-Diagnose-Tests ----------
  const tests = useMemo(() => runSelfTests(series, point), [series, point]);

  return (
    <div className={dark ? "dark" : undefined}>
      <div className={`min-h-dvh w-full ${dark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"} p-4 md:p-8 transition-colors`}>
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                <Zap className="w-7 h-7" /> Smart Energy Monitor
              </h1>
              <p className="text-sm opacity-80">PV • Netz • Batterie • Wärmepumpe • E‑Auto (bidirektional) – Live</p>
            </div>
            <div className="flex items-center gap-2">
              <LiveBadge connected={!useDemo ? connected : true} />
              <Button variant="secondary" className="gap-2" onClick={() => setDark((d) => !d)}>
                {dark ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {dark ? "Light" : "Dark"}
              </Button>
              <Button variant="secondary" className="gap-2" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4" /> Aktualisieren
              </Button>
            </div>
          </header>

          {/* Einstellungen */}
          <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"}`}>
            <CardContent className="pt-6 grid md:grid-cols-3 gap-4 items-end">
              <SwitchInline id="demo" checked={useDemo} onCheckedChange={setUseDemo} label="Demo-Daten" />
              <div className="md:col-span-2 flex items-center gap-2">
                <Input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="wss://..." className={`${dark ? "bg-zinc-800/60 border-zinc-700" : "bg-white border-zinc-300"}`} />
                <Button variant="outline" className="gap-2" onClick={() => setUseDemo(false)}>
                  {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />} Verbinden
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI Karten */}
          <div className="grid md:grid-cols-6 gap-4">
            {kpis.map((k) => {
              const IconComp = k.icon;
              return (
                <motion.div key={k.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                  <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"} overflow-hidden`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle>{k.title}</CardTitle>
                        {IconComp ? React.createElement(IconComp, { className: "w-5 h-5", style: { color: k.accent } }) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className={`relative rounded-xl p-4`} style={{ background: `linear-gradient(135deg, ${k.accent}22, transparent)` }}>
                        <div className="text-2xl font-bold">{k.value}</div>
                        <div className="text-xs opacity-80 mt-1">{k.sub}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"} h-full`}>
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center gap-2"><Battery className="w-4 h-4" />Batterie SOC</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 flex items-center justify-center">
                  <Ring value={point.batterySoc} label="Batterie" />
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"} h-full`}>
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center gap-2"><Car className="w-4 h-4" />EV SOC</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 flex items-center justify-center">
                  <Ring value={point.evSoc} label="E‑Auto" />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Fluss-Visualisierung */}
          <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="w-4 h-4" />Energieflüsse (Live)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {/* Quellen / Senken */}
                <div className="space-y-4">
                  <FlowNode title="PV" Icon={Sun} value={point.pv} unit="kW" accent={COLORS.pv} suffix="Quelle" />
                  <FlowNode title="Batterie" Icon={Battery} value={point.batteryPower} unit="kW" accent={COLORS.battery} suffix={point.batteryPower >= 0 ? "laden" : "entladen"} />
                  <FlowNode title="Netz" Icon={PlugZap} value={point.grid} unit="kW" accent={point.grid >= 0 ? COLORS.gridPos : COLORS.gridNeg} suffix={point.grid >= 0 ? "Bezug" : "Einspeisung"} />
                  <FlowNode title="Wärmepumpe" Icon={Thermometer} value={point.heatPump} unit="kW" accent={COLORS.hp} suffix="Verbrauch" />
                  <FlowNode title="E‑Auto" Icon={Car} value={point.evPower} unit="kW" accent={COLORS.ev} suffix={point.evPower >= 0 ? "Laden" : "V2X"} />
                </div>

                {/* animierte Pfeile */}
                <div className={`relative min-h-[280px] rounded-xl ${dark ? "bg-zinc-950/60 border-zinc-800" : "bg-zinc-100 border-zinc-300"} border overflow-hidden p-4`}>
                  <div className="absolute inset-0" style={{ background: dark ? "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 60%)" : "radial-gradient(circle at 50% 0%, rgba(0,0,0,0.06), transparent 60%)" }} />
                  <div className="grid grid-rows-4 h-full">
                    <div className="flex items-center justify-center gap-2">
                      <Badge>PV</Badge>
                    </div>
                    <div className="flex items-center justify-center gap-6">
                      <Badge>Haus</Badge>
                      <Badge>💡</Badge>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <Badge>Wärmepumpe</Badge>
                      <Badge>E‑Auto</Badge>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <Badge>Batterie</Badge>
                      <Badge>Netz</Badge>
                    </div>
                  </div>

                  <AnimatePresence>
                    {flowValue.map((a, idx) => (
                      <FlowParticles key={`${a.from}-${a.to}-${idx}`} from={a.from} to={a.to} power={a.power} color={colorFromSource(a.from)} />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Tagesverlauf */}
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.pv} stopOpacity={0.6} />
                          <stop offset="95%" stopColor={COLORS.pv} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="load" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.load} stopOpacity={0.6} />
                          <stop offset="95%" stopColor={COLORS.load} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#27272a" : "#e5e7eb"} />
                      <XAxis dataKey="time" tick={{ fill: dark ? "#a1a1aa" : "#374151", fontSize: 12 }} tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
                      <YAxis tick={{ fill: dark ? "#a1a1aa" : "#374151", fontSize: 12 }} domain={[0, "dataMax+1"]} />
                      <Tooltip
                        contentStyle={{ background: dark ? "#09090b" : "#ffffff", border: `1px solid ${dark ? "#27272a" : "#e5e7eb"}`, color: dark ? "#e4e4e7" : "#111827" }}
                        labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                        formatter={(v, n) => [String(Number(v).toFixed(2)), n === "pv" ? "PV" : "Last"]}
                      />
                      <Area type="monotone" dataKey="pv" name="PV" stroke={COLORS.pv} fillOpacity={1} fill="url(#pv)" />
                      <Area type="monotone" dataKey="loadTotal" name="Last" stroke={COLORS.load} fillOpacity={1} fill="url(#load)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailchart Netz / Batterie / EV */}
          <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Netz, Batterie & EV – Leistung (kW)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#27272a" : "#e5e7eb"} />
                  <XAxis dataKey="time" tick={{ fill: dark ? "#a1a1aa" : "#374151", fontSize: 12 }} tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
                  <YAxis tick={{ fill: dark ? "#a1a1aa" : "#374151", fontSize: 12 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: dark ? "#09090b" : "#ffffff", border: `1px solid ${dark ? "#27272a" : "#e5e7eb"}`, color: dark ? "#e4e4e7" : "#111827" }}
                    labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                    formatter={(v, n) => [String(Math.abs(Number(v)).toFixed(2)), n === "grid" ? (Number(v) >= 0 ? "Netz (Bezug)" : "Netz (Einspeisung)") : n === "batteryPower" ? (Number(v) >= 0 ? "Batterie (Laden)" : "Batterie (Entladen)") : Number(v) >= 0 ? "EV (Laden)" : "EV (V2X)"]}
                  />
                  <Line type="monotone" dataKey="grid" name="Netz" stroke={COLORS.gridPos} dot={false} />
                  <Line type="monotone" dataKey="batteryPower" name="Batterie" stroke={COLORS.battery} dot={false} />
                  <Line type="monotone" dataKey="evPower" name="EV" stroke={COLORS.ev} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Diagnose/Tests */}
          <Card className={`${dark ? "bg-zinc-900/60 border-zinc-800" : "bg-white border-zinc-200"}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />Diagnose & Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs space-y-1">
                {tests.map((t, i) => (
                  <li key={i} className={t.pass ? "text-emerald-400" : "text-rose-400"}>
                    {t.pass ? "✔" : "✖"} {t.name}{t.pass ? "" : ` – ${t.message}`}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-xs opacity-70 flex items-center justify-between">
            <div>Demo – ersetze die WebSocket-URL, um Live-Daten (JSON) einzuspeisen. EV unterstützt Laden & V2X.</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3" />
              <span>Kontraststarke Farben · Dark/Light Toggle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function colorFromSource(src) {
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

// ---------- Selbsttests ----------
function runSelfTests(series, point) {
  const results = [];
  const latest = point || series[series.length - 1];

  // Test 1: SOC-Grenzen
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

  // Test 2: Keine NaNs in aktuellen Werten
  const keys = ["pv", "loadBase", "heatPump", "evPower", "batteryPower", "grid", "loadTotal"];
  const nanKeys = keys.filter((k) => Number.isNaN(latest?.[k]));
  results.push({ name: "Keine NaNs", pass: nanKeys.length === 0, message: nanKeys.length ? `NaN in ${nanKeys.join(", ")}` : "ok" });

  // Test 3: Series hat Daten
  results.push({ name: "Series Länge > 10", pass: series && series.length > 10, message: series ? `len=${series.length}` : "keine" });

  // Test 4: Flüsse positiv
  const flows = [
    Math.min(latest.pv, Math.max(0, latest.loadBase + latest.heatPump)),
    Math.max(0, latest.batteryPower),
    Math.max(0, -Math.min(0, latest.grid)),
  ];
  const allPos = flows.every((f) => f >= 0);
  results.push({ name: "Flüsse ≥ 0", pass: allPos, message: allPos ? "ok" : `flows=${flows.join(",")}` });

  // Log für Entwickler
  try { console.table(results); } catch {}
  return results;
}
