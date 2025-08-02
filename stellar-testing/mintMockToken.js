// Mocktoken
// CHECKED

const StellarSdk = require('@stellar/stellar-sdk');

const {
  Keypair,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  rpc
} = StellarSdk;

// Configuration
const ALICE_PRIVATE_KEY = 'SABCJCNM2TQFPU7IBJZFMUMLYAXJ2GJE5RGP7AKAEBWDS7MRJM34DOS4';
const MOCK_TOKEN_CONTRACT_ADDRESS = 'CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D';

const server = new rpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = Networks.TESTNET;
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

/**
 * Mint mock tokens to a specified address
 * @param {string} toAddress - Recipient address
 * @param {string|number} value - Amount to mint (in wei-like units, 18 decimals)
 * @returns {Promise<string>} - Transaction hash
 */
async function mintMockToken(toAddress, value) {
  try {
    console.log(`Minting ${value} token units to ${toAddress}...`);
    
    const account = await server.getAccount(aliceKeypair.publicKey());
    const contract = new Contract(MOCK_TOKEN_CONTRACT_ADDRESS);
    
    // Use correct parameter names from contract: 'to' and 'value'
    const operation = contract.call(
      'mint',
      nativeToScVal(toAddress, { type: 'address' }), // to parameter
      nativeToScVal(BigInt(value), { type: 'u128' })   // value parameter (u128, not i128)
    );
    
    // No need for authorization - mint function has no require_auth()
    const transaction = new TransactionBuilder(account, {
      fee: '10000000',
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    console.log('Simulating transaction...');
    const simulationResponse = await server.simulateTransaction(transaction);
    
    if (simulationResponse.error) {
      throw new Error(`Simulation failed: ${simulationResponse.error}`);
    }
    
    console.log('Preparing and submitting transaction...');
    const preparedTransaction = await server.prepareTransaction(transaction);
    preparedTransaction.sign(aliceKeypair);
    
    const response = await server.sendTransaction(preparedTransaction);
    
    console.log(`✅ Transaction submitted: ${response.hash}`);
    return response.hash;
    
  } catch (error) {
    console.error('❌ Mint failed:', error.message);
    throw error;
  }
}

// Helper function to convert tokens to wei-like units (18 decimals)
function tokensToUnits(tokens) {
  return BigInt(tokens) * BigInt(10**18);
}

// Export the functions
module.exports = mintMockToken;
module.exports.mintMockToken = mintMockToken;
module.exports.tokensToUnits = tokensToUnits;

// If run directly, execute with example parameters
if (require.main === module) {
  const toAddress = aliceKeypair.publicKey(); // Mint to Alice
  const tokens = 1000; // 1000 tokens
  const value = tokensToUnits(tokens); // Convert to 18 decimal units
  
  console.log('🪙 Running mintMockToken standalone...');
  console.log(`Minting ${tokens} tokens (${value} units)...`);
  
  mintMockToken(toAddress, value.toString())
    .then(hash => console.log(`🎉 Success! Hash: ${hash}`))
    .catch(error => console.error('💥 Error:', error.message));
}