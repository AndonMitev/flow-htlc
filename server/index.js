const fcl = require('@onflow/fcl')
const t = require('@onflow/types')
const jsSha = require('js-sha3')

const secret = jsSha.sha3_256('init')
const secretHash = jsSha.sha3_256(secret)

console.log('secret', secret.toString())
console.log('secretHash', secretHash.toString())

const { createManager } = require('./transactions');
const { authorizationFunction } = require('./authorization');

// Seller
const SELLER_ADDRESS = '0x21ba6f10bdf2acd0';
const BUYER_ADDRESS = '0x368b4c701d609c17'

const expiry = Math.floor(Date.now() / 1000) + 600


fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")




const _createManager = async () => {
  const response = await fcl.send([
    fcl.transaction`
      import HTLCs from 0x21ba6f10bdf2acd0

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

//_createManager()




const _createHTLC = async () => {
  const response = await fcl.send([
    fcl.transaction`
    import HTLCs from 0x21ba6f10bdf2acd0
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction (buyerAddress: Address, value: UFix64, secretHash: String, expiry: UFix64, secret: String) {
      prepare(acct: AuthAccount) {
        let manager = acct.borrow<&HTLCs.HTLCManager>(from: HTLCs.HtlcManagerStoragePath)!

        let buyerCapability =  getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        let sellerCapability = acct.getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)

        let flowVault = acct.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)!

        var hltc = manager.createHTLC(
          secret: secret,
          secretHash: secretHash,
          expiry: expiry,
          buyer: buyerCapability,
          seller: sellerCapability,
          vault: <-flowVault.withdraw(amount: value)
        )
      }
    }
  `,
    fcl.args([
      fcl.arg(BUYER_ADDRESS, t.Address),
      fcl.arg('7.0', t.UFix64),
      fcl.arg(secretHash.toString(), t.String),
      fcl.arg(expiry.toString() + '.0', t.UFix64),
      fcl.arg(secret.toString(), t.String)
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
    import HTLCs from 0x21ba6f10bdf2acd0
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction(secret: String, secretHash: String, expiry: UFix64, sellerAddress: Address) {

      prepare(acct: AuthAccount) {
        let manager = getAccount(sellerAddress).getCapability<&HTLCs.HTLCManager{HTLCs.HTLCManagerPublic}>(HTLCs.HtlcManagerPublicPath).borrow()!

        let sellerCapability = getAccount(sellerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        let buyerCapability = acct.getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        
        manager.claim(
          secret: secret,
          secretHash: secretHash,
          expiry: expiry,
          buyer: buyerCapability,
          seller: sellerCapability
        )
      }
    }
`,
    fcl.args([
      fcl.arg(secret.toString(), t.String),
      fcl.arg(secretHash.toString(), t.String),
      fcl.arg('1633026139.00000000', t.UFix64),
      fcl.arg(SELLER_ADDRESS, t.Address),
      ,
    ]),
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)
}

// _claimHTLC()

const _refundHTLC = async () => {
  const response = await fcl.send([
    fcl.transaction`
    import HTLCs from 0x21ba6f10bdf2acd0
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction(secretHash: String, expiry: UFix64, buyerAddress: Address) {
      prepare(acct: AuthAccount) {
        let manager = acct.borrow<&HTLCs.HTLCManager>(from: HTLCs.HtlcManagerStoragePath)!

        let buyerCapability = getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        let sellerCapability = acct.getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        
        manager.refund(
          secretHash: secretHash.decodeHex(),
          expiry: expiry,
          buyer: buyerCapability,
          seller: sellerCapability
        )
      }
    }
`,
    fcl.args([
      fcl.arg(secretHash.toString(), t.String),
      fcl.arg('1633021453.00000000', t.UFix64),
      fcl.arg(BUYER_ADDRESS, t.Address),
    ]),
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)
}

// _refundHTLC()

const checkBalance = async () => {
  const response = await fcl.send([
    fcl.script`
    import HTLCs from 0x21ba6f10bdf2acd0
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    pub fun main(address: Address): UFix64 {
      let buyerCapability = getAccount(address).getCapability<&{FungibleToken.Balance}>(/public/flowTokenVault).borrow()!
      log(buyerCapability)
      
      return buyerCapability.balance
    }
`,
    fcl.args([
      fcl.arg(BUYER_ADDRESS, t.Address),
    ]),
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)
}

checkBalance()