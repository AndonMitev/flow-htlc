const BigNumber = require('bignumber.js')

const validateValue = value => {
  if (!BigNumber.isBigNumber(value)) {
    throw new Error(`Invalid value: ${value}`)
  }

  if (value.lte(0)) {
    throw new Error(`Invalid value: ${value}`)
  }
}

const validateSecretHash = secretHash => {
  if (typeof secretHash !== 'string') {
    throw new Error(`Invalid secret hash type`)
  }

  if (Buffer.from(secretHash, 'hex').toString('hex') !== secretHash) {
    throw new Error(`Invalid secret hash. Not Hex.`)
  }

  if (Buffer.byteLength(secretHash, 'hex') !== 32) {
    throw new Error(`Invalid secret hash: ${secretHash}`)
  }
}

const validateExpiration = expiration => {
  if (isNaN(expiration)) {
    throw new Error(`Invalid expiration. NaN: ${expiration}`)
  }

  if (expiration < 500000000 || expiration > 5000000000000) {
    throw new Error(`Invalid expiration. Out of bounds: ${expiration}`)
  }
}

const validateAddress = address => {
  if (typeof address !== 'string' || !address.startsWith('0x') || address.length !== 18) {
    throw new Error(`Invalid Address`)
  }
}

const validateSwapParams = swapParams => {
  validateValue(swapParams.value)
  validateSecretHash(swapParams.secretHash)
  validateExpiration(swapParams.expiration)
  validateAddress(swapParams.recipientAddress)
  validateAddress(swapParams.refundAddress)
}

module.exports = {
  validateSwapParams
}