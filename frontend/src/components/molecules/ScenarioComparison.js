import React from "react";

import {
  PRESET_SCENARIOS,
  ALLOCATIONS,
  formatMoney,
} from "../../utils/futureMirror.js";

/**
 * ScenarioComparison - preset allocation strategies with their outcomes,
 * so you can flip between them and watch the projection change.
 */
const ScenarioComparison = ({
  currentScenario,
  onScenarioChange,
  resultsByScenario,
}) => (
  <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
    <h3 className="text-lg font-semibold text-white mb-1 text-center">
      🔁 Compare life scenarios
    </h3>
    <p className="text-slate-400 text-sm text-center mb-6">
      Same income, different strategies. Pick one to load it.
    </p>

    <div className="grid grid-cols-1 gap-4">
      {PRESET_SCENARIOS.map((scenario) => {
        const result = resultsByScenario[scenario.key];
        const isActive = scenario.key === currentScenario;

        return (
          <button
            key={scenario.key}
            type="button"
            onClick={() => onScenarioChange(scenario.key)}
            className={`p-4 rounded-lg border-2 transition-all duration-200 text-center ${
              isActive
                ? "bg-purple-600 text-white border-purple-500 shadow-lg"
                : "bg-slate-700 text-white border-slate-600 hover:bg-slate-600 hover:border-slate-500"
            }`}
          >
            <div className="text-3xl mb-1">{scenario.emoji}</div>
            <div className="text-lg font-bold">{scenario.label}</div>
            <div className="text-sm opacity-75 mb-3">
              {scenario.description}
            </div>

            <div className="text-xs opacity-75">
              {ALLOCATIONS.map((allocation) => (
                <span key={allocation.field} className="mr-2">
                  {allocation.emoji}{" "}
                  {Math.round(scenario.allocation[allocation.field] * 100)}%
                </span>
              ))}
            </div>

            {result && (
              <>
                <div className="border-t border-current opacity-20 my-3" />
                <div className="text-xs opacity-75">
                  Wealth at {result.timeline[result.timeline.length - 1].age}
                </div>
                <div className="font-bold text-lg">
                  {formatMoney(result.finalWealth)}
                </div>
                <div className="text-xs opacity-75">
                  {result.yearsToGoal
                    ? `🎯 Goal in ${result.yearsToGoal} years`
                    : "🎯 Goal not reached"}
                </div>
                {result.sleeplessYears > 0 && (
                  <div className="text-xs text-red-300 mt-1">
                    😵‍💫 {result.sleeplessYears} sleepless years
                  </div>
                )}
              </>
            )}

            {isActive && (
              <div className="mt-3">
                <span className="inline-flex items-center px-2 py-1 bg-white/10 rounded-full text-xs">
                  <span className="w-2 h-2 bg-current rounded-full mr-1" />
                  Active
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>

    <p className="text-slate-400 text-sm text-center mt-4">
      💡{" "}
      <span className="text-purple-400 font-semibold">
        The most bullish position is 8 hours of sleep
      </span>
    </p>
  </div>
);

export default ScenarioComparison;
