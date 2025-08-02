// Resolver

const StellarSdk = require("@stellar/stellar-sdk");
const { Buffer } = require("buffer");

const { Keypair, TransactionBuilder, Networks, Contract, nativeToScVal, rpc } =
  StellarSdk;

// Configuration
const ALICE_PRIVATE_KEY =
  "SABCJCNM2TQFPU7IBJZFMUMLYAXJ2GJE5RGP7AKAEBWDS7MRJM34DOS4";
const RESOLVER_CONTRACT_ADDRESS =
  "CBAX53DHRKMJU6UAH46OJKTBTW46AAL7RDWSI6PBHNMSDF72YJU4UNJG";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

/**
 * Withdraw tokens from escrow using secret via resolver
 * @param {string} escrowAddress - Escrow contract address
 * @param {string} secret - Secret to unlock the escrow (plain text)
 * @param {string} ownerPrivateKey - Resolver owner's private key (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function withdrawStellarToken(
  escrowAddress,
  secret,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Withdrawing tokens from escrow using secret...`);
    console.log(`Escrow Address: ${escrowAddress}`);
    console.log(`Secret: ${secret}`);
    console.log(`Resolver Owner: ${ownerKeypair.publicKey()}`);

    // Convert secret to 32-byte hash (same as used in hash lock creation)
    const secretHash = createSecretHash(secret);
    console.log(`Secret Hash: ${secretHash}`);

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: withdraw(env: Env, escrow: Address, secret: BytesN<32>)
    const operation = resolverContract.call(
      "withdraw",
      nativeToScVal(escrowAddress, { type: "address" }), // escrow parameter
      nativeToScVal(Buffer.from(secret, "utf8"), { type: "bytes" }) // secret parameter (BytesN<32>)
    );

    // Set owner as source (resolver uses its own address as caller internally)
    operation.source = ownerKeypair.publicKey();

    const transaction = new TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("Simulating transaction...");
    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    console.log("✅ Simulation successful");
    console.log("Preparing and submitting transaction...");

    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(ownerKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Withdraw transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Withdraw failed:", error.message);
    throw error;
  }
}

/**
 * Public withdraw - allows any resolver to withdraw after timeout
 * @param {string} escrowAddress - Escrow contract address
 * @param {string} secret - Secret to unlock the escrow
 * @param {string} ownerPrivateKey - Resolver owner's private key
 * @returns {Promise<string>} - Transaction hash
 */
async function publicWithdrawStellarToken(
  escrowAddress,
  secret,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Public withdrawing tokens from escrow using secret...`);
    console.log(`Escrow Address: ${escrowAddress}`);
    console.log(`Secret: ${secret}`);

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: public_withdraw(env: Env, escrow: Address, secret: BytesN<32>)
    const operation = resolverContract.call(
      "public_withdraw",
      nativeToScVal(escrowAddress, { type: "address" }),
      nativeToScVal(Buffer.from(secret, "utf8"), { type: "bytes" })
    );

    operation.source = ownerKeypair.publicKey();

    const transaction = new TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("Simulating public withdraw transaction...");
    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      throw new Error(
        `Public withdraw simulation failed: ${simulationResponse.error}`
      );
    }

    console.log("✅ Public withdraw simulation successful");
    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(ownerKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Public Withdraw transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Public Withdraw failed:", error.message);
    throw error;
  }
}

/**
 * Cancel escrow (returns funds to maker)
 * @param {string} escrowAddress - Escrow contract address
 * @param {string} ownerPrivateKey - Resolver owner's private key
 * @returns {Promise<string>} - Transaction hash
 */
async function cancelStellarEscrow(
  escrowAddress,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Canceling escrow (returning funds to maker)...`);
    console.log(`Escrow Address: ${escrowAddress}`);

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: cancel(env: Env, escrow: Address)
    const operation = resolverContract.call(
      "cancel",
      nativeToScVal(escrowAddress, { type: "address" })
    );

    operation.source = ownerKeypair.publicKey();

    const transaction = new TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("Simulating cancel transaction...");
    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      throw new Error(`Cancel simulation failed: ${simulationResponse.error}`);
    }

    console.log("✅ Cancel simulation successful");
    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(ownerKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Cancel transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Cancel failed:", error.message);
    throw error;
  }
}

/**
 * Public cancel escrow (allows any resolver to cancel after timeout)
 * @param {string} escrowAddress - Escrow contract address
 * @param {string} ownerPrivateKey - Resolver owner's private key
 * @returns {Promise<string>} - Transaction hash
 */
