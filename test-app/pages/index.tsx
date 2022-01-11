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
  const [phoneNumber, setPhoneNumber] = useState("+13132880080");

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
        <Lookup phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber} />
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

function Lookup({ phoneNumber, setPhoneNumber }) {
  const { kit, network, performActions, address } = useContractKit();

  const defaultResponse = {
    status: "",
    body: {
      e164Number: "",
      phoneHash: "",
      pepper: "",
    },
  };

  const [response, setResponse] = useState(defaultResponse);
  // const [phoneNumber, setPhoneNumber] = useState("+13132880080");
  const [mapping, setMapping] = useState(null);
  const [attestationsFeeApproved, setAttestationFeeAprpoved] = useState(false);
  const [attestationsContract, setAttestationsContract] = useState(null);
  const [attestationIssuers, setAttestationIssuers] = useState([]);

  const makeRequest = async () => {
    await sendRequestTransaction();

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
    console.log(tmpResponse); // log the res.body, not cloning breaks this

    setResponse({
      //@ts-ignore
      status: res.status,
      body: await res.json(),
      limit: res.headers.get("X-RateLimit-Limit"),
      remaining: res.headers.get("X-RateLimit-Remaining"),
    });
  };

  const lookup = async () => {
    try {
      await performActions(async (k) => {
        let odisUrl, odisPubKey;

        const authSigner = {
          authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
          contractKit: k,
        };

        switch (network.chainId.toString(10)) {
          case "44787":
            odisUrl =
              "https://us-central1-celo-phone-number-privacy.cloudfunctions.net";
            odisPubKey =
              "kPoRxWdEdZ/Nd3uQnp3FJFs54zuiS+ksqvOm9x8vY6KHPG8jrfqysvIRU0wtqYsBKA7SoAsICMBv8C/Fb2ZpDOqhSqvr/sZbZoHmQfvbqrzbtDIPvUIrHgRS0ydJCMsA";
            break;
          case "42220":
            odisUrl =
              "https://us-central1-celo-pgpnp-mainnet.cloudfunctions.net";
            odisPubKey =
              "FvreHfLmhBjwxHxsxeyrcOLtSonC9j7K3WrS4QapYsQH6LdaDTaNGmnlQMfFY04Bp/K4wAvqQwO9/bqPVCKf8Ze8OZo8Frmog4JY4xAiwrsqOXxug11+htjEe1pj4uMA";
            break;
          default:
            console.log(
              `Set the NETWORK environment variable to either 'alfajores' or 'mainnet'`
            );
        }

        const serviceContext = {
          odisUrl,
          odisPubKey,
        };

        const blsBlindingClient = new WebBlsBlindingClient(
          serviceContext.odisPubKey
        );
        
        const response =
          await OdisUtils.PhoneNumberIdentifier.getPhoneNumberIdentifier(
            phoneNumber,
            address,
            authSigner,
            serviceContext,
            undefined,
            undefined,
            undefined,
            blsBlindingClient
          );

        console.log(response);
      });

      toast.success("succeeded");
      // await fetchSummary();
    } catch (e) {
      console.log(e)

      toast.error((e as Error).message);
    }
  };

  const getIdentifiers = async () => {
    const attestations = await kit.contracts.getAttestations();
    setAttestationsContract(attestations);
    let res = await attestations.lookupIdentifiers([response.body.phoneHash]);
    setMapping(res);
    console.log("mapping response", res);
  };

  const sendRequestTransaction = async () => {
    try {
      await performActions(async (k) => {
        const celo = await k.contracts.getGoldToken();
        await celo
          .transfer(
            // server account, to keep up ODIS quota
            "0x9d10d841Af74FC5A4799fa605038711B4E17CfE4",
            Web3.utils.toWei("0.01", "ether")
          )
          .sendAndWaitForReceipt({
            from: k.defaultAccount,
            gasPrice: Web3.utils.toWei("0.5", "gwei"),
          });
      });

      toast.success("sendTransaction succeeded");
      // await fetchSummary();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const approveAttestationFee = async () => {
    try {
      await performActions(async (k) => {
        /**
         * Approves the necessary amount of StableToken to request Attestations
         * @param attestationsRequested The number of attestations to request
         */
        const approve = await attestationsContract.approveAttestationFee(3);
        await approve.sendAndWaitForReceipt({
          gasPrice: Web3.utils.toWei("0.5", "gwei"),
        });
      });
      setAttestationFeeAprpoved(true);
      toast.success("approveAttestationFee succeeded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const requestNewAttestation = async () => {
    try {
      await performActions(async (k) => {
        /**
         * Requests a new attestation
         * @param identifier Attestation identifier (e.g. phone hash)
         * @param attestationsRequested The number of attestations to request
         */
        let request = await attestationsContract.request(
          response.body.phoneHash,
          3
        );
        let requestReceipt = await request.sendAndWaitForReceipt({
          gasPrice: Web3.utils.toWei("0.5", "gwei"),
        });
        console.log(`Request receipt: `, requestReceipt);
      });

      toast.success("requestNewAttestation succeeded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const selectAttestationIssuers = async () => {
    try {
      /**
       * Waits appropriate number of blocks, then selects issuers for previously requested phone number attestations
       * @param identifier Attestation identifier (e.g. phone hash)
       * @param account Address of the account
       */
      const selectIssuers = await attestationsContract.selectIssuersAfterWait(
        response.body.phoneHash,
        kit.defaultAccount
      );
      let issuers = await selectIssuers.sendAndWaitForReceipt({
        gasPrice: Web3.utils.toWei("0.5", "gwei"),
      });
      setAttestationIssuers(issuers);

      console.log(`Issuers:`, issuers);

      toast.success("selectAttestationIssuers succeeded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const consoleLogAttestationStats = async () => {
    /**
     * Returns the attestation stats of a identifer/account pair
     * @param identifier Attestation identifier (e.g. phone hash)
     * @param account Address of the account
     */
    const stats = await attestationsContract.getAttestationStat(
      response.body.phoneHash,
      kit.defaultAccount
    );
    console.log(stats);
  };

  return (
    <>
      <input
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        type="text"
      />
      <button onClick={() => makeRequest()}>Lookup Phone Hash</button>
      <p>Phone Number: {response.body.e164Number}</p>
      <p>Phone Hash: {response.body.phoneHash}</p>
      <p>Pepper: {response.body.pepper}</p>
      {response.body.phoneHash && (
        <>
          <button onClick={() => getIdentifiers()}>
            Console.log associated addresses
          </button>
          <button onClick={() => approveAttestationFee()}>
            Approve Attesation fee
          </button>
        </>
      )}
      {attestationsFeeApproved && (
        <>
          <button onClick={() => requestNewAttestation()}>
            Request new attestations
          </button>
          <button onClick={() => selectAttestationIssuers()}>
            Select attestation issuers
          </button>
          <button onClick={() => consoleLogAttestationStats()}>
            console.log attestations stats
          </button>
        </>
      )}
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
