---
up: INDEX.md
prereqs: ../grounding.md, object-model.md, programmable-transaction-blocks.md
provides: gas-model, gas-smashing, sponsored-transaction-model, signature-boundaries, executor-concurrency
children: none
update-strategy: refresh when Sui gas/auth docs, Mysten executor behavior, or Effect-Sui payment/auth policy changes
update-status: current
---

# Gas, Payment, Sponsorship, and Authentication

> up: INDEX.md
> prereqs: ../grounding.md, object-model.md, programmable-transaction-blocks.md
> provides: gas-model, gas-smashing, sponsored-transaction-model, signature-boundaries, executor-concurrency
> children: none

Primary sources:

- `submodules/sui/docs/content/develop/transaction-payment/gas-in-sui.mdx`
- `submodules/sui/docs/content/develop/transaction-payment/gas-smashing.mdx`
- `submodules/sui/docs/content/develop/transaction-payment/sponsor-txn.mdx`
- `submodules/sui/docs/content/develop/transactions/transaction-auth/auth-overview.mdx`
- `submodules/ts-sdks/packages/docs/content/sui/transaction-building/gas.mdx`

## Gas Accounting

Sui charges for computation and storage:

```text
total_gas_fees = computation_units × reference_gas_price + storage_units × storage_price
net_gas_fees   = computation_gas_fee + storage_gas_fee - storage_rebate
```

Key operational details:

- computation is bucketed, not micro-priced per instruction;
- storage is linear in bytes and can later produce rebates on deletion;
- users submit a gas budget cap;
- successful execution requires the budget to cover the larger of computation fees and total gas fees;
- min/max budget bounds exist and may change with protocol/config.

Effect-Sui should avoid embedding brittle gas constants except where docs/protocol expose them for validation. Prefer dry-run/reference gas price/client APIs.

## Gas Builder Defaults

Mysten's `Transaction` builder can automatically:

- set reference gas price;
- estimate gas budget via dry-run;
- select gas payment coins not otherwise used as inputs;
- merge selected gas coins down to one gas coin.

Effect-Sui map:

- `src/flow/gas.ts`, `gas-plan.ts`: gas policy/plan.
- `src/flow/payment.ts`, `payment-plan.ts`: coin selection/payment planning.
- `src/flow/rpc-preflight.ts`: dry-run/preflight evidence.

## Gas Coin PTB Semantics

`tx.gas` can be borrowed for `SplitCoins`, `MergeCoins`, and Move calls. It can only be moved by value through `TransferObjects`. See `programmable-transaction-blocks.md` for compiler implications.

## Gas Smashing

If multiple gas coins are provided, Sui smashes them into one coin before execution. All but the first are deleted; storage rebates credit back after execution, not as same-transaction gas payment.

Important edges:

- smashing happens even if the transaction later fails during execution;
- up to 256 gas coins can be smashed in a single PTB;
- rebates can create odd-looking results, including a failed transaction with net refund after deleted-coin rebates;
- gas coins selected for payment must not overlap with other transaction inputs.

Effect-Sui should diagnose likely overlap/race hazards where possible and leave final truth to dry-run/execution.

## Sponsored Transactions

Sponsored transactions separate transaction sender from gas owner.

Core structure:

```text
TransactionDataV1 {
  kind,
  sender: user,
  gas_data: GasData {
    payment: Vec<ObjectRef>,
    owner: sponsor,
    price,
    budget,
  },
  expiration,
}
```

For sponsorship, both user and sponsor sign the entire `TransactionData`, including `GasData`. Signature order does not matter. Sponsorship is not multisig: the sponsor pays gas; they do not become a co-author of Move intent unless the transaction logic says so.

Effect-Sui map:

- `src/flow/auth*.ts`: authorization policy and signing.
- `src/adapter/wallet.ts`: wallet callback bridge.
- `src/schema/policy-auth.ts`, `policy-gas.ts`, `policy-payment.ts`: Schema-backed policies.

## Sponsorship Risks

| Risk | Mechanism | Mitigation |
|---|---|---|
| Sponsor gas coin reuse | Same gas object version used by concurrent sponsored txs. | Dedicated gas pools; reservation discipline. |
| User input reuse | User signs another tx using same owned object refs. | Caller policy + owned-object reservations. |
| Tampered gas data | Third party changes gas payment after one party signs. | Both parties sign full `TransactionData`. |
| Sponsor censorship | Sponsor withholds dual-signed transaction. | Submit directly to full node when needed. |

## Signature Model

Sui signatures are `flag || sig || pk`. Addresses are derived from the signature scheme flag plus public key bytes via BLAKE2b-256. Supported schemes include Ed25519, Secp256k1, Secp256r1, multisig, zkLogin, and passkey.

Signing commits to the intent message over BCS transaction data. Do not hand-roll signing payloads in Effect-Sui; rely on Mysten keypair/wallet APIs and validate/classify their outputs.

## Same-Sender Concurrency

Mysten SDK docs call out two executors:

- `SerialTransactionExecutor`: serializes same-sender transactions and handles object versioning.
- `ParallelTransactionExecutor`: manages a gas coin pool and tracks object usage to avoid concurrent reuse.

Effect-Sui's STM reservations mirror this need at the wrapper layer. Reservation keys for owned object and gas refs must prevent same-version double-use until finality/invalidity releases them.