async function publicCancelStellarEscrow(
  escrowAddress,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Public canceling escrow...`);
    console.log(`Escrow Address: ${escrowAddress}`);

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: public_cancel(env: Env, escrow: Address)
    const operation = resolverContract.call(
      "public_cancel",
      nativeToScVal(escrowAddress, { type: "address" })
    );

    operation.source = ownerKeypair.publicKey();

    const transaction = new TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("Simulating public cancel transaction...");
    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      throw new Error(
        `Public cancel simulation failed: ${simulationResponse.error}`
      );
    }

    console.log("✅ Public cancel simulation successful");
    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(ownerKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Public Cancel transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Public Cancel failed:", error.message);
    throw error;
  }
}

/**
 * Create hash from secret (for verification)
 * @param {string} secret - Secret string
 * @returns {string} - Hash hex string
 */
function createSecretHash(secret) {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(secret).digest();
  return hash.toString("hex");
}

/**
 * Verify that a secret matches a hash lock
 * @param {string} secret - Secret string
 * @param {string} hashLock - Hash lock to verify against
 * @returns {boolean} - Whether secret matches hash lock
 */
function verifySecretHash(secret, hashLock) {
  const secretHash = createSecretHash(secret);
  return secretHash.toLowerCase() === hashLock.toLowerCase().replace("0x", "");
}

/**
 * Convenience function to withdraw with Alice's resolver
 * @param {string} escrowAddress - Escrow contract address
 * @param {string} secret - Secret to unlock
 * @returns {Promise<string>} - Transaction hash
 */
async function withdrawWithAlice(escrowAddress, secret) {
  return await withdrawStellarToken(escrowAddress, secret, ALICE_PRIVATE_KEY);
}

// Helper function to convert tokens to wei-like units (18 decimals)
function tokensToUnits(tokens) {
  return BigInt(tokens) * BigInt(10 ** 18);
}

// Export the functions
module.exports = withdrawStellarToken;
module.exports.withdrawStellarToken = withdrawStellarToken;
module.exports.publicWithdrawStellarToken = publicWithdrawStellarToken;
module.exports.cancelStellarEscrow = cancelStellarEscrow;
module.exports.publicCancelStellarEscrow = publicCancelStellarEscrow;
module.exports.withdrawWithAlice = withdrawWithAlice;
module.exports.createSecretHash = createSecretHash;
module.exports.verifySecretHash = verifySecretHash;
module.exports.tokensToUnits = tokensToUnits;

// If run directly, execute with example parameters
if (require.main === module) {
  console.log("🚀 Running withdrawStellarToken standalone...");

  async function runExample() {
    try {
      // Example parameters
      const escrowAddress = "EXAMPLE_ESCROW_CONTRACT_ADDRESS"; // Replace with actual escrow address
      const secret = "my_secret_password_123";
      const expectedHashLock = createSecretHash(secret);

      console.log("📋 Withdraw Parameters:");
      console.log(`Resolver Contract: ${RESOLVER_CONTRACT_ADDRESS}`);
      console.log(`Escrow Address: ${escrowAddress}`);
      console.log(`Secret: ${secret}`);
      console.log(`Expected Hash Lock: ${expectedHashLock}`);
      console.log(`Resolver Owner: ${aliceKeypair.publicKey()}`);

      // Verify secret matches expected hash
      console.log("\n🔐 Verifying secret...");
      const isValidSecret = verifySecretHash(secret, expectedHashLock);
      console.log(
        `Secret verification: ${isValidSecret ? "✅ Valid" : "❌ Invalid"}`
      );

      if (!isValidSecret) {
        throw new Error("Secret does not match expected hash lock");
      }

      // Note: In a real scenario, you would replace 'EXAMPLE_ESCROW_CONTRACT_ADDRESS'
      // with an actual deployed escrow contract address
      console.log("\n⚠️  Note: Using example escrow address");
      console.log(
        "In a real scenario, replace with actual deployed escrow contract address"
      );
      console.log("Example usage:");
      console.log(
        `await withdrawStellarToken('ACTUAL_ESCROW_ADDRESS', '${secret}');`
      );

      // Demonstrate the different withdraw/cancel functions available
      console.log("\n📚 Available Functions:");
      console.log(
        "1. withdrawStellarToken(escrow, secret) - Normal withdraw with secret"
      );
      console.log(
        "2. publicWithdrawStellarToken(escrow, secret) - Public withdraw after timeout"
      );
      console.log(
        "3. cancelStellarEscrow(escrow) - Cancel and return funds to maker"
      );
      console.log(
        "4. publicCancelStellarEscrow(escrow) - Public cancel after timeout"
      );

      // For demo purposes, we'll skip the actual transaction since we don't have a real escrow
      console.log(
        "\n🎯 Demo completed - replace escrow address to execute real transaction"
      );
    } catch (error) {
      console.error("💥 Error:", error.message);

      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure resolver contract is initialized");
      console.log("2. Check that Alice is the owner of resolver");
      console.log("3. Verify escrow contract address is correct");
      console.log("4. Ensure secret matches the hash lock used in escrow");
      console.log("5. Check that escrow has tokens to withdraw");
      console.log("6. Verify timing constraints (not too early, not too late)");
    }
  }

  runExample();
}
