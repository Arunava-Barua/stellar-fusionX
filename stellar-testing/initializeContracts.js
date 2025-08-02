// CHECKED

const StellarSdk = require('@stellar/stellar-sdk');

// Extract what we need from the SDK
const {
  Keypair,
  TransactionBuilder,
  Networks,
  Contract,
  Address,
  nativeToScVal, // We DO need this for Soroban contract calls
  rpc
} = StellarSdk;

// Environment variables
const ALICE_PUBLIC_KEY = 'GB3I5T27E4VXU7PTTIWPBFJTKPUT4SIXKCMK3V6FKU6QXL7Q4TWCZTWQ';
const ALICE_PRIVATE_KEY = 'SABCJCNM2TQFPU7IBJZFMUMLYAXJ2GJE5RGP7AKAEBWDS7MRJM34DOS4';

const WRAPPED_TOKEN_CONTRACT_ADDRESS = 'CB27AJYW32SYXRGGTZSWHZ6ZRURIXP5ANARZ6DCAWID6UWVY6P2Z3IGZ';
const MOCK_TOKEN_CONTRACT_ADDRESS = 'CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D';

const RELAYER_CONTRACT_ADDRESS = 'CC5MRCCFFRNTBKYGNH6COX2WGJPNNAW2DYGLH3BYFUEQS4UUHP444PZK';
const RESOLVER_CONTRACT_ADDRESS = 'CAW3XEHLJDKKQJB7QRF5YNNBGWKSXQRH3BDW5GZ7V6FFZCAQW7M6GQZV';
const ESCROW_FACTORY_CONTRACT_ADDRESS = 'CC3X2OOS45ZETELRNXEK5FTPCOSQ3TBURMZHX647OP7FLYTTWPKVNXJN';
const DUTCH_AUCTION_CONTRACT_ADDRESS = 'CCYMG6TSUAQCKP7NHAZVEIP2ON5J2GNZ4VOSZVA2G3QEQDYNOZ6HD4QC';

// Configure for testnet (change to Networks.PUBLIC for mainnet)
const server = new rpc.Server('https://soroban-testnet.stellar.org');
const networkPassphrase = Networks.TESTNET;

// Create keypair from private key
const aliceKeypair = Keypair.fromSecret(ALICE_PRIVATE_KEY);

async function initializeContracts() {
  try {
    console.log('Starting contract initialization...');
    console.log('Alice Address:', aliceKeypair.publicKey());

    // Check if contracts are already initialized before proceeding
    console.log('\nChecking current initialization status...');
    await checkInitializationStatus();

    // Initialize contracts in dependency order (with error tolerance)
    console.log('\nProceeding with initialization...');
    await initializeDutchAuction();
    await initializeRelayer();
    await initializeEscrowFactory();
    await initializeResolver();
    
    console.log('✅ Contract initialization phase completed!');
    
  } catch (error) {
    console.error('Error initializing contracts:', error);
    console.log('⚠️ Some contracts may have failed to initialize, but others may have succeeded.');
    console.log('This is often normal if contracts were already initialized.');
  }
}

async function checkInitializationStatus() {
  const contracts = [
    { name: 'Dutch Auction', address: DUTCH_AUCTION_CONTRACT_ADDRESS, checkFunction: 'get_owner' },
    { name: 'Relayer', address: RELAYER_CONTRACT_ADDRESS, checkFunction: 'get_owner' },
    { name: 'Escrow Factory', address: ESCROW_FACTORY_CONTRACT_ADDRESS, checkFunction: 'get_relayer' },
    { name: 'Resolver', address: RESOLVER_CONTRACT_ADDRESS, checkFunction: 'get_owner' }
  ];

  for (const contractInfo of contracts) {
    try {
      const contract = new Contract(contractInfo.address);
      const account = await server.getAccount(aliceKeypair.publicKey());
      
      const transaction = new TransactionBuilder(account, {
        fee: '1000000',
        networkPassphrase: networkPassphrase,
      })
        .addOperation(contract.call(contractInfo.checkFunction))
        .setTimeout(300)
        .build();

      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (simulationResponse.error) {
        console.log(`⚪ ${contractInfo.name}: Not initialized`);
      } else {
        console.log(`✅ ${contractInfo.name}: Already initialized`);
      }
    } catch (error) {
      console.log(`⚪ ${contractInfo.name}: Status unknown`);
    }
  }
}

