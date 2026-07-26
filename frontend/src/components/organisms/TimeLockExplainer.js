import React, { useEffect, useState } from "react";

import { homeStyles, getBarFillStyle, colors } from "../../styles";

import {
  LIMIT_SIM,
  timelockSeconds,
  getLimitTimeline,
  bucketState,
  tightestBucket,
  formatUSD,
} from "../../utils/homeDemo.js";

const pad = (value) => String(value).padStart(2, "0");

const formatClock = (totalSeconds) =>
  `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;

// hh:mm:ss for the 24-hour timelock
const formatTimelock = (totalSeconds) =>
  `${pad(Math.floor(totalSeconds / 3600))}:${formatClock(totalSeconds % 3600)}`;

/**
 * TimeLockExplainer - the three-beat walkthrough of how limits behave:
 * you set them, everything under them is instant, and forcing your way past
 * them is slower than simply waiting.
 */
const TimeLockExplainer = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () =>
        setElapsed((value) => (value + LIMIT_SIM.tickMs) % LIMIT_SIM.loopMs),
      LIMIT_SIM.tickMs,
    );
    return () => clearInterval(interval);
  }, []);

  const { spent, event, waiting, refilled, refillSecondsRemaining } =
    getLimitTimeline(elapsed);

  const tightest = tightestBucket();
  const buckets = bucketState(spent, refilled ? [tightest.key] : []);

  // The lock only starts once the rejected withdrawal is pushed through as a
  // bypass request — before that there is nothing counting down
  const rejectedAtMs = event && !event.accepted ? event.atMs : null;
  const bypassRequested = rejectedAtMs !== null;
  const timelockRemaining = bypassRequested
    ? timelockSeconds() - Math.floor((elapsed - rejectedAtMs) / 1000)
    : timelockSeconds();

  const ticketStyle = !event
    ? homeStyles.withdrawTicket
    : event.accepted
    ? { ...homeStyles.withdrawTicket, ...homeStyles.withdrawTicketAccepted }
    : { ...homeStyles.withdrawTicket, ...homeStyles.withdrawTicketRejected };

  const ticketText = refilled
    ? `🔄 New hour, full allowance — ${formatUSD(
        tightest.limit,
      )} ready to go again`
    : !event
    ? "💸 Withdraw whatever you need…"
    : event.accepted
    ? `✅ ${formatUSD(event.amount)} — withdrawn instantly`
    : `🛑 ${formatUSD(
        event.amount,
      )} — over your own ${tightest.name.toLowerCase()} limit`;

  return (
    <div style={homeStyles.section}>
      <h2 style={homeStyles.sectionTitle}>⏳ You set withdrawal limits</h2>
      <p style={homeStyles.sectionSubtitle}>
        You pick the hourly, daily, weekly limits. Trying to bypass them - takes
        time.
      </p>

      {/* Beats 1 + 2: your limits, spent from all at once, refilling on their own clocks */}
      <p style={homeStyles.blockTitle}>
        You can instantly withdraw from the smallest limit & wait for it to
        reset.
      </p>
      {/* <p style={homeStyles.blockSubtitle}>
         Hourly, daily, weekly — your numbers, chosen by you.A withdrawal isn't
        charged to one of them, it's charged to all of them at once. So the
        smallest limit is your real speed limit.
      </p> */}

      <div
        style={ticketStyle}
        className={event?.isFresh ? "home-fade-up" : undefined}
      >
        {ticketText}
      </div>

      <div style={homeStyles.bucketList}>
        {buckets.map((bucket) => (
          <div
            key={bucket.key}
            style={
              bucket.isEmpty
                ? { ...homeStyles.bucketRow, ...homeStyles.bucketRowEmpty }
                : homeStyles.bucketRow
            }
          >
            <div style={homeStyles.bucketHeader}>
              <span style={homeStyles.bucketName}>
                {bucket.emoji} {bucket.name} limit {formatUSD(bucket.limit)}
                <span style={homeStyles.bucketNote}>your number</span>
              </span>
              <span
                style={
                  bucket.isEmpty
                    ? {
                        ...homeStyles.bucketNumbers,
                        ...homeStyles.bucketNumbersEmpty,
                      }
                    : homeStyles.bucketNumbers
                }
              >
                {formatUSD(bucket.remaining)} left
              </span>
            </div>

            <div style={homeStyles.barTrack}>
              <div
                style={getBarFillStyle(
                  bucket.percentRemaining,
                  colors.success.main,
                )}
              />
            </div>

            {bucket.key === tightest.key && (waiting || refilled) && (
              <div
                style={
                  refilled
                    ? {
                        ...homeStyles.bucketRefill,
                        ...homeStyles.bucketRefillDone,
                      }
                    : homeStyles.bucketRefill
                }
              >
                {refilled ? (
                  <span>
                    ✅ Refilled. Full {tightest.name.toLowerCase()} limit
                    available again.
                  </span>
                ) : (
                  <>
                    <span>Limit resets in</span>
                    <span style={homeStyles.bucketClock}>
                      {formatClock(refillSecondsRemaining)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={homeStyles.captionText}>
        Hit your hourly limit and you're done for the hour — but notice the
        daily and weekly bars have barely moved. Each one refills on its own
        clock, without you doing anything.
      </p>

      {/* Beat 3: the lock only exists once someone tries to force a limit */}
      {bypassRequested && (
        <div style={homeStyles.bypassStrip} className="home-fade-up">
          <span style={homeStyles.bypassLabel}>
            🔓 Bypassing the limit requires the wait time
          </span>
          <span style={homeStyles.bypassClock}>
            {formatTimelock(timelockRemaining)}
          </span>
        </div>
      )}

      {/* Beat 4: the recovery key, for when the primary key itself leaks */}
      <p style={homeStyles.blockTitle}>
        🛟 You set an offline recovery key to recover your wallet when your
        primary key is stolen
      </p>
      <div style={homeStyles.demoGrid}>
        <div style={homeStyles.walletPanel}>
          <p style={homeStyles.panelTitle}>1. 🧊 Freeze</p>
          <p style={homeStyles.panelStatus}>
            One click blocks all withdrawals.
          </p>
        </div>
        <div
          style={{ ...homeStyles.walletPanel, ...homeStyles.walletPanelSafe }}
        >
          <p style={homeStyles.panelTitle}>2. 🔁 Move</p>
          <p style={homeStyles.panelStatus}>
            Your savings go to a fresh address; the leaked one is dead.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TimeLockExplainer;
