import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "../pages/PlayerDetails.css";

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

  await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 3;
      canvas.height = height * 3;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.scale(3, 3);
      ctx.fillStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--surface")
          .trim() || "#ffffff";
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

function downloadChartAsCsv(metrics, fileBaseName) {
  const csv = [["Metric", "Value"], ...metrics.map((metric) => [metric.label, metric.value])]
    .map((line) =>
      line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${fileBaseName}.csv`,
  );
}

export default function ChatMetricChart({ chartSpec }) {
  if (!chartSpec?.player || !Array.isArray(chartSpec.metrics)) {
    return null;
  }

  const chartId = `chat-chart-${safeFileName(
    chartSpec.player.unique_id || chartSpec.player.name_split,
  )}`;
  const fileBaseName = `${safeFileName(chartSpec.player.name_split)}-chat-chart`;

  return (
    <div className="player-charts-grid">
      <div className="player-chart-card">
        <div className="player-chart-header">
          <h4>{chartSpec.title || "Player Metric Chart"}</h4>
          <span className="player-chart-meta">
            {chartSpec.subtitle || "Requested chat metrics"}
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
            onClick={() => downloadChartAsCsv(chartSpec.metrics, fileBaseName)}
          >
            Download CSV
          </button>
        </div>
        <div className="player-chart-body" id={chartId}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={chartSpec.metrics}
              margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--line)"
              />
              <XAxis
                dataKey="label"
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
                  if (value == null) {
                    return ["N/A", chartSpec.player.name_split || "Player"];
                  }
                  const suffix = props?.payload?.percentLike ? "%" : "";
                  return [
                    `${Number(value).toFixed(1)}${suffix}`,
                    chartSpec.player.name_split || "Player",
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
              <Bar
                dataKey="value"
                fill="var(--chart-primary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
