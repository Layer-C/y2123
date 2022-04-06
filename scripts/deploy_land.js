
async function main() {
  const contractFactory = await hre.ethers.getContractFactory("Land");
  const uri = "https://api.y2123.io/asset-land?id=";
  const contract = await contractFactory.deploy(uri, "0x8e3DA90f2f00f979E7F960c4CF627F62E6Da5B43");
  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });