import React from "react";

import { colors } from "../../styles";

/**
 * SignInOptionLogo — the mark beside each way into the wallet.
 *
 * Inline, like ChainLogo, so choosing how to sign in never waits on a CDN and
 * never leaks a request to one before the visitor has agreed to anything.
 *
 * Deliberately generic rather than a reproduction of anyone's brand mark. The
 * second option covers MetaMask "and other wallets", so stamping it with one
 * vendor's fox would misdescribe it — and a badly redrawn logo looks worse than
 * an honest glyph. An envelope and a wallet say which is which.
 */
const MARKS = {
  // Coinbase blue: the sign-in is theirs, and the colour is the one honest
  // signal of that in a dialog which otherwise avoids naming brands.
  email: {
    background: "#0052FF",
    render: (
      <g fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="11" width="16" height="11" rx="2" />
        <path d="M8.5 12.5 16 18l7.5-5.5" />
      </g>
    ),
  },

  wallet: {
    background: "#F6851B",
    render: (
      <g fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
        <path d="M8 13.5V11a1 1 0 0 1 1-1h11" />
        <circle cx="20" cy="17.5" r="1.4" fill="#ffffff" stroke="none" />
      </g>
    ),
  },
};

const SignInOptionLogo = ({ kind, size = 36, label }) => {
  const mark = MARKS[kind];
  if (!mark) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={label || `${kind} option`}
      style={{ flexShrink: 0 }}
    >
      <circle cx="16" cy="16" r="16" fill={mark.background} />
      {mark.render}
    </svg>
  );
};

export default SignInOptionLogo;