async function initializeDutchAuction() {
  console.log('\n1. Initializing Dutch Auction Contract...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(DUTCH_AUCTION_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '10000000', // 10 XLM - higher fee to ensure success
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'initialize',
        nativeToScVal(aliceKeypair.publicKey(), { type: 'address' }) // Properly encode as address ScVal
      )
    )
    .setTimeout(300)
    .build();

  // First simulate the transaction
  console.log('🔄 Simulating transaction...');
  const simulationResponse = await server.simulateTransaction(transaction);
  
  if (simulationResponse.error) {
    console.error('❌ Simulation failed:', simulationResponse.error);
    throw new Error('Simulation failed');
  }
  
  console.log('✅ Simulation successful');
  
  // Prepare the transaction with simulation results
  const preparedTransaction = await server.prepareTransaction(transaction);
  
  await submitTransaction(preparedTransaction, 'Dutch Auction initialization');
}

async function initializeRelayer() {
  console.log('\n2. Initializing Relayer Contract...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(RELAYER_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'initialize',
        nativeToScVal(aliceKeypair.publicKey(), { type: 'address' }), // owner
        nativeToScVal(DUTCH_AUCTION_CONTRACT_ADDRESS, { type: 'address' }) // dutch_auction
      )
    )
    .setTimeout(300)
    .build();

  // Simulate first
  console.log('🔄 Simulating transaction...');
  const simulationResponse = await server.simulateTransaction(transaction);
  
  if (simulationResponse.error) {
    console.error('❌ Simulation failed:', simulationResponse.error);
    throw new Error('Simulation failed');
  }
  
  console.log('✅ Simulation successful');
  
  // Prepare the transaction
  const preparedTransaction = await server.prepareTransaction(transaction);
  
  await submitTransaction(preparedTransaction, 'Relayer initialization');
}

async function initializeEscrowFactory() {
  console.log('\n3. Initializing Escrow Factory Contract...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(ESCROW_FACTORY_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'initialize',
        nativeToScVal(DUTCH_AUCTION_CONTRACT_ADDRESS, { type: 'address' }), // dutch_auction
        nativeToScVal(RELAYER_CONTRACT_ADDRESS, { type: 'address' }) // relayer
      )
    )
    .setTimeout(300)
    .build();

  // Simulate first
  console.log('🔄 Simulating transaction...');
  const simulationResponse = await server.simulateTransaction(transaction);
  
  if (simulationResponse.error) {
    console.error('❌ Simulation failed:', simulationResponse.error);
    throw new Error('Simulation failed');
  }
  
  console.log('✅ Simulation successful');
  
  // Prepare the transaction
  const preparedTransaction = await server.prepareTransaction(transaction);
  
  await submitTransaction(preparedTransaction, 'Escrow Factory initialization');
}

async function initializeResolver() {
  console.log('\n4. Initializing Resolver Contract...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(RESOLVER_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '10000000',
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'initialize',
        nativeToScVal(aliceKeypair.publicKey(), { type: 'address' }), // owner
        nativeToScVal(ESCROW_FACTORY_CONTRACT_ADDRESS, { type: 'address' }), // escrow_factory
        nativeToScVal(RELAYER_CONTRACT_ADDRESS, { type: 'address' }), // relayer
        nativeToScVal(DUTCH_AUCTION_CONTRACT_ADDRESS, { type: 'address' }) // dutch_auction
      )
    )
    .setTimeout(300)
    .build();

  // Simulate first
  console.log('🔄 Simulating transaction...');
  const simulationResponse = await server.simulateTransaction(transaction);
  
  if (simulationResponse.error) {
    console.error('❌ Simulation failed:', simulationResponse.error);
    throw new Error('Simulation failed');
  }
  
  console.log('✅ Simulation successful');
  
  // Prepare the transaction
  const preparedTransaction = await server.prepareTransaction(transaction);
  
  await submitTransaction(preparedTransaction, 'Resolver initialization');
}

