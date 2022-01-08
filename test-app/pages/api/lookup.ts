import Web3 from 'web3';
const OdisUtils = require('@celo/identity').OdisUtils
import { newKitFromWeb3 } from '@celo/contractkit'
require('dotenv').config()

const privateKeyToAddress = require('@celo/utils/lib/address').privateKeyToAddress
const normalizeAddressWith0x = require('@celo/utils/lib/address').normalizeAddressWith0x

import rateLimit from '../../utils/rate-limit'

const limiter = rateLimit({
  interval: 1000, // 1 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
})

export default async function handler(req, res) {

    let odisUrl, odisPubKey, phoneNumber, networkURL, errorMsg

    if (req.method === 'POST') {
        // Process a POST request
        try {
            await limiter.check(res, 10, 'CACHE_TOKEN') // 10 requests per minute
            
            console.log(req.body)

            switch (req.body.network) {
                case '44787':
                  networkURL = 'https://alfajores-forno.celo-testnet.org'
                  odisUrl = 'https://us-central1-celo-phone-number-privacy.cloudfunctions.net'
                  odisPubKey = 'kPoRxWdEdZ/Nd3uQnp3FJFs54zuiS+ksqvOm9x8vY6KHPG8jrfqysvIRU0wtqYsBKA7SoAsICMBv8C/Fb2ZpDOqhSqvr/sZbZoHmQfvbqrzbtDIPvUIrHgRS0ydJCMsA'
                  break
                case '42220':
                  networkURL = 'https://forno.celo.org'
                  odisUrl = 'https://us-central1-celo-pgpnp-mainnet.cloudfunctions.net'
                  odisPubKey = 'FvreHfLmhBjwxHxsxeyrcOLtSonC9j7K3WrS4QapYsQH6LdaDTaNGmnlQMfFY04Bp/K4wAvqQwO9/bqPVCKf8Ze8OZo8Frmog4JY4xAiwrsqOXxug11+htjEe1pj4uMA'
                  break
                default:
                  res.status(400).send({ message: 'Set NETWORK to either alfajores or mainnet' })
                  console.log('Set NETWORK to either alfajores or mainnet')
              }

            let web3 = new Web3(networkURL)
            //@ts-ignore
            let contractkit = newKitFromWeb3(web3)
            contractkit.connection.addAccount(process.env.PRIVATE_KEY)
            let from = normalizeAddressWith0x(privateKeyToAddress(process.env.PRIVATE_KEY))
            contractkit.connection.defaultAccount = from

            let phoneNumber = req.body.phoneNumber

            const authSigner = {
                authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
                contractKit: contractkit
            }

            const serviceContext = {
                odisUrl,
                odisPubKey
            }

            const response = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
                phoneNumber,
                from,
                authSigner,
                serviceContext,
              )

            console.log(response)

            res.status(200).json(response)
            return
          } catch {
            res.status(429).json({ error: 'Rate limit exceeded' })
          }
    } else {
        res.status(405).send({ message: 'Only POST requests allowed' })
        return
    }
//

}