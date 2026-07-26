import React, { useCallback, useEffect, useState } from "react";

import { appStyles, getAllowanceFill, colors } from "../../styles";

const pad = (value) => String(value).padStart(2, "0");

// Reset times come back as a unix timestamp; render the wait, not the date —
// "4h 12m" answers the question a date never does.
const formatWait = (resetAt, now) => {
  const seconds = Math.max(0, Math.floor(Number(resetAt) - now / 1000));
  if (!seconds) return null;

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${pad(minutes)}m`;
  return `${minutes}m ${pad(seconds % 60)}s`;
};

const formatUSD = (value) =>
  `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/**
 * AllowanceBar - what you can take out right now, per period, without
 * scrolling. The app is a single page by design, so this is the one thing
 * that stays at the top: the tightest remaining allowance is the number that
 * decides whether a withdrawal will go through at all.
 */
const AllowanceBar = ({ transactionManager, userAddress, currentTime }) => {
  const [periods, setPeriods] = useState(null);

  const load = useCallback(async () => {
    if (!transactionManager || !userAddress) return;
    try {
      const result = await transactionManager.getSpendingLimits(userAddress);
      setPeriods((result?.limits || []).filter((limit) => limit.active));
    } catch (error) {
      // A failed read must not take the page down — the sections below still
      // work, and the bar simply stays quiet
      console.error("Could not load spending limits for the allowance bar:", error);
      setPeriods([]);
    }
  }, [transactionManager, userAddress]);

  useEffect(() => {
    load();
  }, [load]);

  if (periods === null) return null;

  const now = currentTime || Date.now();

  return (
    <section style={appStyles.allowanceBar} aria-label="Remaining allowance">
      <div style={appStyles.allowanceHead}>
        <p style={appStyles.allowanceLabel}>AVAILABLE TO WITHDRAW NOW</p>
        <p style={appStyles.allowanceHint}>
          {periods.length > 1 ? "TIGHTEST PERIOD WINS" : ""}
        </p>
      </div>

      {periods.length === 0 ? (
        <p style={appStyles.allowanceEmpty}>
          No spending limits are active, so withdrawals are not capped. Set a
          limit below to put one in place.
        </p>
      ) : (
        <div style={appStyles.allowanceGrid}>
          {periods.map((period) => {
            const limit = Number(period.limit) || 0;
            const remaining = Number(period.remaining) || 0;
            const isEmpty = remaining <= 0;
            const wait = formatWait(period.resetAt, now);

            return (
              <div key={period.name} style={appStyles.period}>
                <div style={appStyles.periodHead}>
                  <span style={appStyles.periodName}>{period.name}</span>
                  <span
                    style={
                      isEmpty
                        ? {
                            ...appStyles.periodRemaining,
                            ...appStyles.periodRemainingEmpty,
                          }
                        : appStyles.periodRemaining
                    }
                  >
                    {formatUSD(remaining)} / {formatUSD(limit)}
                  </span>
                </div>

                <div style={appStyles.periodTrack}>
                  <div
                    style={getAllowanceFill(
                      limit ? (remaining / limit) * 100 : 0,
                      isEmpty ? colors.error.main : colors.primary.main,
                    )}
                  />
                </div>

                {wait && (
                  <div style={appStyles.periodReset}>
                    {isEmpty ? "REFILLS IN " : "RESETS IN "}
                    {wait}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AllowanceBar;
