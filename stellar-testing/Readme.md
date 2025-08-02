1. Deploy the Stellar smart contracts
2. Run the `initializeContract.js`
3. Run these commands
```
soroban contract invoke \
  --id CCYMG6TSUAQCKP7NHAZVEIP2ON5J2GNZ4VOSZVA2G3QEQDYNOZ6HD4QC \
  --source alice \
  --network testnet \
  -- \
  set_relayer \
  --relayer CC5MRCCFFRNTBKYGNH6COX2WGJPNNAW2DYGLH3BYFUEQS4UUHP444PZK

soroban contract invoke \
  --id CCYMG6TSUAQCKP7NHAZVEIP2ON5J2GNZ4VOSZVA2G3QEQDYNOZ6HD4QC \
  --source alice \
  --network testnet \
  -- \
  set_escrow_factory \
  --escrow_factory CC3X2OOS45ZETELRNXEK5FTPCOSQ3TBURMZHX647OP7FLYTTWPKVNXJN

soroban contract invoke \
  --id CC5MRCCFFRNTBKYGNH6COX2WGJPNNAW2DYGLH3BYFUEQS4UUHP444PZK \
  --source alice \
  --network testnet \
  -- \
  add_resolver \
  --resolver CCAYPNN44LTM5JJAAIDRJPUNSHOHCR56WY6UZYPDQ7B26UAT46NMNXPS

soroban contract invoke \
  --id CCYMG6TSUAQCKP7NHAZVEIP2ON5J2GNZ4VOSZVA2G3QEQDYNOZ6HD4QC \
  --source alice \
  --network testnet \
  -- \
  get_relayer

soroban contract invoke \
  --id CCYMG6TSUAQCKP7NHAZVEIP2ON5J2GNZ4VOSZVA2G3QEQDYNOZ6HD4QC \
  --source alice \
  --network testnet \
  -- \
  get_escrow_factory

soroban contract invoke \
  --id CC5MRCCFFRNTBKYGNH6COX2WGJPNNAW2DYGLH3BYFUEQS4UUHP444PZK \
  --source alice \
  --network testnet \
  -- \
  is_resolver \
  --resolver CCAYPNN44LTM5JJAAIDRJPUNSHOHCR56WY6UZYPDQ7B26UAT46NMNXPS
```
4. Fund Testnet - stellar keys fund GCPS23IDUCDBJKUTR54PFOGP7WPY56MRO7RFUHRW2IMFSKNR4QNDPP6K
5. $ stellar contract invoke   --id CAW3XEHLJDKKQJB7QRF5YNNBGWKSXQRH3BDW5GZ7V6FFZCAQW7M6GQZV   --source alice   --network testnet   -- deploy_escrow_dest   --caller GB3I5T27E4VXU7PTTIWPBFJTKPUT4SIXKCMK3V6FKU6QXL7Q4TWCZTWQ   --order_id e1731a3c006ac66e6d9a96c12ac06663cf50470a152daea27b85b174b369441f   --hash_lock e1731a3c006ac66e6d9a96c12ac06663cf50470a152daea27b85b174b369441f   --token_out CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D   --amount_out 5000000000000000000   --maker GB3I5T27E4VXU7PTTIWPBFJTKPUT4SIXKCMK3V6FKU6QXL7Q4TWCZTWQ

 stellar contract invoke --id CAW3XEHLJDKKQJB7QRF5YNNBGWKSXQRH3BDW5GZ7V6FFZCAQW7M6GQZV --source alice --network testnet -- moveFund --amountIn 1000000000000000000 --to CBDTD5VM6TAHCOMYVJX23XLEHGXP3R34L26624FPX5QH34LPYOSOBMHP --token CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D
ℹ️  Signing transaction: c76ef9076fa5448c8d93abd4ea2023d73d305ab2b23f17492affdb10d5b022ef


 stellar contract invoke --id CDQCNRJRWO2F7O5IYMM2CUHU4QPA4DNWDYKL5UNQSJIQY24LLE3YQX2D --source alice --network testnet -- get_balance --user CAW3XEHLJDKKQJB7QRF5YNNBGWKSXQRH3BDW5GZ7V6FFZCAQW7M6GQZV
ℹ️  Simulation identified as read-only. Send by rerunning with `--send=yes`.
"99000000000000000000"