const fcl = require('@onflow/fcl')
const { ec } = require('elliptic')
const { SHA3 } = require('sha3')

const ADDRESS = '0x1d94651ec082c228';
const PRIVATE_KEY = 'bb13a53f7e63eb583cf082118546947c3d3aa29241a5ee7ae48ab0f1558eae60'
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