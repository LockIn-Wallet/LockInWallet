import React, { useEffect, useState } from "react";

import { homeStyles } from "../../styles";

import { randomPrizeEvent, formatUSD } from "../../utils/homeDemo.js";

const ROTATE_MS = 4200;

/**
 * WinnerTicker - simulated live feed of prize winners, PoolTogether style.
 * A new winner pops in every few seconds with a small entrance animation.
 */
const WinnerTicker = () => {
  const [event, setEvent] = useState(() => randomPrizeEvent());
  const [tickKey, setTickKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvent(randomPrizeEvent());
      setTickKey((key) => key + 1);
    }, ROTATE_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={homeStyles.tickerBox}>
      <div style={homeStyles.tickerLabel}>Winner feed (simulated)</div>
      <span key={tickKey} className="home-winner-pop" style={homeStyles.tickerEntry}>
        {event.tier.emoji} {event.handle} just won{" "}
        <span style={homeStyles.tickerAmount}>{formatUSD(event.amount)}</span>{" "}
        in the {event.tier.label} — deposit untouched
      </span>
    </div>
  );
};

export default WinnerTicker;
