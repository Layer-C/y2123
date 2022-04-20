async function main() {
  const contractFactory = await hre.ethers.getContractFactory("Oxygen");
  const networkName = hre.network.name;
  const networkUrl = hre.network.config.url;

  const contract = await contractFactory.deploy();
  await contract.deployed();

  console.log("Deploying to network", networkName, networkUrl);
  console.log("Contract deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
