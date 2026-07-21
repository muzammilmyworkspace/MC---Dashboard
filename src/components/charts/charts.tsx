"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { weeklyPerformance, channelSplit, roasTrend } from "@/lib/data";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
} as const;

export function PerformanceChart() {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={weeklyPerformance} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gReach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gEng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4" }} />
        <Area type="monotone" dataKey="reach" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gReach)" name="Reach (k)" />
        <Area type="monotone" dataKey="engagement" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gEng)" name="Engagement (k)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ChannelDonut() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={channelSplit}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={3}
          stroke="none"
        >
          {channelSplit.map((c) => (
            <Cell key={c.name} fill={c.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v}%`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RoasLine() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={roasTrend} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} domain={[0, 5]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}x`, "ROAS"]} />
        <Line type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
