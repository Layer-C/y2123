const { utils } = require("ethers");

async function main() {
  // Get owner/deployer's wallet address
  //const [owner] = await hre.ethers.getSigners();

  // Get contract that we want to deploy
  const contractFactory = await hre.ethers.getContractFactory("Clans");

  const uri = "https://api.y2123.io/asset-clans?id=";

  // Deploy contract with the correct constructor arguments
  const contract = await contractFactory.deploy(uri, "0x8e3DA90f2f00f979E7F960c4CF627F62E6Da5B43", "0x4088d86cA721f75B75773faa89b6475931Bb8FBf");

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
