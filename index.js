const ContractKit = require('@celo/contractkit')
const Web3 = require('web3')
const OdisUtils = require('@celo/identity').OdisUtils
const privateKeyToAddress = require('@celo/utils/lib/address').privateKeyToAddress
const normalizeAddressWith0x = require('@celo/utils/lib/address').normalizeAddressWith0x
const extractAttestationCodeFromMessage = require('@celo/utils/lib/attestations').extractAttestationCodeFromMessage

require('dotenv').config()

let networkURL, 
    phoneHash, 
    pepper, 
    contractkit, 
    account, 
    web3, 
    phoneNumber

// setup web3, contractkit, add private key to contractkit
function init(){
  switch (process.env.NETWORK) {
    case 'alfajores':
      networkURL = 'https://alfajores-forno.celo-testnet.org'
      break
    case 'mainnet':
      networkURL = 'https://forno.celo.org'
      break
    default:
      console.log('Set NETWORK to either alfajores or mainnet')
  }
  
  web3 = new Web3(networkURL)
  contractkit = ContractKit.newKitFromWeb3(web3)
  contractkit.connection.addAccount(process.env.PRIVATE_KEY)
  account = normalizeAddressWith0x(privateKeyToAddress(process.env.PRIVATE_KEY))
  contractkit.connection.defaultAccount = account
  console.log(contractkit.defaultAccount)

  phoneNumber = process.env.PHONE_NUMBER
}

// lookup phone number from ODIS, get the identifier (pepper) and phone number hash
async function getHashAndPepper(){
  const response = await lookup(phoneNumber, account)
  pepper = response.pepper
  phoneHash = response.phoneHash
}


/*
lookup the accounts registered to a phone number from the phone hash

example mapping:
  { '0xd5b4028307ee557404bc6819790326dc0194cfc62c0ae5adcd79adb25da0bae8':        <-- phoneHash
  { '0xDcD7335735F2c4bC7228E3d59D3D05e69Bb73809': { completed: 3, total: 4 },    <-- attestations completed
    '0xE609135E96aA3424c05e940A6D2693d674bc9fDD': { completed: 3, total: 3 } } } <-- attestations completed for another address
*/

async function getIdentifiers(){
  const attestationsContract = await contractkit.contracts.getAttestations()
  let mapping = await attestationsContract.lookupIdentifiers([phoneHash])
  console.log(mapping)
}


// request verification codes from ODIS
async function requestCodes() {

  const attestationsContract = await contractkit.contracts.getAttestations()

  /**
   * Approves the necessary amount of StableToken to request Attestations
   * @param attestationsRequested The number of attestations to request
   */
  const approve = await attestationsContract.approveAttestationFee(3)
  await approve.sendAndWaitForReceipt()

  /**
   * Requests a new attestation
   * @param identifier Attestation identifier (e.g. phone hash)
   * @param attestationsRequested The number of attestations to request
   */
  let request = await attestationsContract.request(phoneHash, 3)
  let requestReceipt = await request.sendAndWaitForReceipt()
  console.log(`Request receipt: `, requestReceipt)

  /**
   * Waits appropriate number of blocks, then selects issuers for previously requested phone number attestations
   * @param identifier Attestation identifier (e.g. phone hash)
   * @param account Address of the account
   */
  const selectIssuers = await attestationsContract.selectIssuersAfterWait(phoneHash, account)
  let issuers = await selectIssuers.sendAndWaitForReceipt()
  console.log(`Issuers:`, issuers)

  /**
   * Returns the attestation stats of a identifer/account pair
   * @param identifier Attestation identifier (e.g. phone hash)
   * @param account Address of the account
   */
  const stats = await attestationsContract.getAttestationStat(phoneHash, account)
  console.log(stats)

  let attestationsToComplete = await attestationsContract.getActionableAttestations(phoneHash, account)
  console.info(attestationsToComplete)

  // reveal the phone number to the issuer
  // https://celo-sdk-docs.readthedocs.io/en/latest/contractkit/classes/_wrappers_attestations_.attestationswrapper/#revealphonenumbertoissuer
  console.log(
      'Responses',
      await Promise.all(attestationsToComplete.map(postAttestationRequest))
  )
}

// verify an attestation request with the given code

