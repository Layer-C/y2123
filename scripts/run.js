const { utils } = require("ethers");

async function main() {
    // Get owner/deployer's wallet address
    const [owner] = await hre.ethers.getSigners();

    // Get contract that we want to deploy
    const contractFactory = await hre.ethers.getContractFactory("Y2123");

    // Deploy contract with the correct constructor arguments
    const contract = await contractFactory.deploy();

    // Wait for this transaction to be mined
    await contract.deployed();

    // Get contract address
    console.log("Contract deployed to:", contract.address);

    // Reserve NFTs
    //let txn = await contract.reserveNFTs();
    //await txn.wait();
    //console.log("10 NFTs have been reserved");

    // Get all token IDs of the owner
    let tokens = await contract.getNFTCount(owner.address)
    let balance = await contract.balanceOf(owner.address)
    console.log("Owner has tokens: %s balance: %s", tokens, balance);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });