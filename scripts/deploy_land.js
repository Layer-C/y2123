async function main() {
  const contractFactory = await hre.ethers.getContractFactory("Land");
  const networkName = hre.network.name;
  const networkUrl = hre.network.config.url;

  let uri = "https://api.y2123.io/asset-land?id=";
  let oxgnAddress = "0x08dB6FE68EDD5A9f26502f5dE274bAF1573D9222";
  let proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
  
  if (networkName === 'rinkeby') {
    uri = "https://dev-api.y2123.io/asset-land?id=";
    oxgnAddress = "0x374EEBeCA0e2E23658072Df3Bd31A77f216490A0";
    proxyRegistryAddress = "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A";
  }

  const contract = await contractFactory.deploy(uri, oxgnAddress, proxyRegistryAddress);
  await contract.deployed();

  console.log('Deploying to network', networkName, networkUrl);
  console.log("Contract deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
