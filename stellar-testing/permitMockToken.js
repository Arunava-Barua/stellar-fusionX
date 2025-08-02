// Wrapped Token
// CHECKED

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
const WRAPPED_TOKEN_CONTRACT_ADDRESS =
  "CB27AJYW32SYXRGGTZSWHZ6ZRURIXP5ANARZ6DCAWID6UWVY6P2Z3IGZ";
const MOCK_TOKEN_CONTRACT_ADDRESS =
  "CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

// Step 1: Create deterministic hash (following your exact pattern)
function createPermitHash(token, owner, spender, amount) {
  const message = `${token}:${owner}:${spender}:${amount}`;
  const messageBuffer = Buffer.from(message, "utf8");
  return hash(messageBuffer);
}

// Step 2: Sign the hash (following your exact pattern)
function signPermit(ownerSecretKey, permitHash) {
  const ownerKeypair = Keypair.fromSecret(ownerSecretKey);
  const signature = ownerKeypair.sign(permitHash);
  const publicKey = ownerKeypair.publicKey();

  return {
    publicKey: publicKey,
    signature: signature,
    publicKeyBytes: ownerKeypair.rawPublicKey(),
    signatureBytes: signature,
  };
}

/**
 * Execute permit transaction on wrapped token contract
 * @param {string} tokenAddress - Mock token contract address
 * @param {string} ownerAddress - Owner address
 * @param {string} spenderAddress - Spender address
 * @param {string|number} amount - Amount to permit
 * @param {string} ownerSecretKey - Owner's secret key for signing
 * @returns {Promise<string>} - Transaction hash
 */
