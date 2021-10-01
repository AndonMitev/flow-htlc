import FungibleToken from 0x9a0766d93b6608b7

access(all) contract HTLCs {
    // Note that these are not denormalised. More addresses, and repeating the hash in Claimed might help
    pub event HTLCCreated(id: String, secretHash: String, expiry: UFix64, buyer: Address, seller:Address)
    pub event HTLCClaimed(id: String, secret: String)
    pub event HTLCRefunded(id: String)

    pub let HtlcManagerStoragePath: StoragePath
    pub let HtlcManagerPublicPath: PublicPath

    // We store non-resource data in an inner struct so we can simply return this to describe the HTLC when queried

    pub struct HTLCDetails {
        pub let id: String
        pub let expiry: UFix64
        pub let secretHash: String
        access(contract) let buyer: Capability<&{FungibleToken.Receiver}>
        access(contract) let seller: Capability<&{FungibleToken.Receiver}>

        init (
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>,
        ) {
            let expiryAsStr = expiry.toString()
            let buyerAddressAsStr = buyer.address.toString()
            let sellerAddressAsStr = seller.address.toString()
            
            let concatedParams = expiryAsStr
                .concat(secretHash)
                .concat(sellerAddressAsStr)
                .concat(buyerAddressAsStr)

            self.id = String.encodeHex(HashAlgorithm.SHA3_256.hash(concatedParams.utf8))
            self.secretHash = secretHash
            self.expiry = expiry
            self.buyer = buyer
            self.seller = seller
        }
    }

    // We store the swap details and use them to perform claim and refund actions here.
    // Note that we do enforce correctness here, but we do not emit events.

    pub resource HTLC {
        access(self) let details: HTLCDetails
        // We are custodial as that seems appropriate here.
        access(self) let vault: @FungibleToken.Vault

        pub fun getDetails(): HTLCDetails {
            return self.details
        }

        pub fun claim(secret: String) {
            pre {
                getCurrentBlock().timestamp <= self.details.expiry: "cannot claim after expiry"
                //FIXME: this is an implicit state test.
                self.vault.balance > 0.0: "vault is empty"
            }
            let hash: String = String.encodeHex(HashAlgorithm.SHA3_256.hash(secret.utf8))
            
            assert(hash == self.details.secretHash, message: "must provide correct secret to claim")

            self.details.buyer.borrow()!.deposit(from: <- self.vault.withdraw(amount: self.vault.balance))
        }

        pub fun refund() {
            pre {
                getCurrentBlock().timestamp > self.details.expiry: "cannot refund until after expiry"
                self.vault.balance > 0.0: "vault is empty"
            }
            self.details.seller.borrow()!.deposit(from: <- self.vault.withdraw(amount: self.vault.balance))
        }

        destroy () {
            // The only way for the seller to reclaim their Vault is to call refund() after expiry.
            destroy self.vault
        }

        init (
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>,
            vault: @FungibleToken.Vault
        ) {
            pre {
                secretHash.length == 64: "secret hash must be 32 bytes in length"
                expiry > getCurrentBlock().timestamp: "expiry must be in the future"
                vault.balance > 0.0: "vault balance must be non-zero value"
                // buyer.borrow().getType() == vault.getType(): "vault must be same type as buyer/seller vaults"
                buyer.getType() == seller.getType(): "buyer and seller must be same token type"
            }
            self.details = HTLCDetails(
                secretHash: secretHash,
                expiry: expiry,
                buyer: buyer,
                seller: seller
            )
            self.vault <- vault
        }
    }

    // The interface for a /public/ Capability to the HTLCManager, for anyone to call.

    pub resource interface HTLCManagerPublic {
        pub fun claim(
            secret: String,
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>
        )
        // pub fun getHtlcDetails(htlcID: [UInt8]): HTLCDetails?
        // pub fun getHtlcIds(): [UInt8]
    }

    // A collection-type resource to expose public facilities for the swap.

    pub resource HTLCManager: HTLCManagerPublic {
        access(self) let htlcs: @{String: HTLC}

         pub fun createHTLC(
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>,
            vault: @FungibleToken.Vault
        ) {
            let htlc <- create HTLC(
                secretHash: secretHash, 
                expiry: expiry, 
                buyer: buyer,
                seller: seller,
                vault: <- vault
            )
            let details = htlc.getDetails()
            self.htlcs[details.id] <-! htlc
            emit HTLCCreated(
                id: details.id,
                secretHash: details.secretHash,
                expiry: details.expiry,
                buyer: details.buyer.address,
                seller: details.seller.address,
            )
        }

        pub fun claim(
            secret: String,
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>
        ) {
            let htlcID = self.generateHTLCID(
                secretHash: secretHash, 
                expiry: expiry, 
                buyer: buyer, 
                seller: seller
            )
            
            let htlc <- self.htlcs.remove(key: htlcID) ?? panic("no such htlc in this manager")
            let details = htlc.getDetails()
            htlc.claim(secret: secret)
            destroy htlc
            emit HTLCClaimed(id: details.id, secret: secret)
        }

        // This isn't in the public interface.
        pub fun refund(
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>
        ) {
            let htlcID = self.generateHTLCID(
                secretHash: secretHash, 
                expiry: expiry, 
                buyer: buyer, 
                seller: seller
            )

            let htlc <- self.htlcs.remove(key: htlcID) ?? panic("no such htlc in this manager")
            let details = htlc.getDetails()
            htlc.refund()
            destroy htlc
            emit HTLCRefunded(id: details.id)
        }

        // This isn't in the public interface.
        // Note that buyer and seller are /public/ capabilities so this doesn't require multiple signers.
       
        access(contract) fun generateHTLCID (
            secretHash: String,
            expiry: UFix64,
            buyer: Capability<&{FungibleToken.Receiver}>,
            seller: Capability<&{FungibleToken.Receiver}>
        ): String {
            let expiryAsStr = expiry.toString()
            let buyerAddressAsStr = buyer.address.toString()
            let sellerAddressAsStr = seller.address.toString()
            
            let concatedParams = expiryAsStr
                .concat(secretHash)
                .concat(sellerAddressAsStr)
                .concat(buyerAddressAsStr)

            return String.encodeHex(HashAlgorithm.SHA3_256.hash(concatedParams.utf8))
        }

        // This will destroy any unclaimed HTLC Vaults!
        destroy () {
            destroy self.htlcs
        }

        init () {
            self.htlcs <- {}
        }
    }

    pub fun createSwapManager(): @HTLCManager {
        return <- create HTLCManager() 
    }

    init() {
        self.HtlcManagerStoragePath = /storage/LiqualityHtlcManager
        self.HtlcManagerPublicPath = /public/LiqualityHtlcManager
    }
}

//   pub fun getHtlcDetails(htlcID: [UInt8]): HTLCDetails? {
//             if self.htlcs[htlcID] != nil {
//                 let ref = &self.htlcs[htlcID] as &HTLC
//                 return ref.getDetails()
//             } else {
//                 return nil
//             }
//         }

//         pub fun getHtlcIds(): [UInt8] {
//             return self.htlcs.keys
//         }
 