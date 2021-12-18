const { expect } = require("chai");

describe("Clans Contract", function () {
    let yContract, oContract, cContract, accounts;

    beforeEach(async () => {
        let contract = await ethers.getContractFactory("Y2123");
        yContract = await contract.deploy('');
        await yContract.deployed();

        contract = await ethers.getContractFactory("Oxygen");
        oContract = await contract.deploy();
        await oContract.deployed();

        contract = await ethers.getContractFactory("Clans");
        cContract = await contract.deploy();
        await cContract.deployed();
        await cContract.setContracts(yContract.address, oContract.address)

        accounts = await ethers.getSigners();
    });

    it("Should have basic info right", async () => {
        expect(await yContract.owner()).to.equal(accounts[0].address);
    });

});