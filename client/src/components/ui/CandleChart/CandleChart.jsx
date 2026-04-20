import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, CrosshairMode } from "lightweight-charts";
import { useTheme } from "../../../context/ThemeContext";
import "./CandleChart.css";

const DARK_THEME = {
  layout: { background: { color: "#13171f" }, textColor: "#e2e8f0" },
  grid: { vertLines: { color: "#1e2430" }, horzLines: { color: "#1e2430" } },
  crosshair: { mode: CrosshairMode.Normal },
  timeScale: { borderColor: "#1e2430" },
  rightPriceScale: { borderColor: "#1e2430" },
};

const LIGHT_THEME = {
  layout: { background: { color: "#ffffff" }, textColor: "#0f172a" },
  grid: { vertLines: { color: "#e2e8f0" }, horzLines: { color: "#e2e8f0" } },
  crosshair: { mode: CrosshairMode.Normal },
  timeScale: { borderColor: "#e2e8f0" },
  rightPriceScale: { borderColor: "#e2e8f0" },
};

function toChartTime(ts, resolution) {
  if (resolution === "1h") {
    // Lightweight Charts expects Unix seconds for datetime values
    return Math.floor(new Date(ts).getTime() / 1000);
  }
  // Daily/weekly/monthly: use YYYY-MM-DD string
  return ts.split("T")[0];
}

function CandleChart({ candles, resolution, loading, error }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const { theme } = useTheme();

  // Create chart once on mount, destroy on unmount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      ...(theme === "dark" ? DARK_THEME : LIGHT_THEME),
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions(theme === "dark" ? DARK_THEME : LIGHT_THEME);
  }, [theme]);

  // Update data when candles change
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;

    const data = candles.map((c) => ({
      time: toChartTime(c.ts, resolution),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }));

    seriesRef.current.setData(data);
    chartRef.current.timeScale().fitContent();
  }, [candles, resolution]);

  return (
    <div className="candle-chart">
      <div ref={containerRef} className="candle-chart__canvas" />
      {loading && (
        <div className="candle-chart__overlay">
          <span className="candle-chart__spinner" />
        </div>
      )}
      {!loading && error && (
        <div className="candle-chart__overlay candle-chart__overlay--error">
          <p>Failed to load chart data.</p>
        </div>
      )}
      {!loading && !error && candles.length === 0 && (
        <div className="candle-chart__overlay">
          <p className="candle-chart__empty">Loading historical data…</p>
        </div>
      )}
    </div>
  );
}

export default CandleChart;
