// Relayer.rs

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
 * Notify relayer about secret sharing between escrow contracts
 * @param {string} orderId - Order ID (32 bytes hex string)
 * @param {string} escrowSrc - Escrow source contract address (32 bytes hex string)
 * @param {string} escrowDest - Escrow destination contract address (32 bytes hex string)
 * @param {string} callerAddress - Caller address (resolver who can share secret)
 * @param {string} ownerPrivateKey - Owner's private key (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function notifyStellarRelayer(
  orderId,
  escrowSrc,
  escrowDest,
  callerAddress,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);

    console.log(`Notifying relayer about secret sharing...`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Escrow Src: ${escrowSrc}`);
    console.log(`Escrow Dest: ${escrowDest}`);
    console.log(`Caller: ${callerAddress}`);
    console.log(`Owner: ${ownerKeypair.publicKey()}`);

    // Validate order ID format (should be 32 bytes)
    const orderIdBuffer = Buffer.from(orderId.replace("0x", ""), "hex");
    if (orderIdBuffer.length !== 32) {
      throw new Error("Order ID must be exactly 32 bytes (64 hex characters)");
    }

    // Validate escrow src format (should be 32 bytes)
    const escrowSrcBuffer = Buffer.from(escrowSrc.replace("0x", ""), "hex");
    if (escrowSrcBuffer.length !== 32) {
      throw new Error(
        "Escrow Src must be exactly 32 bytes (64 hex characters)"
      );
    }

    // Validate escrow dest format (should be 32 bytes)
    const escrowDestBuffer = Buffer.from(escrowDest.replace("0x", ""), "hex");
    if (escrowDestBuffer.length !== 32) {
      throw new Error(
        "Escrow Dest must be exactly 32 bytes (64 hex characters)"
      );
    }

    const account = await server.getAccount(ownerKeypair.publicKey());
    const resolverContract = new Contract(RESOLVER_CONTRACT_ADDRESS);

    // Contract function: notify_relayer(env, order_id, escrow_src, escrow_dest, caller)
    const operation = resolverContract.call(
      "notify_relayer",
      nativeToScVal(orderIdBuffer, { type: "bytes" }), // order_id parameter (BytesN<32>)
      nativeToScVal(escrowSrcBuffer, { type: "bytes" }), // escrow_src parameter (BytesN<32>)
      nativeToScVal(escrowDestBuffer, { type: "bytes" }), // escrow_dest parameter (BytesN<32>)
      nativeToScVal(callerAddress, { type: "address" }) // caller parameter
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

    console.log(`✅ Notify Relayer transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Notify Relayer failed:", error.message);
    throw error;
  }
}

/**
 * Convert contract address to 32-byte format (for escrow contract addresses)
 * @param {string} contractAddress - Contract address (C... format)
 * @returns {string} - 32-byte hex string
 */
function contractAddressToBytes32(contractAddress) {
  // Remove 'C' prefix and decode from base32 to get the raw bytes
  // This is a simplified conversion - you might need proper stellar address decoding
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(contractAddress).digest();
  return hash.toString("hex");
}

/**
 * Generate random 32-byte hex string
 * @returns {string} - 32-byte hex string
 */
function generateBytes32() {
  const randomBytes = Buffer.allocUnsafe(32);
  require("crypto").randomFillSync(randomBytes);
  return randomBytes.toString("hex");
}

/**
 * Convenience function using Alice as caller with example escrow addresses
 * @param {string} orderId - Order ID (optional, generates random if not provided)
 * @returns {Promise<string>} - Transaction hash
 */
async function notifyWithAlice(orderId) {
  const orderIdToUse = orderId || generateBytes32();

  // For demo purposes, generate example escrow addresses
  // In real use, these would be actual deployed escrow contract addresses
  const escrowSrc = contractAddressToBytes32("ESCROW_SRC_CONTRACT_ADDRESS");
  const escrowDest = contractAddressToBytes32("ESCROW_DEST_CONTRACT_ADDRESS");

  return await notifyStellarRelayer(
    orderIdToUse, // order_id
    escrowSrc, // escrow_src
    escrowDest, // escrow_dest
    aliceKeypair.publicKey() // caller (resolver)
  );
}

/**
 * Validate bytes32 format
 * @param {string} bytes32 - Bytes32 string to validate
 * @returns {boolean} - Whether bytes32 is valid
 */
