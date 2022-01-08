import { StableToken } from "@celo/contractkit";
import { ensureLeading0x } from "@celo/utils/lib/address";
import {
  Alfajores,
  Baklava,
  Mainnet,
  useContractKit,
  ContractKitProvider,
} from "@celo-tools/use-contractkit";
import { BigNumber } from "bignumber.js";
import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import Web3 from "web3";
const OdisUtils = require("@celo/identity").OdisUtils;

import { PrimaryButton, SecondaryButton, toast } from "../components";

import { WebBlsBlindingClient } from "../utils/bls-blinding-client";

function truncateAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(36)}`;
}

const networks = [Alfajores, Mainnet];

const defaultSummary = {
  name: "",
  address: "",
  wallet: "",
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

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return (
    <>
      <div className="flex justify-center">
        <Connect />
        <Lookup />
      </div>
      <div className="flex flex-row items-center">
        <div className="items-center justify-center">
          {address && (
            <div className="w-64 md:w-96 space-y-4 text-gray-700">
              <div className="mb-4">
                <div className="text-lg font-bold mb-2 text-gray-900">
                  Account summary
                </div>
                <div className="space-y-2">
                  <div>Wallet type: {walletType}</div>
                  <div>Name: {summary.name || "Not set"}</div>
                  <div className="">Address: {truncateAddress(address)}</div>
                  <div className="">
                    Wallet address:{" "}
                    {summary.wallet
                      ? truncateAddress(summary.wallet)
                      : "Not set"}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-lg font-bold mb-2 text-gray-900">
                  Balances
                </div>
                <div className="space-y-2">
                  <div>CELO: {Web3.utils.fromWei(summary.celo.toFixed())}</div>
                  <div>cUSD: {Web3.utils.fromWei(summary.cusd.toFixed())}</div>
                  <div>cEUR: {Web3.utils.fromWei(summary.ceur.toFixed())}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Connect() {
  const { address, destroy, connect, updateNetwork, network } =
    useContractKit();
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
      <div>
        <select
          className="border border-gray-300 rounded px-4 py-2"
          value={network.name}
          onChange={async (e) => {
            const newNetwork = networks.find((n) => n.name === e.target.value);
            if (newNetwork) {
              await updateNetwork(newNetwork);
            }
          }}
        >
          {Object.values(networks).map((n) => (
            <option key={n.name} value={n.name}>
              {n.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function Lookup() {
  const { kit, network } = useContractKit();

  const defaultResponse = {
    status: "",
    body: {
      e164Number: "",
      phoneHash: "",
      pepper: "",
    },
  };

  const [response, setResponse] = useState(defaultResponse);
  const [phoneNumber, setPhoneNumber] = useState("+13132880080");
  const [mapping, setMapping] = useState(null);

  const makeRequest = async () => {
    const lookupData = {
      network: network.chainId.toString(10),
      phoneNumber: phoneNumber,
    };

    const res = await fetch("/api/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lookupData),
    });

    let tmpResponse = await res.clone();
    console.log(tmpResponse); // log the res.body

    await setResponse({
      //@ts-ignore
      status: res.status,
      body: await res.json(),
      limit: res.headers.get("X-RateLimit-Limit"),
      remaining: res.headers.get("X-RateLimit-Remaining"),
    });

    if (tmpResponse.status == 200) {
      getIdentifiers();
    }
  };

  async function getIdentifiers() {
    const attestationsContract = await kit.contracts.getAttestations();
    let res = await attestationsContract.lookupIdentifiers([
      response.body.phoneHash,
    ]);
    setMapping(res);
    console.log("mapping response", res);
  }

  return (
    <>
      <input
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        type="text"
      />
      <button onClick={() => makeRequest()}>Lookup</button>
      <p>Phone Number: {response.body.e164Number}</p>
      <p>Phone Hash: {response.body.phoneHash}</p>
      <p>Pepper: {response.body.pepper}</p>
    </>
  );
}

export default function WrappedApp() {
  return (
    <ContractKitProvider
      dapp={{
        name: "My awesome dApp",
        description: "My awesome description",
        url: "https://example.com",
        icon: "",
      }}
    >
      <App />
    </ContractKitProvider>
  );
}
