# register-number

A repo to show how to register a phone number with ODIS on Celo.

`index.js` includes scripts to request verification codes from and verify them with the Attesations contract (currently only working on Alfajores)

`./test-app/` is a work in progress nextjs application for a UI for registering a phone number (not currently functional).

## Prerequisites

Node v12 - recommended to use NVM `nvm use 12`  
Yarn  
Git  

## Setup sample script

Install dependencies in top level folder
```
yarn install
```

Set PRIVATE_KEY in .env vars  
You can either use an existing account (eg Metamask - Account Details - Export Private Key)  
Or create a new account by running 
```
yarn new-account
```

You'll need some gas to interact with the contracts, on Alfajores testnet you can get some from the [faucet](https://celo.org/developers/faucet)

Ensure you use a phone number that you control so you can respond with the SMS codes

Run script with
```
yarn sample-script
```

The script will run through the basic steps of registering a phone number with the Celo network:
1. Registers your account and wallet with the Account smart contract
2. Retrieves a hash for your phone number using ODIS
3. Requests the Attestations smart contract to send 3 SMS codes to your phone number associated with the hash (paying a small fee in cUSD)
4. You'll be prompted to enter each of the 3 codes which will be sent to the Attestations contract along with your phone hash and account address to associate them
5. Finally you can check that everything worked by sending your phone hash to the Attestations contract and retrieve the stored account address


For more details see the [Identity Overview](https://docs.celo.org/celo-codebase/protocol/identity)

## Troubleshooting

If you see any of the following errors:
"Error: insufficient funds for gas * price + value + gatewayFee" - means you're balance of Celo tokens is too low, use the faucet to top up
"transfer value exceeded balance of sender" - means you don't have enough stable coin balance, eg cUSD. Sometimes the faucet doesn't send cUSD so you may need to get it from another source
"Error: execution reverted: Unknown account" - typically means you're using a phone number that's already been registered with a different account
