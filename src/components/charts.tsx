export function BarChart({
  data,
  unit = "",
  color = "#f5a524",
}: {
  data: { label: string; value: number }[];
  unit?: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-36">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-muted whitespace-nowrap">
            {d.value.toLocaleString("fr-FR")}
            {unit}
          </span>
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${Math.max((d.value / max) * 100, 3)}%`,
              backgroundColor: color,
              opacity: 0.55 + 0.45 * (d.value / max),
            }}
            title={`${d.label}: ${d.value.toLocaleString("fr-FR")}${unit}`}
          />
          <span className="text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const gradient = data
    .map((d) => {
      const start = (acc / total) * 100;
      acc += d.value;
      const end = (acc / total) * 100;
      return `${d.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative w-32 h-32 rounded-full shrink-0"
        style={{
          background: `conic-gradient(${gradient})`,
        }}
      >
        <div className="absolute inset-[22%] rounded-full bg-ink-2 flex items-center justify-center">
          <span className="font-display font-bold text-sm text-center leading-tight">
            {total}%
          </span>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm min-w-0">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-cream/90 truncate">{d.label}</span>
            <span className="ml-auto text-muted text-xs shrink-0">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({
  values,
  color = "#27ae60",
  height = 56,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const w = 100;
  const step = w / (values.length - 1 || 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 6) - 3).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
