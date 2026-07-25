// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title SavingsTimelock
 * @dev OpenZeppelin TimelockController that owns SavingsCore and every module
 *      proxy. All owner powers — UUPS upgrades, module (de)registration,
 *      cross-reference wiring, treasury configuration — must be scheduled
 *      here, sit out the public `minDelay`, and only then execute.
 *
 *      Intended wiring (no custom multisig — a Gnosis Safe holds the keys):
 *      - PROPOSER + CANCELLER: the project's Safe, so queueing (and pulling)
 *        a change requires the Safe's M-of-N confirmation via the Safe UI;
 *      - EXECUTOR: open (address(0)) — once the delay elapses, anyone may
 *        execute. Content approval stays with the Safe; only timing is free,
 *        and the Safe can cancel any queued operation during the delay.
 *
 *      The delay itself is changeable only through the queue (the inherited
 *      updateDelay is self-call-only), so shortening it is publicly visible
 *      for the full current delay first. Project invariant (documented in
 *      GOVERNANCE.md, enforced by process): delay ≥ 2× the users' 24h
 *      emergency bypass, preserving everyone's exit window.
 *
 *      Deliberately contains no logic of its own — a thin, audited surface.
 */
contract SavingsTimelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {}
}
