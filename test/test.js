const { expect } = require("chai");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

describe("Y2123 Contract", function () {
  let yContract, oContract, cContract, accounts, merkleTree, root;
  let list = [];

  beforeEach(async () => {
    let contract = await ethers.getContractFactory("Y2123");
    yContract = await contract.deploy();
    await yContract.deployed();

    contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    contract = await ethers.getContractFactory("Clans");
    cContract = await contract.deploy();
    await cContract.deployed();
    await cContract.setContracts(yContract.address, oContract.address)

    accounts = await ethers.getSigners();
  });

  it("Should have basic info right", async function () {
    expect(await yContract.name()).to.equal("Y2123");
    expect(await yContract.symbol()).to.equal("Y2123");
    expect(await yContract.owner()).to.equal(await accounts[0].address);
    expect(await yContract.maxMintPerAddress()).to.equal(1);
    //expect(await yContract.getTokenIDs(await accounts[0].address)).to.equal(new Array());

    expect(await yContract.MAX_SUPPLY()).to.equal(500);
    await yContract.setMaxSupply(10000);
    expect(await yContract.MAX_SUPPLY()).to.equal(10000);

    expect(await yContract.MAX_RESERVE_MINT()).to.equal(50);
    await yContract.setMaxReserveMint(100);
    expect(await yContract.MAX_RESERVE_MINT()).to.equal(100);

    expect(await yContract.MAX_FREE_MINT()).to.equal(50);
    await yContract.setMaxFreeMint(200);
    expect(await yContract.MAX_FREE_MINT()).to.equal(200);

    expect(await yContract.mintPrice()).to.equal(BigInt(63000000000000000));
    await yContract.setMintPrice(BigInt(61000000000000000));
    expect(await yContract.mintPrice()).to.equal(BigInt(61000000000000000));

    expect(await yContract.freeMintEnabled()).to.equal(false);
    await yContract.toggleFreeMint();
    expect(await yContract.freeMintEnabled()).to.equal(true);

    expect(await yContract.maxMintPerTx()).to.equal(5);
    await yContract.setMaxMintPerTx(3);
    expect(await yContract.maxMintPerTx()).to.equal(3);

    expect(await yContract.maxMintPerAddress()).to.equal(1);
    await yContract.setMaxMintPerAddress(2);
    expect(await yContract.maxMintPerAddress()).to.equal(2);

    await expect(yContract.toggleSale())
      .to.emit(yContract, "SaleActive")
      .withArgs(true);

    await expect(yContract.togglePresale())
      .to.emit(yContract, "PresaleActive")
      .withArgs(false);
  });

  it("Public sale minting", async () => {
    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();
    console.log("nftPrice is %s", nftPrice);

    await expect(yContract.paidMint(1, [], { value: nftPrice, }))
      .to.be.revertedWith('Sale not enabled');

    await yContract.toggleSale();
    await yContract.togglePresale();

    await expect(yContract.paidMint(2, [], { value: BigInt(nftPrice), }))
      .to.be.revertedWith('More ETH please');

    await expect(yContract.paidMint(2, [], { value: BigInt(nftPrice * 2), }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    const minted = await cContract.printY2123();
    expect(minted).to.equal(2);
    console.log("y2123 totalSupply is %s", minted);

    const maxMintPerTxPlus1 = await yContract.maxMintPerTx() + 1;
    await expect(yContract.paidMint(maxMintPerTxPlus1, [], { value: BigInt(nftPrice * maxMintPerTxPlus1), }))
      .to.be.revertedWith('Exceed max mint per transaction');

    await expect(yContract.setMaxSupply(1))
      .to.be.revertedWith('Value lower than total supply');

    await expect(yContract.setMaxSupply(99))
      .to.be.revertedWith('Value lower than total reserve & free mints');

    await yContract.setMaxSupply(103);

    tokenId = await yContract.totalSupply();
    await expect(yContract.paidMint(1, [], { value: nftPrice, }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await expect(yContract.paidMint(1, [], { value: nftPrice, }))
      .to.be.revertedWith('Please try minting with less, not enough supply!');

    await yContract.setBaseURI("ipfs://Test123/");
    expect(await yContract.tokenURI(0)).to.equal("ipfs://Test123/0");
  });

  it("Presale minting", async () => {
    await yContract.toggleSale();
    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();

    list = [];
    for (const account of accounts) {
      list.push(account.address);
    }
    for (let i = 0; i < 20; i++) { //generate 20 WL
      const wallet = ethers.Wallet.createRandom()
      list.push(wallet.address);
    }
    //console.log("list is %s", list);

    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    //console.log("root is %s", root);
    await yContract.setMerkleRoot(root);

    let proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    console.log("owner proof is %s", proof);

    expect(await yContract.paidMint(1, proof, { value: nftPrice, }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await expect(yContract.paidMint(1, proof, { value: nftPrice, }))
      .to.be.revertedWith('Exceed max mint per address for whitelist, try minting with less');

    proof = merkleTree.getHexProof(keccak256(accounts[1].address));
    console.log("addr1 proof is %s", proof);
    tokenId = await yContract.totalSupply();

    expect(await yContract.connect(accounts[1]).paidMint(1, proof, { value: nftPrice, }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[1].address, tokenId);

    //Inject metamask Test2 account at the top
    list[0] = "0x043f292c37e1De0B53951d1e478b59BC5358F359";
    list[1] = "0x043f292c37e1De0B53951d1e478b59BC5358F359";
    //console.log("list is %s", list);

    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    console.log("root is %s", root);
    await yContract.setMerkleRoot(root);

    proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    console.log("owner proof is %s", proof);

    await expect(yContract.paidMint(1, proof, { value: nftPrice, }))
      .to.be.revertedWith('You are not on the whitelist');

    proof = merkleTree.getHexProof(keccak256(accounts[1].address));
    console.log("addr1 proof is %s", proof);

    await expect(yContract.connect(accounts[1]).paidMint(1, proof, { value: nftPrice, }))
      .to.be.revertedWith('You are not on the whitelist');

    proof = merkleTree.getHexProof(keccak256("0x043f292c37e1De0B53951d1e478b59BC5358F359"));
    console.log("Test2 proof is %s", proof);
  });

  it("Free minting with proof testing", async () => {
    await yContract.toggleFreeMint();
    let tokenId = await yContract.totalSupply();

    list = [];
    for (const account of accounts) {
      list.push(account.address);
    }
    //Inject metamask Test2 account at the top
    list[0] = "0x043f292c37e1De0B53951d1e478b59BC5358F359";
    //console.log("list is %s", list);

    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    console.log("root is %s", root);
    await yContract.setFreeRoot(root);

    let proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    console.log("addr1 proof is %s", proof);
    await expect(yContract.connect(accounts[0]).freeMint(proof))
      .to.be.revertedWith('You are not on the free list');

    let proof2 = merkleTree.getHexProof(keccak256(accounts[1].address));
    console.log("addr2 proof is %s", proof2);
    await expect(yContract.connect(accounts[1]).freeMint(proof2))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[1].address, tokenId);
  });

});