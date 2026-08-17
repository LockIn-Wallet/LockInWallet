import React, { useEffect, useState } from "react";

import { homeStyles, getBarFillStyle, colors } from "../../styles";

import {
  DEMO_VAULT_BALANCE,
  DEMO_HOURLY_LIMIT,
  formatUSD,
} from "../../utils/homeDemo.js";

// Simulation timeline (ms within each loop)
const LOOP_MS = 16000;
const TICK_MS = 100;
const COMPROMISE_MS = 2000; // attacker steals the password
const DRAIN_MS = 1800; // regular wallet fully drained this long after compromise
const HOUR_TICK_MS = 1600; // one simulated "hour" per tick
const HOURS_UNTIL_RESCUE = 4; // you notice the alert and move funds after 4 hours
const VERDICT_MS = 12000; // final comparison shown from here until loop restart

const getTimeline = (elapsed) => {
  const compromised = elapsed >= COMPROMISE_MS;
  const drainProgress = compromised
    ? Math.min((elapsed - COMPROMISE_MS) / DRAIN_MS, 1)
    : 0;
  const hoursElapsed = compromised
    ? Math.min(
        Math.floor((elapsed - COMPROMISE_MS) / HOUR_TICK_MS),
        HOURS_UNTIL_RESCUE,
      )
    : 0;

  return {
    compromised,
    drained: drainProgress >= 1,
    regularBalance: DEMO_VAULT_BALANCE * (1 - drainProgress),
    stolenFromVault: hoursElapsed * DEMO_HOURLY_LIMIT,
    hoursElapsed,
    rescued: hoursElapsed >= HOURS_UNTIL_RESCUE,
    verdict: elapsed >= VERDICT_MS,
  };
};

/**
 * TimeLockShowcase - looping simulation: the same stolen password drains a
 * regular wallet instantly, but only leaks the hourly limit from a LockIn
 * vault until the owner reacts. "Password" because this runs on the landing
 * page; the precise term is on /security.
 */
const TimeLockShowcase = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed((value) => (value + TICK_MS) % LOOP_MS),
      TICK_MS,
    );
    return () => clearInterval(interval);
  }, []);

  const {
    compromised,
    drained,
    regularBalance,
    stolenFromVault,
    hoursElapsed,
    rescued,
    verdict,
  } = getTimeline(elapsed);

  const vaultBalance = DEMO_VAULT_BALANCE - stolenFromVault;
  const stolenPercent = (stolenFromVault / DEMO_VAULT_BALANCE) * 100;
  const savedPercent = 100 - stolenPercent;
  const justCompromised = compromised && elapsed < COMPROMISE_MS + 600;

  const bannerStyle = compromised
    ? { ...homeStyles.attackBanner, ...homeStyles.attackBannerDanger }
    : homeStyles.attackBanner;

  const regularStatus = drained
    ? "Drained in seconds. Everything is gone."
    : compromised
    ? "Attacker is withdrawing everything…"
    : "One password away from empty.";

  const vaultStatus = !compromised
    ? "Hourly limit, enforced by the wallet itself."
    : rescued
    ? `You saw the alert, froze the account and moved the rest. The thief got ${formatUSD(
        stolenFromVault,
      )}.`
    : `Hour ${hoursElapsed + 1}: attacker can only take ${formatUSD(
        DEMO_HOURLY_LIMIT,
      )} — the hourly limit. Everything else has to wait.`;

  return (
    <div style={homeStyles.section}>
      <h3 style={homeStyles.sectionTitle}>
        The same stolen password, hitting two wallets
      </h3>
      <p style={homeStyles.sectionSubtitle}>
        Both hold {formatUSD(DEMO_VAULT_BALANCE)}. Anything over the limit has to
        wait, and nobody can rush it.
      </p>

      <div
        style={bannerStyle}
        className={justCompromised ? "home-shake" : undefined}
      >
        {compromised
          ? "Password stolen by malware"
          : "Two wallets, one password about to leak…"}
      </div>

      <div style={homeStyles.demoGrid}>
        <div
          style={{ ...homeStyles.walletPanel, ...homeStyles.walletPanelDanger }}
        >
          <p style={homeStyles.panelTitle}>Regular Wallet</p>
          <p
            style={
              drained
                ? { ...homeStyles.panelBalance, ...homeStyles.panelBalanceLost }
                : homeStyles.panelBalance
            }
          >
            {formatUSD(regularBalance)}
          </p>
          <div style={homeStyles.barTrack}>
            <div
              style={getBarFillStyle(
                (regularBalance / DEMO_VAULT_BALANCE) * 100,
                colors.error.main,
              )}
            />
          </div>
          <p style={homeStyles.panelStatus}>{regularStatus}</p>
        </div>

        <div
          style={{ ...homeStyles.walletPanel, ...homeStyles.walletPanelSafe }}
        >
          <p style={homeStyles.panelTitle}>LockIn Wallet</p>
          <p
            style={{
              ...homeStyles.panelBalance,
              ...homeStyles.panelBalanceSafe,
            }}
          >
            {formatUSD(vaultBalance)}
          </p>
          <div style={homeStyles.barTrack}>
            <div
              style={getBarFillStyle(
                (vaultBalance / DEMO_VAULT_BALANCE) * 100,
                colors.success.main,
              )}
            />
          </div>
          <p style={homeStyles.panelStatus}>{vaultStatus}</p>
        </div>
      </div>

      <div
        style={
          verdict
            ? homeStyles.verdictRow
            : { ...homeStyles.verdictRow, ...homeStyles.verdictRowIdle }
        }
        aria-hidden={!verdict}
      >
        <span style={homeStyles.verdictLost}>
          Regular wallet: lost {formatUSD(DEMO_VAULT_BALANCE)} (100%)
        </span>
        <span style={homeStyles.verdictSaved}>
          LockIn Wallet: saved {formatUSD(vaultBalance)} (
          {savedPercent.toFixed(0)}%)
        </span>
      </div>

      <p style={homeStyles.captionText}>
        You set the hourly, daily and monthly limits — and you are alerted the
        moment someone tries to go over one.
      </p>
    </div>
  );
};

export default TimeLockShowcase;
