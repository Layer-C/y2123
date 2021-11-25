const { expect } = require("chai");

describe("Y2123 Contract", function () {
  let yContract, owner;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    const contract = await ethers.getContractFactory("Y2123");
    yContract = await contract.deploy();
    await yContract.deployed();
  });

  it("Should return the right name and symbol", async function () {
    expect(await yContract.name()).to.equal("Y2123");
    expect(await yContract.symbol()).to.equal("Y2123");
  });

  it("Should return right MAX_SUPPLY", async () => {
    expect(await yContract.MAX_SUPPLY()).to.equal(100);
  });

  it("Should set the right owner", async () => {
    expect(await yContract.owner()).to.equal(await owner.address);
  });

  it("Should mint an NFT", async () => {
    //await yContract.toggleSale();
    const nftPrice = await yContract.PRICE();
    const tokenId = await yContract.totalSupply();
    expect(
      await yContract.mintNFTs(1, {
        value: nftPrice,
      })
    )
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, owner.address, tokenId);
  });

});