/**
 * What happened when the keeper tried to do something.
 *
 * The keeper races the user by design: both may call the same permissionless
 * function, and whoever arrives second reverts. That revert is the system
 * working, not a failure — so it gets its own outcome rather than being lumped
 * in with real errors. Alerting on it would page somebody every time a user
 * pressed a button at the wrong moment.
 */
const OUTCOME = {
  /** We did it. */
  DONE: 'done',
  /** Somebody else already did it — the user, or another keeper instance. */
  RACED: 'raced',
  /** There was nothing to do. */
  IDLE: 'idle',
  /** It genuinely failed and is worth looking at. */
  FAILED: 'failed',
};

/**
 * Reverts that mean "already handled", keyed by the action that can hit them.
 * Deliberately narrow: matching loosely here would hide real failures behind
 * the same silence we give a benign race.
 */
const RACE_REVERTS = [
  'Already deployed',
  'Nothing to sweep',
];

/**
 * The revert reason can sit in any of several places depending on the provider,
 * so search them all rather than trusting one shape.
 */
function revertReason(error) {
  return [
    error?.reason,
    error?.shortMessage,
    error?.message,
    error?.info?.error?.message,
    error?.error?.message,
    error?.data?.message,
  ]
    .filter(Boolean)
    .join(' | ');
}

/** True when this failure means somebody else got there first. */
function isRace(error) {
  const haystack = revertReason(error);
  return RACE_REVERTS.some((reason) => haystack.includes(reason));
}

module.exports = { OUTCOME, RACE_REVERTS, isRace, revertReason };
