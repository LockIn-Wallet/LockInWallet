import React from "react";

import {
  freedomMetrics,
  presentValue,
  formatMoney,
} from "../../utils/futureMirror.js";

const barClass = (percent) => {
  if (percent >= 100) return "bg-gradient-to-r from-green-500 to-green-400";
  if (percent >= 75) return "bg-gradient-to-r from-teal-500 to-teal-400";
  if (percent >= 50) return "bg-gradient-to-r from-yellow-500 to-yellow-400";
  return "bg-gradient-to-r from-red-500 to-red-400";
};

/**
 * GoalProgress - did the projection reach the savings goal, and what does
 * the resulting pot actually pay out each month.
 */
const GoalProgress = ({ result, inputs }) => {
  if (!result) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          🎯 Life goal progress
        </h3>
        <div className="text-slate-400 text-center py-8">
          Adjust the inputs to see your goal progress
        </div>
      </div>
    );
  }

  const { finalWealth, goalAchievedAge, yearsToGoal } = result;
  const freedom = freedomMetrics(finalWealth, inputs.annualIncome);
  const years = inputs.ageEnd - inputs.ageStart;
  const progress = Math.min((finalWealth / inputs.goalAmount) * 100, 100);

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-6">
        🎯 Life goal progress
      </h3>

      <div className="mb-6">
        {goalAchievedAge ? (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎉</span>
              <span className="text-green-400 font-semibold">
                Goal achieved!
              </span>
            </div>
            <div className="text-white text-sm">
              <div>
                Years until goal:{" "}
                <span className="font-bold text-green-400">
                  {yearsToGoal} years
                </span>
              </div>
              <div>
                Age when reached:{" "}
                <span className="font-bold text-green-400">
                  {goalAchievedAge}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⏰</span>
              <span className="text-yellow-400 font-semibold">
                Goal in progress
              </span>
            </div>
            <div className="text-white text-sm">
              <div>
                By age {inputs.ageEnd} you'd have {formatMoney(finalWealth)}
              </div>
              <div>Consider increasing your savings rate</div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-300 font-medium">Progress to goal</span>
          <span className="text-white font-bold">{progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-out ${barClass(
              progress
            )}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>$0</span>
          <span>{formatMoney(inputs.goalAmount)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <div className="text-slate-400 text-sm mb-1">
            Wealth at retirement ({inputs.ageEnd})
          </div>
          <div className="text-white text-xl font-bold">
            {formatMoney(finalWealth)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            ({formatMoney(presentValue(finalWealth, years))} in today's money)
          </div>
        </div>
        <div className="bg-slate-700 p-4 rounded-lg">
          <div className="text-slate-400 text-sm mb-1">
            Monthly passive income
          </div>
          <div className="text-white text-xl font-bold">
            {formatMoney(freedom.monthlyPassiveIncome)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            ({formatMoney(presentValue(freedom.monthlyPassiveIncome, years))} in
            today's money)
          </div>
          <div className="text-xs text-slate-400 mt-1">
            4% withdrawal rule
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-300 font-medium">
            Financial freedom score
          </span>
          <span className="text-white font-bold">
            {freedom.freedomScore}/100
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${barClass(
              freedom.freedomScore
            )}`}
            style={{ width: `${freedom.freedomScore}%` }}
          />
        </div>
        <div className="text-xs text-slate-400 mt-1">
          {freedom.canRetire
            ? "✅ Can cover monthly expenses with passive income"
            : "❌ Passive income insufficient for full retirement"}
        </div>
      </div>

      <div className="bg-slate-700 p-4 rounded-lg">
        <div className="text-slate-300 font-medium mb-2">💡 Insights</div>
        <div className="text-sm text-slate-400 space-y-1">
          <div>• Can cover {freedom.yearsOfExpenses} years of expenses</div>
          <div>• Freedom score represents financial independence level</div>
          {!goalAchievedAge && (
            <div className="text-yellow-400">
              • Consider increasing savings rate to reach goal sooner
            </div>
          )}
          {freedom.canRetire && (
            <div className="text-green-400">
              • Congratulations! You can retire comfortably
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalProgress;
