import React, { useEffect, useState } from "react";

import Icon from "../../atoms/Icon.js";

import { landingStyles, getBarFill, colors } from "../../../styles";

import {
  LIMIT_SIM,
  DEMO_VAULT_BALANCE,
  timelockSeconds,
  getLimitTimeline,
  bucketResetSeconds,
  bucketState,
  tightestBucket,
  formatUSD,
} from "../../../utils/homeDemo.js";

const pad = (value) => String(value).padStart(2, "0");

const formatClock = (totalSeconds) =>
  `${pad(Math.floor(totalSeconds / 3600))}:${pad(
    Math.floor((totalSeconds % 3600) / 60),
  )}:${pad(totalSeconds % 60)}`;

// Scale the unit to the period: seconds matter on the hourly window, days on
// the weekly one.
const formatCountdown = (seconds) => {
  if (seconds <= 0) return "ready";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${pad(m)}m`;
  return `${m}:${pad(seconds % 60)}`;
};

/**
 * EnforcementConsole - the hero's centrepiece. It replays real withdrawal
 * requests against the same rule the contract applies (a withdrawal is checked
 * against every active period at once, so the tightest one is the real speed
 * limit) and shows the contract refusing one out loud, then starting the
 * 24-hour bypass clock. Visitors watch the product say no before they connect
 * anything.
 */
const EnforcementConsole = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed((value) => (value + LIMIT_SIM.tickMs) % LIMIT_SIM.loopMs),
      LIMIT_SIM.tickMs,
    );
    return () => clearInterval(interval);
  }, []);

  const { spent, event, refilled } = getLimitTimeline(elapsed);

  const tightest = tightestBucket();
  const buckets = bucketState(spent, refilled ? [tightest.key] : []);
  const resets = bucketResetSeconds(elapsed);

  // The clock only exists once a refused withdrawal is pushed through as a
  // bypass request — before that there is nothing counting down
  const rejectedAtMs = event && !event.accepted ? event.atMs : null;
  const bypassRequested = rejectedAtMs !== null;
  const timelockRemaining = bypassRequested
    ? timelockSeconds() - Math.floor((elapsed - rejectedAtMs) / 1000)
    : timelockSeconds();

  const ticketStyle = refilled
    ? { ...landingStyles.ticket, ...landingStyles.ticketReset }
    : !event
    ? landingStyles.ticket
    : event.accepted
    ? { ...landingStyles.ticket, ...landingStyles.ticketAccepted }
    : { ...landingStyles.ticket, ...landingStyles.ticketRejected };

  const verdict = refilled
    ? "RESET"
    : !event
    ? "READY"
    : event.accepted
    ? "CLEARED"
    : "DENIED";

  const detail = refilled
    ? `${formatUSD(tightest.limit)} allowance restored`
    : !event
    ? "awaiting request"
    : event.accepted
    ? `${formatUSD(event.amount)} sent instantly`
    : `${formatUSD(event.amount)} exceeds ${tightest.name.toLowerCase()} limit`;

  const verdictIcon = refilled
    ? "check"
    : !event
    ? null
    : event.accepted
    ? "check"
    : "cross";
  const verdictColor = refilled
    ? colors.primary.light
    : !event
    ? colors.text.gray
    : event.accepted
    ? colors.primary.light
    : colors.error.light;

  return (
    <div style={landingStyles.console}>
      <div style={landingStyles.consoleBar}>
        <span style={landingStyles.consoleLabel}>
          LIVE RULE CHECK · ILLUSTRATIVE VAULT
        </span>
        <span style={landingStyles.consoleLabel}>
          <span style={landingStyles.liveDot} aria-hidden="true" />{" "}
          ENFORCED ON-CHAIN
        </span>
      </div>

      <div className="landing-console-body" style={landingStyles.consoleBody}>
        <div style={landingStyles.consoleColumn}>
          <p style={landingStyles.balanceLabel}>VAULT BALANCE</p>
          <p style={landingStyles.balanceAmount}>
            {formatUSD(DEMO_VAULT_BALANCE)}{" "}
            <span style={landingStyles.balanceUnit}>USDC</span>
          </p>
          <p style={landingStyles.balanceStatus}>Locked · rules active</p>

          <div
            style={ticketStyle}
            className={event?.isFresh ? "home-fade-up" : undefined}
            role="status"
            aria-live="polite"
          >
            <span style={landingStyles.ticketVerdict}>
              {verdictIcon && (
                <Icon name={verdictIcon} size={16} color={verdictColor} />
              )}
              {verdict}
            </span>
            <span style={landingStyles.ticketDetail}>{detail}</span>
          </div>

          <div
            className="landing-bypass"
            style={
              bypassRequested
                ? { ...landingStyles.bypassStrip, ...landingStyles.bypassStripActive }
                : landingStyles.bypassStrip
            }
          >
            <span style={landingStyles.bypassLabel}>
              {bypassRequested
                ? "Bypass requested"
                : "Going over needs a bypass"}
            </span>
            <span
              style={
                bypassRequested
                  ? {
                      ...landingStyles.bypassClock,
                      ...landingStyles.bypassClockActive,
                    }
                  : landingStyles.bypassClock
              }
            >
              {formatClock(Math.max(0, timelockRemaining))}
            </span>
          </div>
        </div>

        <div
          className="landing-console-right"
          style={landingStyles.consoleColumnRight}
        >
          <p style={landingStyles.balanceLabel}>YOUR LIMITS</p>
          <div style={landingStyles.bucketList}>
            {buckets.map((bucket) => (
              <div key={bucket.key} style={landingStyles.bucketRow}>
                <div style={landingStyles.bucketHeader}>
                  <span style={landingStyles.bucketName}>
                    {bucket.name} limit
                  </span>
                  <span
                    style={
                      bucket.isEmpty
                        ? {
                            ...landingStyles.bucketNumbers,
                            ...landingStyles.bucketNumbersEmpty,
                          }
                        : landingStyles.bucketNumbers
                    }
                  >
                    {formatUSD(bucket.remaining)} / {formatUSD(bucket.limit)}
                  </span>
                </div>
                <div style={landingStyles.barTrack}>
                  <div
                    style={getBarFill(
                      bucket.percentRemaining,
                      bucket.isEmpty ? colors.error.main : colors.primary.main,
                    )}
                  />
                </div>

                <div
                  style={
                    resets[bucket.key] <= 0
                      ? {
                          ...landingStyles.bucketReset,
                          ...landingStyles.bucketResetReady,
                        }
                      : landingStyles.bucketReset
                  }
                >
                  resets in {formatCountdown(resets[bucket.key])}
                </div>
              </div>
            ))}
          </div>

          <p style={landingStyles.consoleNote}>
            Every withdrawal is charged to all three at once, so the tightest
            one is your real speed limit. Each refills on its own clock.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnforcementConsole;
