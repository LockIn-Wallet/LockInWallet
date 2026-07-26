import React from "react";

import ChainLogo from "../atoms/ChainLogo.js";

import { homeStyles } from "../../styles";

import { SUPPORTED_CHAINS } from "../../utils/homeDemo.js";

/**
 * ChainAvailability - which chains the vault runs on today and what's next.
 */
const ChainAvailability = () => (
  <div style={homeStyles.section}>
    <div style={homeStyles.chainGrid}>
      {SUPPORTED_CHAINS.map((chain) => (
        <div
          key={chain.key}
          style={
            chain.live
              ? { ...homeStyles.chainCard, ...homeStyles.chainCardLive }
              : homeStyles.chainCard
          }
        >
          <div style={homeStyles.chainHeader}>
            <span
              style={
                chain.live
                  ? homeStyles.chainLogoWrap
                  : { ...homeStyles.chainLogoWrap, ...homeStyles.chainLogoMuted }
              }
            >
              <ChainLogo chain={chain.key} />
            </span>
            <span>
              <div style={homeStyles.chainName}>{chain.name}</div>
              <div style={homeStyles.chainTagline}>{chain.tagline}</div>
            </span>
          </div>

          <div
            style={
              chain.live
                ? { ...homeStyles.chainBadge, ...homeStyles.chainBadgeLive }
                : homeStyles.chainBadge
            }
          >
            {chain.status}
          </div>

          <p style={homeStyles.chainDetail}>{chain.detail}</p>
          <p style={homeStyles.chainBestFor}>{chain.bestFor}</p>
        </div>
      ))}
    </div>

    <p style={homeStyles.captionText}>
      Cheap, fast transactions matter here: an hourly or daily withdrawal limit
      only makes sense if using it doesn't cost you a fortune in gas.
    </p>
  </div>
);

export default ChainAvailability;
