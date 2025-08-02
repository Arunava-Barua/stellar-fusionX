#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env};

mod dutch_auction {
    soroban_sdk::contractimport!(file = "G:\\EthUnite\\stellar-fusionX\\contracts\\stellar\\target\\wasm32v1-none\\release\\dutchauction.wasm");
}

mod escrow_factory {
    soroban_sdk::contractimport!(file = "G:\\EthUnite\\stellar-fusionX\\contracts\\stellar\\target\\wasm32v1-none\\release\\escrowfactory.wasm");
}

mod relayer {
    soroban_sdk::contractimport!(file = "G:\\EthUnite\\stellar-fusionX\\contracts\\stellar\\target\\wasm32v1-none\\release\\relayer.wasm");
}

mod escrow_src {
    soroban_sdk::contractimport!(file = "G:\\EthUnite\\stellar-fusionX\\contracts\\stellar\\target\\wasm32v1-none\\release\\escrowsrc.wasm");
    pub type EscrowSrcClient<'a> = Client<'a>;
}
use escrow_src::EscrowSrcClient;

mod escrow_dest {
    soroban_sdk::contractimport!(file = "G:\\EthUnite\\stellar-fusionX\\contracts\\stellar\\target\\wasm32v1-none\\release\\escrowdest.wasm");
    pub type EscrowDestClient<'a> = Client<'a>;
}
use escrow_dest::EscrowDestClient;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Owner,         // owner address
    EscrowFactory, // escrow factory address
    Relayer,       // relayer contract address
    DutchAuction,  // contract address
}

#[contract]
pub struct Resolver;

#[contractimpl]
impl Resolver {
    pub fn initialize(
        env: Env,
        owner: Address,
        escrow_factory: Address,
        relayer: Address,
        dutch_auction: Address,
    ) {
        env.storage().persistent().set(&DataKey::Owner, &owner);
        env.storage()
            .persistent()
            .set(&DataKey::EscrowFactory, &escrow_factory);
        env.storage().persistent().set(&DataKey::Relayer, &relayer);
        env.storage()
            .persistent()
            .set(&DataKey::DutchAuction, &dutch_auction);
    }

    pub fn deploy_escrow_src(env: Env, caller: Address, order_id: BytesN<32>) {
        Self::only_owner(env.clone());
        let dutch_auction_contract =
            dutch_auction::Client::new(&env.clone(), &Self::get_dutch_auction(env.clone()));
        dutch_auction_contract.fillOrder(&caller.clone(), &order_id.clone());
    }

    pub fn deploy_escrow_dest(
        env: Env,
        caller: Address,
        order_id: BytesN<32>,
        hash_lock: BytesN<32>,
        token_out: Address,
        amount_out: u128,
        maker: Address,
    ) -> Address {
        Self::only_owner(env.clone());
        let _escrow_factory =
            escrow_factory::Client::new(&env.clone(), &Self::get_escrow_factory(env.clone()));
        let escrow_dest_contract = _escrow_factory.deploy_dest(
            &order_id.clone(),
            &hash_lock.clone(),
            &token_out.clone(),
            &amount_out.clone(),
            &maker.clone(),
            &caller.clone(),
        );

        escrow_dest_contract
    }

    pub fn moveFund(env: Env, amountIn: u128, to: Address, token: Address) {
        let token_client = token::Client::new(&env, &token);
        // Transfer security deposit from caller to this factory contract
        token_client.transfer(&env.current_contract_address(), &to, &(amountIn as i128));
    }

    pub fn withdraw(env: Env, escrow: Address, secret: BytesN<32>) {
        let caller = env.current_contract_address();
        let escrow = EscrowDestClient::new(&env, &escrow); // common function for both src and dest
        escrow.withdraw(&secret, &caller);
    }
    pub fn public_withdraw(env: Env, escrow: Address, secret: BytesN<32>) {
        let caller = env.current_contract_address();
        let escrow = EscrowDestClient::new(&env, &escrow); // common function for both src and dest
        escrow.public_withdraw(&secret, &caller);
    }
    pub fn cancel(env: Env, escrow: Address) {
        let caller = env.current_contract_address();
        let escrow = EscrowDestClient::new(&env, &escrow); // common function for both src and dest
        escrow.cancel(&caller);
    }
    pub fn public_cancel(env: Env, escrow: Address) {
        let caller = env.current_contract_address();
        let escrow = EscrowSrcClient::new(&env, &escrow); // common function for both src and dest
        escrow.public_cancel(&caller);
    }

    pub fn notify_relayer(
        env: Env,
        order_id: BytesN<32>,
        escrow_src: BytesN<32>,
        escrow_dest: BytesN<32>,
        caller: Address,
    ) {
        Self::only_owner(env.clone());
        let _relayer = relayer::Client::new(&env.clone(), &Self::get_relayer(env.clone()));
        _relayer.signal_share_secret(&escrow_src, &escrow_dest, &order_id, &caller);
    }

    pub fn get_owner(env: Env) -> Address {
        env.storage().persistent().get(&DataKey::Owner).unwrap()
    }

    pub fn get_escrow_factory(env: Env) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::EscrowFactory)
            .unwrap()
    }
    pub fn get_relayer(env: Env) -> Address {
        env.storage().persistent().get(&DataKey::Relayer).unwrap()
    }

    fn only_owner(env: Env) {
        let owner = Self::get_owner(env);
        owner.require_auth();
    }

    fn get_dutch_auction(env: Env) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::DutchAuction)
            .unwrap()
    }
}
