import React from "react";

import {
  freedomMetrics,
  stressLevel,
  sleepQuality,
  outcomeFor,
  presentValue,
  formatMoney,
} from "../../utils/futureMirror.js";

const scoreText = (score) => {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
};

const scoreBar = (score) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

const SLEEP_TONE = {
  bad: "text-red-400",
  warn: "text-orange-400",
  mild: "text-yellow-400",
  good: "text-green-400",
};

const ScoreRow = ({ label, score }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      <span className={`font-bold ${scoreText(score)}`}>{score}/100</span>
      <div className="w-16 bg-slate-600 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${scoreBar(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  </div>
);

const SelfPanel = ({ title, tone, profile, years }) => {
  const outcome = outcomeFor({
    wealth: profile.wealth,
    freedom: profile.freedom.freedomScore,
    stress: profile.stress,
    health: profile.health,
    sleeplessRatio: years > 0 ? profile.sleeplessYears / years : 0,
  });
  const sleep = sleepQuality(profile.sleeplessYears, years);

  const isSaver = tone === "saver";
  const panelClass = isSaver
    ? "bg-gradient-to-br from-green-900/20 to-teal-900/20 border border-green-700/50"
    : "bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-700/50";

  return (
    <div className={`${panelClass} rounded-lg p-6`}>
      <div className="text-center mb-4">
        <div className="text-4xl mb-2">{outcome.emoji}</div>
        <h4
          className={`text-xl font-bold mb-1 ${
            isSaver ? "text-green-400" : "text-red-400"
          }`}
        >
          {title}
        </h4>
        <p className={`text-sm ${isSaver ? "text-green-300" : "text-red-300"}`}>
          {outcome.title}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-300">💰 Final wealth</span>
          <span className="text-white font-bold text-lg">
            {formatMoney(profile.wealth)}
          </span>
        </div>

        <ScoreRow label="❤️ Health score" score={profile.health} />
        <ScoreRow label="🕊️ Freedom score" score={profile.freedom.freedomScore} />

        <div className="flex justify-between items-center">
          <span className="text-slate-300">😴 Sleep quality</span>
          <span className={`font-bold ${SLEEP_TONE[sleep.tone]}`}>
            {sleep.emoji} {sleep.label}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-300">💳 Monthly passive income</span>
          <div className="text-right">
            <div
              className={`font-bold ${
                isSaver ? "text-green-400" : "text-red-400"
              }`}
            >
              {formatMoney(profile.freedom.monthlyPassiveIncome)}
            </div>
            <div className="text-xs text-slate-400">
              (
              {formatMoney(
                presentValue(profile.freedom.monthlyPassiveIncome, years)
              )}{" "}
              in today's money)
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
        <p className="text-sm text-slate-300 leading-relaxed">
          {outcome.message}
        </p>
      </div>
    </div>
  );
};

/**
 * FutureSelfSnapshot - your projected self against the same person who put
 * everything into risky trades instead.
 */
const FutureSelfSnapshot = ({ result, inputs }) => {
  if (!result) {
    return (
      <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          🪞 Future self snapshot
        </h3>
        <div className="text-slate-400 text-center py-8">
          Adjust the inputs to compare your futures
        </div>
      </div>
    );
  }

  const { finalWealth, finalRisky, avgStress, avgHealth, sleeplessYears } =
    result;
  const years = inputs.ageEnd - inputs.ageStart;

  const yourSelf = {
    wealth: finalWealth,
    freedom: freedomMetrics(finalWealth, inputs.annualIncome),
    stress: avgStress,
    health: avgHealth,
    sleeplessYears,
  };

  const gamblerStress = Math.round(stressLevel(0.7, finalRisky));
  const gamblerSelf = {
    wealth: finalRisky,
    freedom: freedomMetrics(finalRisky, inputs.annualIncome),
    stress: gamblerStress,
    health: Math.max(20, 100 - gamblerStress),
    sleeplessYears: Math.round(years * 0.6),
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-1">
        🪞 Future self snapshot
      </h3>
      <p className="text-slate-400 text-sm mb-6">
        Your allocation on the left. The same income with everything on red,
        for comparison.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SelfPanel
          title="Consistent saver"
          tone="saver"
          profile={yourSelf}
          years={years}
        />
        <SelfPanel
          title="High-risk gambler"
          tone="gambler"
          profile={gamblerSelf}
          years={years}
        />
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-teal-900/30 to-blue-900/30 border border-teal-700/50 rounded-lg text-center">
        <p className="text-white font-semibold mb-2">
          💡 High risk or no savings → high stress → sleep issues → health
          problems
        </p>
        <p className="text-slate-300 text-sm">
          Left: chasing charts. Right: becoming the chart.
          <span className="text-purple-400 font-semibold">
            {" "}
            Sleep = staking. Learning = yield. Discipline = protocol security.
          </span>
        </p>
      </div>
    </div>
  );
};

export default FutureSelfSnapshot;
