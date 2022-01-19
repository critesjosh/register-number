import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
// require('dotenv').config()

import rateLimit from "../../utils/rate-limit";

const limiter = rateLimit({
  interval: 1000, // 1 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

export default async function handler(req, res) {
  let phoneNumber, account, pepper, networkURL;

  if (req.method === "POST") {
    // Process a POST request
    try {
      await limiter.check(res, 10, "CACHE_TOKEN"); // 10 requests per minute

      console.log(req.body);

      switch (req.body.network) {
        case "44787":
          networkURL = "https://alfajores-forno.celo-testnet.org";
          break;
        case "42220":
          networkURL = "https://forno.celo.org";
          break;
        default:
          res
            .status(400)
            .send({ message: "Set NETWORK to either alfajores or mainnet" });
          console.log("Set NETWORK to either alfajores or mainnet");
      }

      let web3 = new Web3(networkURL);
      //@ts-ignore
      let contractkit = newKitFromWeb3(web3);
      const attestationsContract =
        await contractkit.contracts.getAttestations();

      let attestationsToComplete =
        await attestationsContract.getActionableAttestations(
          req.body.phoneHash,
          req.body.account
        );

      console.log(attestationsToComplete);

      const postAttestationRequest = async (attestationToComplete) => {
        const requestBody = {
          phoneNumber: req.body.phoneNumber,
          account: req.body.account,
          issuer: attestationToComplete.issuer,
          salt: req.body.pepper,
          smsRetrieverAppSig: undefined,
          language: "en",
          securityCodePrefix: getSecurityPrefix(attestationToComplete),
        };
    
        console.log("Attestation Request Body: ", requestBody);
        const response = await attestationsContract.revealPhoneNumberToIssuer(
          attestationToComplete.attestationServiceURL,
          requestBody
        );
        return response.json();
      };

      console.log(
        "Responses",
        await Promise.all(attestationsToComplete.map(postAttestationRequest))
      );

      let responses = await Promise.all(attestationsToComplete.map(postAttestationRequest))

      res.status(200).send({ responses });
      return;
    } catch (error) {
      console.log('Server error:', error)
      res.status(429).json({ error: "Rate limit exceeded" });
    }
  } else {
    res.status(405).send({ message: "Only POST requests allowed" });
    return;
  }
}

const getSecurityPrefix = (attestationToComplete) =>
  attestationToComplete.name[10];
