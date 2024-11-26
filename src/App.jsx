import './App.css'
import React, { useEffect, useState } from "react";
import { ConnectWallet } from './components/connectWallet';
import { BuyToken, CreateTrustlineForToken, ExhangeTokens, GetTokenBalance, SendSameTokenToUser } from './components/soroban';

const App = () => {
  const [publicKey, setPublicKey] = useState("")
  const [senderToken, setSenderToken] = useState("")
  const [receiverToken, setReceiverToken] = useState("")
  const [receiverAddress, setREceiverAddress] = useState("")
  const [amount, setAmount] = useState(0)
  const [jxofBalance, setJxofBalance] = useState("0");
  const [jxafBalance, setJxafBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false)

const JXoFTokenAddress = "CCTYLYRLOHA4ARAGWIV2YIKGFUE3GTSOKMX6GT5GFZWIQ3QQIRDNUUAN"
const JXaFTokenAddress = "CBTGX2BRZVVRDXNPF2VLIR7BK5OB6Q6ULMDVQFLPQG72TQNTLETCWUUF"

  useEffect(() => {
      if(publicKey !== "") {
        getBalances()
      }
  }, [publicKey])

  const getBalances = async () => {
    setIsLoading(true)
    const xofBalance = await GetTokenBalance(JXoFTokenAddress, publicKey)
    setJxofBalance(xofBalance)
    const xafBalance = await GetTokenBalance(JXaFTokenAddress, publicKey)
    setJxafBalance(xafBalance)
    setIsLoading(false)
  }

  const buyJXoF = async () => {
    await BuyToken("JXoF", publicKey)
    await getBalances()
  }

  const buyJXaF = async () => {
    await BuyToken("JXaF", publicKey)
    await getBalances()
  }

  const createTrusline = async (token) => {
    await CreateTrustlineForToken(token, publicKey)
    await getBalances()
  }

  async function callSendContract() {
    await SendSameTokenToUser(senderToken,receiverToken,receiverAddress,publicKey,amount)
    await getBalances()
  }

  async function callExchangeContract() {
    await ExhangeTokens(publicKey, receiverAddress, senderToken, receiverToken, amount)
    await getBalances()
  }

  return (
    <div className="app">
      <header>
        <h1>Stellar Token Exchange</h1>
        <p>Connect your wallet, view balances, and trade tokens seamlessly.</p>
      </header>
      {publicKey !== "" ? (
        <>
          <p><strong>Connected Wallet:</strong> {publicKey}</p>
          {isLoading ? (
            <div className="loader">Loading...</div>
          ) : (
            <>
              <div className="balance">
                <span>JXoF Balance:</span> 
                <span>{jxofBalance} JXoF</span>
              </div>
              <div className="balance">
                <span>JXaF Balance:</span> 
                <span>{jxafBalance} JXaF</span>
              </div>
              <div className="token-actions">
                <div className="form-group">
                  {jxofBalance === undefined && (
                    <button onClick={() => createTrusline("JXoF")}>
                      Create Trustline for JXoF
                    </button>
                  )}
                  {jxofBalance !== undefined && (
                    <button onClick={buyJXoF}>Buy JXoF</button>
                  )}
                </div>
                <div className="form-group">
                  {jxafBalance === undefined && (
                    <button onClick={() => createTrusline("JXaF")}>
                      Create Trustline for JXaF
                    </button>
                  )}
                  {jxafBalance !== undefined && (
                    <button onClick={buyJXaF}>Buy JXaF</button>
                  )}
                </div>
              </div>
              <div className="token-selection">
                <div className="form-group">
                  <label>Sender Token</label>
                  <select
                    value={senderToken}
                    onChange={(e) => setSenderToken(e.target.value)}
                  >
                    <option value="" disabled>Select Sender Token</option>
                    <option value="JXoF">JXoF</option>
                    <option value="JXaF">JXaF</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Receiver Token</label>
                  <select
                    value={receiverToken}
                    onChange={(e) => setReceiverToken(e.target.value)}
                  >
                    <option value="" disabled>Select Receiver Token</option>
                    <option value="JXoF">JXoF</option>
                    <option value="JXaF">JXaF</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Receiver Address</label>
                <input
                  type="text"
                  value={receiverAddress}
                  placeholder="Receiver address"
                  onChange={(e) => setREceiverAddress(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  value={amount}
                  placeholder="Amount"
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <div className="button-group">
                <button onClick={callSendContract}>Send</button>
                <button onClick={callExchangeContract}>Exchange</button>
              </div>
            </>
          )}
        </>
      ) : (
        <ConnectWallet setPublicKey={(pubKey) => setPublicKey(pubKey)} />
      )}
    </div>
  );
  
};

export default App;



