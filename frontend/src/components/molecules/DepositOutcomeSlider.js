import React, { useState } from "react";

import { homeStyles } from "../../styles";

import {
  depositFromSlider,
  weeklyWinOdds,
  yearlyPrizeEstimate,
  formatUSD,
  DEMO_GRAND_PRIZE,
} from "../../utils/homeDemo.js";

const DEFAULT_SLIDER_VALUE = 50; // ≈ $7,100

/**
 * DepositOutcomeSlider - interactive "what if I locked $X" demo showing
 * the no-loss guarantee: worst case you keep everything, best case you
 * win the grand prize.
 */
const DepositOutcomeSlider = () => {
  const [sliderValue, setSliderValue] = useState(DEFAULT_SLIDER_VALUE);

  const deposit = depositFromSlider(sliderValue);
  const odds = weeklyWinOdds(deposit);
  const yearlyPrizes = yearlyPrizeEstimate(deposit);

  return (
    <div style={homeStyles.sliderBox}>
      <p style={homeStyles.sliderLabel}>
        💰 Try it — how much would you lock in?
      </p>
      <p style={homeStyles.sliderDeposit}>{formatUSD(deposit)}</p>
      <input
        type="range"
        min="0"
        max="100"
        value={sliderValue}
        onChange={(e) => setSliderValue(Number(e.target.value))}
        style={homeStyles.sliderInput}
        aria-label="Deposit amount"
      />

      <div style={homeStyles.outcomeRow}>
        <div style={homeStyles.outcomeCard}>
          <div style={homeStyles.outcomeTitle}>Worst case</div>
          <div style={homeStyles.outcomeValue}>{formatUSD(deposit)}</div>
          <p style={homeStyles.outcomeNote}>
            You keep every cent. Prizes come from pooled yield — never from
            deposits.
          </p>
        </div>

        <div style={homeStyles.outcomeCard}>
          <div style={homeStyles.outcomeTitle}>Average prizes / year</div>
          <div style={homeStyles.outcomeValue}>≈ {formatUSD(yearlyPrizes)}</div>
          <p style={homeStyles.outcomeNote}>
            Long-run expectation at ~4% pool yield paid out as prizes.
          </p>
        </div>

        <div style={{ ...homeStyles.outcomeCard, ...homeStyles.outcomeCardBest }}>
          <div style={homeStyles.outcomeTitle}>Best case</div>
          <div style={homeStyles.outcomeValue}>
            +{formatUSD(DEMO_GRAND_PRIZE)} 🏆
          </div>
          <p style={homeStyles.outcomeNote}>
            The weekly grand prize — roughly 1 in {odds.toLocaleString("en-US")}{" "}
            each week at this deposit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DepositOutcomeSlider;
