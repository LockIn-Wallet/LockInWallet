import React from "react";

import PrizeCountdownCard from "../molecules/PrizeCountdownCard.js";
import WinnerTicker from "../molecules/WinnerTicker.js";
import DepositOutcomeSlider from "../molecules/DepositOutcomeSlider.js";

import { homeStyles } from "../../styles";

import { PRIZE_TIERS } from "../../utils/homeDemo.js";

const HOW_IT_WORKS_STEPS = [
  {
    emoji: "🔒",
    text: "Lock your savings, then opt in to the prize pool with one click.",
  },
  {
    emoji: "🌱",
    text: "Pooled deposits earn yield. The yield — not your money — becomes the prizes.",
  },
  {
    emoji: "🎉",
    text: "Winners are drawn hourly, daily and weekly. Don't win? You lose nothing.",
  },
];

const grandTier = PRIZE_TIERS.find((tier) => tier.grand);
const regularTiers = PRIZE_TIERS.filter((tier) => !tier.grand);

/**
 * PrizeSavingsShowcase - explains the opt-in PoolTogether-style no-loss
 * prize savings with live countdowns, a simulated winner feed, and an
 * interactive deposit slider.
 */
const PrizeSavingsShowcase = () => (
  <div style={homeStyles.section}>
    <p style={homeStyles.sectionSubtitle}>
      A savings lottery where the ticket is free: the pool&apos;s interest is
      paid out as prizes, and your deposit is always yours to withdraw. Worst
      case you win nothing — you never lose a cent.
    </p>

    <div style={homeStyles.stepsRow}>
      {HOW_IT_WORKS_STEPS.map((step) => (
        <div key={step.emoji} style={homeStyles.stepCard}>
          <div style={homeStyles.stepEmoji}>{step.emoji}</div>
          <p style={homeStyles.stepText}>{step.text}</p>
        </div>
      ))}
    </div>

    <div style={homeStyles.prizeGrid}>
      <PrizeCountdownCard tier={grandTier} />
      {regularTiers.map((tier) => (
        <PrizeCountdownCard key={tier.key} tier={tier} />
      ))}
    </div>

    <WinnerTicker />

    <DepositOutcomeSlider />

    <p style={homeStyles.captionText}>
      Prize figures are a simulated demo for illustration. Real draws are
      executed on-chain and depend on live pool size and yield.
    </p>
  </div>
);

export default PrizeSavingsShowcase;