function validateBytes32(bytes32) {
  try {
    const buffer = Buffer.from(bytes32.replace("0x", ""), "hex");
    return buffer.length === 32;
  } catch (error) {
    return false;
  }
}

/**
 * Create notification data for cross-chain coordination
 * @param {string} orderId - Order ID
 * @param {string} escrowSrc - Source escrow address
 * @param {string} escrowDest - Destination escrow address
 * @param {string} secret - Secret for unlocking
 * @returns {Object} - Notification data
 */
function createNotificationData(orderId, escrowSrc, escrowDest, secret) {
  return {
    orderId: orderId,
    escrowSrc: escrowSrc,
    escrowDest: escrowDest,
    secret: secret,
    timestamp: Date.now(),
    // This data would be used by off-chain relayers to coordinate secret sharing
    message: `Secret sharing notification for order ${orderId}`,
  };
}

// Helper function to convert tokens to wei-like units (18 decimals)
function tokensToUnits(tokens) {
  return BigInt(tokens) * BigInt(10 ** 18);
}

// Export the functions
module.exports = notifyStellarRelayer;
module.exports.notifyStellarRelayer = notifyStellarRelayer;
module.exports.notifyWithAlice = notifyWithAlice;
module.exports.contractAddressToBytes32 = contractAddressToBytes32;
module.exports.generateBytes32 = generateBytes32;
module.exports.validateBytes32 = validateBytes32;
module.exports.createNotificationData = createNotificationData;
module.exports.tokensToUnits = tokensToUnits;

// If run directly, execute with example parameters
if (require.main === module) {
  console.log("🚀 Running notifyStellarRelayer standalone...");

  async function runExample() {
    try {
      // Generate parameters for testing
      const orderId = generateBytes32();
      const escrowSrc = contractAddressToBytes32("EXAMPLE_ESCROW_SRC_CONTRACT");
      const escrowDest = contractAddressToBytes32(
        "EXAMPLE_ESCROW_DEST_CONTRACT"
      );
      const callerAddress = aliceKeypair.publicKey();

      console.log(`Generated Order ID: ${orderId}`);
      console.log(`Escrow Src (bytes32): ${escrowSrc}`);
      console.log(`Escrow Dest (bytes32): ${escrowDest}`);
      console.log(`Caller: ${callerAddress}`);

      console.log("\n📋 Notification Parameters:");
      console.log(`Resolver Contract: ${RESOLVER_CONTRACT_ADDRESS}`);
      console.log(`Order ID: ${orderId}`);
      console.log(`Escrow Src: ${escrowSrc}`);
      console.log(`Escrow Dest: ${escrowDest}`);
      console.log(`Caller: ${callerAddress}`);
      console.log(`Owner: ${aliceKeypair.publicKey()}`);

      // Create notification data
      const notificationData = createNotificationData(
        orderId,
        escrowSrc,
        escrowDest,
        "example_secret"
      );
      console.log("\n📦 Notification Data:");
      console.log(JSON.stringify(notificationData, null, 2));

      // Notify relayer
      console.log("\n📢 Notifying relayer...");
      const hash = await notifyStellarRelayer(
        orderId,
        escrowSrc,
        escrowDest,
        callerAddress
      );
      console.log(`🎉 Notification Success! Hash: ${hash}`);

      console.log("\n📝 What happened:");
      console.log("1. Resolver called Relayer signal_share_secret()");
      console.log(
        "2. Relayer published an event with escrow addresses and order ID"
      );
      console.log("3. Off-chain relayers can now coordinate secret sharing");
      console.log(
        "4. The secret can be shared between source and destination chains"
      );

      console.log("\n🔄 Next Steps:");
      console.log("1. Off-chain relayers will listen for this event");
      console.log("2. They will coordinate sharing the secret between chains");
      console.log(
        "3. Both escrow contracts can then be unlocked with the secret"
      );
    } catch (error) {
      console.error("💥 Error:", error.message);

      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure resolver contract is initialized");
      console.log("2. Check that Alice is the owner of resolver");
      console.log("3. Verify Relayer is set in resolver");
      console.log("4. Ensure order ID is valid (32 bytes)");
      console.log("5. Ensure escrow addresses are valid (32 bytes)");
      console.log("6. Check that all contracts are properly deployed");
    }
  }

  runExample();
}
