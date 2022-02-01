const { utils } = require("ethers");

async function main() {
  // Get owner/deployer's wallet address
  const [owner] = await hre.ethers.getSigners();

  // Get contract that we want to deploy
  const contractFactory = await hre.ethers.getContractFactory("Clans");

  const uri = "https://api.y2123.io/clan-asset?id=";

  // Deploy contract with the correct constructor arguments
  const contract = await contractFactory.deploy(uri, "0x60be445c94869A13Ad4568b9f16376264dA64712", "0x4088d86cA721f75B75773faa89b6475931Bb8FBf");

  // Wait for this transaction to be mined
  await contract.deployed();

  // Get contract address
  console.log("Contract deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
