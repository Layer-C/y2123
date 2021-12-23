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
        await cContract.setPaused(false);

        accounts = await ethers.getSigners();
    });

    it("Should have basic info right", async () => {
        expect(await cContract.owner()).to.equal(accounts[0].address);
    });

    it("Clan functions", async () => {
      //expect(await cContract.clanIdTracker.current()).to.equal(0);
      await cContract.createClan();
      //expect(await cContract.clanIdTracker.current()).to.equal(1);
      expect(await cContract.highestOwnedCount(0)).to.equal(100);
      expect(await cContract.highestOwned(0)).to.equal(accounts[0].address);
  });

});