#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contract]
pub struct MockToken;

pub const NAME: &str = "MyToken";
pub const SYMBOL: &str = "MTK";
pub const DECIMALS: u8 = 18;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum DataKey {
    Balance(Address),            // (token, user) -> balance
    Allowance(Address, Address), // (token, owner, spender) -> allowance
    TotalSupply,
}

#[contractimpl]
impl MockToken {
    pub fn mint(env: Env, to: Address, value: u128) {
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &value);
    }

    pub fn approve(env: Env, amount: u128, to: Address, caller: Address) {
        caller.require_auth();

        let user_balance = Self::get_balance(env.clone(), caller.clone());

        if amount > user_balance {
            panic!("Invalid amount");
        }

        env.storage()
            .persistent()
            .set(&DataKey::Allowance(caller, to), &amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        let _amount = amount as u128;
        if _amount == 0 {
            panic!("Invalid amount");
        }

        // Check allowance
        let current_allowance = Self::get_allowance(env.clone(), from.clone(), spender.clone());

        if _amount > current_allowance {
            panic!("Invalid allowance");
        }

        // Check balance
        let from_balance = Self::get_balance(env.clone(), from.clone());

        if _amount > from_balance {
            panic!("Invalid balance");
        }

        // Update allowance
        let new_allowance = current_allowance - _amount;
        env.storage()
            .persistent()
            .set(&DataKey::Allowance(from.clone(), spender), &new_allowance);

        // Update from balance
        let new_from_balance = from_balance - _amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &new_from_balance);

        // Update to balance
        let to_balance = Self::get_balance(env.clone(), to.clone());
        let new_to_balance = to_balance + _amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &new_to_balance);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let _amount = amount as u128;
        if _amount == 0 {
            panic!("Invalid amount");
        }

        let sender_balance = Self::get_balance(env.clone(), from.clone());
        if _amount > sender_balance {
            panic!("Invalid balance");
        }

        // Update sender balance
        let new_sender_balance = sender_balance - _amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &new_sender_balance);

        // Update recipient balance
        let recipient_balance = Self::get_balance(env.clone(), to.clone());
        let new_recipient_balance = recipient_balance + _amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &new_recipient_balance);
    }

    pub fn get_balance(env: Env, user: Address) -> u128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(user))
            .unwrap_or(0)
    }

    pub fn get_allowance(env: Env, owner: Address, spender: Address) -> u128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(owner, spender))
            .unwrap_or(0)
    }
}
