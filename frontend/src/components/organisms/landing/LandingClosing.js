import React from "react";

import WalletConnectButtons from "../../molecules/WalletConnectButtons.js";

import { landingStyles } from "../../../styles";

/**
 * LandingClosing - final CTA and the one place the real wallet options live.
 * Every "Connect wallet" button on the page scrolls here, so the choice of
 * wallet is made once, in context, instead of in a dead-end alert.
 */
const LandingClosing = ({ networkType, connectWallet, onConnectPhantom }) => (
  <section id="connect" style={landingStyles.closing}>
    <div style={landingStyles.closingGlow} aria-hidden="true" />
    <div style={landingStyles.closingInner}>
      <h2 style={landingStyles.sectionTitle}>Don&apos;t trust. Verify.</h2>
      <p style={landingStyles.closingBody}>
        Read the code, set your limits, and let a contract keep the promise
        willpower can&apos;t always keep.
      </p>
      <WalletConnectButtons
        networkType={networkType}
        connectWallet={connectWallet}
        onConnectPhantom={onConnectPhantom}
      />
    </div>
  </section>
);

export default LandingClosing;
