import React, { useEffect, useRef, useState } from "react";

import CountdownDisplay from "../atoms/CountdownDisplay.js";
import ConfettiBurst from "../atoms/ConfettiBurst.js";

import { homeStyles } from "../../styles";

import {
  secondsUntilBoundary,
  prizePoolValue,
  prizePayoutValue,
  randomWinner,
  formatUSD,
} from "../../utils/homeDemo.js";

const CELEBRATION_MS = 8000;
const TICK_MS = 1000;

/**
 * PrizeCountdownCard - one prize tier (hourly/daily/weekly) with a growing
 * prize pool and a live countdown. When the countdown crosses zero, a
 * simulated winner celebration plays before the next draw starts.
 */
const PrizeCountdownCard = ({ tier }) => {
  const [now, setNow] = useState(() => new Date());
  const [celebration, setCelebration] = useState(null);
  const prevSecondsRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      const secondsLeft = secondsUntilBoundary(tier.boundary, current);
      const previous = prevSecondsRef.current;
      prevSecondsRef.current = secondsLeft;

      // Countdown jumped back up → period boundary crossed → draw happened
      if (previous !== null && secondsLeft > previous) {
        setCelebration({
          handle: randomWinner(),
          amount: prizePayoutValue(tier),
        });
      }
      setNow(current);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [tier]);

  useEffect(() => {
    if (!celebration) {
      return undefined;
    }
    const timer = setTimeout(() => setCelebration(null), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [celebration]);

  const secondsLeft = secondsUntilBoundary(tier.boundary, now);
  const pool = prizePoolValue(tier, now);

  const cardStyle = tier.grand
    ? { ...homeStyles.prizeCard, ...homeStyles.prizeCardGrand }
    : homeStyles.prizeCard;

  const poolStyle = tier.grand
    ? { ...homeStyles.poolAmount, ...homeStyles.poolAmountGrand }
    : homeStyles.poolAmount;

  return (
    <div style={cardStyle} className={tier.grand ? "home-glow" : undefined}>
      {celebration && <ConfettiBurst />}

      <p style={homeStyles.prizeTierLabel}>
        {tier.emoji} {tier.label}
      </p>
      <p style={homeStyles.prizeTierBlurb}>{tier.blurb}</p>

      {celebration ? (
        <div style={homeStyles.winnerOverlay} className="home-winner-pop">
          <p style={homeStyles.winnerText}>
            🎉 {celebration.handle} won {formatUSD(celebration.amount)}!
          </p>
          <p style={homeStyles.countdownCaption}>
            Next draw is already filling up…
          </p>
        </div>
      ) : (
        <>
          <p style={poolStyle} className={tier.grand ? "home-pulse" : undefined}>
            {formatUSD(pool, true)}
          </p>
          <CountdownDisplay
            secondsRemaining={secondsLeft}
            showDays={tier.boundary === "week"}
            showHours={tier.boundary !== "hour"}
          />
          <p style={homeStyles.countdownCaption}>
            until the next winner is drawn
          </p>
        </>
      )}
    </div>
  );
};

export default PrizeCountdownCard;
