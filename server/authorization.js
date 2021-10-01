const fcl = require('@onflow/fcl')
const { ec } = require('elliptic')
const { SHA3 } = require('sha3')

// Seller
const ADDRESS = '0xdadbaee81662a80a';
const PRIVATE_KEY = '8ed98931aecff9544afba0b4bbf64b12717f33f8d2450f25b22b2839df96f5a2'


// Buyer
// const ADDRESS = '0x368b4c701d609c17'
// const PRIVATE_KEY = '26bff3a1b3f4671bcedd5757cfd38ab4a4629899bef746851b4e7bdfdb11e309'


const KEY_ID = 0;

const sign = msg => {
  return _sign(PRIVATE_KEY, msg)
}

const authorizationFunction = async (account) => {
  const result = {
    ...account,
    tempId: `${ADDRESS}-${KEY_ID}`,
    addr: fcl.sansPrefix(ADDRESS),
    keyId: Number(KEY_ID),
    signingFunction: async signable => {
      return {
        addr: fcl.withPrefix(ADDRESS),
        keyId: Number(KEY_ID),
        signature: sign(signable.message),
      }
    }
  }

  return result;
}

const _ec = new ec("p256")

const hashMsgHex = (msgHex) => {
  const sha = new SHA3(256)
  sha.update(Buffer.from(msgHex, "hex"))
  return sha.digest()
}

function _sign(privateKey, msgHex) {
  const key = _ec.keyFromPrivate(Buffer.from(privateKey, "hex"))
  const sig = key.sign(hashMsgHex(msgHex))
  const n = 32 // half of signature length?
  const r = sig.r.toArrayLike(Buffer, "be", n)
  const s = sig.s.toArrayLike(Buffer, "be", n)
  return Buffer.concat([r, s]).toString("hex")
}

module.exports = {
  authorizationFunction
}