import React from "react";

export function Card({ className = "", children }) {
  return <div className={`rounded-2xl border ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = "" }) {
  return <div className={`px-3 pt-3 md:px-4 md:pt-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }) {
  return <div className={`text-sm opacity-80 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }) {
  return <div className={`px-3 pb-3 md:px-4 md:pb-4 ${className}`}>{children}</div>;
}

export function Button({ children, onClick, variant = "default", className = "" }) {
  const base = "inline-flex items-center gap-2 px-3 h-9 md:h-10 rounded-xl text-sm font-medium transition-colors";
  const styles =
    variant === "secondary"
      ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
      : variant === "outline"
      ? "bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-100"
      : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200";
  return (
    <button onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder = "", className = "" }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`h-9 md:h-10 w-full rounded-xl px-3 outline-none border ${className}`}
    />
  );
}

export function SwitchInline({ id, checked, onCheckedChange, label }) {
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

export function Badge({ children }) {
  return (
    <span className="px-2 py-1 rounded-full text-[10px] uppercase tracking-wide bg-zinc-800/80 border border-zinc-700 shadow-inner">
      {children}
    </span>
  );
}

export function Ring({ value, label }) {
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
          cx="60"
          cy="60"
          r={radius}
          strokeLinecap="round"
          strokeWidth={stroke}
          fill="none"
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

export function LiveBadge({ connected }) {
  return (
    <div className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-zinc-800/60 border border-zinc-700">
      <span className={`inline-flex w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
      <span className="uppercase tracking-wide">{connected ? "Live" : "Offline (Demo)"}</span>
    </div>
  );
}
