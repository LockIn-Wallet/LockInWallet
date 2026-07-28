import React from "react";

import PrizeCountdownCard from "../molecules/PrizeCountdownCard.js";
import WinnerTicker from "../molecules/WinnerTicker.js";

import { homeStyles } from "../../styles";

import { PRIZE_TIERS } from "../../utils/homeDemo.js";
import { HOW_IT_WORKS_STEPS } from "../../utils/prizeSavingsContent.js";

const grandTier = PRIZE_TIERS.find((tier) => tier.grand);
const regularTiers = PRIZE_TIERS.filter((tier) => !tier.grand);

/**
 * PrizeSavingsShowcase - explains the opt-in PoolTogether-style no-loss
 * prize savings with live countdowns and a simulated winner feed.
 *
 * The "what if I locked $X" simulation is a section of its own on the prize
 * savings page, so it is not rendered here.
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

    <p style={homeStyles.captionText}>
      Prize figures are a simulated demo for illustration. Real draws are
      executed on-chain and depend on live pool size and yield.
    </p>
  </div>
);

export default PrizeSavingsShowcase;
