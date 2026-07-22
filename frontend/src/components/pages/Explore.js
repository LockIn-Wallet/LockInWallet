import React, { useState, useEffect, useCallback } from "react";
import {
  buttonStyles,
  formStyles,
  colors,
  spacing,
  fontSize,
  borderRadius,
} from "../../styles";
import VaultCard from "../molecules/VaultCard.js";

function Explore({ transactionManager, navigate, wallet }) {
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all", "community", "native", "token"
  const [search, setSearch] = useState("");

  const loadVaults = useCallback(async () => {
    try {
      setLoading(true);
      const opts = {};
      if (filter === "community") opts.vaultType = "Community";
      const discovered = await transactionManager.discoverVaults(opts);
      setVaults(discovered);
    } catch (err) {
      console.error("Failed to discover vaults:", err);
    } finally {
      setLoading(false);
    }
  }, [transactionManager, filter]);

  useEffect(() => { loadVaults(); }, [loadVaults]);

  const filtered = vaults.filter((v) => {
    if (filter === "native" && !v.isNativeToken) return false;
    if (filter === "token" && v.isNativeToken) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <button
        style={{ ...buttonStyles.secondary, marginBottom: spacing.lg }}
        onClick={() => navigate("/")}
      >
        &larr; Back
      </button>

      <h2 style={{ color: "white", marginBottom: spacing.lg }}>Explore Vaults</h2>

      {/* Filters */}
      <div style={{
        display: "flex",
        gap: spacing.md,
        marginBottom: spacing.xl,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <input
          style={{ ...formStyles.input, flex: 1, minWidth: "200px" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
        />
        {["all", "community", "native", "token"].map((f) => (
          <button
            key={f}
            style={{
              ...buttonStyles.secondary,
              border: filter === f ? `2px solid ${colors.success.main}` : "2px solid transparent",
              textTransform: "capitalize",
            }}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "token" ? "Tokens" : f === "native" ? "Native Coin" : "Community"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: colors.text.secondary }}>
          Discovering vaults...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          color: colors.text.secondary,
          backgroundColor: colors.background.primary,
          borderRadius: borderRadius.md,
        }}>
          No vaults found. Be the first to create one!
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: spacing.lg,
        }}>
          {filtered.map((vault) => (
            <VaultCard
              key={vault.address}
              vault={vault}
              onClick={() => navigate(`/vault/${vault.address}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Explore;
