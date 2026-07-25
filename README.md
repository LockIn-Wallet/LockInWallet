# LockIn Wallet

A self-custodial, multi-chain savings wallet with **spending rules you lock
in for yourself** — daily/weekly/monthly limits, timelocked changes, and a
guaranteed exit path. Hackers can't drain it; you can't impulse-spend it.

Runs on **Ethereum/EVM (Optimism)** and **Solana** behind one React app.

## How it protects you

- **Lock in your own limits** — daily/weekly/monthly caps enforced on-chain;
  raising them after lock-in takes a public 24h proposal.
- **Timelocked withdrawal addresses** — a new destination works only 24h
  after you request it, so a stolen key can't add its own drain address.
- **Emergency bypass** — you can always withdraw everything after a 24h
  request delay; nothing can lock you in forever.
- **Permanent deposit addresses** — deterministic per-user/per-vault
  addresses safe to save in exchanges.
- **Vaults** — personal and community savings pots with per-member limits
  and early-withdrawal penalties.
- **Referrals** — invite links recorded on-chain at lock-in
  ([incentives design](REFERRAL_INCENTIVES.md)).
- **Governed upgrades** — contract changes queue in a public timelock; the
  in-app Governance page shows what's pending, and you can exit before any
  change executes. See [GOVERNANCE.md](GOVERNANCE.md) and
  [SECURITY.md](SECURITY.md) for the honest trust model.

## Quick start (development)

```shell
npm run install:all        # install all workspace dependencies

npm run dev:evm            # EVM: local chain + deploy + frontend, all-in-one
# or
npm run solana:deploy-reliable && npm run frontend:start   # Solana

# app: http://localhost:3000  ·  chain: http://127.0.0.1:8545
```

Detailed guides: [ethereum/CLAUDE.md](ethereum/CLAUDE.md) (contracts,
modular architecture, deployment) · [solana/CLAUDE.md](solana/CLAUDE.md)
(Anchor programs) · [CLAUDE.md](CLAUDE.md) (workspace overview).

## Architecture in one paragraph

`SavingsCore` is a slim custody kernel (balances, deposits, withdrawal
flows, module registry). Every feature lives in a self-authenticating
UUPS-upgradeable module (limits, proposals, bypass, approvals, vaults,
referrals, PoolTogether) that users call directly. Ownership of everything
sits behind a Gnosis Safe → Timelock governance chain, so upgrades are
M-of-N-approved and publicly delayed. The Solana side mirrors the same
features with Anchor programs and PDAs; one React frontend drives both
through chain-agnostic adapters.

## Documentation

| Doc | What's inside |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) | Release notes — every contract change with its on-chain effect |
| [SECURITY.md](SECURITY.md) | Protections, trust model, vulnerability disclosure |
| [GOVERNANCE.md](GOVERNANCE.md) | Upgrade process, timelock, multisig signer selection |
| [REFERRAL_INCENTIVES.md](REFERRAL_INCENTIVES.md) | Referral program incentives design |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common development issues |

## Community

[Discord](https://discord.gg/ZjYQjZX5XS) · Security reports: see
[SECURITY.md](SECURITY.md) — please don't open public issues for
vulnerabilities.
