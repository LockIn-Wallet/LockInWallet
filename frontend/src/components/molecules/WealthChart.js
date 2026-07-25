import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { formatMoney } from "../../utils/futureMirror.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SERIES = [
  {
    key: "cash",
    label: "💵 TradFi (Cash/Bonds)",
    tileLabel: "💵 TradFi",
    line: "rgb(16, 185, 129)",
    fill: "rgba(16, 185, 129, 0.8)",
    tile: "text-green-400",
  },
  {
    key: "stable",
    label: "₿ Stable Crypto (BTC/ETH)",
    tileLabel: "₿ Stable",
    line: "rgb(249, 115, 22)",
    fill: "rgba(249, 115, 22, 0.8)",
    tile: "text-orange-400",
  },
  {
    key: "risky",
    label: "🎲 Risky Trades (Degen)",
    tileLabel: "🎲 Risky",
    line: "rgb(239, 68, 68)",
    fill: "rgba(239, 68, 68, 0.8)",
    tile: "text-red-400",
  },
];

const AXIS = "rgb(148, 163, 184)";
const GRID = "rgba(148, 163, 184, 0.1)";

/**
 * WealthChart - stacked portfolio growth across the simulated years, with the
 * total plotted on top and life-quality detail in the tooltip.
 */
const WealthChart = ({ timeline, goalAmount }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          📈 Portfolio growth over time
        </h3>
        <div className="h-64 flex items-center justify-center text-slate-400">
          Adjust the inputs to see your projection
        </div>
      </div>
    );
  }

  const sleeplessYears = timeline.filter((year) => year.sleeplessNight).length;
  const last = timeline[timeline.length - 1];

  const data = {
    labels: timeline.map((year) => year.age),
    datasets: [
      ...SERIES.map((series) => ({
        label: series.label,
        data: timeline.map((year) => year[series.key]),
        backgroundColor: series.fill,
        borderColor: series.line,
        borderWidth: 1,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        stack: "portfolio",
      })),
      {
        label: "Total portfolio value",
        data: timeline.map((year) => year.totalWealth),
        borderColor: "rgb(20, 184, 166)",
        backgroundColor: "rgba(20, 184, 166, 0.1)",
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointRadius: 1,
        pointHoverRadius: 6,
        pointBackgroundColor: "rgb(20, 184, 166)",
        type: "line",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "rgb(203, 213, 225)",
          usePointStyle: true,
          pointStyle: "line",
          font: { size: 12, weight: "bold" },
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgba(20, 184, 166, 0.5)",
        borderWidth: 1,
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${formatMoney(context.parsed.y)}`,
          afterBody: (items) => {
            const year = timeline[items[0].dataIndex];
            if (!year) return [];

            const extra = [];
            if (year.goalAchieved) extra.push(`🎯 Goal reached by ${year.age}`);
            if (year.sleeplessNight) {
              extra.push(`😵‍💫 Sleepless year (stress ${year.stress})`);
            }
            extra.push(`❤️ Health: ${year.health}/100`);
            extra.push(`🙂 Happiness: ${year.happiness}/100`);
            return extra;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Age",
          color: AXIS,
          font: { size: 14, weight: "bold" },
        },
        ticks: { color: AXIS },
        grid: { color: GRID },
      },
      y: {
        title: {
          display: true,
          text: "Wealth ($)",
          color: AXIS,
          font: { size: 14, weight: "bold" },
        },
        ticks: { color: AXIS, callback: (value) => formatMoney(value) },
        grid: { color: GRID },
      },
    },
    interaction: { mode: "nearest", axis: "x", intersect: false },
    animation: { duration: 800, easing: "easeInOutQuart" },
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          📈 Portfolio growth over time
        </h3>
        {sleeplessYears > 0 && (
          <div className="flex items-center gap-2 text-red-400">
            <span className="animate-pulse">😵‍💫</span>
            <span className="text-sm">{sleeplessYears} sleepless years</span>
          </div>
        )}
      </div>

      <div className="fm-chart mb-4">
        <Line data={data} options={options} />
      </div>

      {goalAmount > 0 && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-4">
          <span className="inline-block w-4 h-0.5 bg-yellow-500" />
          <span>Goal: {formatMoney(goalAmount)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {SERIES.map((series) => (
          <div key={series.key} className="bg-slate-700 p-3 rounded-lg">
            <div className={`font-semibold text-sm ${series.tile}`}>
              {series.tileLabel}
            </div>
            <div className="text-white text-lg font-bold">
              {formatMoney(last[series.key])}
            </div>
          </div>
        ))}
        <div className="bg-slate-700 p-3 rounded-lg border-2 border-teal-500">
          <div className="text-teal-400 font-semibold text-sm">💎 Total</div>
          <div className="text-white text-lg font-bold">
            {formatMoney(last.totalWealth)}
          </div>
        </div>
      </div>

      {sleeplessYears > 0 && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
          <div className="text-red-400 text-sm text-center">
            💡 <strong>APY of peace &gt; APY of panic</strong> — high stress
            cost you {sleeplessYears} years of quality sleep
          </div>
        </div>
      )}
    </div>
  );
};

export default WealthChart;
