// Wrappedtoken
const StellarSdk = require("@stellar/stellar-sdk");

const { Keypair, TransactionBuilder, Networks, Contract, nativeToScVal, rpc } =
  StellarSdk;

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

/**
 * Deposit mock tokens into the wrapped token contract
 * @param {string} tokenAddress - Mock token contract address
 * @param {string|number} amount - Amount to deposit (in token units with 18 decimals)
 * @param {string} callerPrivateKey - Private key of the depositor (defaults to Alice)
 * @returns {Promise<string>} - Transaction hash
 */
async function depositMockToken(
  tokenAddress,
  amount,
  callerPrivateKey = ALICE_PRIVATE_KEY
) {
  try {
    const callerKeypair = Keypair.fromSecret(callerPrivateKey);

    console.log(`Depositing ${amount} token units...`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`Caller: ${callerKeypair.publicKey()}`);

    const account = await server.getAccount(callerKeypair.publicKey());
    const wrappedContract = new Contract(WRAPPED_TOKEN_CONTRACT_ADDRESS);

    // Contract function: deposit(env: Env, token: Address, amount: u128, caller: Address)
    const operation = wrappedContract.call(
      "deposit",
      nativeToScVal(tokenAddress, { type: "address" }), // token parameter
      nativeToScVal(BigInt(amount), { type: "u128" }), // amount parameter
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
    console.error("❌ Deposit failed:", error.message);
    throw error;
  }
}

/**
 * Check wrapped token balance for an address
 * @param {string} tokenAddress - Mock token contract address
 * @param {string} userAddress - User address to check
 * @returns {Promise<string>} - Wrapped balance amount
 */
async function checkWrappedBalance(tokenAddress, userAddress) {
  try {
    console.log(`Checking wrapped balance for: ${userAddress}`);
    console.log(`Token: ${tokenAddress}`);

    const account = await server.getAccount(aliceKeypair.publicKey());
    const wrappedContract = new Contract(WRAPPED_TOKEN_CONTRACT_ADDRESS);

    const transaction = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        wrappedContract.call(
          "get_balance",
          nativeToScVal(tokenAddress, { type: "address" }), // token
          nativeToScVal(userAddress, { type: "address" }) // user
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
    console.log(`Wrapped Balance: ${balance}`);

    return balance;
  } catch (error) {
    console.error("❌ Error checking wrapped balance:", error.message);
    return "0";
  }
}

/**
 * Check wrapped token allowance
 * @param {string} tokenAddress - Mock token contract address
 * @param {string} ownerAddress - Token owner address
 * @param {string} spenderAddress - Spender address
 * @returns {Promise<string>} - Allowance amount
 */
async function checkWrappedAllowance(
  tokenAddress,
  ownerAddress,
  spenderAddress
) {
  try {
    console.log(
      `Checking wrapped allowance: ${ownerAddress} -> ${spenderAddress}`
    );
    console.log(`Token: ${tokenAddress}`);

    const account = await server.getAccount(aliceKeypair.publicKey());
    const wrappedContract = new Contract(WRAPPED_TOKEN_CONTRACT_ADDRESS);

    const transaction = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        wrappedContract.call(
          "get_allowance",
          nativeToScVal(tokenAddress, { type: "address" }), // token
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
    console.log(`Wrapped Allowance: ${allowance}`);

    return allowance;
  } catch (error) {
    console.error("❌ Error checking wrapped allowance:", error.message);
    return "0";
  }
}

/**
 * Convenience function to deposit mock tokens (uses default mock token address)
 * @param {string|number} amount - Amount to deposit
 * @param {string} callerPrivateKey - Private key of depositor
 * @returns {Promise<string>} - Transaction hash
 */
async function depositToWrapper(amount, callerPrivateKey = ALICE_PRIVATE_KEY) {
  return await depositMockToken(
    MOCK_TOKEN_CONTRACT_ADDRESS,
    amount,
    callerPrivateKey
  );
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
module.exports = depositMockToken;
module.exports.depositMockToken = depositMockToken;
module.exports.checkWrappedBalance = checkWrappedBalance;
module.exports.checkWrappedAllowance = checkWrappedAllowance;
module.exports.depositToWrapper = depositToWrapper;
module.exports.tokensToUnits = tokensToUnits;
module.exports.unitsToTokens = unitsToTokens;

// If run directly, execute with example parameters
if (require.main === module) {
  const tokens = 100; // 100 tokens
  const amount = tokensToUnits(tokens); // Convert to 18 decimal units

  console.log("🏦 Running depositMockToken standalone...");
  console.log(`Depositing ${tokens} tokens (${amount} units)...`);

  async function runExample() {
    try {
      // First check current balances
      console.log("\n📊 Checking current balances...");
      await checkWrappedBalance(
        MOCK_TOKEN_CONTRACT_ADDRESS,
        aliceKeypair.publicKey()
      );

      // Deposit tokens
      console.log("\n💰 Depositing tokens...");
      const hash = await depositToWrapper(amount.toString());
      console.log(`🎉 Deposit Success! Hash: ${hash}`);

      // Check balances after deposit
      console.log("\n📊 Checking balances after deposit...");
      await checkWrappedBalance(
        MOCK_TOKEN_CONTRACT_ADDRESS,
        aliceKeypair.publicKey()
      );
    } catch (error) {
      console.error("💥 Error:", error.message);

      // Common issues and solutions
      console.log("\n🔧 Troubleshooting:");
      console.log("1. Make sure you have mock tokens to deposit");
      console.log(
        "2. Make sure you have approved the wrapped token contract to spend your mock tokens"
      );
      console.log(
        "3. Check that both contracts are properly deployed and initialized"
      );
    }
  }

  runExample();
}
