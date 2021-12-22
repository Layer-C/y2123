const { expect } = require("chai");

describe("Clans Contract", function () {
    let oContract, cContract, accounts;

    beforeEach(async () => {
        contract = await ethers.getContractFactory("Oxygen");
        oContract = await contract.deploy();
        await oContract.deployed();

        contract = await ethers.getContractFactory("Clans_only");
        cContract = await contract.deploy('');
        await cContract.deployed();
        //await cContract.setContracts(yContract.address, oContract.address)

        accounts = await ethers.getSigners();
    });

    it("Should have basic info right", async () => {
        expect(await cContract.owner()).to.equal(accounts[0].address);
    });

});