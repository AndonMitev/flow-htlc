const fcl = require('@onflow/fcl')
const t = require('@onflow/types')

const { createManager } = require('./transactions');
const { authorizationFunction } = require('./authorization');

fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")




const _createManager = async () => {
  const response = await fcl.send([
    fcl.transaction`
      import HTLCs from 0x1d94651ec082c228

      transaction {
        prepare(acct: AuthAccount) {
          let htlcManager <- HTLCs.createSwapManager()
          acct.save(<-htlcManager, to: HTLCs.HtlcManagerStoragePath)
          acct.link<&HTLCs.HTLCManager{HTLCs.HTLCManagerPublic}>(HTLCs.HtlcManagerPublicPath, target: HTLCs.HtlcManagerStoragePath)
          log("manager created")
        }
      }
`,
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)

  // const tx = await fcl.tx(response).onceSealed()

  // console.log('tx', tx)
}




const _createHTLC = async () => {
  const response = await fcl.send([
    fcl.transaction`
    import HTLCs from 0x1d94651ec082c228
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868
  
    transaction (buyerAddress: Address, value: UFix64, secretHash: String, expiry: UFix64) {
      prepare(acct: AuthAccount) {
        let manager = acct.borrow<&HTLCs.HTLCManager>(from: HTLCs.HtlcManagerStoragePath)!
        
        let buyerCapability =  getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        let sellerCapability = acct.getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        
        let flowVault = acct.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)!
    
        var hltc = manager.createHTLC(
          secretHash: secretHash.decodeHex(),
          expiry: expiry,
          buyer: buyerCapability,
          seller: sellerCapability,
          vault: <-flowVault.withdraw(amount: value)
        )
    
        log(manager.getHtlcIds())
      }
    }
  `,
    fcl.args([
      fcl.arg('0x1d94651ec082c228', t.Address),
      fcl.arg('5.0', t.UFix64),
      fcl.arg('c2a76553cceaf3f9df4ffe0ef706b9a96681e3a9e676539aa4d756917bae8271', t.String),
      fcl.arg('1682946468.0', t.UFix64),
    ]),
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)
}

// _createHTLC()

const _claimHTLC = async () => {
  const response = await fcl.send([
    fcl.transaction`
    import HTLCs from 0x1d94651ec082c228

    transaction(buyerAddress: Address, secret: String) {

      prepare(acct: AuthAccount) {
        let manager = getAccount(buyerAddress).getCapability<&HTLCs.HTLCManager>(HTLCs.HtlcManagerPublicPath).borrow()!
        
        manager.claim(htlcID: 1, secret: secret.decodeHex())
      }
    }
`,
    fcl.args([
      fcl.arg('0x1d94651ec082c228', t.Address),
      fcl.arg('c2a76553cceaf3f9df4ffe0ef706b9a96681e3a9e676539aa4d756917bae8271', t.String),
    ]),
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)
}

_claimHTLC()