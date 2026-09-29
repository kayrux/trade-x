import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useTheme } from '../../../context/ThemeContext';
import './ValueChart.css';

// Value-over-time area chart for portfolio / account value. Single-value series
// keyed by date (YYYY-MM-DD), colored green/red by net change over the window,
// with a dashed baseline at the starting value — like the reference.

const COLORS = {
  up: { line: '#22c55e', top: 'rgba(34, 197, 94, 0.28)', bottom: 'rgba(34, 197, 94, 0.02)' },
  down: { line: '#ef4444', top: 'rgba(239, 68, 68, 0.24)', bottom: 'rgba(239, 68, 68, 0.02)' },
};

const AXES = {
  dark: { text: '#e2e8f0', border: '#1e2430', grid: '#1e2430', bg: '#13171f' },
  light: { text: '#0f172a', border: '#e2e8f0', grid: '#eef2f7', bg: '#ffffff' },
};

function ValueChart({ series = [], loading, error }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const baselineRef = useRef(null);
  const { theme } = useTheme();

  const axes = theme === 'dark' ? AXES.dark : AXES.light;

  // Create once; theme + data are applied in their own effects.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: axes.text, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: axes.grid } },
      crosshair: { mode: CrosshairMode.Magnet },
      timeScale: { borderColor: axes.border, fixLeftEdge: true, fixRightEdge: true },
      rightPriceScale: { borderColor: axes.border },
      handleScroll: false,
      handleScale: false,
    });
    const s = chart.addSeries(AreaSeries, { lineWidth: 2, priceLineVisible: false });
    chartRef.current = chart;
    seriesRef.current = s;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      baselineRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: { textColor: axes.text },
      grid: { horzLines: { color: axes.grid } },
      timeScale: { borderColor: axes.border },
      rightPriceScale: { borderColor: axes.border },
    });
  }, [axes]);

  useEffect(() => {
    const s = seriesRef.current;
    const chart = chartRef.current;
    if (!s || !chart) return;

    if (!series.length) {
      s.setData([]);
      return;
    }

    const data = series.map((p) => ({ time: p.date, value: Number(p.value) }));
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const dir = last >= first ? COLORS.up : COLORS.down;

    s.applyOptions({ lineColor: dir.line, topColor: dir.top, bottomColor: dir.bottom });
    s.setData(data);

    // Dashed baseline at the starting value.
    if (baselineRef.current) s.removePriceLine(baselineRef.current);
    baselineRef.current = s.createPriceLine({
      price: first,
      color: axes.border,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
    });

    chart.timeScale().fitContent();
  }, [series, axes]);

  return (
    <div className="value-chart">
      <div ref={containerRef} className="value-chart__canvas" />
      {loading && (
        <div className="value-chart__overlay">
          <span className="value-chart__spinner" />
        </div>
      )}
      {!loading && error && (
        <div className="value-chart__overlay value-chart__overlay--error">
          <p>Couldn’t load chart data.</p>
        </div>
      )}
      {!loading && !error && series.length === 0 && (
        <div className="value-chart__overlay">
          <p className="value-chart__empty">No value history yet.</p>
        </div>
      )}
    </div>
  );
}

export default ValueChart;
