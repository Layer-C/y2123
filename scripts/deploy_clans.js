const { utils } = require("ethers");

async function main() {
    // Get owner/deployer's wallet address
    const [owner] = await hre.ethers.getSigners();

    // Get contract that we want to deploy
    const contractFactory = await hre.ethers.getContractFactory("Clans_only");

    const uri = "https://y2123.io/game/clans/";

    // Deploy contract with the correct constructor arguments
    const contract = await contractFactory.deploy(uri);

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