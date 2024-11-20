import {
    FreighterModule,
    StellarWalletsKit,
    WalletNetwork,
    ALBEDO_ID,
    AlbedoModule
  } from '@creit.tech/stellar-wallets-kit';

  export const ConnectWallet = () => {

    const kit = new StellarWalletsKit({
        network: WalletNetwork.TESTNET,
        selectedWalletId: ALBEDO_ID,
        modules: [
            new AlbedoModule(),
            new FreighterModule(),
        ]
      });

    const connect = async () => {
        await kit.openModal({
            onWalletSelected: async (option) => {
              kit.setWallet(option.id);
              const { address } = await kit.getAddress();
              // Do something else
              sessionStorage.setItem("publicKey", address)
              sessionStorage.setItem("walletKit", kit)
            }
          });
    }

    return(
        <>
            <button onClick={() => connect()}>Connet ooh</button>
        </>
    )
  }
  
  

