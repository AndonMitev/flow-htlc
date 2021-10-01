const fcl = require('@onflow/fcl')


fcl
  .config()
  .put("accessNode.api", "https://access-testnet.onflow.org")

const findInitTransaction = async (address = '0x21ba6f10bdf2acd0') => {
  const account = await fcl.send([fcl.getAccount(address)]).then(fcl.decode);
  console.log(account)
};

module.exports = {
  findInitTransaction
}