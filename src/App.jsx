import './App.css'
import React, { useEffect, useState } from "react";
import { ConnectWallet } from './components/connectWallet';
import { xdr } from 'stellar-sdk';
import { Address, Asset, Contract, nativeToScVal } from '@stellar/stellar-sdk';


const App = () => {
  const [SDKStellar, setSDKStellar] = useState(null)
  const [server, setServer] = useState(null);
  const [publicKey, setPublicKey] = useState(sessionStorage.getItem("publicKey"))
  const [senderToken, setSenderToken] = useState("")
  const [receiverToken, setReceiverToken] = useState("")
  const [receiverAddress, setREceiverAddress] = useState("")
  const [amount, setAmount] = useState(0)

  const contractAddress = import.meta.env.VITE_CONTRACT_ID

  console.log("contractAddress", contractAddress)

  useEffect(() => {
    (async () => {
      const StellarSdk = await import("stellar-sdk");
      setSDKStellar(SDKStellar)
      const horizonUrl = import.meta.env.VITE_HORIZON_URL;
      setServer(new StellarSdk.Horizon.Server(horizonUrl));
    })();
  }, []);

  // Function to ensure the trustline exists for the asset
  async function ensureTrustline(account, asset) {
    const accountData = await server.loadAccount(account);
    console.log("accountData", accountData)
    const hasTrustline = accountData.balances.some(balance => balance.asset_code === asset.code);
    console.log("hasTrustline", hasTrustline)
    if (!hasTrustline) {
      // If the trustline does not exist, create it
      await createTrustline(accountData, account, asset);
    }
  }

  // Function to create a trustline for the asset on the account
  async function createTrustline(accountData, account, asset) {
    const StellarSdk = await import("stellar-sdk");
    const transaction = new StellarSdk.TransactionBuilder(accountData, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: asset
      }))
      .setTimeout(30)
      .build();

      //note users have to do their trust them self

    transaction.sign(StellarSdk.Keypair.fromSecret("SCFC5TPMVCB42I362ZU35J346L5ANH7......GTLLQ5SL6YSA5ZMPIAT"));
    try {
      const result = await server.submitTransaction(transaction);
      console.log(`Trustline created: ${result}`);
    } catch (error) {
      console.error("Error creating trustline:", error);
    }
  }

  
  // Call the 'send' method of the Soroban contract
  // async function callSendContract(senderAddress, receiverAddress, selectedTokenAddress, amount) {
  //   console.log("selectedTokenAddress", selectedTokenAddress)
  //   const StellarSdk = await import("stellar-sdk");
  //   await ensureTrustline(senderAddress, selectedTokenAddress); // Ensure sender has a trustline
  //   await ensureTrustline(receiverAddress, selectedTokenAddress); // Ensure receiver has a trustline
  
  //   const transaction = new StellarSdk.TransactionBuilder(
  //     await server.loadAccount(senderAddress),
  //     {
  //       fee: StellarSdk.BASE_FEE,
  //       networkPassphrase: StellarSdk.Networks.TESTNET
  //     }
  //   )
  //     .addOperation(
  //       StellarSdk.Operation.invokeContractFunction({
  //         contract: contractAddress,
  //         function: 'send', // Contract method to call
  //         args: [
  //           senderAddress,
  //           receiverAddress,
  //           selectedTokenAddress,
  //           amount
  //           ],
  //       })
  //     )
  //     .setTimeout(30)
  //     .build();

  //     console.log("transaction", transaction)

  //     console.log("Transaction operations:", transaction.operations.length);

  //   transaction.sign(StellarSdk.Keypair.fromSecret("SDPQCJMAEZGOEXIULXDJLN2CWAS3PXPT2ESAYY33CZFKS2O6K5N4TG4S"));
  //   try {
  //     console.log("here")
  //     const result = await server.submitTransaction(transaction);
  //     console.log('Called contract to send tokens:', result);
  //   } catch (error) {
  //     console.error('Error calling contract:', error);
  //   }
  // }

  // Function to convert an asset (code and issuer) into ScVal
  function assetToScVal(assetCode, assetIssuer) {
    // Ensure asset code is padded to 4 or 12 characters (depending on type)
    const paddedCode = assetCode.padEnd(4, '\0'); // For alphanum4 (adjust for alphanum12 if needed)

    // Create Asset ScObject
    const assetScObject = new xdr.ScObject.scObjAsset(
        new xdr.Asset.assetTypeCreditAlphanum4(
            paddedCode,
            Address.fromString(assetIssuer).toBuffer() // Issuer address as Uint256
        )
    );

    // Wrap the ScObject in ScVal
    return xdr.ScVal.scvObject(assetScObject);
  }



  async function callSendContract(senderAddress, receiverAddress, selectedTokenAddress, amount) {
    const StellarSdk = await import("stellar-sdk");
    console.log("selectedTokenAddress", selectedTokenAddress)
    // Initialize the contract with the valid ID
    const contract = new Contract(contractAddress);
    await ensureTrustline(senderAddress, selectedTokenAddress); // Ensure sender has a trustline
    await ensureTrustline(receiverAddress, selectedTokenAddress); // Ensure receiver has a trustline
  
    const transaction = new StellarSdk.TransactionBuilder(
      await server.loadAccount(senderAddress),
      {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      }
    )
      .addOperation(
        contract.call(
          "send",
          nativeToScVal(Address.fromString(senderAddress)),
          nativeToScVal(Address.fromString(receiverAddress)),
          assetToScVal("TokenA", import.meta.env.VITE_ISSUER_SECRET),
          nativeToScVal(amount, {type: "i128"})
        )
      )
      .setTimeout(30)
      .build();

      console.log(`transaction=${transaction.toXDR()}`);

      let preparedTransaction = await server.prepareTransaction(transaction);

      preparedTransaction.sign(StellarSdk.Keypair.fromSecret("SDPQCJMAEZGOEXIULXDJLN2CWAS3P.....SAYY33CZFKS2O6K5N4TG4S"));
      
      // Let's see the base64-encoded XDR of the transaction we just built.
    console.log(
      `Signed prepared transaction XDR: ${preparedTransaction
        .toEnvelope()
        .toXDR("base64")}`,
    );
    
    // Submit the transaction to the Stellar-RPC server. The RPC server will
    // then submit the transaction into the network for us. Then we will have to
    // wait, polling `getTransaction` until the transaction completes.
    try {
      let sendResponse = await server.sendTransaction(preparedTransaction);
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

  // Call the 'exchange' method of the Soroban contract
  async function callExchangeContract(senderAddress, receiverAddress, sendTokenAddress, receiveTokenAddress, amount) {
    const transaction = new SDKStellar.TransactionBuilder(
      await server.loadAccount(senderAddress),
      {
        fee: BASE_FEE,
        networkPassphrase: network
      }
    )
      .addOperation(
        SDKStellar.Operation.invokeContract({
          contract: contractAddress,
          method: 'exchange', // Contract method to call
          params: [
            senderAddress,
            receiverAddress,
            sendTokenAddress,
            receiveTokenAddress,
            amount.toString()
          ],
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(StellarSdk.Keypair.fromSecret(senderAddress));
    try {
      const result = await server.submitTransaction(transaction);
      console.log('Called contract to exchange tokens:', result);
    } catch (error) {
      console.error('Error calling contract:', error);
    }
  }

  // Read contract's balance for a token
  async function readBalance() {
    const StellarSdk = await import("stellar-sdk");
    if (!contractAddress) {
        throw new Error("Contract ID is not defined in the environment variables.");
    }

    const assetIssuer = import.meta.env.VITE_ISSUER_SECRET;
    if (!assetIssuer) {
        throw new Error("Asset issuer secret is not defined in the environment variables.");
    }

    // Define the asset
    const assetA = new StellarSdk.Asset("TokenA", assetIssuer)

    // Initialize the contract with the valid ID
    const contract = new Contract(contractAddress);

    try {
        // Call the `read_balance` method
        const result = await contract.call('read_balance', [assetA, publicKey]);
        console.log("result", result);
    } catch (error) {
        console.error("Error calling contract method:", error);
    }
    
    // const transaction = new StellarSdk.TransactionBuilder(
    //   await server.loadAccount(address),
    //   {
    //     fee: StellarSdk.BASE_FEE,
    //     networkPassphrase: StellarSdk.Networks.TESTNET
    //   }
    // )
    //   .addOperation(
    //     StellarSdk.Operation.invokeContract({
    //       contract: contractAddress,
    //       method: 'read_balance', // Contract method to read balance
    //       params: [selectedTokenAddress, address],
    //     })
    //   )
    //   .setTimeout(30)
    //   .build();

    // transaction.sign(StellarSdk.Keypair.fromSecret(publicKey));
    // try {
    //   const result = await server.submitTransaction(transaction);
    //   console.log('Read contract balance:', result);
    // } catch (error) {
    //   console.error('Error reading balance from contract:', error);
    // }
  }

  if (!server) return <div>Loading...</div>;

  const onTransactClick = async () => {
    const StellarSdk = await import("stellar-sdk");
    console.log("SDK", StellarSdk)
    console.log("import.meta.env.VITE_ISSUER_SECRET", import.meta.env.VITE_ISSUER_SECRET)
    // GACQGXELVPYV7T4IYGUU23UWSLYDQI525BTLLVNOHTWIBNUCIF3ZCKQS
    const assetA = new StellarSdk.Asset("TokenA", import.meta.env.VITE_ISSUER_SECRET)
    const assetB = new StellarSdk.Asset("TokenB", import.meta.env.VITE_ISSUER_SECRET)

    await callSendContract(publicKey, receiverAddress, assetA, amount)
  }

  return (
    <div className='app'>
      {publicKey ? (<>
        <p>Connected: {publicKey}</p>
        <p>Sender Token</p>
        <input 
          type='text'
          value={senderToken}
          placeholder='sender token'
          onChange={(e) => setSenderToken(e.target.value)}
        />
        <p>Receiver Token</p>
        <input 
          type='text'
          value={receiverToken}
          placeholder='receiver token'
          onChange={(e) => setReceiverToken(e.target.value)}
        />
        <p>Receiver Address</p>
        <input 
          type='text'
          value={receiverAddress}
          placeholder='receiver address'
          onChange={(e) => setREceiverAddress(e.target.value)}
        />
        <p>Amount</p>
        <input 
          type='number'
          value={amount}
          placeholder='amount'
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <button onClick={() => onTransactClick()}>
          Transact
        </button>
        {/* <button onClick={() => readBalance()}>
          Get My Balance
        </button> */}
      </>) : (<ConnectWallet />)}
      
    </div>
  );
};

export default App;

