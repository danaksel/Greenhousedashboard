import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrendChartProps {
  title: string;
  data: Array<{ time: string; value: number; id: string }>;
  color: string;
  unit: string;
}

export function TrendChart({ title, data, color, unit }: TrendChartProps) {
  // Calculate domain with whole numbers
  const values = data.map(d => d.value);
  const minValue = Math.floor(Math.min(...values));
  const maxValue = Math.ceil(Math.max(...values));
  
  // Generate array of all whole numbers from floor(min) to ceil(max)
  const ticks = [];
  for (let i = minValue; i <= maxValue; i++) {
    ticks.push(i);
  }
  
  return (
    <Card className="p-4 bg-[#ebeee8] backdrop-blur-sm shadow-lg border border-stone-200">
      <h3 className="text-sm mb-3 text-stone-700">{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ right: 20, left: -10, top: 5, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: '#78716c' }} 
            stroke="#a8a29e"
            interval={0}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#78716c' }} 
            stroke="#a8a29e"
            domain={[minValue, maxValue]}
            ticks={ticks}
            interval={0}
            tickFormatter={(value) => `${value}${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #d6d3d1",
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