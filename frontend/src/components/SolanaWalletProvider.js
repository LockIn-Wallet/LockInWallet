import React from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";

// Import utility functions
import { NETWORKS } from "../utils/walletUtils.js";

function SolanaWalletProvider({ children, networkType, selectedNetwork }) {
  const network =
    networkType === "solana"
      ? NETWORKS.solana[selectedNetwork]?.network || WalletAdapterNetwork.Devnet
      : WalletAdapterNetwork.Devnet;
  const endpoint =
    networkType === "solana"
      ? NETWORKS.solana[selectedNetwork]?.rpcUrl || "http://127.0.0.1:8899"
      : "http://127.0.0.1:8899";

  // Debug network configuration lookup
  console.log('🔍 DEBUGGING: SolanaWalletProvider endpoint calculation:', {
    networkType,
    selectedNetwork,
    availableNetworks: Object.keys(NETWORKS.solana),
    networkConfig: NETWORKS.solana[selectedNetwork],
    rpcUrl: NETWORKS.solana[selectedNetwork]?.rpcUrl,
    endpoint,
    network
  });

  // Add validation that endpoint is correctly calculated
  if (networkType === "solana" && selectedNetwork === "devnet") {
    if (endpoint === "http://127.0.0.1:8899") {
      console.error('❌ ENDPOINT ERROR: Selected devnet but endpoint is still localhost!');
      console.error('Expected: https://api.devnet.solana.com');
      console.error('Got:', endpoint);
    } else {
      console.log('✅ ENDPOINT CORRECT: Devnet endpoint properly set to:', endpoint);
    }
  }

  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  return (
    <ConnectionProvider key={`${networkType}-${selectedNetwork}`} endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default SolanaWalletProvider;