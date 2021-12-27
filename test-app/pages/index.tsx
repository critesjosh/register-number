import React, { useCallback, useEffect, useState } from 'react';
import { Web3ReactProvider, useWeb3React } from '@web3-react/core'
import { newKitFromWeb3 } from '@celo/contractkit';
import Web3 from "web3";
import { Web3Provider } from '@ethersproject/providers'
import { formatEther } from '@ethersproject/units'
import { InjectedConnector } from '@web3-react/injected-connector'
import { rmSync } from 'fs';
const OdisUtils = require('@celo/identity').OdisUtils

function getLibrary(provider: any): Web3Provider {
  const web3 = new Web3(provider)
  const contractkit = newKitFromWeb3(web3)
  const library = contractkit.connection.web3.givenProvider
  return library
}

function App() {
  const context = useWeb3React<Web3Provider>()
  const { connector, library, chainId, account, activate, deactivate, active, error } = context
  const injected = new InjectedConnector({ supportedChainIds: [1, 3, 4, 5, 42, 44787] })

  const [contractKit, setcontractKit] = useState(null)

  // handle logic to recognize the connector currently being activated
  const [activatingConnector, setActivatingConnector] = React.useState<any>()
  React.useEffect(() => {
    if (activatingConnector && activatingConnector === connector) {
      setActivatingConnector(undefined)
    }
  }, [activatingConnector, connector])
  
  return (
    <>
      <Account/>
      <button onClick={() => {
          setActivatingConnector(injected)
          activate(injected)
        }}>Connect to metamask</button>
        <button onClick={() => {deactivate()}}>Disconnect</button>
      <ChainId/>
      <Lookup/>
    </>
  )
}

function ChainId() {
  const { chainId } = useWeb3React()

  return (
    <>
      <span>Chain Id</span>
      <span role="img" aria-label="chain">
        ⛓
      </span>
      <span>{chainId ?? ''}</span>
    </>
  )
}

function Balance() {
  const { account, library, chainId } = useWeb3React()

  const [balance, setBalance] = React.useState()
  React.useEffect((): any => {
    if (!!account && !!library) {
      let stale = false

      library
        .getBalance(account)
        .then((balance: any) => {
          if (!stale) {
            setBalance(balance)
          }
        })
        .catch(() => {
          if (!stale) {
            setBalance(null)
          }
        })

      return () => {
        stale = true
        setBalance(undefined)
      }
    }
  }, [account, library, chainId]) // ensures refresh if referential identity of library doesn't change across chainIds

  return (
    <>
      <span>Balance</span>
      <span role="img" aria-label="gold">
        💰
      </span>
      <span>{balance === null ? 'Error' : balance ? `Ξ${formatEther(balance)}` : ''}</span>
    </>
  )
}

export default function() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <App />
    </Web3ReactProvider>
  )
}

function Account() {
  const { account } = useWeb3React()

  return (
    <>
      <span>Account</span>
      <span role="img" aria-label="robot">
        🤖
      </span>
      <span>
        {account === null
          ? '-'
          : account
          ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}`
          : ''}
      </span>
    </>
  )
}

function Lookup(){
  const context = useWeb3React<Web3Provider>()

  const { connector, library, chainId, account, activate, deactivate, active, error } = context
  const [contractKit, setcontractKit] = useState(null)
  const [response, setResponse] = useState(null)

  let odisUrl, odisPubKey, phoneNumber = '+13132880080', lookupAccount = '0xd32dc3ef59cb45d6b8c82b807a51b52ebdb9cbb4'


  async function lookup(){

    const web3 = new Web3(window.ethereum)
    console.log(web3)
    const contractKit = newKitFromWeb3(web3)
    console.log(contractKit)
    setcontractKit(contractKit)

    const authSigner = {
      authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
      contractKit: contractKit
    }

    switch (chainId.toString(10)) {
      case '44787':
        odisUrl = 'https://us-central1-celo-phone-number-privacy.cloudfunctions.net'
        odisPubKey = 'kPoRxWdEdZ/Nd3uQnp3FJFs54zuiS+ksqvOm9x8vY6KHPG8jrfqysvIRU0wtqYsBKA7SoAsICMBv8C/Fb2ZpDOqhSqvr/sZbZoHmQfvbqrzbtDIPvUIrHgRS0ydJCMsA'
        break
      case '42220':
        odisUrl = 'https://us-central1-celo-pgpnp-mainnet.cloudfunctions.net'
        odisPubKey = 'FvreHfLmhBjwxHxsxeyrcOLtSonC9j7K3WrS4QapYsQH6LdaDTaNGmnlQMfFY04Bp/K4wAvqQwO9/bqPVCKf8Ze8OZo8Frmog4JY4xAiwrsqOXxug11+htjEe1pj4uMA'
        break
      default:
        console.log(`connect to Celo mainnet or testnet`)
    }

    const serviceContext = {
      odisUrl,
      odisPubKey
    }

    console.log(authSigner, serviceContext)
  
    const response = await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
      phoneNumber,
      lookupAccount,
      authSigner,
      serviceContext
    )

      console.log(response)

    setResponse(response)
  }

  return (
    <>
    <button onClick={lookup}>Lookup</button>
    {response}
    </>
  )
}