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

function formatNumericStat(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(1));
}

function formatPercentLikeStat(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const normalized = num <= 1 ? num * 100 : num;
  return Number(normalized.toFixed(1));
}

function ArchetypeMetricsChart({ player, comparisonPlayer }) {
  const data = [
    {
      name: "PSP",
      tooltip: "Pure Scoring Prowess",
      primary: formatNumericStat(player.psp),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.psp)
        : null,
      isPercent: false,
    },
    {
      name: "3PE",
      tooltip: "3 Point Efficiency",
      primary: formatPercentLikeStat(player.c_3pe),
      comparison: comparisonPlayer
        ? formatPercentLikeStat(comparisonPlayer.c_3pe)
        : null,
      isPercent: true,
    },
    {
      name: "FGS",
      tooltip: "Floor General Skills",
      primary: formatNumericStat(player.fgs),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.fgs)
        : null,
      isPercent: false,
    },
    {
      name: "DSI",
      tooltip: "Defensive Statistical Impact",
      primary: formatNumericStat(player.dsi),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.dsi)
        : null,
      isPercent: false,
    },
    {
      name: "USG%",
      tooltip: "Usage Rate",
      primary: formatPercentLikeStat(player.usg),
      comparison: comparisonPlayer
        ? formatPercentLikeStat(comparisonPlayer.usg)
        : null,
      isPercent: true,
    },
  ].filter((item) => item.primary !== null || item.comparison !== null);

  if (!data.length) return null;

  const primaryLabel = player.name_split || "Player";
  const comparisonLabel = comparisonPlayer?.name_split || "Comparison Player";
  const chartId = `chart-archetype-${safeFileName(player.unique_id || player.name_split)}`;
  const fileBaseName = `${safeFileName(player.name_split)}-archetype-metrics`;

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Core Archetype Metrics</h4>
        <span className="player-chart-meta">PSP, 3PE, FGS, DSI, and USG%</span>
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
              domain={[0, 100]}
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
                const isPercent = Boolean(props?.payload?.isPercent);
                const formatted = `${Number(value).toFixed(1)}${isPercent ? "%" : ""}`;
                return [formatted, label];
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

function AroundTheRimChart({ player, comparisonPlayer }) {
  const data = [
    {
      name: "ATR",
      tooltip: "Around The Rim",
      primary: formatNumericStat(player.ram),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.ram)
        : null,
      isPercent: false,
    },
  ].filter((item) => item.primary !== null || item.comparison !== null);

  if (!data.length) return null;

  const primaryLabel = player.name_split || "Player";
  const comparisonLabel = comparisonPlayer?.name_split || "Comparison Player";
  const chartId = `chart-atr-${safeFileName(player.unique_id || player.name_split)}`;
  const fileBaseName = `${safeFileName(player.name_split)}-around-the-rim`;

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Around The Rim (ATR)</h4>
        <span className="player-chart-meta">
          Separate scale for high ATR values
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
              formatter={(value, _name, props) => {
                const dataKey = props?.dataKey;
                const label =
                  dataKey === "primary" ? primaryLabel : comparisonLabel;
                if (value == null) {
                  return ["N/A", label];
                }
                return [`${Number(value).toFixed(1)}`, label];
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
      <ArchetypeMetricsChart
        player={player}
        comparisonPlayer={comparisonPlayer}
      />
      <AroundTheRimChart player={player} comparisonPlayer={comparisonPlayer} />
    </div>
  );
}
