import React from "react";
import { motion } from "framer-motion";
import { COLORS } from "../utils";

export function FlowParticles({ from, to, power, color }) {
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

export function FlowNode({ title, Icon, value, unit, accent, suffix }) {
  const positive = value >= 0;
  const IconComp = Icon;
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 opacity-80">
          {IconComp ? React.createElement(IconComp, { className: "w-4 h-4", style: { color: accent } }) : null}
          <span className="text-sm">{title}</span>
        </div>
        <span className="text-xs" style={{ color: positive ? accent : COLORS.gridPos }}>{positive ? "+" : "-"}</span>
      </div>
      <div className="mt-2 rounded-lg p-2 sm:p-3" style={{ background: `${accent}22` }}>
        <div className="text-xl sm:text-2xl font-bold">
          {Math.abs(value).toFixed(2)} <span className="text-sm font-medium opacity-80">{unit}</span>
        </div>
        {suffix && <div className="text-xs opacity-80 mt-1">{suffix}</div>}
      </div>
    </div>
  );
}
