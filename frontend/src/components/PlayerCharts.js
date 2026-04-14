import {
  Bar,
  BarChart,
  CartesianGrid,
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
  const svgs = Array.from(container?.querySelectorAll("svg") || []);
  if (!container || svgs.length === 0) return;

  const serializer = new XMLSerializer();
  const containerRect = container.getBoundingClientRect();
  const width = Math.max(1, Math.round(containerRect.width));
  const height = Math.max(1, Math.round(containerRect.height));
  const exportScale = 3;
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = Math.max(1, Math.round(width * exportScale * dpr));
  const canvasHeight = Math.max(1, Math.round(height * exportScale * dpr));
  const drawScale = canvasWidth / width;

  const renderedSvgs = await Promise.all(
    svgs.map(
      (svg) =>
        new Promise((resolve, reject) => {
          const svgRect = svg.getBoundingClientRect();
          const clonedSvg = svg.cloneNode(true);
          replaceCssVarsInElementTree(clonedSvg);
          clonedSvg.setAttribute("width", String(Math.max(1, svgRect.width)));
          clonedSvg.setAttribute("height", String(Math.max(1, svgRect.height)));
          clonedSvg.setAttribute(
            "viewBox",
            `0 0 ${Math.max(1, svgRect.width)} ${Math.max(1, svgRect.height)}`,
          );

          let svgString = serializer.serializeToString(clonedSvg);
          svgString = resolveCssVars(svgString);
          const svgBlob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
          });
          const svgUrl = URL.createObjectURL(svgBlob);
          const image = new Image();

          image.onload = () => {
            URL.revokeObjectURL(svgUrl);
            resolve({
              image,
              x: svgRect.left - containerRect.left,
              y: svgRect.top - containerRect.top,
              width: svgRect.width,
              height: svgRect.height,
            });
          };
          image.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            reject(new Error("Failed to render SVG for export"));
          };
          image.src = svgUrl;
        }),
    ),
  );

  await new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas context unavailable"));
      return;
    }

    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--surface")
        .trim() || "#ffffff";
    ctx.scale(drawScale, drawScale);
    ctx.fillRect(0, 0, width, height);

    for (const rendered of renderedSvgs) {
      ctx.drawImage(
        rendered.image,
        rendered.x,
        rendered.y,
        rendered.width,
        rendered.height,
      );
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export chart image"));
        return;
      }
      downloadBlob(blob, `${fileBaseName}.png`);
      resolve();
    }, "image/png");
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
  const metricsData = [
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

  const atrData = [
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

  if (!metricsData.length && !atrData.length) return null;

  const primaryLabel = player.name_split || "Player";
  const comparisonLabel = comparisonPlayer?.name_split || "Comparison Player";
  const chartId = `chart-archetype-${safeFileName(player.unique_id || player.name_split)}`;
  const fileBaseName = `${safeFileName(player.name_split)}-archetype-metrics`;

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>Core Archetype Metrics</h4>
        <span className="player-chart-meta">
          PSP, 3PE, FGS, DSI, USG%, and ATR
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
            downloadChartAsCsv(
              [...metricsData, ...atrData],
              fileBaseName,
              comparisonPlayer,
            )
          }
        >
          Download CSV
        </button>
      </div>
      <div
        className="player-chart-body"
        id={chartId}
        style={{ height: 312 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 5fr) minmax(180px, 1.3fr)",
            gap: "1rem",
            height: "100%",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={metricsData}
              margin={{ top: 8, right: 8, bottom: 14, left: 0 }}
              barCategoryGap="12%"
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
              <Bar
                dataKey="primary"
                name={primaryLabel}
                fill="var(--chart-primary)"
                radius={[4, 4, 0, 0]}
                barSize={34}
              />
              {comparisonPlayer ? (
                <Bar
                  dataKey="comparison"
                  name={comparisonLabel}
                  fill="var(--chart-compare)"
                  radius={[4, 4, 0, 0]}
                  barSize={34}
                />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={atrData}
              margin={{ top: 8, right: 0, bottom: 14, left: 8 }}
              barCategoryGap="12%"
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
                orientation="right"
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
              <Bar
                dataKey="primary"
                name={primaryLabel}
                fill="var(--chart-primary)"
                radius={[4, 4, 0, 0]}
                barSize={34}
              />
              {comparisonPlayer ? (
                <Bar
                  dataKey="comparison"
                  name={comparisonLabel}
                  fill="var(--chart-compare)"
                  radius={[4, 4, 0, 0]}
                  barSize={34}
                />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
            marginTop: "-0.35rem",
            fontSize: "0.8rem",
            color: "var(--text)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                background: "var(--chart-primary)",
                display: "inline-block",
              }}
            />
            {primaryLabel}
          </span>
          {comparisonPlayer ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  background: "var(--chart-compare)",
                  display: "inline-block",
                }}
              />
              {comparisonLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RamCramChart({ player, comparisonPlayer }) {
  const ramData = [
    {
      name: "RAM",
      primary: formatNumericStat(player.ram),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.ram)
        : null,
    },
  ].filter((item) => item.primary != null || item.comparison != null);

  const cramData = [
    {
      name: "CRAM",
      primary: formatNumericStat(player.c_ram),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.c_ram)
        : null,
    },
  ].filter((item) => item.primary != null || item.comparison != null);

  const csvData = [
    {
      name: "RAM",
      primary: formatNumericStat(player.ram),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.ram)
        : null,
      isPercent: false,
    },
    {
      name: "CRAM",
      primary: formatNumericStat(player.c_ram),
      comparison: comparisonPlayer
        ? formatNumericStat(comparisonPlayer.c_ram)
        : null,
      isPercent: false,
    },
  ].filter((item) => item.primary !== null || item.comparison !== null);

  if (!ramData.length && !cramData.length) return null;

  const primaryLabel = player.name_split || "Player";
  const comparisonLabel = comparisonPlayer?.name_split || "Comparison Player";
  const chartId = `chart-ram-cram-${safeFileName(player.unique_id || player.name_split)}`;
  const fileBaseName = `${safeFileName(player.name_split)}-ram-cram`;

  return (
    <div className="player-chart-card">
      <div className="player-chart-header">
        <h4>RAM &amp; CRAM</h4>
        <span className="player-chart-meta">RAM and CRAM</span>
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
            downloadChartAsCsv(csvData, fileBaseName, comparisonPlayer)
          }
        >
          Download CSV
        </button>
      </div>
      <div className="player-chart-body" id={chartId}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "1rem",
              flex: 1,
              minHeight: 0,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ramData}
                margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
                barCategoryGap="32%"
                barGap={8}
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
                  label={{
                    value: "RAM",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--muted)",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  formatter={(value, _name, props) => {
                    if (value == null) {
                      return ["N/A", props?.name];
                    }
                    return [`${Number(value).toFixed(1)}`, props?.name];
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
                <Bar
                  dataKey="primary"
                  name={primaryLabel}
                  fill="var(--chart-primary)"
                  radius={[4, 4, 0, 0]}
                  barSize={52}
                />
                {comparisonPlayer ? (
                  <Bar
                    dataKey="comparison"
                    name={comparisonLabel}
                    fill="var(--chart-compare)"
                    radius={[4, 4, 0, 0]}
                    barSize={52}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cramData}
                margin={{ top: 8, right: 8, bottom: 8, left: 12 }}
                barCategoryGap="32%"
                barGap={8}
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
                  orientation="right"
                  tick={{ fill: "var(--muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--line)" }}
                  tickLine={{ stroke: "var(--line)" }}
                  label={{
                    value: "CRAM",
                    angle: 90,
                    position: "insideRight",
                    fill: "var(--muted)",
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  formatter={(value, _name, props) => {
                    if (value == null) {
                      return ["N/A", props?.name];
                    }
                    return [`${Number(value).toFixed(1)}`, props?.name];
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
                <Bar
                  dataKey="primary"
                  name={primaryLabel}
                  fill="var(--chart-primary)"
                  radius={[4, 4, 0, 0]}
                  barSize={52}
                />
                {comparisonPlayer ? (
                  <Bar
                    dataKey="comparison"
                    name={comparisonLabel}
                    fill="var(--chart-compare)"
                    radius={[4, 4, 0, 0]}
                    barSize={52}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "1rem",
              marginTop: "0.5rem",
              fontSize: "0.8rem",
              color: "var(--text)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  background: "var(--chart-primary)",
                  display: "inline-block",
                }}
              />
              {primaryLabel}
            </span>
            {comparisonPlayer ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    background: "var(--chart-compare)",
                    display: "inline-block",
                  }}
                />
                {comparisonLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerCharts({ player, comparisonPlayer }) {
  if (!player) return null;

  return (
    <div className="player-charts-grid">
      <RamCramChart
        player={player}
        comparisonPlayer={comparisonPlayer}
      />
      <ArchetypeMetricsChart
        player={player}
        comparisonPlayer={comparisonPlayer}
      />
    </div>
  );
}
