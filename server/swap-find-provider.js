const fcl = require('@onflow/fcl')


fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")

const findTransactionByHash = async (hash = 'f822dff44eb06368cb36ae12d257f549650a5e76333f21a0f088a23c470f33dd') => {
  return await fcl
    .send([
      fcl.getTransaction(
        hash
      ),
    ])
    .then(fcl.decode);
}

// const findInitTransaction = async (address = '0xdadbaee81662a80a') => {
//   return await fcl.send([fcl.getAccount(address)]).then(fcl.decode);
// };


findTransactionByHash().then(({ args }) => {
  const [sellerAddress, buyerAddress, value, expiry, secretHash] = args;

  console.log(sellerAddress, buyerAddress, value, expiry, secretHash)
})


module.exports = {
  // findInitTransaction,
  findTransactionByHash
}