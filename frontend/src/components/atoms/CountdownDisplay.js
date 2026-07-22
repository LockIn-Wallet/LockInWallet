import React from "react";

import { homeStyles } from "../../styles";

const pad = (value) => String(value).padStart(2, "0");

/**
 * CountdownDisplay - PoolTogether-style segmented countdown (dd/hh/mm/ss)
 */
const CountdownDisplay = ({
  secondsRemaining,
  showDays = false,
  showHours = true,
}) => {
  const days = Math.floor(secondsRemaining / 86400);
  const hours = showDays
    ? Math.floor((secondsRemaining % 86400) / 3600)
    : Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const segments = [
    ...(showDays ? [{ value: days, unit: "days" }] : []),
    ...(showHours ? [{ value: hours, unit: "hrs" }] : []),
    { value: minutes, unit: "min" },
    { value: seconds, unit: "sec" },
  ];

  return (
    <div style={homeStyles.countdownRow}>
      {segments.map(({ value, unit }) => (
        <div key={unit} style={homeStyles.countdownSegment}>
          <div style={homeStyles.countdownValue}>{pad(value)}</div>
          <div style={homeStyles.countdownUnit}>{unit}</div>
        </div>
      ))}
    </div>
  );
};

export default CountdownDisplay;
