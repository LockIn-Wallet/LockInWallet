import React from "react";

// Inline marks so the homepage never reaches out to a CDN for a logo.
// viewBox is normalised to 0 0 32 32 for every chain.
const CHAIN_MARKS = {
  // Added with the Base rollout. Without a mark here the card renders no logo
  // at all, which is how it shipped — `ChainLogo` returns null for a chain it
  // does not know, silently.
  base: {
    background: "#0052FF",
    render: (
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="#ffffff" strokeWidth="3.2" />
    ),
  },
  optimism: {
    background: "#FF0420",
    render: (
      <text
        x="16"
        y="17"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="12"
        fontWeight="bold"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        OP
      </text>
    ),
  },
  ethereum: {
    background: "#627EEA",
    render: (
      <g fill="#ffffff">
        <path fillOpacity="0.65" d="M16 4v8.9l7.5 3.3L16 4Z" />
        <path d="M16 4 8.5 16.2 16 12.9V4Z" />
        <path fillOpacity="0.65" d="M16 22.0v6L23.5 17.6 16 22.0Z" />
        <path d="M16 28v-6l-7.5-4.4L16 28Z" />
        <path fillOpacity="0.4" d="M16 20.6l7.5-4.4L16 12.9v7.7Z" />
        <path fillOpacity="0.8" d="M8.5 16.2 16 20.6v-7.7l-7.5 3.3Z" />
      </g>
    ),
  },
  solana: {
    background: "#131313",
    render: (
      <g fill="url(#solanaGradient)">
        <defs>
          <linearGradient id="solanaGradient" x1="4" y1="26" x2="28" y2="6">
            <stop offset="0%" stopColor="#00FFA3" />
            <stop offset="100%" stopColor="#DC1FFF" />
          </linearGradient>
        </defs>
        <path d="M9.1 20.8c.2-.2.4-.3.7-.3h17.4c.4 0 .6.5.3.8l-3.4 3.4c-.2.2-.4.3-.7.3H6c-.4 0-.6-.5-.3-.8l3.4-3.4Z" />
        <path d="M9.1 7.3c.2-.2.5-.3.7-.3h17.4c.4 0 .6.5.3.8l-3.4 3.4c-.2.2-.4.3-.7.3H6c-.4 0-.6-.5-.3-.8l3.4-3.4Z" />
        <path d="M23.5 14c-.2-.2-.4-.3-.7-.3H5.4c-.4 0-.6.5-.3.8l3.4 3.4c.2.2.4.3.7.3h17.4c.4 0 .6-.5.3-.8L23.5 14Z" />
      </g>
    ),
  },
};

/**
 * ChainLogo - inline SVG mark for a supported (or upcoming) chain.
 */
const ChainLogo = ({ chain, size = 40 }) => {
  const mark = CHAIN_MARKS[chain];

  if (!mark) {
    return null;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={`${chain} logo`}
    >
      <circle cx="16" cy="16" r="16" fill={mark.background} />
      {mark.render}
    </svg>
  );
};

export default ChainLogo;
