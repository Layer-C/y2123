require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("dotenv").config();

const { ALCHEMY_API_KEY, ETHERSCAN_API, TEST1_PK, DEPLOY_PK } = process.env;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.13",
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
      accounts: [DEPLOY_PK],
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [TEST1_PK],
    },
    arbrinkeby: {
      url: `https://arb-rinkeby.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [TEST1_PK],
    },
    optkovan: {
      url: `https://opt-kovan.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [TEST1_PK],
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      gasPrice: 35000000000,
      saveDeployments: true,
      accounts: [TEST1_PK],
    },
    fuji: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [TEST1_PK],
    },
    fantomtest: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      gasPrice: 350000000000,
      saveDeployments: true,
      accounts: [TEST1_PK],
    },
  },
  paths: {
    tests: "./test_oxgn",
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  etherscan: {
    apiKey: ETHERSCAN_API,
  },
  mocha: {
    timeout: 500000,
  },
};
