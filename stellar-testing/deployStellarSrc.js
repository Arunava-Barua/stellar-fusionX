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
 * Deploy escrow source contract via resolver
 * @param {string} callerAddress - Address of the caller (executive resolver)
 * @param {string} orderId - Order ID (32 bytes hex string)
 * @param {string} ownerPrivateKey - Owner's private key (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function deployStellarSrc(
  callerAddress,
  orderId,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Deploying escrow source via resolver...`);
    console.log(`Caller: ${callerAddress}`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Owner: ${ownerKeypair.publicKey()}`);

    // Validate order ID format (should be 32 bytes)
    const orderIdBuffer = Buffer.from(orderId.replace("0x", ""), "hex");
    if (orderIdBuffer.length !== 32) {
      throw new Error("Order ID must be exactly 32 bytes (64 hex characters)");
    }

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: deploy_escrow_src(env: Env, caller: Address, order_id: BytesN<32>)
    const operation = resolverContract.call(
      "deploy_escrow_src",
      nativeToScVal(callerAddress, { type: "address" }), // caller parameter
      nativeToScVal(orderIdBuffer, { type: "bytes" }) // order_id parameter (BytesN<32>)
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

    console.log(`✅ Deploy Escrow Src transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Deploy Escrow Src failed:", error.message);
    throw error;
  }
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
 * Convenience function using Alice as caller
 * @param {string} orderId - Order ID (optional, generates random if not provided)
 * @returns {Promise<string>} - Transaction hash
 */
async function deployWithAlice(orderId) {
  const orderIdToUse = orderId || generateOrderId();
  return await deployStellarSrc(aliceKeypair.publicKey(), orderIdToUse);
}

/**
 * Check if an order exists in Dutch Auction
 * @param {string} orderId - Order ID to check
 * @returns {Promise<boolean>} - Whether order exists
 */
async function checkOrderExists(orderId) {
  try {
    console.log(`Checking if order exists: ${orderId}`);

    // You would need to implement this based on Dutch Auction contract
    // This is a placeholder
    console.log("⚠️ Order existence check not implemented yet");
    return true;
  } catch (error) {
    console.error("❌ Error checking order:", error.message);
    return false;
  }
}

// Helper function to convert tokens to wei-like units (18 decimals)
function tokensToUnits(tokens) {
  return BigInt(tokens) * BigInt(10 ** 18);
}

// Export the functions
module.exports = deployStellarSrc;
module.exports.deployStellarSrc = deployStellarSrc;
module.exports.deployWithAlice = deployWithAlice;
module.exports.generateOrderId = generateOrderId;
module.exports.checkOrderExists = checkOrderExists;
module.exports.tokensToUnits = tokensToUnits;

// If run directly, execute with example parameters
if (require.main === module) {
  console.log("🚀 Running deployStellarSrc standalone...");

  async function runExample() {
    try {
      // Generate a random order ID for testing
      const orderId = generateOrderId();
      console.log(`Generated Order ID: ${orderId}`);

      // Use Alice as both owner and caller for testing
      const callerAddress = aliceKeypair.publicKey();

      console.log("\n📋 Deploy Parameters:");
      console.log(`Resolver Contract: ${RESOLVER_CONTRACT_ADDRESS}`);
      console.log(`Caller: ${callerAddress}`);
      console.log(`Order ID: ${orderId}`);
      console.log(`Owner: ${aliceKeypair.publicKey()}`);

      // Deploy escrow source
      console.log("\n🏗️ Deploying escrow source...");
      const hash = await deployStellarSrc(callerAddress, orderId);
      console.log(`🎉 Deploy Success! Hash: ${hash}`);

      console.log("\n📝 What happened:");
      console.log("1. Resolver called Dutch Auction fillOrder()");
      console.log("2. Dutch Auction deployed escrow source contract");
      console.log("3. Escrow source contract is now ready for deposits");
    } catch (error) {
      console.error("💥 Error:", error.message);

      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure resolver contract is initialized");
      console.log("2. Check that Alice is the owner of resolver");
      console.log("3. Verify Dutch Auction and Escrow Factory are set");
      console.log("4. Ensure order ID is valid (32 bytes)");
      console.log("5. Check that all contracts are properly deployed");
    }
  }

  runExample();
}
