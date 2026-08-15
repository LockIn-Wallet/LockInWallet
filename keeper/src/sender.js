/**
 * One transaction at a time, with the nonce read fresh.
 *
 * Everything the keeper sends goes through here, and it is the single most
 * load-bearing piece of the service. A keeper that fires several transactions
 * concurrently from one key hands the node two transactions claiming the same
 * nonce: one is dropped, and if the survivor is underpriced the whole queue
 * stalls behind it. The symptom is a keeper that looks alive, logs no errors,
 * and silently stops delivering anyone's deposits.
 *
 * Serialising is not a performance problem at this scale — a sweep is worth
 * cents and users are not watching the clock — and it removes an entire class
 * of failure. Optimise this only with evidence that throughput actually binds.
 */

class Sender {
  /**
   * @param {object} signer   an ethers Signer
   * @param {object} [opts]
   * @param {number} [opts.confirmations] blocks to wait before returning
   * @param {function} [opts.log]
   */
  constructor(signer, { confirmations = 1, log = () => {} } = {}) {
    this.signer = signer;
    this.confirmations = confirmations;
    this.log = log;
    // The tail of the queue. Each send chains onto it, so only one is ever in
    // flight regardless of how many callers race to start one.
    this.queue = Promise.resolve();
  }

  /**
   * Send a transaction, waiting for anything already queued.
   *
   * @param {function} build receives overrides (including the nonce) and
   *   returns the contract-call promise, e.g.
   *   `send(o => contract.doThing(arg, o))`
   * @returns {Promise<object>} the receipt
   */
  async send(build) {
    const run = this.queue.then(
      () => this._sendNow(build),
      // A failure upstream must not poison the queue for everyone behind it.
      () => this._sendNow(build)
    );

    // Keep the chain going whether this one worked or not, but never leave an
    // unhandled rejection behind on the internal handle.
    this.queue = run.then(
      () => undefined,
      () => undefined
    );

    return run;
  }

  async _sendNow(build) {
    const address = await this.signer.getAddress();
    // Read the nonce per transaction rather than tracking it in memory. A
    // cached counter drifts the moment anything else spends from this key — a
    // manual top-up, a second process, an operator with the same wallet — and
    // the drift only shows up as a stuck queue much later.
    const nonce = await this.signer.provider.getTransactionCount(address, 'pending');

    const tx = await build({ nonce });

    // The nonce above belongs to this signer. If the caller handed us a
    // contract connected to a different account, the transaction goes out from
    // that account carrying a nonce that means nothing to it — which surfaces
    // as a baffling "nonce too low" rather than the wiring mistake it is.
    if (tx.from && tx.from.toLowerCase() !== address.toLowerCase()) {
      throw new Error(
        `Sender signs for ${address} but the transaction was built from ${tx.from}. ` +
          `Connect the contract to the keeper's signer.`
      );
    }

    this.log(`sent ${tx.hash} (nonce ${nonce})`);

    const receipt = await tx.wait(this.confirmations);
    if (receipt.status !== 1) {
      throw new Error(`Transaction ${tx.hash} reverted on-chain`);
    }
    return receipt;
  }
}

module.exports = { Sender };
