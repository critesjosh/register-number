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
    getConnectedKit,
  } = useContractKit();

  useEffect(() => {
    updateNetwork(Alfajores);
  }, []);

  const defaultResponse = {
    status: "",
    body: {
      e164Number: "",
      phoneHash: "",
      pepper: "",
    },
  };

  const [phoneNumber, setPhoneNumber] = useState("+13132880080");
  const [lookupResponse, setLookupResponse] = useState(defaultResponse);
  const [mapping, setMapping] = useState(null);
  const [attestationsFeeApproved, setAttestationFeeApproved] = useState(false);
  const [attestationsContract, setAttestationsContract] = useState(null);
  const [attestationIssuers, setAttestationIssuers] = useState([]);
  const [codesSent, setCodesSent] = useState(true);
  const [code0, setCode0] = useState("");
  const [code1, setCode1] = useState("");
  const [code2, setCode2] = useState("");

  const makeRequest = async (endpoint: string) => {
    if (endpoint == "lookup") await sendRequestTransaction();

    const lookupData = {
      network: network.chainId.toString(10),
      phoneNumber: phoneNumber,
      issuers: attestationIssuers,
      account: kit.defaultAccount,
      pepper: lookupResponse.body.pepper,
      phoneHash: lookupResponse.body.phoneHash,
      codes: [code0, code1, code2],
    };

    const res = await fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lookupData),
    });

    let tmpResponse = await res.clone();
    console.log("Endpoint", endpoint, await tmpResponse.json()); // log the res.body, not cloning breaks this

    switch (endpoint) {
      case "lookup":
        setLookupResponse({
          //@ts-ignore
          status: res.status,
          body: await res.json(),
          limit: res.headers.get("X-RateLimit-Limit"),
          remaining: res.headers.get("X-RateLimit-Remaining"),
        });
        break;
      case "getCodes":
        if (res.status === 200) setCodesSent(true);
        break;
      default:
        console.log("unknown endpoint", endpoint);
    }
  };

  const getIdentifiers = async () => {
    let res = await attestationsContract.lookupIdentifiers([
      lookupResponse.body.phoneHash,
    ]);
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

        const cUSDContract = await k.contracts.getStableToken();
        const attestations = await k.contracts.getAttestations();
        setAttestationsContract(attestations);

        let allowance = await cUSDContract.allowance(
          k.defaultAccount,
          attestationsContract.address
        );

        if (
          allowance.isGreaterThan(
            new BigNumber(Web3.utils.toWei("0.15", "ether"))
          )
        ) {
          setAttestationFeeApproved(true);
        }
      });

      toast.success("sendTransaction succeeded");
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
      setAttestationFeeApproved(true);
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
          lookupResponse.body.phoneHash,
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
        lookupResponse.body.phoneHash,
        kit.defaultAccount
      );

      let issuersReceipt = await selectIssuers.sendAndWaitForReceipt({
        gasPrice: Web3.utils.toWei("0.5", "gwei"),
      });

      let issuers = issuersReceipt.events?.AttestationIssuerSelected.map(
        (event) => {
          if (event.event == "AttestationIssuerSelected") {
            return event.returnValues.issuer;
          }
        }
      );

      setAttestationIssuers(issuers);

      console.log(`Issuers<Array>:`, issuers);

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
      lookupResponse.body.phoneHash,
      kit.defaultAccount
    );
    console.log(stats);
  };

  return (
    <>
      <div className="flex justify-center">
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
          <div>{network.name}</div>
        </>
        <>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            type="text"
          />
          <button onClick={() => makeRequest("lookup")}>
            Lookup Phone Hash
          </button>
          <h2>Phone Number lookup response</h2>
          <p>Phone Number: {lookupResponse.body.e164Number}</p>
          <p>Phone Hash: {lookupResponse.body.phoneHash}</p>
          <p>Pepper: {lookupResponse.body.pepper}</p>
          {lookupResponse.body.phoneHash && (
            <>
              <button onClick={() => getIdentifiers()}>
                Console.log associated addresses
              </button>
              <button onClick={() => approveAttestationFee()}>
                Approve Attesation fee
              </button>
            </>
          )}
          <h2>Request Attestations</h2>
          {attestationsFeeApproved && (
            <>
              <button onClick={() => requestNewAttestation()}>
                Request new attestations
              </button>
              <button onClick={() => selectAttestationIssuers()}>
                Select attestation issuers
              </button>
              <button onClick={() => makeRequest("getCodes")}>Get codes</button>
              <button onClick={() => consoleLogAttestationStats()}>
                console.log attestations stats
              </button>
            </>
          )}
          <h2>Send Codes</h2>
          {codesSent && (
            <>
              <input
                value={code0}
                onChange={(e) => setCode0(e.target.value)}
                type="text"
              />
              <input
                value={code1}
                onChange={(e) => setCode1(e.target.value)}
                type="text"
              />
              <input
                value={code2}
                onChange={(e) => setCode2(e.target.value)}
                type="text"
              />
              <button onClick={() => makeRequest('sendCodes')}>Send the Codes</button>
              <br></br>
            </>
          )}
        </>
      </div>
    </>
  );
}

export default function WrappedApp() {
  return (
    <ContractKitProvider
      dapp={{
        name: "Register Phone Number",
        description: "My awesome description",
        url: "https://example.com",
        icon: "",
      }}
    >
      <App />
    </ContractKitProvider>
  );
}

const getSecurityPrefix = (attestationToComplete) =>
  attestationToComplete.name[10];
