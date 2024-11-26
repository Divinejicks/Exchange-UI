import './App.css'
import React, { useEffect, useState } from "react";
import { ConnectWallet } from './components/connectWallet';

import * as StellarSdk from "@stellar/stellar-sdk";

import { Address, Asset, Contract, nativeToScVal } from "@stellar/stellar-sdk";

export const server = new StellarSdk.Horizon.Server(import.meta.env.VITE_HORIZON_URL);


const App = () => {
  const [publicKey, setPublicKey] = useState(sessionStorage.getItem("publicKey"))
  const [senderToken, setSenderToken] = useState("")
  const [receiverToken, setReceiverToken] = useState("")
  const [receiverAddress, setREceiverAddress] = useState("")
  const [amount, setAmount] = useState(0)
  const [jxofBalance, setJxofBalance] = useState("0");
  const [jxafBalance, setJxafBalance] = useState("0");

  const contractAddress = import.meta.env.VITE_CONTRACT_ID
  const JXoFTokenAddress = "CCTYLYRLOHA4ARAGWIV2YIKGFUE3GTSOKMX6GT5GFZWIQ3QQIRDNUUAN"
  const JXaFTokenAddress = "CBTGX2BRZVVRDXNPF2VLIR7BK5OB6Q6ULMDVQFLPQG72TQNTLETCWUUF"

  useEffect(() => {
    if(server) {
      readBalance()
    }
  }, [server])

  const buyJXoF = async () => {
    const jxofAsset = new StellarSdk.Asset("JXoF", import.meta.env.VITE_ISSUER_SECRET)

    await ensureTrustline(publicKey, jxofAsset)
    await issueAssets(jxofAsset)

  }

  const buyJXaF = async () => {
    const jxafAsset = new StellarSdk.Asset("JXaF", import.meta.env.VITE_ISSUER_SECRET)

    await ensureTrustline(publicKey, jxafAsset)
    await issueAssets(jxafAsset)

  }

  const createTrusline = async (token) => {
    const Asset = new StellarSdk.Asset(token, import.meta.env.VITE_ISSUER_SECRET)
    await ensureTrustline(publicKey, Asset)
  }

  async function issueAssets(_asset) {
    const account = await server.loadAccount(import.meta.env.VITE_ISSUER_SECRET);
  
    // Create transaction to send some assets to the distribution account
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: publicKey,
          asset: _asset,
          amount: "1000"  // amount of TokenA to send
        })
      )
      .setTimeout(30)
      .build();
  
    transaction.sign(StellarSdk.Keypair.fromSecret(import.meta.env.VITE_ISSUER_KEY));
  
    // Submit the transaction
    try {
      const result = await server.submitTransaction(transaction);
      console.log("Assets issued:", result);
    } catch (error) {
      console.error("Error issuing assets:", error);
    }
  }

  // Function to ensure the trustline exists for the asset
  async function ensureTrustline(account, asset, canContinue = true) {
    const accountData = await server.loadAccount(account);
    console.log("accountData", accountData)
    const hasTrustline = accountData.balances.some(balance => balance.asset_code === asset.code);
    console.log("hasTrustline", hasTrustline)
    if (!hasTrustline) {
      if(canContinue) {
        await createTrustline(accountData, account, asset);
      } else {
        alert(`user with address : ${account} have not yet setup the trustline for this token. Contact him to do so`)
        return
      }
    }
  }

  // Function to create a trustline for the asset on the account
  async function createTrustline(accountData, account, asset) {
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
      
    // transaction.sign(StellarSdk.Keypair.fromSecret(import.meta.env.VITE_ACCOUNTONE_KEY));
    transaction.sign(StellarSdk.Keypair.fromSecret(import.meta.env.VITE_ACCOUNTTWO_KEY));
    try {
      const result = await server.submitTransaction(transaction);
      console.log(`Trustline created: ${result}`);
    } catch (error) {
      console.error("Error creating trustline:", error);
    }
  }


  async function callSendContract() {
    const contract = new Contract(contractAddress);
    // const jxofAsset = new StellarSdk.Asset("JXoF", import.meta.env.VITE_ISSUER_SECRET)
    // await ensureTrustline(publicKey, jxofAsset, false); 
    // await ensureTrustline(receiverAddress, jxofAsset, false); 
  
    const transaction = new StellarSdk.TransactionBuilder(
      await server.loadAccount(publicKey),
      {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      }
    )
      .addOperation(
        contract.call(
          "contract_address"
        )
      )
      .setTimeout(30)
      .build();

      console.log(`transaction=${transaction.toXDR()}`);

      transaction.sign(StellarSdk.Keypair.fromSecret(import.meta.env.VITE_ACCOUNTONE_KEY));
      
      try {
        const result = await server.submitTransaction(transaction);
        console.log('Called contract to exchange tokens:', result);
      } catch (error) {
        console.error('Error calling contract:', error);
      }
  }

  
  // Read contract's balance for a token
  const readBalance = async () => {
    const accountData = await server.loadAccount(publicKey);
    const jxofB = await accountData.balances.find(balance => balance.asset_code === "JXoF")?.balance
    setJxofBalance(jxofB !== undefined ? jxofB : jxofBalance)
    const jxafB = await accountData.balances.find(balance => balance.asset_code === "JXaF")?.balance
    setJxafBalance(jxafB !== undefined ? jxafB : jxafBalance)
  }

  if (!server) return <div>Loading...</div>;

  return (
    <div className='app'>
      {publicKey ? (<>
        <p>Connected: {publicKey}</p>
        <p>JXoF Balance: {jxofBalance} JXoF</p>
        <p>JXaF Balance: {jxafBalance} JXaF</p>
        <div>
          <button onClick={() => createTrusline("JXoF")} style={{marginRight: "10px"}}>
            Create Trusline on JXoF without buying
          </button>
          <button onClick={() => buyJXoF()}>
            Buy JXoF
          </button>
        </div>
        <div style={{marginTop: "10px"}}>
          <button onClick={() => createTrusline("JXaF")} style={{marginRight: "10px"}}>
            Create Trusline on JXaF without buying
          </button>
          <button onClick={() => buyJXaF()}>
            Buy JXaF
          </button>
        </div>
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
        <button onClick={() => callSendContract()} style={{marginRight: "10px"}}>
          Send
        </button>
        <button>
          Exchange
        </button>
      </>) : (<ConnectWallet />)}
      
    </div>
  );
};

export default App;