import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SavingsCore } from "../target/types/savings_core";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("savings-core", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SavingsCore as Program<SavingsCore>;
  const user = provider.wallet;

  // Derive the savings account PDA
  const [savingsAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("savings"), user.publicKey.toBuffer()],
    program.programId
  );

  console.log("Program ID:", program.programId.toString());
  console.log("User:", user.publicKey.toString());
  console.log("Savings Account PDA:", savingsAccountPda.toString());

  it("Can initialize a savings account", async () => {
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          savingsAccount: savingsAccountPda,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize transaction signature:", tx);

      // Fetch the account and check it was initialized correctly
      const account = await program.account.savingsAccount.fetch(savingsAccountPda);

      assert.ok(account.owner.equals(user.publicKey));
      assert.equal(account.solBalance.toString(), "0");
      assert.equal(account.splBalances.length, 0);

      console.log("✅ Account initialized successfully");
    } catch (error) {
      // If account already exists, that's fine for testing
      if (error.message.includes("already in use")) {
        console.log("ℹ️  Account already exists, skipping initialization");
      } else {
        throw error;
      }
    }
  });

  it("Can deposit SOL", async () => {
    const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL

    // Get initial balance
    let account;
    try {
      account = await program.account.savingsAccount.fetch(savingsAccountPda);
    } catch (error) {
      // If account doesn't exist, it will be created
      account = { solBalance: new anchor.BN(0) };
    }

    const initialBalance = account.solBalance;

    const tx = await program.methods
      .depositSol(new anchor.BN(depositAmount))
      .accounts({
        savingsAccount: savingsAccountPda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Deposit SOL transaction signature:", tx);

    // Fetch the updated account
    const updatedAccount = await program.account.savingsAccount.fetch(savingsAccountPda);

    const expectedBalance = initialBalance.add(new anchor.BN(depositAmount));
    assert.ok(updatedAccount.solBalance.eq(expectedBalance));

    console.log("✅ SOL deposited successfully");
    console.log("Previous balance:", initialBalance.toString());
    console.log("New balance:", updatedAccount.solBalance.toString());
  });

  it("Can get SOL balance", async () => {
    // This test assumes a previous deposit was made
    const account = await program.account.savingsAccount.fetch(savingsAccountPda);

    console.log("Current SOL balance:", account.solBalance.toString());
    assert.ok(account.solBalance.gt(new anchor.BN(0)));

    console.log("✅ SOL balance retrieved successfully");
  });
});