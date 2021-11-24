dataEncryptionKeyUtils = require('@celo/utils/lib/dataEncryptionKey')
require('dotenv').config()
const ContractKit = require('@celo/contractkit')
const privateKeyToAddress = require('@celo/utils/lib/address').privateKeyToAddress
const normalizeAddressWith0x = require('@celo/utils/lib/address').normalizeAddressWith0x
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider("https://forno.celo.org"))
const contractKit = ContractKit.newKitFromWeb3(web3)
contractKit.addAccount(process.env.PRIVATE_KEY)
const defaultAccount = normalizeAddressWith0x(privateKeyToAddress(process.env.PRIVATE_KEY))

async function setDEK(){
    dekPublicKey = dataEncryptionKeyUtils.compressedPubKey(process.env.ODIS_KEY)
    const accountWrapper = await contractKit.contracts.getAccounts()
    console.log(dekPublicKey)
    //const setKeyTx = await accountWrapper.setAccountDataEncryptionKey(dekPublicKey).send({from: defaultAccount})
}

setDEK()