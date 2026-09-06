/**
 * The fork a new wallet is asked: a spending limit, or an outright lock.
 *
 * What matters is that the lock path is offered only where locks exist, that
 * both options are always described, and that the copy never promises a lock
 * has an exit. The rendering itself is a handful of buttons; these cover the
 * decisions behind them.
 */

const {
  SETUP_PATHS,
  SETUP_PATH_CHOICE,
  LOCK_CONFIRMATION,
} = require("../../utils/lockContent.js");

describe("Setup path choice", () => {
  test("offers exactly the two ways in", () => {
    expect(SETUP_PATH_CHOICE.options.map((option) => option.key)).toEqual([
      SETUP_PATHS.limits,
      SETUP_PATHS.lock,
    ]);
  });

  test("every option carries a title, an explanation and its own button label", () => {
    for (const option of SETUP_PATH_CHOICE.options) {
      expect(option.title.length).toBeGreaterThan(0);
      expect(option.body.length).toBeGreaterThan(0);
      expect(option.cta.length).toBeGreaterThan(0);
    }
  });

  test("the lock option says outright that there is no emergency exit", () => {
    const lock = SETUP_PATH_CHOICE.options.find((option) => option.key === SETUP_PATHS.lock);
    expect(lock.body).toMatch(/no emergency exit/i);
  });

  test("the limit option promises the allowance is always available", () => {
    const limits = SETUP_PATH_CHOICE.options.find((option) => option.key === SETUP_PATHS.limits);
    expect(limits.body).toMatch(/always yours/i);
  });

  test("choosing one path does not close the other", () => {
    expect(SETUP_PATH_CHOICE.footnote).toMatch(/both/i);
  });

  test("the confirmation before a lock is created rules out every exit", () => {
    expect(LOCK_CONFIRMATION).toMatch(/no penalty exit/i);
    expect(LOCK_CONFIRMATION).toMatch(/no bypass/i);
  });
});
