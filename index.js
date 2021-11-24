// In this example, we will go over how to look up a Celo address that is registered with a phone number with ODIS

// 1. Import the appropriate packages
const ContractKit = require('@celo/contractkit')
const OdisUtils = require('@celo/identity').OdisUtils
const id = require('@celo/identity')
const WasmBlsBlindingClient = require('@celo/identity/lib/odis/bls-blinding-client').WasmBlsBlindingClient
const getPhoneHash = require('@celo/utils/lib/phoneNumbers').getPhoneHash
const Web3 = require('web3')
require('dotenv').config()
let thresholdBls = require('blind-threshold-bls')

// 2. Import these packages to help with private key management for the example
const privateKeyToAddress = require('@celo/utils/lib/address').privateKeyToAddress
const normalizeAddressWith0x = require('@celo/utils/lib/address').normalizeAddressWith0x

// 3. connect contractKit to mainnet via Forno
const web3 = new Web3(new Web3.providers.HttpProvider("https://forno.celo.org"))
const contractKit = ContractKit.newKitFromWeb3(web3)

// 4. Specify the authentication method and contractKit instance
const authSigner = {
  authenticationMethod: OdisUtils.Query.AuthenticationMethod.ENCRYPTION_KEY,
  rawKey: process.env.ODIS_KEY
}
// const authSigner = {
//     authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
//     contractKit: contractKit
// }



// 5. Set a phone number to lookup
let e164Number = '+15172023334' // this is a fake number

const serviceContext = {
    odisUrl: 'https://us-central1-celo-pgpnp-mainnet.cloudfunctions.net',
    odisPubKey: 'FvreHfLmhBjwxHxsxeyrcOLtSonC9j7K3WrS4QapYsQH6LdaDTaNGmnlQMfFY04Bp'
}

// 6. You will need a private key from which to query ODIS. The address associated with this private key
//    will be the account from which the query is made. The account must have a small balance (0.005 CELO or 0.01 cUSD).
const defaultAccount = normalizeAddressWith0x(privateKeyToAddress(process.env.PRIVATE_KEY))

// 7. Import the account to contractKit to sign the query request
contractKit.addAccount(process.env.PRIVATE_KEY)

const salt = "salt"
const phoneHash = getPhoneHash(e164Number, salt)

const message = Buffer.from(e164Number)
const blindedMsgResult = threshold_bls.blind(message, process.env.ODIS_KEY)
const blsBlindingClient = new WasmBlsBlindingClient(serviceContext.odisPubKey, blindedMsgResult.blindingFactor)

// 8. Wrap the async functions so we can await the responses
let run = async function(){

  // 9. Make the request to ODIS
  const res = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
    e164Number,
    defaultAccount,
    authSigner,
    serviceContext,
    // blindingFactor,
    phoneHash,
    blsBlindingClient
  )

  console.log(res)

  /*
    { e164Number: '+11234567890',
    phoneHash:
    '0xd5b4028307ee557404bc6819790326dc0194cfc62c0ae5adcd79adb25da0bae8',
    pepper: '+8swDgOD5m138' }
  */

  // 10. Look up the address registered to the returned phoneHash
  const attesationsContract = await contractKit.contracts.getAttestations()
  let mapping = await attesationsContract.lookupIdentifiers([res.phoneHash])

  console.log(mapping)

  /*
   { '0xd5b4028307ee557404bc6819790326dc0194cfc62c0ae5adcd79adb25da0bae8':
   { '0xDcD7335735F2c4bC7228E3d59D3D05e69Bb73809': { completed: 3, total: 4 },
     '0xE609135E96aA3424c05e940A6D2693d674bc9fDD': { completed: 3, total: 3 } } }
  */
}

run()