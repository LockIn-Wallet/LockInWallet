import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { styles, colors, fontSize, spacing } from "../../styles";
import logo from "../../assets/images/logo.png";

function WalletHeader({ wallet, selectedNetwork }) {
  return (
    <div>
      <img
        src={logo}
        alt="LockIn Wallet"
        style={styles.app.logo}
        onError={(e) => {
          e.target.style.display = "none";
          e.target.nextSibling.style.display = "block";
        }}
      />
      <h1 style={{ ...styles.app.title, display: "none", textAlign: "center" }}>
        LockIn Wallet
      </h1>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.lg,
      }}>
        <span style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
          {selectedNetwork === "localhost" ? "Localnet" :
           selectedNetwork === "devnet" ? "Devnet" : "Mainnet"}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          {wallet.connected && wallet.publicKey && (
            <span style={{ fontSize: fontSize.xs, color: colors.text.secondary }}>
              {wallet.publicKey.toString().slice(0, 4)}...{wallet.publicKey.toString().slice(-4)}
            </span>
          )}
          <WalletMultiButton />
        </div>
      </div>
    </div>
  );
}

export default WalletHeader;
