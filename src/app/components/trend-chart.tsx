import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrendChartProps {
  title: string;
  data: Array<{ time: string; value: number; id: string }>;
  color: string;
  unit: string;
  darkMode?: boolean;
}

export function TrendChart({ title, data, color, unit, darkMode = false }: TrendChartProps) {
  // Calculate domain with whole numbers
  const values = data.map(d => d.value);
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

  const bgClass = darkMode ? 'bg-[#2d3a21]' : 'bg-[#ebeee8]';
  const titleColor = darkMode ? 'text-white/80' : 'text-stone-700';
  const borderClass = darkMode ? 'border-white/10' : 'border-stone-200';
  const gridColor = darkMode ? '#4d5d3e' : '#d6d3d1';
  const axisColor = darkMode ? '#8d9d7e' : '#a8a29e';
  const tickColor = darkMode ? '#adbca2' : '#78716c';
  const tooltipBg = darkMode ? '#2d3a21' : 'white';
  const tooltipBorder = darkMode ? '#5d6d4e' : '#d6d3d1';
  
  return (
    <Card className={`p-4 ${bgClass} backdrop-blur-sm shadow-lg border ${borderClass} transition-colors duration-300`}>
      <h3 className={`text-sm mb-3 ${titleColor}`}>{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ right: 20, left: -10, top: 5, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: tickColor }} 
            stroke={axisColor}
            interval={0}
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
            formatter={(value: number) => [`${value}${unit}`]}
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
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
