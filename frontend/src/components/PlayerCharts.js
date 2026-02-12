import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatPercentageStat(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number((num * 100).toFixed(1));
}

function formatNumericStat(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(1));
}

function ShootingEfficiencyChart({ player, comparisonPlayer }) {
  const data = [
    {
      name: "FG%",
      primary: formatPercentageStat(player.fg),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.fg)
        : null,
    },
    {
      name: "3PT%",
      primary: formatPercentageStat(player.c_3pt),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.c_3pt)
        : null,
    },
    {
      name: "2PT%",
      primary: formatPercentageStat(player.c_2pt),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.c_2pt)
        : null,
    },
    {
      name: "FT%",
      primary: formatPercentageStat(player.ft),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.ft)
        : null,
    },
    {
      name: "eFG%",
      primary: formatPercentageStat(player.efg),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.efg)
        : null,
    },
    {
      name: "TS%",
      primary: formatPercentageStat(player.ts),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.ts)
        : null,
    },
  ].filter((item) => item.primary !== null || item.comparison !== null);

  if (!data.length) return null;

  const primaryLabel = player.name_split || "Player";
  const comparisonLabel =
    comparisonPlayer?.name_split || "Comparison Player";

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Shooting Efficiency Profile</h4>
        <span className="player-chart-meta">
          Percentage-based metrics (side-by-side when comparing)
        </span>
      </div>
      <div className="player-chart-body">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={{ stroke: "var(--line)" }}
            />
            <YAxis
              unit="%"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}`}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={{ stroke: "var(--line)" }}
            />
            <Tooltip
              formatter={(value, _name, props) => {
                const dataKey = props?.dataKey;
                const label =
                  dataKey === "primary" ? primaryLabel : comparisonLabel;
                if (value == null) {
                  return ["N/A", label];
                }
                return [`${Number(value).toFixed(1)}%`, label];
              }}
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
            <Legend
              formatter={(_value, entry) =>
                entry?.dataKey === "primary" ? primaryLabel : comparisonLabel
              }
            />
            <Bar
              dataKey="primary"
              name={primaryLabel}
              fill="var(--chart-primary)"
              radius={[4, 4, 0, 0]}
            />
            {comparisonPlayer ? (
              <Bar
                dataKey="comparison"
                name={comparisonLabel}
                fill="var(--chart-compare)"
                radius={[4, 4, 0, 0]}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UsagePlaymakingChart({ player, comparisonPlayer }) {
  const data = [
    {
      name: "USG%",
      tooltip: "Usage rate",
      primary: formatPercentageStat(player.usg),
      comparison: comparisonPlayer
        ? formatPercentageStat(comparisonPlayer.usg)
        : null,
    },
    {
      name: "A/TO",
      tooltip: "Assist to turnover",
      primary: formatNumericStat(player.a_to),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.a_to)
        : null,
    },
    {
      name: "TPG",
      tooltip: "Turnovers per game",
      primary: formatNumericStat(player.to_g),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.to_g)
        : null,
    },
    {
      name: "PPG",
      tooltip: "Points per game",
      primary: formatNumericStat(player.pts_g),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.pts_g)
        : null,
    },
  ].filter((item) => item.primary !== null || item.comparison !== null);

  if (!data.length) return null;

  const primaryLabel = player.name_split || "Player";
  const comparisonLabel =
    comparisonPlayer?.name_split || "Comparison Player";

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Usage & Playmaking</h4>
        <span className="player-chart-meta">
          Role and decision-making profile
        </span>
      </div>
      <div className="player-chart-body">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="name"
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
              formatter={(value, _name, entry) => {
                const dataKey = entry?.dataKey;
                const label =
                  dataKey === "primary" ? primaryLabel : comparisonLabel;
                if (value == null) {
                  return ["N/A", label];
                }
                const baseLabel = entry?.payload?.tooltip || "Value";
                return [
                  Number(value).toFixed(1),
                  `${baseLabel} • ${label}`,
                ];
              }}
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
            <Legend
              formatter={(_value, entry) =>
                entry?.dataKey === "primary" ? primaryLabel : comparisonLabel
              }
            />
            <Bar
              dataKey="primary"
              name={primaryLabel}
              fill="var(--chart-primary)"
              radius={[4, 4, 0, 0]}
            />
            {comparisonPlayer ? (
              <Bar
                dataKey="comparison"
                name={comparisonLabel}
                fill="var(--chart-compare)"
                radius={[4, 4, 0, 0]}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PlayerCharts({ player, comparisonPlayer }) {
  if (!player) return null;

  return (
    <div className="player-charts-grid">
      <ShootingEfficiencyChart
        player={player}
        comparisonPlayer={comparisonPlayer}
      />
      <UsagePlaymakingChart
        player={player}
        comparisonPlayer={comparisonPlayer}
      />
    </div>
  );
}


