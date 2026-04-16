import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function normalizePercentLike(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
}

function formatSeasonLabel(season) {
  if (typeof season !== "string") return season;
  if (season.includes("_")) {
    const [a, b] = season.split("_");
    if (a && b) return `${a}-${b}`;
  }
  return season;
}

function mapRowsToSeries(rows = []) {
  return rows.map((row) => ({
    season: formatSeasonLabel(row.season || ""),
    pts_g: Number.isFinite(Number(row.pts_g)) ? Number(row.pts_g) : null,
    reb_g: Number.isFinite(Number(row.reb_g)) ? Number(row.reb_g) : null,
    ast_g: Number.isFinite(Number(row.ast_g)) ? Number(row.ast_g) : null,
    ts: normalizePercentLike(row.ts),
    usg: normalizePercentLike(row.usg),
  }));
}

function renderTooltipValue(value, name) {
  if (value == null) return ["N/A", name];
  if (name === "TS%" || name === "USG%") {
    return [`${Number(value).toFixed(1)}%`, name];
  }
  return [Number(value).toFixed(1), name];
}

function ProgressionChartCard({ title, subtitle, children }) {
  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>{title}</h4>
        <span className="player-chart-meta">{subtitle}</span>
      </div>
      <div className="player-chart-body">{children}</div>
    </div>
  );
}

export default function PlayerProgressionCharts({ rows = [] }) {
  const data = mapRowsToSeries(rows).filter((row) => row.season);
  if (data.length < 2) {
    return (
      <div className="player-history-note">
        There is not enough season history to show progression yet.
      </div>
    );
  }

  return (
    <div className="player-charts-grid">
      <ProgressionChartCard
        title="Season Progression"
        subtitle="PPG, RPG, and APG by season"
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--line)"
            />
            <XAxis
              dataKey="season"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={{ stroke: "var(--line)" }}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={{ stroke: "var(--line)" }}
            />
            <Tooltip
              formatter={renderTooltipValue}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{
                backgroundColor: "var(--surface-2)",
                borderRadius: 8,
                borderColor: "var(--line)",
                color: "var(--text)",
                boxShadow: "var(--shadow-soft)",
                fontSize: "0.8rem",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="pts_g"
              name="PPG"
              stroke="var(--chart-primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="reb_g"
              name="RPG"
              stroke="var(--chart-compare)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="ast_g"
              name="APG"
              stroke="var(--accent)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ProgressionChartCard>
      <ProgressionChartCard
        title="Efficiency Progression"
        subtitle="TS% and USG% by season"
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--line)"
            />
            <XAxis
              dataKey="season"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={{ stroke: "var(--line)" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={{ stroke: "var(--line)" }}
            />
            <Tooltip
              formatter={renderTooltipValue}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{
                backgroundColor: "var(--surface-2)",
                borderRadius: 8,
                borderColor: "var(--line)",
                color: "var(--text)",
                boxShadow: "var(--shadow-soft)",
                fontSize: "0.8rem",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="ts"
              name="TS%"
              stroke="var(--chart-primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="usg"
              name="USG%"
              stroke="var(--chart-compare)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ProgressionChartCard>
    </div>
  );
}
