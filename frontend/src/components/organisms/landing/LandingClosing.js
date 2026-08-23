import React from "react";

import WalletConnectButtons from "../../molecules/WalletConnectButtons.js";

import { landingStyles } from "../../../styles";

/**
 * LandingClosing - final CTA and the one place the real sign-in options live.
 * Every call-to-action button on the page scrolls here, so the choice of how
 * to sign in is made once, in context, instead of in a dead-end alert.
 */
const LandingClosing = ({
  content,
  networkType,
  connectWallet,
  onConnectPhantom,
  onSignInWithPasskey,
  isSigningIn,
}) => (
  <section id="connect" style={landingStyles.closing}>
    <div style={landingStyles.closingGlow} aria-hidden="true" />
    <div style={landingStyles.closingInner}>
      <h2 style={landingStyles.sectionTitle}>{content.title}</h2>
      <p style={landingStyles.closingBody}>{content.body}</p>
      <WalletConnectButtons
        networkType={networkType}
        connectWallet={connectWallet}
        onConnectPhantom={onConnectPhantom}
        onSignInWithPasskey={onSignInWithPasskey}
        isSigningIn={isSigningIn}
      />
    </div>
  </section>
);

export default LandingClosing;
