# Keeper

Pays for the two transactions a saver who arrives with a bank card and no coin
cannot yet make:

1. **Creating their deposit address** — `deployDepositAddressFor(vaultId, member)`
2. **Sweeping what lands on it** — `sweep(token)` on their deposit proxy

Native coin needs neither: the proxy forwards it inside `receive()`, in the same
transaction that delivered it. **ERC20 has no such hook** — a token transfer
notifies its recipient of nothing — so sweeping is the only way a card or
exchange deposit reaches the vault without the user paying for it. That is why
this service exists.

## It holds no privilege

Every call the keeper makes is permissionless. Anyone could make it, including
the user. Nothing here is on the critical path to anyone's money.

That is the whole design, and it is worth protecting:

- **If the keeper is down, the app still works.** The user pays their own gas —
  the same path that existed before this service, not a new fallback.
- **If the keeper's key leaks, you lose its gas balance.** Nothing else. It
  cannot move funds, change rules, or upgrade anything.
- **Never give the keeper a privileged function.** The moment a sponsored
  operation is `onlyKeeper`, the keeper becomes a single point of failure
  between users and their money, and you have quietly rebuilt custody.

Use a dedicated key. Never the deployer key — that one owns upgrades.

## What it cannot do

It can only sponsor *permissionless* operations. Creating a vault, setting
spending limits and requesting a withdrawal are all `msg.sender`-gated by
design, because they are authorisations only the account holder can give.

So this buys gasless **deposits**, not a gasless product. A user with no ETH
still cannot create their vault. That needs a smart account plus a paymaster,
which sponsors operations the user authorises — the category a keeper
structurally cannot touch. See `docs/GOOGLE_SIGNIN_PLAN.md`.

## Running it

```bash
cp keeper/.env.example keeper/.env    # then fill in KEEPER_PRIVATE_KEY
cd keeper && NETWORK=base npm start
```

Addresses are never hardcoded: the core comes from
`frontend/src/networkConfig.json`, and every module is resolved from the core's
on-chain registry — so an upgrade that moves a module needs no change here.

## How it works

One loop. Every cycle it walks the current membership, checks which deposit
addresses are actually holding tokens, and sweeps those.

It reconciles from **current state** rather than following events. This is
deliberate and worth keeping:

- Money often arrives at an address *before it is deployed* — a member is shown
  their address and hands it to an exchange long before any contract exists
  there. An event-driven keeper has nothing to react to.
- Anything that happened while the keeper was down is picked up on the next
  cycle, with no catch-up logic to get wrong.

An address is only deployed when something is actually sitting on it; deploying
on spec would be gas for nothing.

The cost is `O(members × tokens)` reads per cycle. Reads are cheap and parallel.
When the member count makes that bite, add a log-based fast path *in front of*
this loop and keep reconciliation as the periodic backstop — do not replace it.
Trading away the self-healing property to save RPC calls is a bad deal for a
service whose entire job is not losing deposits.

## Racing the user

The keeper and the user call the same functions, so they race, and the loser
reverts with `Already deployed` or `Nothing to sweep`.

**Those reverts mean success.** They are the system working correctly, and
`src/outcomes.js` classifies them as `RACED` rather than `FAILED` — alerting on
them would page somebody every time a user pressed a button at an awkward
moment. The matching is deliberately narrow so a genuine failure still surfaces.

The frontend must do the same: treat both reverts as success, or the common case
of everything working shows the user an error.

## Operating it

**Nonce serialisation** is the piece most likely to bite, and `src/sender.js`
handles it: one transaction at a time, nonce read fresh per send. Firing
concurrently from one key hands the node two transactions claiming the same
nonce — one is dropped, and the queue stalls behind the survivor. The symptom is
a keeper that looks alive, logs no errors, and silently delivers nothing.

**Funding.** The keeper stops and logs loudly below `MIN_BALANCE_ETH`. This
needs real monitoring: an out-of-gas keeper is invisible from the outside,
because the app keeps working and deposits merely stop arriving.

**Running two instances** is safe — they race each other and one wins — but
pointless, and it doubles the wasted gas on lost races. Prefer one instance
restarted quickly.

## Testing

Behaviour is covered in the Hardhat suite, where a real chain and real reverts
are available:

```bash
cd ethereum && npx hardhat test test/Keeper.ts
```
