// Resolver
// CHECKED

const StellarSdk = require("@stellar/stellar-sdk");
const { Buffer } = require("buffer");

const { Keypair, TransactionBuilder, Networks, Contract, nativeToScVal, rpc } =
  StellarSdk;

// Configuration
const ALICE_PRIVATE_KEY =
  "SABCJCNM2TQFPU7IBJZFMUMLYAXJ2GJE5RGP7AKAEBWDS7MRJM34DOS4";
const RESOLVER_CONTRACT_ADDRESS =
  "CBAX53DHRKMJU6UAH46OJKTBTW46AAL7RDWSI6PBHNMSDF72YJU4UNJG";
const MOCK_TOKEN_CONTRACT_ADDRESS =
  "CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

/**
 * Deploy escrow destination contract via resolver
 * @param {string} callerAddress - Address of the caller (executive resolver)
 * @param {string} orderId - Order ID (32 bytes hex string)
 * @param {string} hashLock - Hash lock (32 bytes hex string)
 * @param {string} tokenOutAddress - Token out contract address
 * @param {string|number} amountOut - Amount out (in token units)
 * @param {string} makerAddress - Maker address
 * @param {string} ownerPrivateKey - Owner's private key (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function deployStellarDest(
  callerAddress,
  orderId,
  hashLock,
  tokenOutAddress,
  amountOut,
  makerAddress,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Deploying escrow destination via resolver...`);
    console.log(`Caller: ${callerAddress}`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Hash Lock: ${hashLock}`);
    console.log(`Token Out: ${tokenOutAddress}`);
    console.log(`Amount Out: ${amountOut}`);
    console.log(`Maker: ${makerAddress}`);
    console.log(`Owner: ${ownerKeypair.publicKey()}`);

    // Validate order ID format (should be 32 bytes)
    const orderIdBuffer = Buffer.from(orderId.replace("0x", ""), "hex");
    if (orderIdBuffer.length !== 32) {
      throw new Error("Order ID must be exactly 32 bytes (64 hex characters)");
    }

    // Validate hash lock format (should be 32 bytes)
    const hashLockBuffer = Buffer.from(hashLock.replace("0x", ""), "hex");
    if (hashLockBuffer.length !== 32) {
      throw new Error("Hash lock must be exactly 32 bytes (64 hex characters)");
    }

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: deploy_escrow_dest(env, caller, order_id, hash_lock, token_out, amount_out, maker)
    const operation = resolverContract.call(
      "deploy_escrow_dest",
      nativeToScVal(callerAddress, { type: "address" }), // caller parameter
      nativeToScVal(orderIdBuffer, { type: "bytes" }), // order_id parameter (BytesN<32>)
      nativeToScVal(hashLockBuffer, { type: "bytes" }), // hash_lock parameter (BytesN<32>)
      nativeToScVal(tokenOutAddress, { type: "address" }), // token_out parameter
      nativeToScVal(BigInt(amountOut), { type: "u128" }), // amount_out parameter
      nativeToScVal(makerAddress, { type: "address" }) // maker parameter
    );

    // Set owner as source for authorization (only_owner check)
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

    console.log(
      `✅ Deploy Escrow Dest transaction submitted: ${response.hash}`
    );
    return response.hash;
  } catch (error) {
    console.error("❌ Deploy Escrow Dest failed:", error.message);
    throw error;
  }
}

/**
 * Generate a random hash lock (32 bytes)
 * @returns {string} - Hex string hash lock
 */
function generateHashLock() {
  const randomBytes = Buffer.allocUnsafe(32);
  require("crypto").randomFillSync(randomBytes);
  return randomBytes.toString("hex");
}

/**
 * Generate a random order ID (32 bytes)
 * @returns {string} - Hex string order ID
 */
function generateOrderId() {
  const randomBytes = Buffer.allocUnsafe(32);
  require("crypto").randomFillSync(randomBytes);
  return randomBytes.toString("hex");
}

/**
 * Convenience function using Alice as caller and maker with default mock token
 * @param {string} orderId - Order ID (optional, generates random if not provided)
 * @param {string} hashLock - Hash lock (optional, generates random if not provided)
 * @param {string|number} amountOut - Amount out in token units
 * @returns {Promise<string>} - Transaction hash
 */
