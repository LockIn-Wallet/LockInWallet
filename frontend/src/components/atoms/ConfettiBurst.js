import React from "react";

import { homeStyles, getConfettiPieceStyle } from "../../styles";

/**
 * ConfettiBurst - continuous confetti rain overlay for winner celebrations.
 * Parent element must be position: relative with overflow: hidden.
 */
const ConfettiBurst = ({ pieces = 14 }) => (
  <div style={homeStyles.confettiContainer}>
    {Array.from({ length: pieces }, (_, index) => (
      <span
        key={index}
        className="home-confetti"
        style={getConfettiPieceStyle(index)}
      />
    ))}
  </div>
);

export default ConfettiBurst;
