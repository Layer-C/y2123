const { expect } = require("chai");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

describe("Y2123 Contract", function () {
  let yContract, merkleTree, root;
  let owner, addr1, addr2, addr3, addr4, addr5;
  let list = [];

  beforeEach(async () => {
    const contract = await ethers.getContractFactory("Y2123");
    yContract = await contract.deploy();
    await yContract.deployed();

    [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();
  });

  it("Should return the right name and symbol", async function () {
    expect(await yContract.name()).to.equal("Y2123");
    expect(await yContract.symbol()).to.equal("Y2123");
  });

  it("Should return right MAX_SUPPLY", async () => {
    expect(await yContract.MAX_SUPPLY()).to.equal(500);
  });

  it("Should set the right owner", async () => {
    expect(await yContract.owner()).to.equal(await owner.address);
  });

  it("Presale minting", async () => {
    await yContract.toggleSale();
    const nftPrice = await yContract.mintPrice();
    const tokenId = await yContract.totalSupply();

    list.push(owner.address, addr1.address);
    console.log("list is %s", list);
    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    console.log("root is %s", root);

    await yContract.setMerkleRoot(root);
    const proof = merkleTree.getHexProof(keccak256(owner.address));
    console.log("proof is %s", proof);

    expect(
      await yContract.paidMint(1, proof, {
        value: nftPrice,
      })
    )
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, owner.address, tokenId);
  });

  it("Public sale minting", async () => {
    await yContract.toggleSale();
    await yContract.togglePresale();
    const nftPrice = await yContract.mintPrice();
    const tokenId = await yContract.totalSupply();

    expect(
      await yContract.paidMint(1, [], {
        value: nftPrice,
      })
    )
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, owner.address, tokenId);
  });
});