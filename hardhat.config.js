require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

const { ALCHEMY_API_KEY, TEST1_PK, TEST2_PK, TEST3_PK, ETHERSCAN_API } =
  process.env;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.10",
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
      accounts: [TEST1_PK],
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [TEST1_PK],
    },
  },
  paths: {
    tests: "./test_clans",
  },
  etherscan: {
    apiKey: ETHERSCAN_API,
  },
  mocha: {
    timeout: 500000,
  },
};
