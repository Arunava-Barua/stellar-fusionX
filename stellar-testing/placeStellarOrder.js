// Relayer

const StellarSdk = require("@stellar/stellar-sdk");
const { Buffer } = require("buffer");

const {
  Keypair,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  rpc,
  hash,
} = StellarSdk;

// Configuration
const ALICE_PRIVATE_KEY =
  "SABCJCNM2TQFPU7IBJZFMUMLYAXJ2GJE5RGP7AKAEBWDS7MRJM34DOS4";
const RELAYER_CONTRACT_ADDRESS =
  "CC5MRCCFFRNTBKYGNH6COX2WGJPNNAW2DYGLH3BYFUEQS4UUHP444PZK";
const WRAPPED_TOKEN_CONTRACT_ADDRESS =
  "CB27AJYW32SYXRGGTZSWHZ6ZRURIXP5ANARZ6DCAWID6UWVY6P2Z3IGZ";
const MOCK_TOKEN_CONTRACT_ADDRESS =
  "CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

/**
 * Create permit hash for wrapped token
 * @param {string} token - Token contract address
 * @param {string} owner - Owner address
 * @param {string} spender - Spender address (relayer)
 * @param {string|number} amount - Amount to permit
 * @returns {Buffer} - Hash for signing
 */
function createPermitHash(token, owner, spender, amount) {
  const message = `${token}:${owner}:${spender}:${amount}`;
  const messageBuffer = Buffer.from(message, "utf8");
  return hash(messageBuffer);
}

/**
 * Sign permit hash with owner's private key
 * @param {string} ownerSecretKey - Owner's private key
 * @param {Buffer} permitHash - Hash to sign
 * @returns {Object} - Signature data
 */
function signPermit(ownerSecretKey, permitHash) {
  const ownerKeypair = Keypair.fromSecret(ownerSecretKey);
  const signature = ownerKeypair.sign(permitHash);

  return {
    publicKey: ownerKeypair.publicKey(),
    signature: signature,
    publicKeyBytes: ownerKeypair.rawPublicKey(),
    signatureBytes: signature,
  };
}

/**
 * Convert contract address to BytesN<32> format
 * @param {string} contractAddress - Contract address
 * @returns {string} - 32-byte hex string
 */
