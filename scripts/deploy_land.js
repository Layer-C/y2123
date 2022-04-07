async function main() {
  const contractFactory = await hre.ethers.getContractFactory("Land");
  const uri = "https://dev-api.y2123.io/asset-land?id=";
  const contract = await contractFactory.deploy(uri, "0x374EEBeCA0e2E23658072Df3Bd31A77f216490A0");
  await contract.deployed();
  console.log("Contract deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
