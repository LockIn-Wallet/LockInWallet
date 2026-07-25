const SavingsABI = require('../../SavingsABI.json');
const ProposalABI = require('../../ProposalSystemModuleABI.json');
const ApprovalABI = require('../../ApprovalSystemModuleABI.json');
const TimePeriodABI = require('../../TimePeriodLimitsModuleABI.json');

/**
 * ABI surface contract tests (Pattern B architecture)
 *
 * SavingsCore is a custody kernel: balances, deposits, withdrawal flows and
 * the module registry. Every user-facing feature lives in a self-
 * authenticating module called directly. If a removed forwarder reappears in
 * the core ABI — or a feature function goes missing from its module ABI —
 * code will compile but crash at runtime (that is exactly how the
 * "savings.isSetupCommitted is not a function" bug reached the browser).
 */

const fnNames = (abi) =>
  new Set(abi.filter((e) => e.type === 'function').map((e) => e.name));

describe('SavingsCore kernel ABI surface', () => {
  const core = fnNames(SavingsABI);

  test('keeps the custody kernel functions', () => {
    for (const fn of [
      'deposit',
      'depositTo',
      'withdraw',
      'withdrawTo',
      'withdrawAll',
      'getTokenBalance',
      'updateTokenBalance',
      'transferTokensTo',
      'registerModule',
      'getModule',
      'isAuthorizedModule',
      'setupModuleCrossReferences',
    ]) {
      expect(core).toContain(fn);
    }
  });

  test('contains none of the removed per-feature forwarders', () => {
    for (const fn of [
      'isSetupCommitted',
      'commitSetup',
      'commitSetupWithReferrer',
      'commitInitialSetup',
      'setCommonPeriodLimits',
      'addTimePeriodLimit',
      'getUserSpendingLimits',
      'proposeLimitChange',
      'executeLimitProposal',
      'requestLimitBypass',
      'executeBypassWithdrawal',
      'getUserWithdrawalAddresses',
      'requestWithdrawalAddress',
      'addWithdrawalAddressDirect',
      'executeWithdrawalAddressRequest',
      'deployUserProxy',
      'getProxyDeploymentFee',
      'depositToPoolTogether',
      'claimPoolTogetherPrize',
    ]) {
      expect(core).not.toContain(fn);
    }
  });
});

describe('module ABIs carry the moved user-facing functions', () => {
  test('ProposalSystemModule owns setup and proposals', () => {
    const proposal = fnNames(ProposalABI);
    for (const fn of [
      'commitSetup',
      'commitSetupWithReferrer',
      'commitInitialSetup',
      'isSetupCommitted',
      'proposeLimitChange',
      'executeLimitProposal',
      'getUserPendingProposals',
    ]) {
      expect(proposal).toContain(fn);
    }
  });

  test('ApprovalSystemModule owns withdrawal destinations', () => {
    const approval = fnNames(ApprovalABI);
    for (const fn of [
      'requestWithdrawalAddress',
      'addWithdrawalAddressDirect',
      'executeWithdrawalAddressRequest',
      'cancelWithdrawalAddressRequest',
      'removeWithdrawalAddress',
      'getUserWithdrawalAddresses',
      'getUserPendingWithdrawalRequests',
    ]) {
      expect(approval).toContain(fn);
    }
  });

  test('TimePeriodLimitsModule owns spending limits', () => {
    const limits = fnNames(TimePeriodABI);
    for (const fn of [
      'setCommonPeriodLimits',
      'addTimePeriodLimit',
      'getUserSpendingLimits',
      'setProposalSystemModule',
    ]) {
      expect(limits).toContain(fn);
    }
  });
});
