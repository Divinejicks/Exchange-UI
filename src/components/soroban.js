import { Address, BASE_FEE, Contract, nativeToScVal, Networks, rpc, TransactionBuilder , scValToBigInt, Asset, Operation, Horizon, Keypair} from "@stellar/stellar-sdk";
import { kit } from "./connectWallet";

export const server = new rpc.Server('https://soroban-testnet.stellar.org', {
    allowHttp: true,
});

export const horizonServer = new Horizon.Server('https://horizon-testnet.stellar.org', {
    allowHttp: true,
})

export const addressToScVal = (address) => {
    return new Address(address).toScVal();
};

export const stringToSymbol = (value) => {
    return nativeToScVal(value, {type: "symbol"})
}

export const stringToI128 = (value) => {
    return nativeToScVal(value, {type: "i128"})
}

export const JXoFTokenAddress = "CCTYLYRLOHA4ARAGWIV2YIKGFUE3GTSOKMX6GT5GFZWIQ3QQIRDNUUAN"
export const JXaFTokenAddress = "CBTGX2BRZVVRDXNPF2VLIR7BK5OB6Q6ULMDVQFLPQG72TQNTLETCWUUF"
export const contractAddress = import.meta.env.VITE_CONTRACT_ID
export const publicKeyOfIssuer = import.meta.env.VITE_ISSUER_PUBLIC_KEY

const contract = new Contract(contractAddress)
const decimals = 7

export const GetTokenBalance = async (token, publicKey) => {
    try {
        const sourceAccount = await server.getAccount(publicKey);
        const buildTx = new TransactionBuilder(sourceAccount, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET
        })
            .addOperation(
                contract.call(
                    "read_balance",
                    addressToScVal(token),
                    addressToScVal(publicKey)
                )
            )
            .setTimeout(30)
            .build();

        const simulateResponse = await server.simulateTransaction(buildTx);

        if (simulateResponse.error) {
            const errorMessage = simulateResponse.error.toString();
            if (errorMessage.includes("trustline entry is missing for account")) {
                // alert(`Trustline is missing for this account: ${publicKey}`);
                return
            }
            else {
                throw new Error(simulateResponse.error);
            }
        }

        // Decode the balance from simulateResponse
        const scValResult = simulateResponse.result?.retval;
        if (!scValResult) {
            throw new Error("No return value from simulation.");
        }

        // Convert the SCVal result to a BigInt
        const rawBalance = scValToBigInt(scValResult);

        // Adjust for decimals
        const readableBalance = parseFloat(rawBalance) / Math.pow(10, decimals);

        return readableBalance; // Return the balance as a BigInt
    } catch (error) {
        console.error("Error getting token balance:", error);
        throw error;
    }
};

export const CreateTrustlineForToken = async (tokenName, userPublicKey) => {
    const asset = new Asset(tokenName, publicKeyOfIssuer)
    const sourceAccount = await horizonServer.loadAccount(userPublicKey)
    const buildTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
    })
        .addOperation(Operation.changeTrust({
            asset: asset
        }))
        .setTimeout(30)
        .build();

    const prepareTx = buildTx.toXDR()
    const { signedTxXdr }  = await kit.signTransaction(prepareTx, {
        userPublicKey,
        networkPassphrase: Networks.TESTNET
    })

    const tx = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET)

    try {
        let sendResponse = await horizonServer.submitTransaction(tx);
        console.log("Assets issued:", sendResponse);
    } catch (error) {
      console.error("Error issuing assets:", error);
    }
}

export const BuyToken = async (tokenName, userPublicKey) => {
    const asset = new Asset(tokenName, publicKeyOfIssuer)
    //Note we use the publickey of the issuer to load the account
    const sourceAccount = await horizonServer.loadAccount(publicKeyOfIssuer)
    const buildTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
    })
        .addOperation(Operation.payment({
            destination: userPublicKey,
            asset: asset,
            amount: "1000"
        }))
        .setTimeout(30)
        .build();
    
    buildTx.sign(Keypair.fromSecret(import.meta.env.VITE_ISSUER_KEY));

    try {
        let sendResponse = await horizonServer.submitTransaction(buildTx);
        console.log("Assets issued:", sendResponse);
    } catch (error) {
      console.error("Error issuing assets:", error);
    }
} 

