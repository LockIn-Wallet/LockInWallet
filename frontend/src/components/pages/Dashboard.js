import React, { useState, useEffect, useCallback } from "react";
import {
  cardStyles,
  buttonStyles,
  colors,
  spacing,
  fontSize,
  borderRadius,
} from "../../styles";
import VaultCard from "../molecules/VaultCard.js";

function Dashboard({ transactionManager, navigate }) {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVaults = useCallback(async () => {
    try {
      setLoading(true);
      const userVaults = await transactionManager.getUserVaults();
      setVaults(userVaults);
    } catch (err) {
      console.error("Failed to load vaults:", err);
    } finally {
      setLoading(false);
    }
  }, [transactionManager]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  return (
    <div>
      {/* Action buttons */}
      <div style={{
        display: "flex",
        gap: spacing.md,
        marginBottom: spacing.xl,
      }}>
        <button
          style={buttonStyles.primary}
          onClick={() => navigate("/create")}
        >
          + Create Vault
        </button>
        <button
          style={buttonStyles.secondary}
          onClick={() => navigate("/explore")}
        >
          Explore Vaults
        </button>
        <button
          style={{ ...buttonStyles.secondary, marginLeft: "auto" }}
          onClick={loadVaults}
        >
          Refresh
        </button>
      </div>

      {/* Vault list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: spacing.xxl, color: colors.text.secondary }}>
          Loading your vaults...
        </div>
      ) : vaults.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          color: colors.text.secondary,
          backgroundColor: colors.background.primary,
          borderRadius: borderRadius.md,
          border: `1px dashed ${colors.border?.default || "#4a5568"}`,
        }}>
          <p style={{ fontSize: fontSize.lg, marginBottom: spacing.md }}>
            No vaults yet
          </p>
          <p style={{ marginBottom: spacing.xl }}>
            Create a personal vault to start saving, or explore community vaults to join.
          </p>
          <div style={{ display: "flex", gap: spacing.md, justifyContent: "center" }}>
            <button style={buttonStyles.primary} onClick={() => navigate("/create")}>
              Create Your First Vault
            </button>
            <button style={buttonStyles.secondary} onClick={() => navigate("/explore")}>
              Browse Community Vaults
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: spacing.lg,
        }}>
          {vaults.map(({ vault, membership }) => (
            <VaultCard
              key={vault.address}
              vault={vault}
              membership={membership}
              onClick={() => navigate(`/vault/${vault.address}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
