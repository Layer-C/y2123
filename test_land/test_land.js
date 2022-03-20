const { expect } = require("chai");

describe("Land Contract", function () {
  let landContract, accounts;
  let list = [];
  const uri = "https://api.y2123.io/land-asset?id=";

  beforeEach(async () => {
    let contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(uri);
    await landContract.deployed();

    accounts = await ethers.getSigners();
  });

  it("Should have basic info right", async () => {
    expect(await landContract.name()).to.equal("Y2123.Land");
    expect(await landContract.symbol()).to.equal("Y2123.Land");
    expect(await landContract.owner()).to.equal(accounts[0].address);

    expect(await landContract.MAX_SUPPLY()).to.equal(500);
    await landContract.setMaxSupply(10000);
    expect(await landContract.MAX_SUPPLY()).to.equal(10000);

    expect(await landContract.mintPrice()).to.equal(BigInt(63000000000000000));
    await landContract.setMintPrice(BigInt(61000000000000000));
    expect(await landContract.mintPrice()).to.equal(BigInt(61000000000000000));

    expect(await landContract.toggleSale())
      .to.emit(landContract, "SaleActive")
      .withArgs(true);
  });
});
