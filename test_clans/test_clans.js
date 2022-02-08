const { expect } = require("chai");

describe("Clans Contract", function () {
  let oContract, cContract, accounts;

  beforeEach(async () => {
    contract = await ethers.getContractFactory("Y2123");
    const uri = "https://api.y2123.io/asset?id=";
    yContract = await contract.deploy(uri);
    await yContract.deployed();

    contract = await ethers.getContractFactory("Oxygen");

    oContract = await contract.deploy();
    await oContract.deployed();

    contract = await ethers.getContractFactory("Clans");
    const clan_uri = "https://api.y2123.io/clan-asset?id=";
    cContract = await contract.deploy(clan_uri, oContract.address, yContract.address);
    await cContract.deployed();
    //await cContract.setTokenContract(oContract.address);

    await oContract.addAdmin(cContract.address);

    accounts = await ethers.getSigners();
    await oContract.addAdmin(accounts[0].address);
  });

  it("Should have basic info right", async () => {
    expect(await cContract.owner()).to.equal(accounts[0].address);
  });

  it("Oxgn functions", async () => {
    // test out max cap minting
  });

  it("Clan functions", async () => {
    let colonyId = 1;
    let clanId = 4;

    await cContract.toggleFeatureFlagCreateClan();
    await cContract.toggleFeatureFlagSwitchColony();

    expect(await cContract.clanIdTracker()).to.equal(clanId);
    await oContract.mint(accounts[0].address, ethers.utils.parseEther("100.0"));
    await cContract.createClan(colonyId);
    expect(await cContract.clanIdTracker()).to.equal(clanId + 1);
    expect(await cContract.clanToHighestOwnedCount(clanId)).to.equal(100);
    expect(await cContract.clanToHighestOwnedAccount(clanId)).to.equal(accounts[0].address);

    expect(await cContract.shouldChangeLeader(accounts[0].address, clanId, 100)).to.equal(false);
    expect(await cContract.shouldChangeLeader(accounts[0].address, clanId, 110)).to.equal(false);
    //Clan leader can't be leader  again
    expect(await cContract.shouldChangeLeader(accounts[0].address, clanId, 111)).to.equal(false);
    //Must be in that clan to be leader
    expect(await cContract.shouldChangeLeader(accounts[1].address, clanId, 111)).to.equal(false);

    await cContract.safeTransferFrom(accounts[0].address, accounts[1].address, clanId, 100, []);
    expect(await cContract.clanToHighestOwnedCount(clanId)).to.equal(100);
    expect(await cContract.clanToHighestOwnedAccount(clanId)).to.equal(accounts[0].address);

    //await expect(cContract.createClan(colonyId)).to.be.revertedWith('ERC20: burn amount exceeds balance');

    const clans = await cContract.getClansInColony(1);
    expect(ethers.BigNumber.from(clans[0])).to.eql(ethers.BigNumber.from(1));
    expect(ethers.BigNumber.from(clans[1])).to.eql(ethers.BigNumber.from(4));

    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();
    await expect(yContract.paidMint(3, [], { value: BigInt(nftPrice * 3) }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await yContract.connect(accounts[1]).paidMint(3, [], { value: BigInt(nftPrice * 3) });

    await yContract.addAdmin(cContract.address);
    await cContract.addContract(yContract.address);
    await cContract.stake(yContract.address, [0, 1, 2], 1);

    await cContract.connect(accounts[1]).stake(yContract.address, [3, 4], 4);
    //Elligible to be leader now that have changed clan
    expect(await cContract.shouldChangeLeader(accounts[1].address, clanId, 111)).to.equal(true);

    //Change clan by staking
    await oContract.mint(accounts[1].address, ethers.utils.parseEther("100.0")); // oxgn needed to change clan
    await cContract.connect(accounts[1]).stake(yContract.address, [5], 1);
    const acc = await cContract.getAccountsInClan(1);
    expect(acc[0]).to.eql(accounts[0].address);
    expect(acc[1]).to.eql(accounts[1].address);

    /*
    const clanRecords = await cContract.getClanRecords(1);
    //console.log(clanRecords);
    expect(clanRecords[0].entity).to.eql(accounts[0].address);
    expect(ethers.BigNumber.from(clanRecords[0].clanData.clanId)).to.eql(ethers.BigNumber.from(1));
    expect(clanRecords[1].entity).to.eql(accounts[1].address);
    expect(ethers.BigNumber.from(clanRecords[1].clanData.clanId)).to.eql(ethers.BigNumber.from(1));

    const clanStakedRecords = await cContract.getClanStaking(1, yContract.address);
    console.log(clanStakedRecords);
    expect(clanStakedRecords[0].entity).to.eql(accounts[0].address);
    */
  });
});