async function permitMockToken(
  tokenAddress,
  ownerAddress,
  spenderAddress,
  amount,
  ownerSecretKey = ALICE_PRIVATE_KEY
) {
  try {
    console.log("=== Permit Parameters ===");
    console.log(`Token: ${tokenAddress}`);
    console.log(`Owner: ${ownerAddress}`);
    console.log(`Spender: ${spenderAddress}`);
    console.log(`Amount: ${amount}`);
    console.log("");

    // Step 1: Create hash
    const permitHash = createPermitHash(
      tokenAddress,
      ownerAddress,
      spenderAddress,
      amount
    );
    console.log("=== Step 1: Hash ===");
    console.log(`Hash (hex): ${permitHash.toString("hex")}`);
    console.log(`Hash (base64): ${permitHash.toString("base64")}`);
    console.log("");

    // Step 2: Sign
    const signatureData = signPermit(ownerSecretKey, permitHash);
    console.log("=== Step 2: Signature ===");
    console.log(`Public Key: ${signatureData.publicKey}`);
    console.log(
      `Public Key (hex): ${signatureData.publicKeyBytes.toString("hex")}`
    );
    console.log(
      `Signature (hex): ${signatureData.signatureBytes.toString("hex")}`
    );
    console.log("");

    // Step 3: Generate CLI command (for reference)
    console.log("=== Step 3: CLI Command ===");
    console.log(`soroban contract invoke \\`);
    console.log(`  --id ${WRAPPED_TOKEN_CONTRACT_ADDRESS} \\`);
    console.log(`  --source alice \\`);
    console.log(`  --network testnet \\`);
    console.log(`  -- permit \\`);
    console.log(`  --token ${tokenAddress} \\`);
    console.log(`  --owner ${ownerAddress} \\`);
    console.log(`  --spender ${spenderAddress} \\`);
    console.log(`  --amount ${amount} \\`);
    console.log(
      `  --public_key ${signatureData.publicKeyBytes.toString("hex")} \\`
    );
    console.log(
      `  --signature ${signatureData.signatureBytes.toString("hex")} \\`
    );
    console.log(`  --hash ${permitHash.toString("hex")}`);
    console.log("");

    // Step 4: Execute permit transaction
    console.log("=== Step 4: Executing Transaction ===");

    const account = await server.getAccount(aliceKeypair.publicKey());
    const wrappedContract = new Contract(WRAPPED_TOKEN_CONTRACT_ADDRESS);

    // Contract function: permit(env, token, owner, spender, amount, public_key, signature, hash)
    const operation = wrappedContract.call(
      "permit",
      nativeToScVal(tokenAddress, { type: "address" }), // token
      nativeToScVal(ownerAddress, { type: "address" }), // owner
      nativeToScVal(spenderAddress, { type: "address" }), // spender
      nativeToScVal(BigInt(amount), { type: "u128" }), // amount
      nativeToScVal(signatureData.publicKeyBytes, { type: "bytes" }), // public_key (BytesN<32>)
      nativeToScVal(signatureData.signatureBytes, { type: "bytes" }), // signature (BytesN<64>)
      nativeToScVal(permitHash, { type: "bytes" }) // hash (BytesN<32>)
    );

    const transaction = new TransactionBuilder(account, {
      fee: "10000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log("Simulating permit transaction...");
    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }

    console.log("✅ Simulation successful");
    console.log("Preparing and submitting permit transaction...");

    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(aliceKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Permit transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Permit failed:", error.message);
    throw error;
  }
}

/**
 * Generate permit signature without executing transaction (following your pattern)
 * @param {string} tokenAddress - Token contract address
 * @param {string} ownerAddress - Owner address
 * @param {string} spenderAddress - Spender address
 * @param {string|number} amount - Amount to permit
 * @param {string} ownerSecretKey - Owner's secret key
 * @returns {Object} - Signature data
 */
function generatePermitSignature(
  tokenAddress,
  ownerAddress,
  spenderAddress,
  amount,
  ownerSecretKey
) {
  console.log("=== Permit Parameters ===");
  console.log(`Token: ${tokenAddress}`);
  console.log(`Owner: ${ownerAddress}`);
  console.log(`Spender: ${spenderAddress}`);
  console.log(`Amount: ${amount}`);
  console.log("");

  // Step 1: Create hash
  const permitHash = createPermitHash(
    tokenAddress,
    ownerAddress,
    spenderAddress,
    amount
  );
  console.log("=== Step 1: Hash ===");
  console.log(`Hash (hex): ${permitHash.toString("hex")}`);
  console.log(`Hash (base64): ${permitHash.toString("base64")}`);
  console.log("");

  // Step 2: Sign
  const signatureData = signPermit(ownerSecretKey, permitHash);
  console.log("=== Step 2: Signature ===");
  console.log(`Public Key: ${signatureData.publicKey}`);
  console.log(
    `Public Key (hex): ${signatureData.publicKeyBytes.toString("hex")}`
  );
  console.log(
    `Signature (hex): ${signatureData.signatureBytes.toString("hex")}`
  );
  console.log("");

  // Step 3: Generate CLI command
  console.log("=== Step 3: CLI Command ===");
  console.log(`soroban contract invoke \\`);
  console.log(`  --id ${WRAPPED_TOKEN_CONTRACT_ADDRESS} \\`);
  console.log(`  --source alice \\`);
  console.log(`  --network testnet \\`);
  console.log(`  -- permit \\`);
  console.log(`  --token ${tokenAddress} \\`);
  console.log(`  --owner ${ownerAddress} \\`);
  console.log(`  --spender ${spenderAddress} \\`);
  console.log(`  --amount ${amount} \\`);
  console.log(
    `  --public_key ${signatureData.publicKeyBytes.toString("hex")} \\`
  );
  console.log(
    `  --signature ${signatureData.signatureBytes.toString("hex")} \\`
  );
  console.log(`  --hash ${permitHash.toString("hex")}`);

  return {
    hash: permitHash,
    hashHex: permitHash.toString("hex"),
    hashBase64: permitHash.toString("base64"),
    publicKey: signatureData.publicKey,
    publicKeyHex: signatureData.publicKeyBytes.toString("hex"),
    signature: signatureData.signature,
    signatureHex: signatureData.signatureBytes.toString("hex"),
    cliCommand: `soroban contract invoke --id ${WRAPPED_TOKEN_CONTRACT_ADDRESS} --source alice --network testnet -- permit --token ${tokenAddress} --owner ${ownerAddress} --spender ${spenderAddress} --amount ${amount} --public_key ${signatureData.publicKeyBytes.toString(
      "hex"
    )} --signature ${signatureData.signatureBytes.toString(
      "hex"
    )} --hash ${permitHash.toString("hex")}`,
  };
}

/**
 * For browser/React usage (following your pattern)
 */
function browserExample() {
  return {
    createHash: createPermitHash,
    signWithWallet: async (walletSigner, hash) => {
      // Integrate with Freighter, xBull, or other Stellar wallets
      const signature = await walletSigner.sign(hash);
      return signature;
    },
  };
}

// Helper function to convert tokens to wei-like units (18 decimals)
function tokensToUnits(tokens) {
  return BigInt(tokens) * BigInt(10 ** 18);
}

// Helper function to convert units back to tokens (18 decimals)
function unitsToTokens(units) {
  return Number(BigInt(units) / BigInt(10 ** 18));
}

// Export for use (following your pattern)
module.exports = permitMockToken;
module.exports.permitMockToken = permitMockToken;
module.exports.createPermitHash = createPermitHash;
module.exports.signPermit = signPermit;
module.exports.generatePermitSignature = generatePermitSignature;
module.exports.browserExample = browserExample;
module.exports.tokensToUnits = tokensToUnits;
module.exports.unitsToTokens = unitsToTokens;

// Run example if this file is executed directly (following your pattern)
if (require.main === module) {
  // Contract parameters (following your example)
  const token = MOCK_TOKEN_CONTRACT_ADDRESS;
  const owner = aliceKeypair.publicKey();
  const spender = WRAPPED_TOKEN_CONTRACT_ADDRESS; // Allow wrapper to spend
  const amount = tokensToUnits(100).toString(); // 100 tokens

  console.log("🔐 Running permitMockToken standalone...");

  async function runExample() {
    try {
      // Execute the permit
      const hash = await permitMockToken(
        token,
        owner,
        spender,
        amount,
        ALICE_PRIVATE_KEY
      );
      console.log(`🎉 Permit Success! Transaction Hash: ${hash}`);
    } catch (error) {
      console.error("💥 Error:", error.message);

      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure wrapped token contract is deployed");
      console.log("2. Check that signature is not already used");
      console.log("3. Verify contract addresses are correct");
      console.log("4. Ensure Alice has sufficient XLM for transaction fees");
    }
  }

  runExample().catch(console.error);
}
