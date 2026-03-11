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
  const minValue = Math.floor(Math.min(...values));
  const maxValue = Math.ceil(Math.max(...values));
  
  // Generate array of all whole numbers from floor(min) to ceil(max)
  const ticks = [];
  for (let i = minValue; i <= maxValue; i++) {
    ticks.push(i);
  }

  const bgClass = darkMode ? 'bg-[#3d4d2e]/90' : 'bg-[#ebeee8]';
  const titleColor = darkMode ? 'text-white/80' : 'text-stone-700';
  const borderClass = darkMode ? 'border-white/10' : 'border-stone-200';
  const gridColor = darkMode ? '#4d5d3e' : '#d6d3d1';
  const axisColor = darkMode ? '#8d9d7e' : '#a8a29e';
  const tickColor = darkMode ? '#adbca2' : '#78716c';
  const tooltipBg = darkMode ? '#3d4d2e' : 'white';
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
            domain={[minValue, maxValue]}
            ticks={ticks}
            interval={0}
            tickFormatter={(value) => `${value}${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`${value}${unit}`, "Value"]}
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