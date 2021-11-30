const { expect } = require("chai");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

describe("Y2123 Contract", function () {
  let yContract, accounts, merkleTree, root;
  let list = [];

  beforeEach(async () => {
    const contract = await ethers.getContractFactory("Y2123");
    yContract = await contract.deploy();
    await yContract.deployed();

    accounts = await ethers.getSigners();
  });

  it("Should return the right name and symbol", async function () {
    expect(await yContract.name()).to.equal("Y2123");
    expect(await yContract.symbol()).to.equal("Y2123");
  });

  it("Should return right MAX_SUPPLY", async () => {
    expect(await yContract.MAX_SUPPLY()).to.equal(500);
  });

  it("Should set the right owner", async () => {
    expect(await yContract.owner()).to.equal(await accounts[0].address);
  });

  it("Presale minting with working proof", async () => {
    await yContract.toggleSale();
    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();

    list = [];
    for (const account of accounts) {
      list.push(account.address);
    }
    for (let i = 0; i < 500; i++) { //generate 500 WL
      const wallet = ethers.Wallet.createRandom()
      list.push(wallet.address);
    }
    console.log("list is %s", list);

    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    console.log("root is %s", root);
    await yContract.setMerkleRoot(root);

    let proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    console.log("owner proof is %s", proof);

    expect(
      await yContract.paidMint(1, proof, {
        value: nftPrice,
      })
    )
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    proof = merkleTree.getHexProof(keccak256(accounts[1].address));
    console.log("addr1 proof is %s", proof);
    tokenId = await yContract.totalSupply();

    expect(
      await yContract.connect(accounts[1]).paidMint(1, proof, {
        value: nftPrice,
      })
    )
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[1].address, tokenId);
  });

  it("Presale minting with invalid proof", async () => {
    await yContract.toggleSale();
    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();

    list = [];
    for (let i = 0; i < 500; i++) { //generate 500 WL
      const wallet = ethers.Wallet.createRandom()
      list.push(wallet.address);
    }
    console.log("list is %s", list);

    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    console.log("root is %s", root);
    await yContract.setMerkleRoot(root);

    let proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    console.log("owner proof is %s", proof);

    await expect(
      yContract.paidMint(1, proof, {
        value: nftPrice,
      })
    ).to.be.revertedWith('You are not on the whitelist');

    proof = merkleTree.getHexProof(keccak256(accounts[1].address));
    console.log("addr1 proof is %s", proof);
    tokenId = await yContract.totalSupply();

    await expect(
      yContract.connect(accounts[1]).paidMint(1, proof, {
        value: nftPrice,
      })
    ).to.be.revertedWith('You are not on the whitelist');
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
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);
  });
});