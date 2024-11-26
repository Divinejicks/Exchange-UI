import {
    FreighterModule,
    StellarWalletsKit,
    WalletNetwork,
    ALBEDO_ID,
    AlbedoModule
  } from '@creit.tech/stellar-wallets-kit';
import { useState } from 'react';

export const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: ALBEDO_ID,
  modules: [
      new AlbedoModule(),
      new FreighterModule(),
  ]
});

  export const ConnectWallet = ({setPublicKey}) => {
    const connect = async () => {
        await kit.openModal({
            onWalletSelected: async (option) => {
              kit.setWallet(option.id);
              const { address } = await kit.getAddress();
              setPublicKey(address)
              sessionStorage.setItem("kit", kit)
            }
          });
    }

    return(
        <>
            <button onClick={() => connect()}>Connet wallet</button>
        </>
    )
  }
  
  

