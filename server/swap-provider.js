const fcl = require('@onflow/fcl')
const t = require('@onflow/types')
const jsSha = require('js-sha3')
const BN = require('bignumber.js')

const { validateSwapParams } = require('./validations');

const secret = jsSha.sha3_256('init')
const secretHash = jsSha.sha3_256(secret)

// console.log('secret', secret.toString())
// console.log('secretHash', secretHash.toString())

const { authorizationFunction } = require('./authorization');

// Seller
const SELLER_ADDRESS = '0xdadbaee81662a80a';
const BUYER_ADDRESS = '0x368b4c701d609c17'

const expiry = Math.floor(Date.now() / 1000) + 600


const swapParams = {
  recipientAddress: BUYER_ADDRESS,
  refundAddress: SELLER_ADDRESS,
  expiration: expiry,
  secretHash,
  value: BN(5)
}





fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")




const _createManager = async () => {
  const response = await fcl.send([
    fcl.transaction`
      import HTLCs from 0xdadbaee81662a80a

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
  validateSwapParams(swapParams)

  const response = await fcl.send([
    fcl.transaction`
    import HTLCs from 0xdadbaee81662a80a
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction (sellerAddress: Address, buyerAddress: Address, value: UFix64, expiry: UFix64, secretHash: String) {
      prepare(acct: AuthAccount) {
        let manager = acct.borrow<&HTLCs.HTLCManager>(from: HTLCs.HtlcManagerStoragePath)!

        let buyerCapability = getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
        let sellerCapability = getAccount(sellerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)

        let flowVault = acct.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)!

        var hltc = manager.createHTLC(
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
      fcl.arg(SELLER_ADDRESS, t.Address),
      fcl.arg(BUYER_ADDRESS, t.Address),
      fcl.arg('7.0', t.UFix64),
      fcl.arg(expiry.toString() + '.0', t.UFix64),
      fcl.arg(secretHash.toString(), t.String),
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
    import HTLCs from 0xdadbaee81662a80a
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction(sellerAddress: Address, buyerAddress: Address, expiry: UFix64, secretHash: String, secret: String) {

      prepare(acct: AuthAccount) {
        let manager = getAccount(sellerAddress).getCapability<&HTLCs.HTLCManager{HTLCs.HTLCManagerPublic}>(HTLCs.HtlcManagerPublicPath).borrow()!

        let sellerCapability = getAccount(sellerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        let buyerCapability = getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        
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
      fcl.arg(SELLER_ADDRESS, t.Address),
      fcl.arg(BUYER_ADDRESS, t.Address),
      fcl.arg('1633092144.0', t.UFix64),
      fcl.arg(secretHash.toString(), t.String),
      fcl.arg(secret.toString(), t.String),
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
    import HTLCs from 0xdadbaee81662a80a
    import FungibleToken from 0x9a0766d93b6608b7
    import FlowToken from 0x7e60df042a9c0868

    transaction(sellerAddress: Address, buyerAddress: Address, expiry: UFix64, secretHash: String) {
      prepare(acct: AuthAccount) {
        let manager = acct.borrow<&HTLCs.HTLCManager>(from: HTLCs.HtlcManagerStoragePath)!

        let buyerCapability = getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        let sellerCapability = getAccount(sellerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        
        manager.refund(
          secretHash: secretHash,
          expiry: expiry,
          buyer: buyerCapability,
          seller: sellerCapability
        )
      }
    }
`,
    fcl.args([
      fcl.arg(SELLER_ADDRESS, t.Address),
      fcl.arg(BUYER_ADDRESS, t.Address),
      fcl.arg('1633077290.00000000', t.UFix64),
      fcl.arg(secretHash.toString(), t.String),
    ]),
    fcl.proposer(authorizationFunction),
    fcl.authorizations([authorizationFunction]),
    fcl.payer(authorizationFunction),
    fcl.limit(9999),
  ]);

  fcl.decode(response).then(console.log)
}

// _refundHTLC()



module.exports = {
  _createManager,
  _createHTLC,
  _claimHTLC,
  _refundHTLC
}