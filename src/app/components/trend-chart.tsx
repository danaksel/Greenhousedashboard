import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface TrendChartProps {
  title: string;
  data: Array<{ time: string; value: number; id: string }>;
  color: string;
  unit: string;
}

export function TrendChart({ title, data, color, unit }: TrendChartProps) {
  return (
    <Card className="p-4 bg-white shadow-lg">
      <h3 className="text-sm mb-3 text-gray-700">{title}</h3>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }} 
            stroke="#9ca3af"
          />
          <YAxis 
            tick={{ fontSize: 12 }} 
            stroke="#9ca3af"
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
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