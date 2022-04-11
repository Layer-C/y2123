require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

const { ALCHEMY_API_KEY, ETHERSCAN_API, TEST1_PK, DEPLOY_PK } = process.env;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.11",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: ['a3db0fa7a2e482a884e7756731d292858328fff941f6c8d6e5c0f280b4da3c74'],
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: ['a3db0fa7a2e482a884e7756731d292858328fff941f6c8d6e5c0f280b4da3c74'],
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: ['a3db0fa7a2e482a884e7756731d292858328fff941f6c8d6e5c0f280b4da3c74'],
    },
    kovan: {
      url: `https://eth-kovan.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: ['a3db0fa7a2e482a884e7756731d292858328fff941f6c8d6e5c0f280b4da3c74'],
    },
    ropsten: {
      url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: ['a3db0fa7a2e482a884e7756731d292858328fff941f6c8d6e5c0f280b4da3c74'],
    },
  },
  paths: {
    tests: "./test_land",
  },
  etherscan: {
    apiKey: ETHERSCAN_API,
  },
  mocha: {
    timeout: 500000,
  },
};
