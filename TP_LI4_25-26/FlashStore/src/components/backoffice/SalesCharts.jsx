import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BRAND_COLORS = [
  '#f97316', '#fb923c', '#fdba74',
  '#2563eb', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#14b8a6', '#64748b',
];

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f97316' }} className="tabular-nums">
          {p.name === 'sales' ? 'Vendas' : p.name === 'transactions' ? 'Transações' : p.name}:{' '}
          <span className="font-bold">
            {p.name === 'sales' ? `${Number(p.value).toFixed(2)}€` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}h</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.stroke }} className="tabular-nums">
          {p.dataKey === 'sales' ? 'Vendas' : 'Transações'}:{' '}
          <span className="font-bold">
            {p.dataKey === 'sales' ? `${Number(p.value).toFixed(2)}€` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function LocalSalesChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="lineGradientSales" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}h`}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}€`}
          width={50}
        />
        <Tooltip content={<CustomLineTooltip />} />
        <Line
          type="monotone"
          dataKey="sales"
          stroke="#f97316"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#f97316' }}
        />
        <Line
          type="monotone"
          dataKey="transactions"
          stroke="#cbd5e1"
          strokeWidth={2}
          dot={{ r: 2, fill: '#cbd5e1', strokeWidth: 0 }}
          activeDot={{ r: 4, fill: '#94a3b8' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StoreSalesBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 16 }} barSize={40}>
        <defs>
          <linearGradient id="barGradientOrange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
            <stop offset="100%" stopColor="#fdba74" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="store"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}€`}
          width={55}
        />
        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#f97316', fillOpacity: 0.06 }} />
        <Bar dataKey="sales" fill="url(#barGradientOrange)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPieChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="sales"
          nameKey="name"
          innerRadius={72}
          outerRadius={110}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={BRAND_COLORS[index % BRAND_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${Number(value).toFixed(2)}€`, name]}
          contentStyle={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            fontSize: '13px',
          }}
          itemStyle={{ color: '#334155' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
