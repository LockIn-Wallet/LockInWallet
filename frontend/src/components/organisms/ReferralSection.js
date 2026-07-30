import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";

import {
  buttonStyles,
  formStyles,
  layoutStyles,
  utilityStyles,
  spacing,
} from "../../styles";
import { buildReferralLink } from "../../services/referral.service.js";

/**
 * ReferralSection Component
 *
 * Shown after setup is committed:
 * - The user's shareable referral link with a copy button
 * - How many users they invited — a count only. Invitee wallet addresses are
 *   not exposed on-chain, so referral rewards can never double as a window
 *   into what an invitee has saved.
 */
const ReferralSection = ({ transactionManager, userAddress }) => {
  const [referralCount, setReferralCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = buildReferralLink(userAddress);

  const loadReferrals = useCallback(async () => {
    if (!transactionManager || !userAddress) return;
    setIsLoading(true);
    try {
      setReferralCount(await transactionManager.getReferralCount(userAddress));
    } catch (error) {
      console.error("Error loading referrals:", error);
      setReferralCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [transactionManager, userAddress]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Could not copy referral link:", error);
    }
  };

  return (
    <div>
      <div style={layoutStyles.section}>
        <p style={{ ...utilityStyles.textSecondary, marginBottom: spacing.md }}>
          Share your link — anyone who locks in their wallet through it is
          recorded as invited by you, making you eligible for future referral
          rewards.
        </p>
        <div style={{ ...layoutStyles.flexAlignCenter, gap: spacing.md }}>
          <input
            type="text"
            readOnly
            value={referralLink}
            style={{ ...formStyles.input, ...utilityStyles.addressText }}
            onFocus={(e) => e.target.select()}
          />
          <button style={buttonStyles.copy} onClick={copyLink}>
            {copied ? "✅ Copied" : "📋 Copy"}
          </button>
        </div>
      </div>

      <div style={layoutStyles.section}>
        <h4 style={{ ...utilityStyles.textPrimary, marginBottom: spacing.md }}>
          Invited users
        </h4>

        {isLoading ? (
          <p style={utilityStyles.loadingText}>Loading your referrals...</p>
        ) : referralCount === 0 ? (
          <p style={utilityStyles.textMuted}>
            No one yet — share your link to invite savers.
          </p>
        ) : (
          <p style={utilityStyles.textSecondary}>
            {referralCount} {referralCount === 1 ? "person has" : "people have"}{" "}
            locked in a wallet through your link.
          </p>
        )}

        <p style={{ ...utilityStyles.textMuted, marginTop: spacing.md }}>
          You see the count only — invitee addresses are never listed on-chain,
          so a referral can't become a view into someone else's savings.
        </p>
      </div>
    </div>
  );
};

ReferralSection.propTypes = {
  transactionManager: PropTypes.object,
  userAddress: PropTypes.string,
};

export default ReferralSection;
