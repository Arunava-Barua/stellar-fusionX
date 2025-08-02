// Mocktoken
// CHECKED

const StellarSdk = require("@stellar/stellar-sdk");

const { Keypair, TransactionBuilder, Networks, Contract, nativeToScVal, rpc } =
  StellarSdk;

// Configuration
const ALICE_PRIVATE_KEY =
  "SABCJCNM2TQFPU7IBJZFMUMLYAXJ2GJE5RGP7AKAEBWDS7MRJM34DOS4";
const MOCK_TOKEN_CONTRACT_ADDRESS =
  "CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

/**
 * Approve an address to spend mock tokens on behalf of the caller
 * @param {string} spenderAddress - Address to approve for spending
 * @param {string|number} amount - Amount to approve (in token units with 18 decimals)
 * @param {string} callerPrivateKey - Private key of the token owner (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function approveMockToken(
  spenderAddress,
  amount,
  callerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const callerKeypair = Keypair.fromSecret(callerPrivateKey);

    console.log(`Approving ${amount} token units for ${spenderAddress}...`);
    console.log(`Caller: ${callerKeypair.publicKey()}`);

    const account = await server.getAccount(callerKeypair.publicKey());
    const contract = new Contract(MOCK_TOKEN_CONTRACT_ADDRESS);

    // Contract function: approve(env: Env, amount: u128, to: Address, caller: Address)
    const operation = contract.call(
      "approve",
      nativeToScVal(BigInt(amount), { type: "u128" }), // amount parameter
      nativeToScVal(spenderAddress, { type: "address" }), // to parameter (spender)
      nativeToScVal(callerKeypair.publicKey(), { type: "address" }) // caller parameter
    );

    // Set caller as source for authorization (caller.require_auth())
    operation.source = callerKeypair.publicKey();

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

    console.log("Preparing and submitting transaction...");
    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(callerKeypair);

    const response = await server.sendTransaction(preparedTransaction);

    console.log(`✅ Transaction submitted: ${response.hash}`);
    return response.hash;
  } catch (error) {
    console.error("❌ Approve failed:", error.message);
    throw error;
  }
}

/**
 * Check allowance between owner and spender
 * @param {string} ownerAddress - Token owner address
 * @param {string} spenderAddress - Spender address
 * @returns {Promise<string>} - Allowance amount
 */
async function checkAllowance(ownerAddress, spenderAddress) {
  try {
    console.log(`Checking allowance: ${ownerAddress} -> ${spenderAddress}`);

    const account = await server.getAccount(aliceKeypair.publicKey());
    const contract = new Contract(MOCK_TOKEN_CONTRACT_ADDRESS);

    const transaction = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        contract.call(
          "get_allowance",
          nativeToScVal(ownerAddress, { type: "address" }), // owner
          nativeToScVal(spenderAddress, { type: "address" }) // spender
        )
      )
      .setTimeout(300)
      .build();

    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      console.error("❌ Allowance check failed:", simulationResponse.error);
      return "0";
    }

    const allowance = simulationResponse.result?.retval || "0";
    console.log(`Allowance: ${JSON.stringify(allowance)}`);

    return allowance;
  } catch (error) {
    console.error("❌ Error checking allowance:", error.message);
    return "0";
  }
}

/**
 * Check token balance for an address
 * @param {string} address - Address to check
 * @returns {Promise<string>} - Balance amount
 */
async function checkBalance(address) {
  try {
    console.log(`Checking balance for: ${address}`);

    const account = await server.getAccount(aliceKeypair.publicKey());
    const contract = new Contract(MOCK_TOKEN_CONTRACT_ADDRESS);

    const transaction = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        contract.call(
          "get_balance",
          nativeToScVal(address, { type: "address" })
        )
      )
      .setTimeout(300)
      .build();

    const simulationResponse = await server.simulateTransaction(transaction);

    if (simulationResponse.error) {
      console.error("❌ Balance check failed:", simulationResponse.error);
      return "0";
    }

    const balance = simulationResponse.result?.retval || "0";
    console.log(`Balance: ${balance}`);

    return balance;
  } catch (error) {
    console.error("❌ Error checking balance:", error.message);
    return "0";
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
module.exports = approveMockToken;
module.exports.approveMockToken = approveMockToken;
module.exports.checkAllowance = checkAllowance;
module.exports.checkBalance = checkBalance;
module.exports.tokensToUnits = tokensToUnits;
module.exports.unitsToTokens = unitsToTokens;

// If run directly, execute with example parameters
if (require.main === module) {
  // Example: Approve a spender to spend 500 tokens on Alice's behalf
  const spenderAddress =
    "CB27AJYW32SYXRGGTZSWHZ6ZRURIXP5ANARZ6DCAWID6UWVY6P2Z3IGZ"; // Example spender
  const tokens = 500; // 500 tokens
  const amount = tokensToUnits(tokens); // Convert to 18 decimal units

  console.log("🔐 Running approveMockToken standalone...");
  console.log(`Approving ${tokens} tokens (${amount} units) for spender...`);

  async function runExample() {
    try {
      // First check Alice's balance
      await checkBalance(aliceKeypair.publicKey());

      // Approve the spender
      const hash = await approveMockToken(spenderAddress, amount.toString());
      console.log(`🎉 Approval Success! Hash: ${hash}`);

      // Check the allowance
      await checkAllowance(aliceKeypair.publicKey(), spenderAddress);
    } catch (error) {
      console.error("💥 Error:", error.message);
    }
  }

  runExample();
}
