import { StableToken } from '@celo/contractkit';
import { ensureLeading0x } from '@celo/utils/lib/address';
import {
  Alfajores,
  Baklava,
  Mainnet,
  useContractKit,
  ContractKitProvider
} from '@celo-tools/use-contractkit';
import { BigNumber } from 'bignumber.js';
import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import Web3 from 'web3';
const OdisUtils = require('@celo/identity').OdisUtils

import { PrimaryButton, SecondaryButton, toast } from '../components';

function truncateAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(36)}`;
}

const networks = [Alfajores, Baklava, Mainnet];

const defaultSummary = {
  name: '',
  address: '',
  wallet: '',
  celo: new BigNumber(0),
  cusd: new BigNumber(0),
  ceur: new BigNumber(0),
};

function App() {
  const {
    kit,
    address,
    network,
    updateNetwork,
    connect,
    destroy,
    performActions,
    walletType,
  } = useContractKit();
  const [summary, setSummary] = useState(defaultSummary);
  
  const fetchSummary = useCallback(async () => {
    if (!address) {
      setSummary(defaultSummary);
      return;
    }

    const [accounts, goldToken, cUSD, cEUR] = await Promise.all([
      kit.contracts.getAccounts(),
      kit.contracts.getGoldToken(),
      kit.contracts.getStableToken(StableToken.cUSD),
      kit.contracts.getStableToken(StableToken.cEUR),
    ]);

    const [summary, celo, cusd, ceur] = await Promise.all([
      accounts.getAccountSummary(address).catch((e) => {
        console.error(e);
        return defaultSummary;
      }),
      goldToken.balanceOf(address),
      cUSD.balanceOf(address),
      cEUR.balanceOf(address),
    ]);
    setSummary({
      ...summary,
      celo,
      cusd,
      ceur,
    });
  }, [address, kit]);

  return (
    <>
      <Connect/>
      <Lookup/>
    </>
  )
}

// function ChainId() {
//   const { chainId } = useWeb3React()

//   return (
//     <>
//       <span>Chain Id</span>
//       <span role="img" aria-label="chain">
//         ⛓
//       </span>
//       <span>{chainId ?? ''}</span>
//     </>
//   )
// }

function Connect() {
  const { address, destroy, connect } = useContractKit()
  return (
    <>
    <p>{address}</p>
        {address ? (
                <SecondaryButton onClick={destroy}>Disconnect</SecondaryButton>
              ) : (
                <SecondaryButton
                  onClick={() =>
                    connect().catch((e) => toast.error((e as Error).message))
                  }
                >
                  Connect
                </SecondaryButton>
              )}
    </>
  )
}

function Lookup(){
  const {
    kit,
    address,
    network,
    updateNetwork,
    connect,
    destroy,
    performActions,
    walletType,
  } = useContractKit();

  const [response, setResponse] = useState(null)

  let odisUrl, odisPubKey, phoneNumber = '+13132880080', lookupAccount = '0xd32dc3ef59cb45d6b8c82b807a51b52ebdb9cbb4'

  async function lookup(){

    const authSigner = {
      authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
      contractKit: kit
    }

    switch (network.chainId.toString(10)) {
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

export default function WrappedApp() {
  return (
    <ContractKitProvider
      dapp={{
        name: 'My awesome dApp',
        description: 'My awesome description',
        url: 'https://example.com',
        icon: ''
      }}
    >
      <App />
    </ContractKitProvider>
  );
}