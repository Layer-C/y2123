const { expect } = require("chai");

describe("Land Contract", function () {
  let landContract, accounts;
  let list = [];
  const uri = "https://api.y2123.io/land-asset?id=";
    let oxgnAddress = "0x08dB6FE68EDD5A9f26502f5dE274bAF1573D9222";
    let proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";

  beforeEach(async () => {
    let contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(uri, oxgnAddress, proxyRegistryAddress);
    await landContract.deployed();

    contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    await oContract.addAdmin(landContract.address);

    accounts = await ethers.getSigners();
    await oContract.addAdmin(accounts[0].address);
  });

  it("Should have basic info right", async () => {
    expect(await landContract.name()).to.equal("Y2123.Land");
    expect(await landContract.symbol()).to.equal("Y2123.Land");
    expect(await landContract.owner()).to.equal(accounts[0].address);

    expect(await landContract.MAX_SUPPLY()).to.equal(500);
    await landContract.setMaxSupply(10000);
    expect(await landContract.MAX_SUPPLY()).to.equal(10000);

    expect(await landContract.mintPrice()).to.equal(BigInt(500000000000000000000));
    await landContract.setMintPrice(BigInt(600000000000000000000));
    expect(await landContract.mintPrice()).to.equal(BigInt(600000000000000000000));

    expect(await landContract.toggleSale())
      .to.emit(landContract, "SaleActive")
      .withArgs(true);
  });
  it("Oxgn functions", async () => {
    expect(await oContract.mintedCount()).to.equal(ethers.utils.parseEther("0"));
    expect(await oContract.burnedCount()).to.equal(ethers.utils.parseEther("0"));
    expect(await oContract.MAX_SUPPLY()).to.equal(ethers.BigNumber.from(0));
    expect(await oContract.rewardCount()).to.equal(ethers.BigNumber.from(0));
    expect(await oContract.donationCount()).to.equal(ethers.BigNumber.from(0));
    expect(await oContract.taxCount()).to.equal(ethers.BigNumber.from(0));
    expect(await oContract.tokenCapSet()).to.equal(false);

    await oContract.mint(accounts[0].address, ethers.utils.parseEther("200.0"));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("200.0"));

    await oContract.mint(accounts[1].address, ethers.utils.parseEther("200.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("200.0"));

    await oContract.burn(accounts[0].address, ethers.utils.parseEther("50.0"));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("150.0"));

    await oContract.burn(accounts[1].address, ethers.utils.parseEther("50.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("150.0"));

    await expect(oContract.connect(accounts[1]).mint(accounts[0].address, ethers.utils.parseEther("200.0"))).to.be.revertedWith("Only admins can mint");

    await expect(oContract.connect(accounts[1]).transferFrom(accounts[1].address, accounts[0].address, ethers.utils.parseEther("10.0"))).to.be.revertedWith("ERC20: insufficient allowance");

    await oContract.transferFrom(accounts[0].address, accounts[1].address, ethers.utils.parseEther("30.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("180.0"));

    await expect(oContract.transferFrom(accounts[0].address, accounts[1].address, ethers.utils.parseEther("200.0"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");

    expect(await oContract.mintedCount()).to.equal(ethers.utils.parseEther("400"));
    expect(await oContract.burnedCount()).to.equal(ethers.utils.parseEther("100"));
    expect(await oContract.totalSupply()).to.equal(ethers.utils.parseEther("300"));

    await oContract.donate(accounts[0].address, ethers.utils.parseEther("100.0"));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("220.0"));

    await oContract.donate(accounts[1].address, ethers.utils.parseEther("50.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("230.0"));

    expect(await oContract.donationCount()).to.equal(ethers.utils.parseEther("150"));
    expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("150"));

    await oContract.tax(accounts[0].address, ethers.utils.parseEther("50.0"));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("270.0"));

    await oContract.tax(accounts[1].address, ethers.utils.parseEther("100.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("330.0"));

    expect(await oContract.taxCount()).to.equal(ethers.utils.parseEther("150"));
    expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("300"));

    //REWARD
    await oContract.reward(accounts[0].address, ethers.utils.parseEther("30.0"));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("300.0"));

    await oContract.reward(accounts[1].address, ethers.utils.parseEther("70.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("400.0"));

    expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("400"));

    //Set MaxSupply
    let supply = await oContract.totalSupply();
    await expect(oContract.setMaxSupply(supply)).to.be.revertedWith("Value is smaller than the number of existing tokens");

    await oContract.setMaxSupply(supply + ethers.utils.parseEther("1000.0"));

    await expect(oContract.setMaxSupply(supply + ethers.utils.parseEther("2000.0"))).to.be.revertedWith("Token cap has been already set");

    expect(await oContract.MAX_SUPPLY()).to.equal(supply + ethers.utils.parseEther("1000.0"));
    expect(await oContract.tokenCapSet()).to.equal(true);

    //REWARD AFTER SET MaxSupply
    await oContract.reward(accounts[0].address, ethers.utils.parseEther("150.0"));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("450.0"));

    await oContract.reward(accounts[1].address, ethers.utils.parseEther("50.0"));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("450.0"));

    expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("600"));
    expect(await oContract.balanceOf(oContract.address)).to.equal(ethers.utils.parseEther("100.0"));

    let maxSupply = await oContract.MAX_SUPPLY();
    await expect(oContract.reward(accounts[1].address, maxSupply)).to.be.revertedWith("Amount exceeds max cap or max cap reached!");

    await expect(oContract.reward(accounts[1].address, ethers.BigNumber.from(maxSupply).mul(2).div(5))).to.be.revertedWith("Amount exceeds 40% rewards pool!");

    let reserve = await oContract.balanceOf(oContract.address);
    await expect(oContract.withdrawReserve(accounts[1].address, reserve + ethers.utils.parseEther("1.0"))).to.be.revertedWith("amount exceeds balance");

    let acc0 = await oContract.balanceOf(accounts[0].address);
    let acc1 = await oContract.balanceOf(accounts[1].address);
    console.log("acc0 before withdrawReserve: " + acc0);
    console.log("acc1 before withdrawReserve: " + acc1);
    console.log("reserve before withdrawReserve: " + reserve);
    await oContract.connect(accounts[0]).withdrawReserve(accounts[1].address, ethers.BigNumber.from(reserve).div(2));
    expect(await oContract.balanceOf(oContract.address)).to.equal(ethers.BigNumber.from(reserve).div(2));
    expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.BigNumber.from(acc1).add(ethers.BigNumber.from(reserve).div(2)));
    expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.BigNumber.from(acc0));

    reserve = await oContract.balanceOf(oContract.address);
    acc0 = await oContract.balanceOf(accounts[0].address);
    acc1 = await oContract.balanceOf(accounts[1].address);
    console.log("acc0 after withdrawReserve: " + acc0);
    console.log("acc1 after withdrawReserve: " + acc1);
    console.log("reserve after withdrawReserve: " + reserve);

    //Burn half the reserve
    reserve = await oContract.balanceOf(oContract.address);
    console.log("Before burning half: " + reserve);
    await oContract.connect(accounts[0]).burnReserve(ethers.BigNumber.from(reserve).div(2));
    expect(await oContract.balanceOf(oContract.address)).to.equal(ethers.BigNumber.from(reserve).div(2));
    reserve = await oContract.balanceOf(oContract.address);
    console.log("After burning half: " + reserve);
  });

   it("Land functions", async () => {
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

     let nftPrice = await yContract.mintPrice();
     let tokenId = await yContract.totalSupply();
     await expect(yContract.paidMint(3, [], {
         value: ethers.BigNumber.from(nftPrice).mul(3)
       }))
       .to.emit(yContract, "Transfer")
       .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

     await yContract.connect(accounts[1]).paidMint(3, [], {
       value: ethers.BigNumber.from(nftPrice).mul(3)
     });

     //await yContract.addAdmin(cContract.address);
     await cContract.addContract(yContract.address);

     await yContract.setApprovalForAll(cContract.address, true);
     await cContract.stake(yContract.address, [0, 1, 2], 1);

     await yContract.connect(accounts[1]).setApprovalForAll(cContract.address, true);
     await cContract.connect(accounts[1]).stake(yContract.address, [3, 4], 4);
     //Elligible to be leader now that have changed clan
     expect(await cContract.shouldChangeLeader(accounts[1].address, clanId, 111)).to.equal(true);

     //Change clan by staking
     await oContract.mint(accounts[1].address, ethers.utils.parseEther("100.0")); // oxgn needed to change clan
     await cContract.connect(accounts[1]).stake(yContract.address, [5], 1);
     const acc = await cContract.getAccountsInClan(1);
     expect(acc[0]).to.eql(accounts[0].address);
     expect(acc[1]).to.eql(accounts[1].address);

     const clanRecords = await cContract.getClanRecords(1);
     //console.log(clanRecords);
     expect(clanRecords.entity[0]).to.eql(accounts[0].address);
     expect(ethers.BigNumber.from(clanRecords.updateClanTimestamp[0])).to.not.eq(ethers.BigNumber.from(0));
     expect(clanRecords.entity[1]).to.eql(accounts[1].address);
     expect(ethers.BigNumber.from(clanRecords.updateClanTimestamp[1])).to.not.eq(ethers.BigNumber.from(0));

     const claimableOfOwner = await cContract.claimableOfOwner(yContract.address, accounts[0].address);
     console.log(claimableOfOwner);
     expect(claimableOfOwner.stakedTimestamps[0]).to.not.eql(ethers.BigNumber.from(0));
     expect(claimableOfOwner.claimableTimestamps[0]).to.not.eql(ethers.BigNumber.from(0));

     //Staking another contract NFTs
     nftPrice = await y2Contract.mintPrice();
     tokenId = await y2Contract.totalSupply();
     await expect(y2Contract.paidMint(3, [], {
         value: ethers.BigNumber.from(nftPrice).mul(3)
       }))
       .to.emit(y2Contract, "Transfer")
       .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

     await y2Contract.connect(accounts[1]).paidMint(3, [], {
       value: ethers.BigNumber.from(nftPrice).mul(3)
     });

     await y2Contract.setApprovalForAll(cContract.address, true);
     await cContract.stake(y2Contract.address, [0, 1, 2], 1);

     await y2Contract.connect(accounts[1]).setApprovalForAll(cContract.address, true);
     await cContract.connect(accounts[1]).stake(y2Contract.address, [3, 4], 4);

     expect(await cContract.stakedTokensOfOwner(y2Contract.address, accounts[1].address)).to.eql([ethers.BigNumber.from(3), ethers.BigNumber.from(4)]);

     await cContract.connect(accounts[1]).unstake(y2Contract.address, [3]);

     expect(await cContract.stakedTokensOfOwner(y2Contract.address, accounts[1].address)).to.eql([ethers.BigNumber.from(4)]);

     await oContract.mint(cContract.address, ethers.utils.parseEther("100.0"));
     await cContract.withdrawForDonation(ethers.utils.parseEther("50.0"));
     await expect(cContract.withdrawForDonation(ethers.utils.parseEther("51.0"))).to.be.revertedWith("amount exceeds balance");
   });
  
});


