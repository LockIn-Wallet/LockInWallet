import React, { useMemo, useState } from "react";

import VisualiserInputs from "../molecules/VisualiserInputs.js";
import ScenarioComparison from "../molecules/ScenarioComparison.js";
import WealthChart from "../molecules/WealthChart.js";
import GoalProgress from "../molecules/GoalProgress.js";
import FutureSelfSnapshot from "../molecules/FutureSelfSnapshot.js";

import "../../styles/visualiser.css";

import {
  DEFAULT_INPUTS,
  PRESET_SCENARIOS,
  simulateFuture,
} from "../../utils/futureMirror.js";

/**
 * SavingsVisualiser - projects decades of saving under a chosen allocation,
 * ported from the FutureMirror project. The simulation is deterministic, so
 * the same inputs always draw the same future.
 *
 * Styled with Tailwind (scoped in tailwind.config.js) rather than the app-wide
 * token system, to keep the upstream design intact. The `.fm-page` wrapper
 * carries a scoped reset, so the component is self-contained wherever it is
 * mounted.
 *
 * Props:
 *   compact  - drop the deep-dive panels and show a CTA instead. Used for the
 *              homepage embed, where the full dashboard would run too long.
 *   title    - heading override
 *   subtitle - sub-heading override
 */
const SavingsVisualiser = ({
  compact = false,
  title = "🔮 Savings Visualiser",
  subtitle = "See your life before it gets rekt.",
}) => {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [scenario, setScenario] = useState("balanced");

  // Deterministic, so recomputing on every change is free of surprises
  const result = useMemo(() => simulateFuture(inputs), [inputs]);

  // Every preset projected against the current income and goal, so the
  // comparison cards are filled in before you click them
  const resultsByScenario = useMemo(
    () =>
      PRESET_SCENARIOS.reduce((all, preset) => {
        all[preset.key] = simulateFuture({ ...inputs, ...preset.allocation });
        return all;
      }, {}),
    [inputs]
  );

  const handleScenarioChange = (key) => {
    const preset = PRESET_SCENARIOS.find((item) => item.key === key);
    if (!preset) return;

    setScenario(key);
    setInputs((current) => ({ ...current, ...preset.allocation }));
  };

  // Editing a slider by hand no longer matches a preset
  const handleInputsChange = (next) => {
    setInputs(next);

    const matching = PRESET_SCENARIOS.find((preset) =>
      Object.entries(preset.allocation).every(
        ([field, value]) => next[field] === value
      )
    );
    setScenario(matching ? matching.key : null);
  };

  return (
    <div className="fm-page">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          {title}
        </h2>
        <p className="text-lg text-slate-300 mb-2">{subtitle}</p>
        <p className="text-xs text-slate-500">
          Illustrative projections, not financial advice.
        </p>
      </div>

      {compact ? (
        /* Narrow embed: lead with the chart, controls underneath side by side */
        <div className="space-y-6">
          <WealthChart
            timeline={result.timeline}
            goalAmount={inputs.goalAmount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <VisualiserInputs
              inputs={inputs}
              onInputsChange={handleInputsChange}
            />
            <ScenarioComparison
              currentScenario={scenario}
              onScenarioChange={handleScenarioChange}
              resultsByScenario={resultsByScenario}
            />
          </div>
        </div>
      ) : (
        /* Full page: controls rail on the left, results on the right */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1 space-y-6">
            <VisualiserInputs
              inputs={inputs}
              onInputsChange={handleInputsChange}
            />
            <ScenarioComparison
              currentScenario={scenario}
              onScenarioChange={handleScenarioChange}
              resultsByScenario={resultsByScenario}
            />
          </div>

          <div className="xl:col-span-2 space-y-6">
            <WealthChart
              timeline={result.timeline}
              goalAmount={inputs.goalAmount}
            />
            <GoalProgress result={result} inputs={inputs} />
            <FutureSelfSnapshot result={result} inputs={inputs} />
          </div>
        </div>
      )}

      {compact && (
        <div className="mt-8 text-center">
          <a
            href="/savings-visualiser"
            className="inline-block px-6 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg"
          >
            Open the full visualiser →
          </a>
          <p className="text-slate-400 text-sm mt-3">
            Goal progress, passive income and your future-self comparison
          </p>
        </div>
      )}

      <div className="mt-12 text-center">
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-3">💡 The real alpha</h3>
          <p className="text-slate-300 text-sm leading-relaxed max-w-4xl mx-auto">
            Crank the risk slider and wealth might spike — but health and income
            growth collapse with it. Put that share into yourself instead and
            the curve starts slower, then compounds far harder.
            <span className="text-teal-400 font-semibold">
              {" "}
              "Invest in self" grows slower short-term, but compounds way harder
              later.
            </span>
          </p>
          <div className="mt-4 flex justify-center items-center gap-4 text-xs text-slate-400 flex-wrap">
            <span>🔥 Stablecoins are for your wallet</span>
            <span>•</span>
            <span>💤 Stability is for your mind</span>
            <span>•</span>
            <span>📈 The hard part is still holding it in five years</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavingsVisualiser;
