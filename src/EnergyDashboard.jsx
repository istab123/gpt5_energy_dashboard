import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Zap,
  RefreshCw,
  Car,
  Thermometer,
  Moon,
  SunMedium,
} from "lucide-react";

import { useDemoData } from "./hooks/useDemoData";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  SwitchInline,
  Badge,
  Ring,
  LiveBadge,
} from "./components/UI";
import { FlowParticles, FlowNode } from "./components/Flow";
import { formatKw, formatKwh, COLORS, colorFromSource, runSelfTests } from "./utils";

export default function EnergyDashboard() {
  const [dark, setDark] = useState(true);
  const [useDemo, setUseDemo] = useState(true);
  const [wsUrl, setWsUrl] = useState("wss://example.home/energy");
  const [connected, setConnected] = useState(false);

  const { point, series } = useDemoData(useDemo);

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

  const tests = useMemo(() => runSelfTests(series, point), [series, point]);

  return (
    <div className={`min-h-screen ${dark ? "bg-zinc-900 text-zinc-100" : "bg-white text-zinc-900"} transition-colors`}>
      <div className="max-w-6xl mx-auto p-2 md:p-4 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            Smart Energy Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <LiveBadge connected={connected && !useDemo} />
            <SwitchInline id="demo" checked={useDemo} onCheckedChange={setUseDemo} label="Demo" />
            <button onClick={() => setDark((d) => !d)} className="p-2 rounded-lg border">
              {dark ? <SunMedium className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!useDemo && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} className="flex-1" />
            <Button onClick={() => { wsRef.current?.close(); setUseDemo(true); }} variant="outline">
              Disconnect
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {kpis.map((k) => (
            <Card key={k.title} className="bg-zinc-800/40 border-zinc-700">
              <CardHeader className="flex justify-between items-center">
                <CardTitle>{k.title}</CardTitle>
                {k.icon && React.createElement(k.icon, { className: "w-4 h-4", style: { color: k.accent } })}
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{k.value}</div>
                <div className="text-xs opacity-80 mt-1">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-zinc-800/40 border-zinc-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Energiestrom</CardTitle>
            <Badge>{netDirection}</Badge>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 md:h-80">
              {flowValue.map((a, idx) => (
                <FlowParticles key={`${a.from}-${a.to}-${idx}`} from={a.from} to={a.to} power={a.power} color={colorFromSource(a.from)} />
              ))}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-2 p-2 sm:gap-4 sm:p-4">
                <FlowNode title="PV" Icon={Sun} value={point.pv} unit="kW" accent={COLORS.pv} suffix="Quelle" />
                <FlowNode title="Batterie" Icon={Battery} value={point.batteryPower} unit="kW" accent={COLORS.battery} suffix={point.batteryPower >= 0 ? "laden" : "entladen"} />
                <FlowNode title="Netz" Icon={PlugZap} value={point.grid} unit="kW" accent={point.grid >= 0 ? COLORS.gridPos : COLORS.gridNeg} suffix={point.grid >= 0 ? "Bezug" : "Einspeisung"} />
                <FlowNode title="Wärmepumpe" Icon={Thermometer} value={point.heatPump} unit="kW" accent={COLORS.hp} suffix="Verbrauch" />
                <FlowNode title="E‑Auto" Icon={Car} value={point.evPower} unit="kW" accent={COLORS.ev} suffix={point.evPower >= 0 ? "Laden" : "V2X"} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800/40 border-zinc-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Verlauf</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setUseDemo(true)} variant="outline">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={series}>
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
                <CartesianGrid strokeDasharray="3 3" className={dark ? "stroke-zinc-700" : "stroke-zinc-200"} />
                <XAxis dataKey="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => new Date(t).toLocaleTimeString()} type="number" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value, name) => [`${value} kW`, name]} />
                <Area type="monotone" dataKey="pv" name="PV" stroke={COLORS.pv} fillOpacity={1} fill="url(#pv)" />
                <Area type="monotone" dataKey="loadTotal" name="Last" stroke={COLORS.load} fillOpacity={1} fill="url(#load)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800/40 border-zinc-700">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" className={dark ? "stroke-zinc-700" : "stroke-zinc-200"} />
                <XAxis dataKey="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => new Date(t).toLocaleTimeString()} type="number" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value, name) => [`${value} kW`, name]} />
                <Line type="monotone" dataKey="grid" name="Netz" stroke={COLORS.gridPos} dot={false} />
                <Line type="monotone" dataKey="batteryPower" name="Batterie" stroke={COLORS.battery} dot={false} />
                <Line type="monotone" dataKey="evPower" name="EV" stroke={COLORS.ev} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-800/40 border-zinc-700">
          <CardHeader>
            <CardTitle>Selbsttests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {tests.map((t) => (
                <li key={t.name} className={`flex justify-between ${t.pass ? "text-emerald-500" : "text-rose-500"}`}>
                  <span>{t.name}</span>
                  <span>{t.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
