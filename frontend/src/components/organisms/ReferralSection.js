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
import { truncateAddress } from "../../utils/addressUtils.js";

/**
 * ReferralSection Component
 *
 * Shown after setup is committed:
 * - The user's shareable referral link with a copy button
 * - An anonymized list of users they invited (truncated addresses + join dates
 *   only — full invitee addresses are never displayed)
 */
const ReferralSection = ({ transactionManager, userAddress }) => {
  const [referrals, setReferrals] = useState({ count: 0, users: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = buildReferralLink(userAddress);

  const loadReferrals = useCallback(async () => {
    if (!transactionManager || !userAddress) return;
    setIsLoading(true);
    try {
      const result = await transactionManager.getReferredUsers(userAddress);
      setReferrals(result || { count: 0, users: [] });
    } catch (error) {
      console.error("Error loading referrals:", error);
      setReferrals({ count: 0, users: [] });
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
          Invited users {referrals.count > 0 && `(${referrals.count})`}
        </h4>

        {isLoading ? (
          <p style={utilityStyles.loadingText}>Loading your referrals...</p>
        ) : referrals.users.length === 0 ? (
          <p style={utilityStyles.textMuted}>
            No one yet — share your link to invite savers.
          </p>
        ) : (
          referrals.users.map((user) => (
            <div
              key={user.address}
              style={{ ...layoutStyles.flexBetween, marginBottom: spacing.sm }}
            >
              <span style={{ ...utilityStyles.addressText, ...utilityStyles.textSecondary }}>
                {truncateAddress(user.address)}
              </span>
              <span style={utilityStyles.textMuted}>
                joined {user.joinedAt.toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

ReferralSection.propTypes = {
  transactionManager: PropTypes.object,
  userAddress: PropTypes.string,
};

export default ReferralSection;
