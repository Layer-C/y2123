const { utils } = require("ethers");

async function main() {
    // Get owner/deployer's wallet address
    const [owner] = await hre.ethers.getSigners();

    // Get contract that we want to deploy
    const contractFactory = await hre.ethers.getContractFactory("Y2123");

    const uri = "https://gateway.pinata.cloud/ipfs/QmWoaUxvJLvynACkE9KKj3GkgbWQDToqdSmEL97cRynGrf/";
    //const root1 = '0x4450f575d669ae24697c974018bbbb3db32139532f7d25b71e443d06c2637f01';
    //const root2 = '0xebecb36a6776ac70a2a6af26f91099730e830d664a0b416ae261fb2732aee002';

    // Deploy contract with the correct constructor arguments
    const contract = await contractFactory.deploy(uri);

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