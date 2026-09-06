import { ethers } from "ethers";

import LockedVaultFactoryABI from "../LockedVaultFactoryABI.json";
import LockedVaultABI from "../LockedVaultABI.json";
import ERC20ABI from "../ERC20ABI.json";

import { getTokenMeta, isNativeTokenAddress } from "./tokenUtils.js";
import { CONDITION_KINDS, findPriceFeed } from "./locks.js";

const ZERO = ethers.ZeroAddress;

/**
 * Read-only access to locked vaults on one network.
 *
 * Shared by the adapter (with a signer) and the public proof page (with a
 * plain RPC provider), so a lock decodes the same way whether its owner or a
 * stranger is looking at it.
 */
export const createLockReader = (networkConfig, runner) => {
  const factoryAddress = networkConfig?.lockedVaultFactory;
  const available = Boolean(factoryAddress) && factoryAddress !== ZERO;
  const factory = available
    ? new ethers.Contract(factoryAddress, LockedVaultFactoryABI, runner)
    : null;

  const vaultAt = (address) => new ethers.Contract(address, LockedVaultABI, runner);

  const decodeCondition = async (conditionAddress) => {
    if (!conditionAddress || conditionAddress === ZERO) return null;
    const raw = await factory.describeCondition(conditionAddress);
    const kind = CONDITION_KINDS[Number(raw.kind)] || "None";
    const feed = findPriceFeed(networkConfig, raw.feed);
    return {
      address: conditionAddress,
      kind,
      verified: kind !== "None" && (kind !== "Price" || Boolean(feed)),
      unlockAt: Number(raw.unlockAt),
      feed: raw.feed,
      feedLabel: feed?.label || null,
      threshold: feed ? Number(ethers.formatUnits(raw.threshold, feed.decimals)) : Number(raw.threshold),
      above: Boolean(raw.above),
      maxStaleness: Number(raw.maxStaleness),
      members: Array.from(raw.members || []),
    };
  };

  const balanceOf = async (lockAddress, tokenAddress) => {
    if (isNativeTokenAddress(tokenAddress)) return runner.provider
      ? runner.provider.getBalance(lockAddress)
      : runner.getBalance(lockAddress);
    return new ethers.Contract(tokenAddress, ERC20ABI, runner).balanceOf(lockAddress);
  };

  /**
   * Every balance the lock holds among the tokens this app knows, plus any
   * extra addresses the caller asks about (a custom token the owner locked).
   */
  const readBalances = async (lockAddress, extraTokens = []) => {
    const known = Object.values(networkConfig?.tokens || {})
      .map((token) => token.address)
      .filter((address) => address && address !== ZERO);
    const candidates = [ZERO, ...new Set([...known, ...extraTokens.filter(Boolean)])];
    const raws = await Promise.all(candidates.map((token) => balanceOf(lockAddress, token)));
    return candidates
      .map((token, index) => {
        const meta = getTokenMeta(networkConfig, token);
        return {
          token,
          symbol: meta.symbol,
          decimals: meta.decimals,
          raw: raws[index],
          formatted: ethers.formatUnits(raws[index], meta.decimals),
        };
      })
      .filter((entry) => entry.raw > 0n);
  };

  const getLock = async (lockAddress, extraTokens = []) => {
    if (!available) return null;
    if (!(await factory.isLock(lockAddress))) return null;
    const [described, condition] = await Promise.all([
      factory.describeLock(lockAddress),
      factory.describeLock(lockAddress).then((d) => decodeCondition(d.condition)),
    ]);
    const balances = await readBalances(lockAddress, extraTokens);
    return {
      address: lockAddress,
      owner: described.owner,
      deadline: Number(described.deadline),
      unlocked: Boolean(described.unlocked),
      condition,
      verified: !condition || condition.verified,
      balances,
      hasBalance: balances.length > 0,
    };
  };

  const getLocks = async (owner, extraTokens = []) => {
    if (!available) return [];
    const addresses = await factory.getLocks(owner);
    return Promise.all(addresses.map((address) => getLock(address, extraTokens)));
  };

  return { available, factory, vaultAt, getLock, getLocks, decodeCondition };
};
