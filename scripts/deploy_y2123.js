async function main() {
  const contractFactory = await hre.ethers.getContractFactory("Y2123");
  const networkName = hre.network.name;
  const networkUrl = hre.network.config.url;

  let uri = "https://api.y2123.io/asset-cs2?id=";
  let stakingAddress = "";
  let proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";

  if (networkName === "rinkeby") {
    uri = "https://dev-api.y2123.io/asset-cs2?id=";
    stakingAddress = "0xE00f68446FC0Eb6928Cdd4407bAAADE15CC03f14";
    proxyRegistryAddress = "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A";
  }

  // Deploy contract with the correct constructor arguments
  const contract = await contractFactory.deploy(uri, stakingAddress, proxyRegistryAddress);

  // Wait for this transaction to be mined
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