export const SendSameTokenToUser = async (nameOfTokenSend, nameOfTokenReceive, walletAddressOfReceiver, userPublicKey, amount) => {
    const tokenSent = nameOfTokenSend === "JXoF" ? JXoFTokenAddress : JXaFTokenAddress
    const sourceAccount = await server.getAccount(userPublicKey)
    const buildTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
    })
        .addOperation(contract.call(
            "send",
            addressToScVal(userPublicKey),
            addressToScVal(walletAddressOfReceiver),
            addressToScVal(tokenSent),
            stringToI128(amount * Math.pow(10, decimals))
        ))
        .setTimeout(120)
        .build();
    
    const _buildTx = await server.prepareTransaction(buildTx)
    const prepareTx = _buildTx.toXDR()

    const { signedTxXdr }  = await kit.signTransaction(prepareTx, {
        userPublicKey,
        networkPassphrase: Networks.TESTNET
    })

    const tx = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET)

    try {
        let sendResponse = await server.sendTransaction(tx);
        console.log(`Sent transaction: ${JSON.stringify(sendResponse)}`);
    
        if (sendResponse.status === "PENDING") {
          let getResponse = await server.getTransaction(sendResponse.hash);
          // Poll `getTransaction` until the status is not "NOT_FOUND"
          while (getResponse.status === "NOT_FOUND") {
            console.log("Waiting for transaction confirmation...");
            // See if the transaction is complete
            getResponse = await server.getTransaction(sendResponse.hash);
            // Wait one second
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
    
          console.log(`getTransaction response: ${JSON.stringify(getResponse)}`);
    
          if (getResponse.status === "SUCCESS") {
            // Make sure the transaction's resultMetaXDR is not empty
            if (!getResponse.resultMetaXdr) {
              throw "Empty resultMetaXDR in getTransaction response";
            }
            // Find the return value from the contract and return it
            let transactionMeta = getResponse.resultMetaXdr;
            let returnValue = transactionMeta.v3().sorobanMeta().returnValue();
            console.log(`Transaction result: ${returnValue.value()}`);
          } else {
            throw `Transaction failed: ${getResponse.resultXdr}`;
          }
        } else {
          throw sendResponse.errorResultXdr;
        }
      } catch (err) {
        // Catch and report any errors we've thrown
        console.log("Sending transaction failed");
        console.log(JSON.stringify(err));
      }

}

export const ExhangeTokens = async (senderAddress, receiverAddress, nameOfTokenSend, nameOfTokenReceive, amount) => {
    const senderToken = nameOfTokenSend === "JXoF" ? JXoFTokenAddress : JXaFTokenAddress
    const receiverToken = nameOfTokenReceive === "JXoF" ? JXoFTokenAddress : JXaFTokenAddress
    const sourceAccount = await server.getAccount(senderAddress)
    const buildTx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET
    })
        .addOperation(contract.call(
            "exchange",
            addressToScVal(senderAddress),
            addressToScVal(receiverAddress),
            addressToScVal(senderToken),
            addressToScVal(receiverToken),
            stringToI128(amount * Math.pow(10, decimals))
        ))
        .setTimeout(120)
        .build();


    console.log(buildTx.toXDR())
    
    const simulateResponse = await server.simulateTransaction(buildTx);
    if (simulateResponse.error) {
        throw new Error(simulateResponse.error);
    }
    
    const _buildTx = await server.prepareTransaction(buildTx)
    const prepareTx = _buildTx.toXDR()

    const { signedTxXdr }  = await kit.signTransaction(prepareTx, {
        senderAddress,
        networkPassphrase: Networks.TESTNET
    })

    const tx = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET)

    try {
        let sendResponse = await server.sendTransaction(tx);
        console.log(`Sent transaction: ${JSON.stringify(sendResponse)}`);
    
        if (sendResponse.status === "PENDING") {
          let getResponse = await server.getTransaction(sendResponse.hash);
          // Poll `getTransaction` until the status is not "NOT_FOUND"
          while (getResponse.status === "NOT_FOUND") {
            console.log("Waiting for transaction confirmation...");
            // See if the transaction is complete
            getResponse = await server.getTransaction(sendResponse.hash);
            // Wait one second
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
    
          console.log(`getTransaction response: ${JSON.stringify(getResponse)}`);
    
          if (getResponse.status === "SUCCESS") {
            // Make sure the transaction's resultMetaXDR is not empty
            if (!getResponse.resultMetaXdr) {
              throw "Empty resultMetaXDR in getTransaction response";
            }
            // Find the return value from the contract and return it
            let transactionMeta = getResponse.resultMetaXdr;
            let returnValue = transactionMeta.v3().sorobanMeta().returnValue();
            console.log(`Transaction result: ${returnValue.value()}`);
          } else {
            throw `Transaction failed: ${getResponse.resultXdr}`;
          }
        } else {
          throw sendResponse.errorResultXdr;
        }
      } catch (err) {
        // Catch and report any errors we've thrown
        console.log("Sending transaction failed");
        console.log(JSON.stringify(err));
      }

}