function contractAddressToBytes32(contractAddress) {
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
 * Place order via relayer (combines permit + order placement)
 * @param {Object} orderData - Order parameters
 * @param {string} makerPrivateKey - Maker's private key for signing permit
 * @param {string} ownerPrivateKey - Relayer owner's private key (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function placeStellarOrder(
  orderData,
  makerPrivateKey,
  ownerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const ownerKeypair = Keypair.fromSecret(ownerPrivateKey);
    const makerKeypair = Keypair.fromSecret(makerPrivateKey);

    console.log("🚀 Placing Stellar order via relayer...");
    console.log("Order Details:");
    console.log(`  Order ID: ${orderData.orderId}`);
    console.log(`  Maker: ${orderData.maker}`);
    console.log(`  Token In: ${orderData.tokenIn}`);
    console.log(`  Token Out: ${orderData.tokenOut}`);
    console.log(`  Amount In: ${orderData.amountIn}`);
    console.log(`  Min Amount Out: ${orderData.minAmountOut}`);
    console.log(`  Max Amount Out: ${orderData.maxAmountOut}`);
    console.log(`  Hash Lock: ${orderData.hashLock}`);

    // Step 1: Create permit signature for wrapped token
    console.log("\n🔐 Creating permit signature...");

    const permitHash = createPermitHash(
      orderData.tokenIn,
      orderData.maker,
      RELAYER_CONTRACT_ADDRESS,
      orderData.amountIn
    );

    const signatureData = signPermit(makerPrivateKey, permitHash);

    console.log(`Permit Hash: ${permitHash.toString("hex")}`);
    console.log(`Public Key: ${signatureData.publicKey}`);
    console.log(`Signature: ${signatureData.signatureBytes.toString("hex")}`);

    // Step 2: Prepare OrderInput struct
    const orderInput = {
      orderId: Buffer.from(orderData.orderId.replace("0x", ""), "hex"),
      maker: orderData.maker,
      tokenIn: Buffer.from(orderData.tokenIn.replace("0x", ""), "hex"),
      tokenOut: Buffer.from(orderData.tokenOut.replace("0x", ""), "hex"),
      amountIn: BigInt(orderData.amountIn),
      minAmountOut: BigInt(orderData.minAmountOut),
      maxAmountOut: BigInt(orderData.maxAmountOut),
      hashLock: Buffer.from(orderData.hashLock.replace("0x", ""), "hex"),
    };

    // Step 3: Build transaction
    const account = await server.getAccount(ownerKeypair.publicKey());
    const relayerContract = new Contract(RELAYER_CONTRACT_ADDRESS);

    // Contract function: place_order(env, order_input, public_key, signature, hash)
    const operation = relayerContract.call(
      "place_order",
      // OrderInput struct
      nativeToScVal(
        {
          orderId: nativeToScVal(orderInput.orderId, { type: "bytes" }),
          maker: nativeToScVal(orderInput.maker, { type: "address" }),
          tokenIn: nativeToScVal(orderInput.tokenIn, { type: "bytes" }),
          tokenOut: nativeToScVal(orderInput.tokenOut, { type: "bytes" }),
          amountIn: nativeToScVal(orderInput.amountIn, { type: "u128" }),
          minAmountOut: nativeToScVal(orderInput.minAmountOut, {
            type: "u128",
          }),
          maxAmountOut: nativeToScVal(orderInput.maxAmountOut, {
            type: "u128",
          }),
          hashLock: nativeToScVal(orderInput.hashLock, { type: "bytes" }),
        },
        { type: "instance" }
      ),
      // Permit signature data
      nativeToScVal(signatureData.publicKeyBytes, { type: "bytes" }), // public_key (BytesN<32>)
      nativeToScVal(signatureData.signatureBytes, { type: "bytes" }), // signature (BytesN<64>)
      nativeToScVal(permitHash, { type: "bytes" }) // hash (BytesN<32>)
    );

    // Set owner as source for authorization (only_owner check)
    operation.source = ownerKeypair.publicKey();

    const transaction = new TransactionBuilder(account, {
      fee: "15000000", // Higher fee for complex transaction
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("\n🔄 Simulating transaction...");
    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    console.log("✅ Simulation successful");
    console.log("Preparing and submitting transaction...");

    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(ownerKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Place Order transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Place Order failed:", error.message);
    throw error;
  }
}

/**
 * Create order data structure
 * @param {Object} params - Order parameters
 * @returns {Object} - Formatted order data
 */
function createOrderData(params) {
  return {
    orderId: params.orderId || generateBytes32(),
    maker: params.maker,
    tokenIn:
      params.tokenIn ||
      contractAddressToBytes32(WRAPPED_TOKEN_CONTRACT_ADDRESS),
    tokenOut:
      params.tokenOut || contractAddressToBytes32(MOCK_TOKEN_CONTRACT_ADDRESS),
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
    maxAmountOut: params.maxAmountOut,
    hashLock: params.hashLock || generateBytes32(),
  };
}

/**
 * Convenience function to place order with Alice as maker
 * @param {string|number} amountIn - Amount to swap in
 * @param {string|number} minAmountOut - Minimum amount out
 * @param {string|number} maxAmountOut - Maximum amount out
 * @returns {Promise<string>} - Transaction hash
 */
async function placeOrderWithAlice(amountIn, minAmountOut, maxAmountOut) {
  const orderData = createOrderData({
    maker: aliceKeypair.publicKey(),
    amountIn: amountIn,
    minAmountOut: minAmountOut,
    maxAmountOut: maxAmountOut,
  });

  return await placeStellarOrder(orderData, ALICE_PRIVATE_KEY);
}

/**
 * Generate CLI command for comparison
 * @param {Object} orderData - Order data
 * @param {Object} signatureData - Signature data
 * @param {Buffer} permitHash - Permit hash
 * @returns {string} - CLI command
 */
function generateCLICommand(orderData, signatureData, permitHash) {
  return `soroban contract invoke \\
  --id ${RELAYER_CONTRACT_ADDRESS} \\
  --source alice \\
  --network testnet \\
  -- place_order \\
  --order_input '${JSON.stringify(orderData)}' \\
  --public_key ${signatureData.publicKeyBytes.toString("hex")} \\
  --signature ${signatureData.signatureBytes.toString("hex")} \\
  --hash ${permitHash.toString("hex")}`;
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
module.exports = placeStellarOrder;
module.exports.placeStellarOrder = placeStellarOrder;
module.exports.placeOrderWithAlice = placeOrderWithAlice;
module.exports.createOrderData = createOrderData;
module.exports.createPermitHash = createPermitHash;
module.exports.signPermit = signPermit;
module.exports.contractAddressToBytes32 = contractAddressToBytes32;
module.exports.generateBytes32 = generateBytes32;
module.exports.generateCLICommand = generateCLICommand;
module.exports.tokensToUnits = tokensToUnits;
module.exports.unitsToTokens = unitsToTokens;

// If run directly, execute with example parameters
if (require.main === module) {
  console.log("🚀 Running placeStellarOrder standalone...");

  async function runExample() {
    try {
      // Create example order
      const amountIn = tokensToUnits(100); // 100 tokens in
      const minAmountOut = tokensToUnits(95); // Min 95 tokens out
      const maxAmountOut = tokensToUnits(105); // Max 105 tokens out

      console.log("📋 Order Parameters:");
      console.log(`Amount In: ${unitsToTokens(amountIn)} tokens`);
      console.log(`Min Amount Out: ${unitsToTokens(minAmountOut)} tokens`);
      console.log(`Max Amount Out: ${unitsToTokens(maxAmountOut)} tokens`);

      const orderData = createOrderData({
        maker: aliceKeypair.publicKey(),
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        maxAmountOut: maxAmountOut.toString(),
      });

      console.log("\n📦 Generated Order Data:");
      console.log(`Order ID: ${orderData.orderId}`);
      console.log(`Maker: ${orderData.maker}`);
      console.log(`Token In: ${orderData.tokenIn}`);
      console.log(`Token Out: ${orderData.tokenOut}`);
      console.log(`Hash Lock: ${orderData.hashLock}`);

      // Place the order
      console.log("\n🏭 Placing order via relayer...");
      const hash = await placeStellarOrder(orderData, ALICE_PRIVATE_KEY);
      console.log(`🎉 Order Placement Success! Hash: ${hash}`);

      console.log("\n📝 What happened:");
      console.log("1. Created permit signature for wrapped token spending");
      console.log(
        "2. Relayer called wrapped_token.permit() to allow token spending"
      );
      console.log(
        "3. Relayer called dutch_auction.start_auction() to start the auction"
      );
      console.log("4. Order is now live in the Dutch auction system");

      console.log("\n🔄 Next Steps:");
      console.log(
        "1. Order will be available for fulfillment in Dutch auction"
      );
      console.log("2. Resolvers can call fillOrder to fulfill the order");
      console.log("3. Escrow contracts will be deployed when order is filled");
    } catch (error) {
      console.error("💥 Error:", error.message);

      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure relayer contract is initialized");
      console.log("2. Check that Alice is the owner of relayer");
      console.log("3. Verify Dutch Auction is set in relayer");
      console.log("4. Ensure wrapped token contract exists");
      console.log("5. Check that maker has sufficient wrapped token balance");
      console.log("6. Verify all contract addresses are correct");
    }
  }

  runExample();
}