async function verify(contractkit, base64Code) {

    const attestationsWrapper = await contractkit.contracts.getAttestations()

    let attestationsToComplete = await attestationsWrapper.getActionableAttestations(
        phoneHash,
        account
      )

    const prefix = base64Code.substring(0, 1)

    const respondingService = attestationsToComplete.filter(
        (attestationToComplete) =>
          getSecurityPrefix(attestationToComplete).toString() === prefix
      )

      if (respondingService.length === 1) {
        const getAttestationRequest = {
          account: account,
          issuer: respondingService[0].issuer,
          phoneNumber: phoneNumber,
          salt: pepper,
          securityCode: base64Code.substring(1)
        }
        try {
          const attestation = await attestationsWrapper.getAttestationForSecurityCode(
            respondingService[0].attestationServiceURL,
            getAttestationRequest,
            account
          )
          console.log('Attestation: ', attestation)
          const code = extractAttestationCodeFromMessage(attestation)
          if (code) {
            console.log('Extracted code: ', code)
            const matchingIssuer = await attestationsWrapper.findMatchingIssuer(
              phoneHash,
              account,
              code,
              attestationsToComplete.map((a) => a.issuer)
            )
            if (matchingIssuer === null) {
              console.warn('No matching issuer found for code')
              resolve(null)
              return
            }
            const isValidRequest = await attestationsWrapper.validateAttestationCode(
              phoneHash,
              account,
              matchingIssuer,
              code
            )
            if (!isValidRequest) {
              console.warn('Code was not valid')
              resolve(null)
              return
            }
            const completeResult = await attestationsWrapper.complete(
              phoneHash,
              account,
              matchingIssuer,
              code
            )
            const receipt = await completeResult.sendAndWaitForReceipt()
            console.log(receipt)
          } else {
            console.error('extracted code is null')
          }
        } catch (error) {
          console.error(error)
        }
      } else {
        console.log('respondingService:', respondingService)
        console.log('Prefix does not match any issuers')
      }

}

const postAttestationRequest = async (attestationToComplete) => {
    const attestations = await contractkit.contracts.getAttestations()

    const requestBody = {
      phoneNumber,
      account: account,
      issuer: attestationToComplete.issuer,
      salt: pepper,
      smsRetrieverAppSig: undefined,
      language: 'en',
      securityCodePrefix: getSecurityPrefix(attestationToComplete)
    }
    console.log('Attestation Request Body: ', requestBody)
    const response = await attestations.revealPhoneNumberToIssuer(
      attestationToComplete.attestationServiceURL,
      requestBody
    )
    return response.json()
}

// NOTE: this is currently a janky way of getting a prefix code for alfajores, need to update for mainnet
const getSecurityPrefix = (attestationToComplete) => attestationToComplete.name[10]

// lookup the phoneHash and pepper for given account
async function lookup(phoneNumber, account){

  let odisUrl, odisPubKey

  const authSigner = {
    authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
    contractKit: contractkit
  }

  switch (process.env.NETWORK) {
    case 'alfajores':
      odisUrl = 'https://us-central1-celo-phone-number-privacy.cloudfunctions.net'
      odisPubKey = 'kPoRxWdEdZ/Nd3uQnp3FJFs54zuiS+ksqvOm9x8vY6KHPG8jrfqysvIRU0wtqYsBKA7SoAsICMBv8C/Fb2ZpDOqhSqvr/sZbZoHmQfvbqrzbtDIPvUIrHgRS0ydJCMsA'
      break
    case 'mainnet':
      odisUrl = 'https://us-central1-celo-pgpnp-mainnet.cloudfunctions.net'
      odisPubKey = 'FvreHfLmhBjwxHxsxeyrcOLtSonC9j7K3WrS4QapYsQH6LdaDTaNGmnlQMfFY04Bp/K4wAvqQwO9/bqPVCKf8Ze8OZo8Frmog4JY4xAiwrsqOXxug11+htjEe1pj4uMA'
      break
    default:
      console.log(`Set the NETWORK environment variable to either 'alfajores' or 'mainnet'`)
  }

  const serviceContext = {
    odisUrl,
    odisPubKey
  }

  const response = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
    phoneNumber,
    account,
    authSigner,
    serviceContext
  )

  return response
}

// register an account with Accounts.sol and register the associated wallet
// This is a necessary step for ODIS to resolve wallet addresses correctly
async function registerAccountAndWallet(){
  const accountsContract = await contractkit.contracts.getAccounts()

  // register account if needed
  let registeredAccount = await accountsContract.isAccount()
  if(!registeredAccount){
    await accountsContract.createAccount()
  }

  // register wallet if needed
  let registeredWalletAddress = await accountsContract.getWalletAddress(account)
  if(!registeredWalletAddress){
    const setWalletTx = await accountsContract.setWalletAddress(account)
    await setWalletTx.sendAndWaitForReceipt()
  }
}

// helper function to disable certain component when testing
async function run(){
  init()
  // await registerAccountAndWallet()
  // await getHashAndPepper()
  // await getIdentifiers()
  // await requestCodes()
  // await verify(contractkit, '93905629')
}

run()