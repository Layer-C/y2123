const { utils } = require("ethers");

async function main() {
    // Get owner/deployer's wallet address
    const [owner] = await hre.ethers.getSigners();

    // Get contract that we want to deploy
    const contractFactory = await hre.ethers.getContractFactory("Y2123");

    const uri = "ipfs://QmWPw3fBWKUcmbuQx5ixF6o3xjD3Xk1y4H8BPs2JQtT1n4/";
    const root1 = '0x486048819872b8bad022b996e0de31aae3e5160b7c03de01a94d4bbadf4af63a';
    const root2 = '0x486048819872b8bad022b996e0de31aae3e5160b7c03de01a94d4bbadf4af63a';

    // Deploy contract with the correct constructor arguments
    const contract = await contractFactory.deploy(uri, root1, root2);

    // Wait for this transaction to be mined
    await contract.deployed();

    // Get contract address
    console.log("Contract deployed to:", contract.address);

    let balance = await contract.balanceOf(owner.address)
    console.log("Owner has balance: %s", balance);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });