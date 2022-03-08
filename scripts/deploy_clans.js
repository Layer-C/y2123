const { utils } = require("ethers");
const { ethers } = require("hardhat");
require("dotenv").config();

const { TEST1_PK, DEPLOY_PK } = process.env;

async function main() {
  
  const contractFactory = await hre.ethers.getContractFactory("Clans");
  const uri = "https://api.y2123.io/asset-clans?id=";
  const overrides = {
    nonce: 61,
    //maxPriorityFeePerGas: ethers.BigNumber.from(2000000000),
    //maxFeePerGas: ethers.BigNumber.from(2000000000),
  };
  const contract = await contractFactory.deploy(uri, "0x08dB6FE68EDD5A9f26502f5dE274bAF1573D9222", "0xAd20084e30624F5eB5d2346ea509C35A86E8f9eB", overrides);
  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
  
  // Override nonce 62 with send ETH
  /*
  const deployWallet = new ethers.Wallet(DEPLOY_PK, hre.ethers.provider);
  const me = "0x8360d6D8A7B00C0564130B0f1FB6e82789415deE";
  const gasPrice = await hre.ethers.provider.getGasPrice();
  console.log("gasPrice: ", ethers.utils.formatEther(gasPrice), "eth");
  const tx = {
    from: deployWallet.address,
    to: me,
    value: ethers.utils.parseUnits("0.01", "ether"),
    gasPrice: gasPrice.mul(2),
    gasLimit: ethers.utils.hexlify(10000), // 10 gwei
    //nonce:hre.ethers.provider.getTransactionCount(deployWallet.address, 'latest'),
    nonce: 62,
  }
  const transaction = await deployWallet.sendTransaction(tx);
  console.log(transaction);
  */
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });