import React from "react";

import {
  ALLOCATIONS,
  GOAL_PRESETS,
  totalAllocated,
  rebalanceAllocations,
  formatMoney,
} from "../../utils/futureMirror.js";

// Tailwind can't build class names from variables, so each tone is spelled out
const TONE_CLASSES = {
  risk: { label: "text-red-300", value: "text-red-400", fill: "#ef4444" },
  stable: {
    label: "text-orange-300",
    value: "text-orange-400",
    fill: "#f97316",
  },
  cash: { label: "text-green-300", value: "text-green-400", fill: "#10b981" },
  self: { label: "text-purple-300", value: "text-purple-400", fill: "#8b5cf6" },
};

/**
 * VisualiserInputs - age, income, allocation sliders and the savings goal.
 */
const VisualiserInputs = ({ inputs, onInputsChange }) => {
  const total = totalAllocated(inputs);
  const unallocated = Math.max(0, 1 - total);

  const setField = (field, value) =>
    onInputsChange({ ...inputs, [field]: value });

  const setAllocation = (field, value) =>
    onInputsChange(rebalanceAllocations(inputs, field, parseFloat(value)));

  const totalColor =
    total > 1
      ? "text-red-400"
      : total >= 0.9
        ? "text-green-400"
        : "text-yellow-400";

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-1 text-center">
        🏃 Freedom run simulator
      </h2>
      <p className="text-slate-400 text-sm text-center mb-6">
        See how your allocation choices ripple across decades
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label
            className="block text-sm font-medium text-slate-300 mb-2"
            htmlFor="visualiser-age"
          >
            Current age: {inputs.ageStart}
          </label>
          <input
            id="visualiser-age"
            type="range"
            min="18"
            max="50"
            value={inputs.ageStart}
            onChange={(event) =>
              setField("ageStart", parseInt(event.target.value, 10))
            }
            className="fm-slider"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>18</span>
            <span>50</span>
          </div>
        </div>

        <div>
          <label
            className="block text-sm font-medium text-slate-300 mb-2"
            htmlFor="visualiser-income"
          >
            Monthly savings
          </label>
          <input
            id="visualiser-income"
            type="number"
            min="0"
            value={Math.round(inputs.annualIncome / 12)}
            onChange={(event) =>
              setField(
                "annualIncome",
                (parseInt(event.target.value, 10) || 0) * 12
              )
            }
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="2500"
          />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-4">
        💰 Portfolio allocation
      </h3>

      {ALLOCATIONS.map((allocation) => {
        const value = inputs[allocation.field];
        const tone = TONE_CLASSES[allocation.tone];
        const filled = (value / allocation.max) * 100;

        return (
          <div key={allocation.field} className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label
                className={`text-sm font-medium ${tone.label}`}
                htmlFor={`alloc-${allocation.field}`}
              >
                {allocation.emoji} {allocation.label}
                <span className="block text-xs text-slate-500 font-normal">
                  {allocation.sublabel}
                </span>
              </label>
              <span className={`font-bold ${tone.value}`}>
                {Math.round(value * 100)}%
              </span>
            </div>
            <input
              id={`alloc-${allocation.field}`}
              type="range"
              min="0"
              max={allocation.max}
              step="0.05"
              value={value}
              onChange={(event) =>
                setAllocation(allocation.field, event.target.value)
              }
              className="fm-slider"
              style={{
                background: `linear-gradient(to right, ${tone.fill} 0%, ${tone.fill} ${filled}%, #475569 ${filled}%, #475569 100%)`,
                height: "8px",
                borderRadius: "4px",
              }}
            />
            <div className="text-xs text-slate-400 mt-1">{allocation.hint}</div>
          </div>
        );
      })}

      <div className="bg-slate-700/50 p-3 rounded-lg mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-slate-300">Total allocated:</span>
          <span className={`font-bold ${totalColor}`}>
            {Math.round(total * 100)}%
          </span>
        </div>
        {unallocated > 0 && (
          <div className="text-xs text-slate-400 mt-1">
            {Math.round(unallocated * 100)}% unallocated (lifestyle spending)
          </div>
        )}
        {total > 1 && (
          <div className="text-xs text-red-400 mt-1">
            ⚠️ Over-allocated! Adjust the sliders above
          </div>
        )}
      </div>

      <div>
        <label
          className="block text-sm font-medium text-slate-300 mb-2"
          htmlFor="visualiser-goal"
        >
          🎯 Savings goal
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {GOAL_PRESETS.map((goal) => (
            <button
              key={goal.value}
              type="button"
              onClick={() => setField("goalAmount", goal.value)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                inputs.goalAmount === goal.value
                  ? "bg-teal-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {goal.label}
              <div className="opacity-75">{formatMoney(goal.value)}</div>
            </button>
          ))}
        </div>
        <input
          id="visualiser-goal"
          type="number"
          min="0"
          value={inputs.goalAmount}
          onChange={(event) =>
            setField("goalAmount", parseInt(event.target.value, 10) || 0)
          }
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="500000"
        />
      </div>
    </div>
  );
};

export default VisualiserInputs;