async function deployDestWithAlice(
  orderId,
  hashLock,
  amountOut = tokensToUnits(100)
) {
  const orderIdToUse = orderId || generateOrderId();
  const hashLockToUse = hashLock || generateHashLock();

  return await deployStellarDest(
    aliceKeypair.publicKey(), // caller (executive resolver)
    orderIdToUse, // order_id
    hashLockToUse, // hash_lock
    MOCK_TOKEN_CONTRACT_ADDRESS, // token_out (mock token)
    amountOut, // amount_out
    aliceKeypair.publicKey() // maker
  );
}

/**
 * Create hash lock from a secret
 * @param {string} secret - Secret string
 * @returns {string} - Hash lock hex string
 */
function createHashLock(secret) {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(secret).digest();
  return hash.toString("hex");
}

/**
 * Validate hash lock format
 * @param {string} hashLock - Hash lock to validate
 * @returns {boolean} - Whether hash lock is valid
 */
function validateHashLock(hashLock) {
  try {
    const buffer = Buffer.from(hashLock.replace("0x", ""), "hex");
    return buffer.length === 32;
  } catch (error) {
    return false;
  }
}

// Helper function to convert tokens to wei-like units (18 decimals)
function tokensToUnits(tokens) {
  return BigInt(tokens) * BigInt(10 ** 18);
}

// Helper function to convert units back to tokens (18 decimals)
function unitsToTokens(units) {
  return Number(BigInt(units) / BigInt(10 ** 18));
}

// Export the functions
module.exports = deployStellarDest;
module.exports.deployStellarDest = deployStellarDest;
module.exports.deployDestWithAlice = deployDestWithAlice;
module.exports.generateOrderId = generateOrderId;
module.exports.generateHashLock = generateHashLock;
module.exports.createHashLock = createHashLock;
module.exports.validateHashLock = validateHashLock;
module.exports.tokensToUnits = tokensToUnits;
module.exports.unitsToTokens = unitsToTokens;

// If run directly, execute with example parameters
if (require.main === module) {
  console.log("🚀 Running deployStellarDest standalone...");

  async function runExample() {
    try {
      // Generate parameters for testing
      const orderId = generateOrderId();
      const secret = "my_secret_password_123";
      const hashLock = createHashLock(secret);
      const amountOut = tokensToUnits(5); // 5 tokens

      console.log(`Generated Order ID: ${orderId}`);
      console.log(`Secret: ${secret}`);
      console.log(`Hash Lock: ${hashLock}`);
      console.log(
        `Amount Out: ${amountOut} (${unitsToTokens(amountOut)} tokens)`
      );

      // Use Alice as caller, maker, and owner for testing
      const callerAddress = aliceKeypair.publicKey();
      const makerAddress = aliceKeypair.publicKey();
      const tokenOutAddress = MOCK_TOKEN_CONTRACT_ADDRESS;

      console.log("\n📋 Deploy Parameters:");
      console.log(`Resolver Contract: ${RESOLVER_CONTRACT_ADDRESS}`);
      console.log(`Caller: ${callerAddress}`);
      console.log(`Order ID: ${orderId}`);
      console.log(`Hash Lock: ${hashLock}`);
      console.log(`Token Out: ${tokenOutAddress}`);
      console.log(`Amount Out: ${amountOut}`);
      console.log(`Maker: ${makerAddress}`);
      console.log(`Owner: ${aliceKeypair.publicKey()}`);

      // Deploy escrow destination
      console.log("\n🏗️ Deploying escrow destination...");
      const hash = await deployStellarDest(
        callerAddress,
        orderId,
        hashLock,
        tokenOutAddress,
        amountOut.toString(),
        makerAddress
      );
      console.log(`🎉 Deploy Success! Hash: ${hash}`);

      console.log("\n📝 What happened:");
      console.log("1. Resolver called Escrow Factory deploy_dest()");
      console.log("2. Escrow Factory deployed escrow destination contract");
      console.log(
        "3. Escrow destination contract is now ready for token deposits"
      );
      console.log("4. The hash lock will require the secret to unlock funds");

      console.log("\n🔐 Important:");
      console.log(`Secret to unlock: "${secret}"`);
      console.log(`Hash Lock: ${hashLock}`);
    } catch (error) {
      console.error("💥 Error:", error.message);

      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure resolver contract is initialized");
      console.log("2. Check that Alice is the owner of resolver");
      console.log("3. Verify Escrow Factory is set in resolver");
      console.log("4. Ensure order ID is valid (32 bytes)");
      console.log("5. Ensure hash lock is valid (32 bytes)");
      console.log("6. Check that token out address is valid");
      console.log("7. Check that all contracts are properly deployed");
    }
  }

  runExample();
}
