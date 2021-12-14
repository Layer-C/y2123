const { utils } = require("ethers");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

async function main() {
    // Get owner/deployer's wallet address
    const [owner] = await hre.ethers.getSigners();
    const accounts = await ethers.getSigners();

    // Get contract that we want to deploy
    const contractFactory = await hre.ethers.getContractFactory("Y2123");

    let whitelist = [];
    for (let i = 0; i < 20; i++) { //generate 20 WL
        const wallet = ethers.Wallet.createRandom()
        whitelist.push(wallet.address);
    }
    //Inject metamask Test account at the top
    whitelist[0] = "0xBD55d43702087b1A8C16Bf052Be549d7c4172f07";
    console.log("whitelist is %s", whitelist);
    let merkleTree = new MerkleTree(whitelist, keccak256, { hashLeaves: true, sortPairs: true });
    let whitelistRoot = merkleTree.getHexRoot();
    console.log("whitelistRoot is %s", whitelistRoot);

    let freelist = [];
    for (let i = 0; i < 20; i++) { //generate 20 WL
        const wallet = ethers.Wallet.createRandom()
        freelist.push(wallet.address);
    }
    //Inject metamask Test account at the top
    freelist[0] = "0x2DEb1F37eAd5A0554f0a267385E20CF81Bcb2957";
    console.log("freelist is %s", freelist);
    let merkleTree2 = new MerkleTree(freelist, keccak256, { hashLeaves: true, sortPairs: true });
    let freelistRoot = merkleTree2.getHexRoot();
    console.log("freelistRoot is %s", freelistRoot);

    const uri = "ipfs://QmWPw3fBWKUcmbuQx5ixF6o3xjD3Xk1y4H8BPs2JQtT1n4/";
    // Deploy contract with the correct constructor arguments
    const contract = await contractFactory.deploy(uri, whitelistRoot, freelistRoot);

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