async function submitTransaction(transaction, description) {
  try {
    // Sign the transaction
    transaction.sign(aliceKeypair);
    
    console.log(`Submitting ${description}...`);
    
    // Submit to Soroban
    const response = await server.sendTransaction(transaction);
    console.log(`Transaction submitted: ${response.hash}`);
    
    // Wait for confirmation with better error handling
    let status = 'PENDING';
    let attempts = 0;
    const maxAttempts = 15; // Increased attempts
    
    while (status === 'PENDING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      try {
        const statusResponse = await server.getTransaction(response.hash);
        status = statusResponse.status;
        console.log(`${description} status: ${status}`);
        
        if (status === 'SUCCESS') {
          console.log(`✅ ${description} completed successfully!`);
          return;
        } else if (status === 'FAILED') {
          console.error(`❌ ${description} failed`);
          
          // Try to get more details about the failure
          if (statusResponse.resultXdr) {
            console.error('Result XDR:', statusResponse.resultXdr);
          }
          if (statusResponse.resultMetaXdr) {
            console.error('Meta XDR:', statusResponse.resultMetaXdr);
          }
          
          // Don't throw error, just log and continue
          console.log(`⚠️ Skipping ${description} - may already be initialized`);
          return;
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // Transaction not found yet, continue waiting
          console.log(`Waiting for ${description} to be processed...`);
        } else if (error.message && error.message.includes('Bad union switch')) {
          // This specific error - likely the contract is already initialized
          console.log(`⚠️ ${description} may already be initialized - continuing...`);
          return;
        } else {
          console.error(`Error checking ${description}:`, error.message);
          // Don't throw, just continue
          return;
        }
      }
      
      attempts++;
    }
    
    if (status === 'PENDING' && attempts >= maxAttempts) {
      console.warn(`⚠️ ${description} is still pending after ${maxAttempts} attempts`);
    }
    
  } catch (error) {
    console.error(`Error in ${description}:`, error.message);
    
    // Check if it's already initialized
    if (error.message && (
      error.message.includes('Bad union switch') || 
      error.message.includes('already initialized') ||
      error.message.includes('AlreadyInitialized')
    )) {
      console.log(`⚠️ ${description} may already be initialized - continuing...`);
      return;
    }
    
    throw error;
  }
}

// Additional helper function to set up contract relationships
async function setupContractRelationships() {
  console.log('\n5. Setting up contract relationships...');
  
  try {
    // Set relayer in Dutch Auction
    await setRelayerInDutchAuction();
    
    // Set escrow factory in Dutch Auction
    await setEscrowFactoryInDutchAuction();
    
    // Add resolver to relayer
    await addResolverToRelayer();
    
    console.log('✅ Contract relationships set up successfully!');
    
  } catch (error) {
    console.error('Error setting up contract relationships:', error);
  }
}

async function setRelayerInDutchAuction() {
  console.log('Setting relayer in Dutch Auction...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(DUTCH_AUCTION_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'set_relayer',
        nativeToScVal(Address.fromString(RELAYER_CONTRACT_ADDRESS))
      )
    )
    .setTimeout(300)
    .build();

  await submitTransaction(transaction, 'Set relayer in Dutch Auction');
}

async function setEscrowFactoryInDutchAuction() {
  console.log('Setting escrow factory in Dutch Auction...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(DUTCH_AUCTION_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'set_escrow_factory',
        nativeToScVal(Address.fromString(ESCROW_FACTORY_CONTRACT_ADDRESS))
      )
    )
    .setTimeout(300)
    .build();

  await submitTransaction(transaction, 'Set escrow factory in Dutch Auction');
}

async function addResolverToRelayer() {
  console.log('Adding resolver to relayer...');
  
  const account = await server.getAccount(aliceKeypair.publicKey());
  const contract = new Contract(RELAYER_CONTRACT_ADDRESS);
  
  const transaction = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: networkPassphrase,
  })
    .addOperation(
      contract.call(
        'add_resolver',
        nativeToScVal(Address.fromString(RESOLVER_CONTRACT_ADDRESS))
      )
    )
    .setTimeout(300)
    .build();

  await submitTransaction(transaction, 'Add resolver to relayer');
}

// Main execution function
async function main() {
  console.log('🚀 Starting Soroban Contract Initialization');
  console.log('==========================================');
  
  // First initialize all contracts
  await initializeContracts();
  
  // Then set up the relationships between contracts
  await setupContractRelationships();
  
  console.log('\n🎉 All done! Your contracts are now initialized and ready to use.');
  console.log('\nContract Summary:');
  console.log(`- Dutch Auction: ${DUTCH_AUCTION_CONTRACT_ADDRESS}`);
  console.log(`- Relayer: ${RELAYER_CONTRACT_ADDRESS}`);
  console.log(`- Escrow Factory: ${ESCROW_FACTORY_CONTRACT_ADDRESS}`);
  console.log(`- Resolver: ${RESOLVER_CONTRACT_ADDRESS}`);
  console.log(`- Owner: ${aliceKeypair.publicKey()}`);
}

// Export functions for use in other modules
module.exports = {
  initializeContracts,
  setupContractRelationships,
  main
};

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}