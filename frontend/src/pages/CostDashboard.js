import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getUsageDashboard } from "../api";
import "./Profile.css";

const RANGE_OPTIONS = [
  { value: 14, label: "2 Weeks" },
  { value: 30, label: "1 Month" },
  { value: 180, label: "6 Months" },
];

const formatCurrency = (value) =>
  value == null ? "N/A" : `$${Number(value).toFixed(4)}`;

export default function CostDashboard({ onLogout }) {
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageRange, setUsageRange] = useState(14);

  useEffect(() => {
    loadUsage(usageRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usageRange]);

  const loadUsage = async (days) => {
    setUsageLoading(true);
    try {
      const usageData = await getUsageDashboard(days);
      setUsage(usageData);
    } catch (error) {
      console.error("Failed to load usage dashboard:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        onLogout();
      }
    } finally {
      setUsageLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container profile-container--wide">
        <h1>Cost Dashboard</h1>

        <section className="usage-dashboard usage-dashboard--standalone">
          <div className="usage-dashboard-header">
            <div>
              <h2>Model Usage</h2>
              <p>
                Track model requests, token usage, and estimated cost over time.
              </p>
            </div>
            <label className="usage-range-control">
              <span>Range</span>
              <select
                value={usageRange}
                onChange={(event) => setUsageRange(Number(event.target.value))}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {usageLoading ? (
            <p>Loading usage dashboard...</p>
          ) : (
            <>
              <div className="usage-summary-grid">
                <div className="usage-summary-card">
                  <span className="usage-summary-label">Requests</span>
                  <strong>{usage?.totals?.requests || 0}</strong>
                </div>
                <div className="usage-summary-card">
                  <span className="usage-summary-label">Total Tokens</span>
                  <strong>{usage?.totals?.totalTokens || 0}</strong>
                </div>
                <div className="usage-summary-card">
                  <span className="usage-summary-label">Input Tokens</span>
                  <strong>{usage?.totals?.inputTokens || 0}</strong>
                </div>
                <div className="usage-summary-card">
                  <span className="usage-summary-label">Estimated Cost</span>
                  <strong>{formatCurrency(usage?.totals?.costUsd)}</strong>
                </div>
              </div>

              <div className="usage-chart-section">
                <h3>Daily Usage</h3>
                <div className="usage-chart-card">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={usage?.dailyUsage || []}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--line)"
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "var(--muted)", fontSize: 12 }}
                      />
                      <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="var(--chart-primary)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="usage-model-grid">
                <div className="usage-chart-section">
                  <h3>Gemini Models</h3>
                  <div className="usage-chart-card">
                    {(usage?.geminiModels || []).length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={usage.geminiModels}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--line)"
                          />
                          <XAxis
                            dataKey="model"
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <YAxis
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="costUsd"
                            fill="var(--chart-primary)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="usage-empty">
                        No Gemini usage recorded in this period.
                      </p>
                    )}
                  </div>
                </div>

                <div className="usage-chart-section">
                  <h3>TAMU Protected Models</h3>
                  <div className="usage-chart-card">
                    {(usage?.tamuModels || []).length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={usage.tamuModels}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--line)"
                          />
                          <XAxis
                            dataKey="model"
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <YAxis
                            tick={{ fill: "var(--muted)", fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="costUsd"
                            fill="var(--chart-compare)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="usage-empty">
                        No TAMU protected-model usage recorded in this period.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
