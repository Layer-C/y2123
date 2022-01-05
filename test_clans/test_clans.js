const { expect } = require("chai");

describe("Clans Contract", function () {
    let oContract, cContract, accounts;

    beforeEach(async () => {
        contract = await ethers.getContractFactory("Oxygen");
        oContract = await contract.deploy();
        await oContract.deployed();

        contract = await ethers.getContractFactory("Clans");
        cContract = await contract.deploy('');
        await cContract.deployed();
        await cContract.setContracts(oContract.address)
        await cContract.setPaused(false);

        await oContract.addAdmin(cContract.address)

        accounts = await ethers.getSigners();
    });

    it("Should have basic info right", async () => {
        expect(await cContract.owner()).to.equal(accounts[0].address);
    });

    it("Clan functions", async () => {
      let colonyId = 1;
      let clanId = 0;
      expect(await cContract.clanIdTracker()).to.equal(clanId);
      await cContract.createClan(colonyId);
      expect(await cContract.clanIdTracker()).to.equal(1);
      expect(await cContract.highestOwnedCount(clanId)).to.equal(100);
      expect(await cContract.highestOwned(clanId)).to.equal(accounts[0].address);

      expect(await cContract.shouldChangeLeader(clanId, 100)).to.equal(false);
      expect(await cContract.shouldChangeLeader(clanId, 110)).to.equal(false);
      expect(await cContract.shouldChangeLeader(clanId, 111)).to.equal(true);

      await cContract.safeTransferFrom(accounts[0].address, accounts[1].address, clanId, 100, []);
      expect(await cContract.highestOwnedCount(clanId)).to.equal(100);
      expect(await cContract.highestOwned(clanId)).to.equal(accounts[0].address);

      await cContract.testMint(accounts[1].address, clanId, 10);
      expect(await cContract.highestOwnedCount(clanId)).to.equal(100);
      expect(await cContract.highestOwned(clanId)).to.equal(accounts[0].address);

      await cContract.testMint(accounts[1].address, clanId, 1);
      expect(await cContract.highestOwnedCount(clanId)).to.equal(111);
      expect(await cContract.highestOwned(clanId)).to.equal(accounts[1].address);

      await expect(cContract.createClan(colonyId)).to.be.revertedWith('ERC20: burn amount exceeds balance');

  });

});