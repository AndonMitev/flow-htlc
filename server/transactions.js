const fcl = require('@onflow/fcl')

const createManager = fcl.transaction`
  import HTLCs from 0x638b4f17dff8517f
  
  transaction {
    prepare(acct: AuthAccount) {
      let htlcManager <- HTLCs.createSwapManager()
      acct.save(<-htlcManager, to: HTLCs.HtlcManagerStoragePath)
      acct.link<&HTLCs.HTLCManager{HTLCs.HTLCManagerPublic}>(HTLCs.HtlcManagerPublicPath, target: HTLCs.HtlcManagerStoragePath)
      log("manager created")
    }
  }
`

const createHTLC = fcl.transaction`
  import HTLCs from 0x638b4f17dff8517f
  import FungibleToken from 0x9a0766d93b6608b7

  transaction (buyerAddress: Address, value: UFix64, secretHash: String, expiry: UFix64) {
    prepare(acct: AuthAccount) {
      let manager = acct.borrow<&HTLCs.HTLCManager>(from: HTLCs.HtlcManagerStoragePath)!
      
      let buyerCapability = getAccount(buyerAddress).getCapability<&{FungibleToken.Receiver}>(/public/flowTokenVault)
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
`

const claim = fcl.transaction`
import HTLCs from 0x638b4f17dff8517f

transaction {

  prepare(acct: AuthAccount) {
    let manager = getAccount(0x04).getCapability<&HTLCs.HTLCManager>(HTLCs.HtlcManagerPublicPath).borrow()!
    
    manager.claim(htlcID: 1, secret: "010101010".decodeHex())
  }
`

const refund = fcl.transaction`
import HTLCs from 0x638b4f17dff8517f

transaction {

  prepare(acct: AuthAccount) {
    let manager = getAccount(0x04).getCapability<&HTLCs.HTLCManager>(HTLCs.HtlcManagerPublicPath).borrow()!
    
    manager.refund()
  }
`

module.export = {
  createManager,
  createHTLC,
  claim,
  refund
}