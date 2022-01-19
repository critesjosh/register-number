import Web3 from "web3";
import { newKitFromWeb3 } from "@celo/contractkit";
// require('dotenv').config()
const extractAttestationCodeFromMessage =
  require("@celo/utils/lib/attestations").extractAttestationCodeFromMessage;
const privateKeyToAddress =
  require("@celo/utils/lib/address").privateKeyToAddress;
const normalizeAddressWith0x =
  require("@celo/utils/lib/address").normalizeAddressWith0x;

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
      contractkit.connection.addAccount(process.env.PRIVATE_KEY);
      let from = normalizeAddressWith0x(
        privateKeyToAddress(process.env.PRIVATE_KEY)
      );
      contractkit.connection.defaultAccount = from;
      const attestationsWrapper = await contractkit.contracts.getAttestations();

      let attestationsToComplete =
        await attestationsWrapper.getActionableAttestations(
          req.body.phoneHash,
          req.body.account
        );

      const verify = async (base64Code) => {
        const prefix = base64Code.substring(0, 1);

        const respondingService = attestationsToComplete.filter(
          (attestationToComplete) =>
            getSecurityPrefix(attestationToComplete).toString() === prefix
        );

        if (respondingService.length === 1) {
          const getAttestationRequest = {
            account: req.body.account,
            issuer: respondingService[0].issuer,
            phoneNumber: req.body.phoneNumber,
            salt: req.body.pepper,
            securityCode: base64Code.substring(1),
          };
          try {
            const attestation =
              await attestationsWrapper.getAttestationForSecurityCode(
                respondingService[0].attestationServiceURL,
                getAttestationRequest,
                req.body.account
              );
            console.log("Attestation: ", attestation);
            const code = extractAttestationCodeFromMessage(attestation);
            if (code) {
              console.log("Extracted code: ", code);
              const matchingIssuer =
                await attestationsWrapper.findMatchingIssuer(
                  req.body.phoneHash,
                  req.body.account,
                  code,
                  attestationsToComplete.map((a) => a.issuer)
                );
              if (matchingIssuer === null) {
                console.warn("No matching issuer found for code");
                // resolve(null)
                return;
              }
              const isValidRequest =
                await attestationsWrapper.validateAttestationCode(
                  req.body.phoneHash,
                  req.body.account,
                  matchingIssuer,
                  code
                );
              if (!isValidRequest) {
                console.warn("Code was not valid");
                // resolve(null)
                return;
              }
              const completeResult = await attestationsWrapper.complete(
                req.body.phoneHash,
                req.body.account,
                matchingIssuer,
                code
              );
              const receipt = await completeResult.sendAndWaitForReceipt();
              console.log(receipt);
            } else {
              console.error("extracted code is null");
            }
          } catch (error) {
            console.error(error);
          }
        } else {
          console.log("respondingService:", respondingService);
          console.log("Prefix does not match any issuers");
        }
      };

      req.body.codes?.map((code) => {
        verify(code);
      });

      res.status(200).send({ message: "Success" });
      return;
    } catch (error) {
      console.log("Server error:", error);
      res.status(429).json({ error: "Rate limit exceeded" });
    }
  } else {
    res.status(405).send({ message: "Only POST requests allowed" });
    return;
  }
}

const getSecurityPrefix = (attestationToComplete) =>
  attestationToComplete.name[10];
