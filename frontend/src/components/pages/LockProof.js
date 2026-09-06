import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import SectionHeading from "../atoms/SectionHeading.js";
import LandingLink from "../atoms/LandingLink.js";

import { homeStyles, landingStyles, lockStyles } from "../../styles";
import { createReadProvider } from "../../utils/providerManager.js";
import { createLockReader } from "../../utils/lockReader.js";
import { NETWORKS } from "../../utils/walletUtils.js";
import { describeRule, formatLockDate, lockStatus } from "../../utils/locks.js";
import {
  PROOF_GUARANTEES,
  PROOF_UNVERIFIED_WARNING,
  PROOF_OF_LOCK_PATH,
} from "../../utils/lockContent.js";

const STATUS_LABEL = { locked: "Locked", ready: "Open — awaiting release", released: "Released" };
const STATUS_STYLE = {
  locked: lockStyles.pillLocked,
  ready: lockStyles.pillReady,
  released: lockStyles.pillReleased,
};

/**
 * LockProof — /lock/:chainKey/:address
 *
 * The public page for one lock. Readable without a wallet, so a creator can
 * hand the link to their audience: it reads the chain directly and shows the
 * owner, the rule, the balance and the deadline exactly as the contract
 * reports them.
 */
const LockProof = () => {
  const { chainKey, address } = useParams();
  const network = NETWORKS.evm[chainKey];
  const [lock, setLock] = useState(null);
  const [state, setState] = useState("loading");

  const reader = useMemo(() => {
    if (!network?.rpcUrls?.[0]) return null;
    return createLockReader(network, createReadProvider(network.rpcUrls[0], network.chainId));
  }, [network]);

  useEffect(() => {
    if (!reader?.available) {
      setState("unsupported");
      return;
    }
    let cancelled = false;
    reader
      .getLock(address)
      .then((result) => {
        if (cancelled) return;
        setLock(result);
        setState(result ? "ready" : "missing");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [reader, address]);

  const status = lock ? lockStatus(lock) : null;

  return (
    <div style={landingStyles.page}>
      <header style={landingStyles.sectionFlush}>
        <div style={landingStyles.inner}>
          <p style={landingStyles.eyebrow}>Proof of lock</p>
          <h1 style={homeStyles.pageTitle}>These tokens cannot move</h1>
          <p style={homeStyles.pageLede}>
            Read live from {network?.name || "the chain"}. Nothing on this page is stored by us.
          </p>
        </div>
      </header>

      <section style={landingStyles.section}>
        <div style={landingStyles.inner}>
          {state === "loading" && <p style={lockStyles.meta}>Reading the lock…</p>}
          {state === "unsupported" && (
            <p style={lockStyles.error}>Locks are not available on this network.</p>
          )}
          {state === "missing" && (
            <p style={lockStyles.error}>That address is not a lock created by the LockIn factory.</p>
          )}
          {state === "error" && <p style={lockStyles.error}>Could not read the lock right now.</p>}

          {lock && (
            <div style={lockStyles.proofCard}>
              <span style={STATUS_STYLE[status]}>{STATUS_LABEL[status]}</span>
              {!lock.verified && (
                <p style={{ ...lockStyles.warning, marginTop: lockStyles.actions.marginTop }}>
                  {PROOF_UNVERIFIED_WARNING}
                </p>
              )}

              <div style={lockStyles.proofAmount}>
                {lock.balances.length === 0
                  ? "Empty"
                  : lock.balances.map((entry) => `${entry.formatted} ${entry.symbol}`).join(" · ")}
              </div>

              <p style={lockStyles.rule}>{describeRule(lock)}</p>

              <div style={lockStyles.proofRow}>
                <span style={lockStyles.proofLabel}>Owner</span>
                <span style={lockStyles.meta}>{lock.owner}</span>
              </div>
              <div style={lockStyles.proofRow}>
                <span style={lockStyles.proofLabel}>Lock</span>
                <span style={lockStyles.meta}>{lock.address}</span>
              </div>
              <div style={lockStyles.proofRow}>
                <span style={lockStyles.proofLabel}>Deadline</span>
                <span>{formatLockDate(lock.deadline)}</span>
              </div>
              {lock.condition && (
                <div style={lockStyles.proofRow}>
                  <span style={lockStyles.proofLabel}>Rule contract</span>
                  <span style={lockStyles.meta}>
                    {lock.condition.address} ({lock.condition.kind}
                    {lock.condition.verified ? ", verified" : ", unverified"})
                  </span>
                </div>
              )}

              <ul style={lockStyles.proofGuarantees}>
                {PROOF_GUARANTEES.map(({ title, text }) => (
                  <li key={title}>{text}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ ...homeStyles.pageCtaRow, marginTop: lockStyles.proofCard.padding }}>
            <LandingLink href={PROOF_OF_LOCK_PATH} internal style={landingStyles.ctaSecondary}>
              Create your own lock
            </LandingLink>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LockProof;
