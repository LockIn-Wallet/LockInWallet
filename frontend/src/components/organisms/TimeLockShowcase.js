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
const COMPROMISE_MS = 2000; // attacker steals the private key
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
 * TimeLockShowcase - looping animated simulation: the same stolen private
 * key drains a regular wallet instantly, but only leaks the hourly limit
 * from a LockInWallet vault until the owner reacts.
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
    ? "☠️ Drained in seconds. Everything is gone."
    : compromised
    ? "Attacker is withdrawing everything…"
    : "Protected only by the private key.";

  const vaultStatus = !compromised
    ? "Protected by on-chain time locks + hourly withdrawal limit."
    : rescued
    ? `🚨 You saw the alert and moved funds to safety. The thief got only ${formatUSD(
        stolenFromVault,
      )}.`
    : `⏳ Hour ${hoursElapsed + 1}: attacker can only take ${formatUSD(
        DEMO_HOURLY_LIMIT,
      )} — the hourly limit. Everything else is time-locked.`;

  return (
    <div style={homeStyles.section}>
      <h2 style={homeStyles.sectionTitle}>
        🔐 A stolen key can't empty your wallet
      </h2>
      <p style={homeStyles.sectionSubtitle}>
        Watch the same attack hit two wallets holding{" "}
        {formatUSD(DEMO_VAULT_BALANCE)}. Withdrawals above your limit are
        time-locked on-chain, so a thief can't rush them — you get time to
        notice and react.
      </p>

      <div
        style={bannerStyle}
        className={justCompromised ? "home-shake" : undefined}
      >
        {compromised
          ? "🚨 Private key stolen by malware!"
          : "🔑 Two wallets, one secret about to leak…"}
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
          <p style={homeStyles.panelTitle}>🔒 LockInWallet</p>
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

      {verdict && (
        <div style={homeStyles.verdictRow} className="home-fade-up">
          <span style={homeStyles.verdictLost}>
            Regular wallet: lost {formatUSD(DEMO_VAULT_BALANCE)} (100%)
          </span>
          <span style={homeStyles.verdictSaved}>
            LockInWallet: saved {formatUSD(vaultBalance)} (
            {savedPercent.toFixed(0)}%)
          </span>
        </div>
      )}

      <p style={homeStyles.captionText}>
        You choose your own hourly, daily and monthly limits. Anything above
        them needs a time-locked proposal — visible on-chain long before it can
        execute, with alerts the moment someone tries.
      </p>
    </div>
  );
};

export default TimeLockShowcase;
