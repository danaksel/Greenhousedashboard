import { Card } from "./ui/card";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getResolvedDisplayTheme } from "../../shared/display-theme";
import type { DisplayThemeConfig } from "../utils/api";

type ChartPoint = {
  time: string;
  value: number;
  min?: number;
  max?: number;
  range?: [number, number];
  id: string;
};

interface TrendChartProps {
  title: string;
  data: ChartPoint[];
  color: string;
  unit: string;
  darkMode?: boolean;
  xAxisInterval?: number;
  thresholdLine?: {
    value: number;
    label: string;
    color: string;
  };
  theme?: DisplayThemeConfig;
}

export function TrendChart({
  title,
  data,
  color,
  unit,
  darkMode = false,
  xAxisInterval = 0,
  thresholdLine,
  theme,
}: TrendChartProps) {
  const modeTheme = darkMode ? getResolvedDisplayTheme(theme).dark : getResolvedDisplayTheme(theme).light;
  const gridColor = modeTheme.graphPanelBorder;
  const axisColor = modeTheme.symbolColor;
  const tickColor = modeTheme.mutedColor;
  const tooltipBg = modeTheme.graphPanelBg;
  const tooltipBorder = modeTheme.graphPanelBorder;

  if (data.length === 0) {
    return (
      <Card className="border p-4 shadow-lg backdrop-blur-sm transition-colors duration-300" style={{ backgroundColor: modeTheme.graphPanelBg, borderColor: modeTheme.graphPanelBorder }}>
        <h3 className="mb-3 text-sm" style={{ color: modeTheme.labelColor, opacity: modeTheme.labelOpacity }}>{title}</h3>
        <div className="flex h-[160px] items-center justify-center text-sm" style={{ color: modeTheme.mutedColor }}>
          Ingen historikk tilgjengelig
        </div>
      </Card>
    );
  }

  // Calculate domain with whole numbers, including the true min/max range.
  const values = [
    ...data.flatMap((d) => [d.value, d.min ?? d.value, d.max ?? d.value]),
    ...(thresholdLine ? [thresholdLine.value] : []),
  ];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  
  const minTick = Math.floor(rawMin);
  const baseMaxTick = Math.ceil(rawMax);
  
  const candidateSteps = [1, 2, 5, 10, 20, 50];
  
  let chosen = null;
  
  for (const step of candidateSteps) {
    const axisMax = Math.ceil((baseMaxTick - minTick) / step) * step + minTick;
    const tickCount = Math.floor((axisMax - minTick) / step) + 1;
    
    if (tickCount <= 4) {
      chosen = { step, axisMax, tickCount };
      break;
    }
  }
  
  // Fallback if no step found (shouldn't happen with our candidate steps)
  if (!chosen) {
    chosen = { step: 10, axisMax: baseMaxTick, tickCount: 4 };
  }
  
  // Generate ticks
  const ticks = [];
  for (let v = minTick; v <= chosen.axisMax; v += chosen.step) {
    ticks.push(v);
  }
  
  return (
    <Card className="border p-4 shadow-lg backdrop-blur-sm transition-colors duration-300 md:p-5" style={{ backgroundColor: modeTheme.graphPanelBg, borderColor: modeTheme.graphPanelBorder }}>
      <h3 className="mb-3 text-sm" style={{ color: modeTheme.labelColor, opacity: modeTheme.labelOpacity }}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ right: 20, left: -10, top: 5, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: tickColor }} 
            stroke={axisColor}
            interval={xAxisInterval}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: tickColor }} 
            stroke={axisColor}
            domain={[minTick, chosen.axisMax]}
            ticks={ticks}
            tickFormatter={(value) => `${value}${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: "8px",
              fontSize: "12px",
              color: tickColor,
            }}
            labelStyle={{ color: tickColor }}
            formatter={(value: number | [number, number], name: string) => {
              if (name === "range" && Array.isArray(value)) {
                return [`${value[0]}-${value[1]}${unit}`, "min-maks"];
              }

              return [`${value}${unit}`, "verdi"];
            }}
          />
          {thresholdLine && (
            <ReferenceLine
              y={thresholdLine.value}
              stroke={thresholdLine.color}
              strokeDasharray="5 5"
              strokeOpacity={0.85}
              ifOverflow="extendDomain"
              label={{
                value: thresholdLine.label,
                position: "insideTopRight",
                fill: thresholdLine.color,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="range"
            fill={color}
            fillOpacity={darkMode ? 0.16 : 0.18}
            stroke={color}
            strokeOpacity={darkMode ? 0.28 : 0.32}
            strokeWidth={1}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
