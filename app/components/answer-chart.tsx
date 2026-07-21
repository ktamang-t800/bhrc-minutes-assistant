"use client";

import type { AnswerChart, AnswerTable } from "../lib/answer-format";

const chartColors = [
  "#0a827b",
  "#bddb4a",
  "#e7a83e",
  "#4f78a8",
  "#b85f75",
  "#745aa6",
  "#43a4b5",
  "#9c7a3d",
];

function numericValue(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[%$£€¥]/g, "").trim();
  const match = normalized.match(/^-?\d+(?:\.\d+)?$/);
  return match ? Number(match[0]) : null;
}

function formatValue(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function chartRows(chart: AnswerChart, table: AnswerTable) {
  const labelIndex = table.headers.indexOf(chart.labelColumn);
  const valueIndexes = chart.valueColumns.map((column) =>
    table.headers.indexOf(column),
  );

  return table.rows
    .map((row) => ({
      label: row[labelIndex] ?? "",
      values: valueIndexes.map((index) => numericValue(row[index] ?? "")),
    }))
    .filter(
      (row): row is { label: string; values: number[] } =>
        Boolean(row.label) && row.values.every((value) => value !== null),
    );
}

function ChartLegend({ columns }: { columns: string[] }) {
  if (columns.length < 2) return null;
  return (
    <div className="chart-series-legend">
      {columns.map((column, index) => (
        <span key={column}>
          <i style={{ background: chartColors[index % chartColors.length] }} />
          {column}
        </span>
      ))}
    </div>
  );
}

function BarChart({ chart, table }: { chart: AnswerChart; table: AnswerTable }) {
  const rows = chartRows(chart, table);
  const maximum = Math.max(1, ...rows.flatMap((row) => row.values.map(Math.abs)));

  return (
    <div className="bar-chart" role="img" aria-label={chart.title}>
      <ChartLegend columns={chart.valueColumns} />
      <div className="bar-chart-rows">
        {rows.map((row) => (
          <div className="bar-chart-row" key={row.label}>
            <span className="bar-chart-label">{row.label}</span>
            <div className="bar-chart-series">
              {row.values.map((value, seriesIndex) => (
                <div className="bar-track" key={`${row.label}-${seriesIndex}`}>
                  <span
                    className="bar-fill"
                    style={{
                      background: chartColors[seriesIndex % chartColors.length],
                      width: `${Math.max(2, (Math.abs(value) / maximum) * 100)}%`,
                    }}
                  />
                  <b>{formatValue(value)}</b>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ chart, table }: { chart: AnswerChart; table: AnswerTable }) {
  const rows = chartRows(chart, table);
  const width = Math.max(720, rows.length * 68);
  const height = 260;
  const padding = 34;
  const values = rows.flatMap((row) => row.values);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const range = maximum - minimum || 1;
  const xFor = (index: number) =>
    rows.length === 1
      ? width / 2
      : padding + (index / (rows.length - 1)) * (width - padding * 2);
  const yFor = (value: number) =>
    height - padding - ((value - minimum) / range) * (height - padding * 2);

  return (
    <div className="line-chart" role="img" aria-label={chart.title}>
      <ChartLegend columns={chart.valueColumns} />
      <div className="line-chart-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          style={{ minWidth: width }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + ratio * (height - padding * 2);
            return (
              <line
                className="line-chart-grid"
                key={ratio}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
              />
            );
          })}
          {chart.valueColumns.map((column, seriesIndex) => {
            const points = rows
              .map((row, rowIndex) =>
                `${xFor(rowIndex)},${yFor(row.values[seriesIndex])}`,
              )
              .join(" ");
            return (
              <g key={column}>
                <polyline
                  fill="none"
                  points={points}
                  stroke={chartColors[seriesIndex % chartColors.length]}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
                {rows.map((row, rowIndex) => (
                  <circle
                    cx={xFor(rowIndex)}
                    cy={yFor(row.values[seriesIndex])}
                    fill={chartColors[seriesIndex % chartColors.length]}
                    key={`${column}-${row.label}`}
                    r="4.5"
                  />
                ))}
              </g>
            );
          })}
          <text className="line-chart-axis-value" x="2" y={padding + 4}>
            {formatValue(maximum)}
          </text>
          <text className="line-chart-axis-value" x="2" y={height - padding + 4}>
            {formatValue(minimum)}
          </text>
        </svg>
        <div
          className="line-chart-labels"
          style={{
            gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(64px, 1fr))`,
            minWidth: width,
          }}
        >
          {rows.map((row) => (
            <span key={row.label}>{row.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PieChart({ chart, table }: { chart: AnswerChart; table: AnswerTable }) {
  const rows = chartRows(chart, table).filter((row) => row.values[0] >= 0);
  const total = rows.reduce((sum, row) => sum + row.values[0], 0);
  let offset = 0;
  const segments = rows.map((row, index) => {
    const start = total ? (offset / total) * 360 : 0;
    offset += row.values[0];
    const end = total ? (offset / total) * 360 : 0;
    return {
      ...row,
      color: chartColors[index % chartColors.length],
      start,
      end,
    };
  });
  const background = segments
    .map((segment) => `${segment.color} ${segment.start}deg ${segment.end}deg`)
    .join(", ");

  return (
    <div className="pie-chart" role="img" aria-label={chart.title}>
      <div
        className="pie-chart-visual"
        style={{ background: `conic-gradient(${background})` }}
      >
        <div>
          <strong>{formatValue(total)}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="pie-chart-legend">
        {segments.map((segment) => (
          <div key={segment.label}>
            <i style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <b>
              {formatValue(segment.values[0])}
              <small>
                {total ? ` · ${Math.round((segment.values[0] / total) * 100)}%` : ""}
              </small>
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnswerChartCard({
  chart,
  table,
}: {
  chart: AnswerChart;
  table: AnswerTable;
}) {
  const rows = chartRows(chart, table);
  if (!rows.length) return null;

  return (
    <section className="answer-chart-card">
      <div className="answer-chart-heading">
        <div>
          <span>{chart.type} chart</span>
          <h3>{chart.title}</h3>
        </div>
        <small>Generated from the table above</small>
      </div>
      <div className="answer-chart-body">
        {chart.type === "bar" && <BarChart chart={chart} table={table} />}
        {chart.type === "line" && <LineChart chart={chart} table={table} />}
        {chart.type === "pie" && <PieChart chart={chart} table={table} />}
      </div>
    </section>
  );
}
