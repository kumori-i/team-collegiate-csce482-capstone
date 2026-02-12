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

function safeFileName(value) {
  return String(value || "chart")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function resolveCssVars(serializedSvg) {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVars = [
    "--line",
    "--muted",
    "--surface",
    "--surface-2",
    "--text",
    "--chart-primary",
    "--chart-compare",
    "--accent",
    "--accent-2",
    "--accent-3",
    "--shadow-soft",
  ];
  let output = serializedSvg;
  for (const cssVar of cssVars) {
    const value = rootStyles.getPropertyValue(cssVar).trim();
    if (!value) continue;
    output = output.replaceAll(`var(${cssVar})`, value);
  }
  return output;
}

function replaceCssVarsInElementTree(rootElement) {
  const rootStyles = getComputedStyle(document.documentElement);
  const walker = document.createTreeWalker(
    rootElement,
    NodeFilter.SHOW_ELEMENT,
  );
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof Element)) continue;
    for (const attrName of node.getAttributeNames()) {
      const attrValue = node.getAttribute(attrName);
      if (!attrValue || !attrValue.includes("var(")) continue;
      const replaced = attrValue.replace(
        /var\((--[^)]+)\)/g,
        (_match, cssVar) => rootStyles.getPropertyValue(cssVar).trim() || "",
      );
      node.setAttribute(attrName, replaced);
    }
  }
}

async function downloadChartAsPng(chartDomId, fileBaseName) {
  const container = document.getElementById(chartDomId);
  const svg = container?.querySelector("svg");
  if (!svg) return;

  const svgRect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(svgRect.width));
  const height = Math.max(1, Math.round(svgRect.height));
  const clonedSvg = svg.cloneNode(true);
  replaceCssVarsInElementTree(clonedSvg);
  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));
  clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);
  svgString = resolveCssVars(svgString);
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);
  const exportScale = 3;
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = Math.max(1, Math.round(width * exportScale * dpr));
  const canvasHeight = Math.max(1, Math.round(height * exportScale * dpr));
  const drawScale = canvasWidth / width;

  await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.fillStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--surface")
          .trim() || "#ffffff";
      ctx.scale(drawScale, drawScale);
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) {
          reject(new Error("Failed to export chart image"));
          return;
        }
        downloadBlob(blob, `${fileBaseName}.png`);
        resolve();
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Failed to render SVG for export"));
    };
    image.src = svgUrl;
  });
}

function downloadChartAsCsv(data, fileBaseName, comparisonPlayer) {
  const hasComparison = Boolean(comparisonPlayer);
  const rows = data.map((item) => {
    const row = [item.name, item.primary ?? ""];
    if (hasComparison) {
      row.push(item.comparison ?? "");
    }
    return row;
  });
  const header = hasComparison
    ? ["Metric", "Primary", "Comparison"]
    : ["Metric", "Primary"];
  const csv = [header, ...rows]
    .map((line) =>
      line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${fileBaseName}.csv`,
  );
}

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
  const comparisonLabel = comparisonPlayer?.name_split || "Comparison Player";
  const chartId = `chart-shooting-${safeFileName(player.unique_id || player.name_split)}`;
  const fileBaseName = `${safeFileName(player.name_split)}-shooting-efficiency`;

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Shooting Efficiency Profile</h4>
        <span className="player-chart-meta">
          Percentage-based metrics (side-by-side when comparing)
        </span>
      </div>
      <div className="player-chart-actions">
        <button
          type="button"
          className="player-chart-action-button"
          onClick={() => downloadChartAsPng(chartId, fileBaseName)}
        >
          Download Image
        </button>
        <button
          type="button"
          className="player-chart-action-button"
          onClick={() =>
            downloadChartAsCsv(data, fileBaseName, comparisonPlayer)
          }
        >
          Download CSV
        </button>
      </div>
      <div className="player-chart-body" id={chartId}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--line)"
            />
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
  const comparisonLabel = comparisonPlayer?.name_split || "Comparison Player";
  const chartId = `chart-usage-${safeFileName(player.unique_id || player.name_split)}`;
  const fileBaseName = `${safeFileName(player.name_split)}-usage-playmaking`;

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Usage & Playmaking</h4>
        <span className="player-chart-meta">
          Role and decision-making profile
        </span>
      </div>
      <div className="player-chart-actions">
        <button
          type="button"
          className="player-chart-action-button"
          onClick={() => downloadChartAsPng(chartId, fileBaseName)}
        >
          Download Image
        </button>
        <button
          type="button"
          className="player-chart-action-button"
          onClick={() =>
            downloadChartAsCsv(data, fileBaseName, comparisonPlayer)
          }
        >
          Download CSV
        </button>
      </div>
      <div className="player-chart-body" id={chartId}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--line)"
            />
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
                return [Number(value).toFixed(1), `${baseLabel} • ${label}`];
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
