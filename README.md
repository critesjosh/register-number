# register-number

A repo to show how to register a phone number with ODIS on Celo.

`index.js` includes scripts to request verification codes from and verify them with the Attesations contract.

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

