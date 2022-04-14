const { expect } = require("chai");

describe("Land Contract", function () {
  let landContract, accounts;
  const uri = "https://api.y2123.io/land-asset?id=";
  const oxgnAddress = "0x374EEBeCA0e2E23658072Df3Bd31A77f216490A0";
  const clansAddress = "0x93f5e53C1D31BFA6Ec4086C0Ca87411086D2E621";
  const proxyRegistryAddress = "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A";

  beforeEach(async () => {
    let contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(uri, oxgnAddress, clansAddress, proxyRegistryAddress);
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
});


