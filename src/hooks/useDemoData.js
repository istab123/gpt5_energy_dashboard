import { useEffect, useState } from "react";
import { clamp, round1, round2 } from "../utils";

export function useDemoData(enabled) {
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
  const now = Date.now() - 60_000 * 60;
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
  const sunFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const pvPeak = 6;
  const pv = (sunFactor ** 1.4) * pvPeak * (0.85 + Math.random() * 0.3);

  const baseLoad = 0.6 + Math.sin((t / 1000 / 60 / 15) % (2 * Math.PI)) * 0.2 + (Math.random() - 0.5) * 0.1;
  const loadBase = Math.max(0.3, baseLoad);
  const hpCycle = 1 + 0.6 * Math.sin((t / 1000 / 60 / 8) % (2 * Math.PI));
  const heatPump = clamp(0.5 + hpCycle * 1.2 + (Math.random() - 0.5) * 0.2, 0.3, 2.4);

  let evSoc = prev ? prev.evSoc : 50 + Math.random() * 20;
  let evPower = 0;
  const dayChargeTarget = 90;
  const canFastCharge = 7;
  const canV2H = 3;
  if (sunFactor > 0.2 && evSoc < dayChargeTarget) {
    evPower = Math.min(canFastCharge, 1 + sunFactor * 6);
  }
  if (hour >= 18 && hour <= 22 && evSoc > 40) {
    evPower = -Math.min(canV2H, 1.5 + Math.random());
  }

  const loadTotal = loadBase + heatPump + Math.max(0, evPower);

  const effectiveLoad = loadTotal + Math.min(0, evPower);
  const surplus = pv - effectiveLoad;

  let batteryPower = 0;
  let grid = 0;

  if (surplus > 0) {
    const canCharge = Math.max(0, 4 * (1 - (prev?.batterySoc ?? 60) / 100));
    batteryPower = Math.min(surplus, canCharge);
    const rest = surplus - batteryPower;
    grid = -Math.max(0, rest);
  } else {
    const canDischarge = Math.max(0, 4 * ((prev?.batterySoc ?? 60) / 100));
    const discharge = Math.min(-surplus, canDischarge);
    batteryPower = -discharge;
    grid = -surplus - discharge;
  }

  const dtH = prev ? (t - prev.time) / 3_600_000 : 1 / 60;
  const batteryCapacityKWh = 10;
  const evCapacityKWh = 60;
  const prevBatSoc = prev?.batterySoc ?? 60;
  let batterySoc = clamp(prevBatSoc + (batteryPower * 100 * dtH) / batteryCapacityKWh, 5, 100);
  evSoc = clamp(evSoc + (evPower * 100 * dtH) / evCapacityKWh, 5, 100);

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
    loadTotal: round2(loadTotal),
  };
}
