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

  
});


