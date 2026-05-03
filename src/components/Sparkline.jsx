/**
 * Sparkline - mini gráfico de linha sem eixos, para top bar
 * Mostra evolução resumida em poucos pixels
 */
export default function Sparkline({
  data = [],
  width = 80,
  height = 24,
  color = "var(--ui-accent)",
  strokeWidth = 1.5,
  showArea = true
}) {
  if (!data?.length || data.length < 2) {
    // Linha plana decorativa quando sem dados
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <line
          x1={0} y1={height/2}
          x2={width} y2={height/2}
          stroke="var(--ui-bg-tertiary)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  // Normaliza dados para o tamanho do SVG (com padding vertical)
  const padding = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padding + (height - 2 * padding) - ((v - min) / range) * (height - 2 * padding);
    return [x, y];
  });

  // Path com curvas suaves (cardinal spline simplificado)
  const smoothPath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    const prev = arr[i - 1];
    const cx = (prev[0] + p[0]) / 2;
    return `${acc} Q ${cx.toFixed(1)} ${prev[1].toFixed(1)}, ${cx.toFixed(1)} ${((prev[1] + p[1]) / 2).toFixed(1)} T ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  }, "");

  const areaPath = `${smoothPath} L ${width} ${height} L 0 ${height} Z`;

  // Detecta tendência
  const isUp = data[data.length - 1] >= data[0];
  const finalColor = color === "auto"
    ? (isUp ? "var(--ui-success)" : "var(--ui-danger)")
    : color;

  const gradId = `spark-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={finalColor} stopOpacity={0.25}/>
          <stop offset="100%" stopColor={finalColor} stopOpacity={0}/>
        </linearGradient>
      </defs>

      {showArea && <path d={areaPath} fill={`url(#${gradId})`}/>}
      <path
        d={smoothPath}
        fill="none"
        stroke={finalColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ponto final destacado */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2}
        fill={finalColor}
      />
    </svg>
  );
}
