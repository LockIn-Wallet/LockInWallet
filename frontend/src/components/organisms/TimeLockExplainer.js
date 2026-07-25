import React, { useEffect, useState } from "react";

import { homeStyles, getBarFillStyle, colors } from "../../styles";

import {
  LIMIT_SIM,
  TIMELOCK_HOURS,
  ESCAPE_ROUTES,
  getLimitTimeline,
  bucketState,
  tightestBucket,
  formatUSD,
} from "../../utils/homeDemo.js";

const pad = (value) => String(value).padStart(2, "0");

const formatClock = (totalSeconds) =>
  `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;

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
    ? `✅ ${formatUSD(event.amount)} — gone in seconds, no approval needed`
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
        recharge.
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
                    <span>Refills in</span>
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

      <hr style={homeStyles.blockDivider} />

      {/* Beat 3: forcing it is the slow lane */}
      <p style={homeStyles.blockTitle}>
        2️⃣ Want more, right now? Forcing it is the slow lane.
      </p>
      <p style={homeStyles.blockSubtitle}>
        You can ask the contract to bypass a limit — but the request is frozen
        for {TIMELOCK_HOURS} hours before it can move a cent. Compare that to
        simply waiting for the limit to refill.
      </p>

      <div style={homeStyles.compareTableWrap}>
        <table style={homeStyles.compareTable}>
          <thead>
            <tr>
              <th
                style={{
                  ...homeStyles.compareHeadCell,
                  ...homeStyles.compareHeadCellLeft,
                }}
              >
                Limit you hit
              </th>
              <th style={homeStyles.compareHeadCell}>Just wait for it</th>
              <th style={homeStyles.compareHeadCell}>Bypass it</th>
            </tr>
          </thead>
          <tbody>
            {ESCAPE_ROUTES.map((route) => (
              <tr key={route.key}>
                <td style={homeStyles.comparePeriodCell}>
                  {route.emoji} {route.name}
                </td>
                <td
                  style={{
                    ...homeStyles.compareCell,
                    ...(route.refillWins
                      ? homeStyles.compareWinner
                      : homeStyles.compareLoser),
                  }}
                >
                  {route.refillWait}
                  {route.refillWins && " ✅"}
                </td>
                <td
                  style={{
                    ...homeStyles.compareCell,
                    ...(route.refillWins || route.tie
                      ? homeStyles.compareLoser
                      : homeStyles.compareWinner),
                  }}
                >
                  {route.bypassWait}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* <p style={homeStyles.compareVerdict}>
        There is no fast lane. Beating your hourly limit costs you a whole day —
        and the big ones cost you a day spent in plain sight.
      </p> */}

      <div style={homeStyles.lockActionRow}>
        <span style={homeStyles.lockTag}>
          🔔 You're alerted the second it opens
        </span>
        <span style={homeStyles.lockTag}>
          👁️ Visible on-chain the whole time
        </span>
        <span style={homeStyles.lockTag}>✋ Cancel it instantly</span>
      </div>

      <p style={homeStyles.captionText}>
        That's the whole product: limits you set, that only time can lift. It's
        why an impulse at 2am doesn't cost you your savings — and why someone
        holding your keys can't either.
      </p>
    </div>
  );
};

export default TimeLockExplainer;
