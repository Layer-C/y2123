const { expect } = require("chai");
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

describe("Y2123 Contract", function () {
  let yContract, oContract, cContract, accounts, merkleTree, root;
  let list = [];
  const uri = "ipfs://QmWPw3fBWKUcmbuQx5ixF6o3xjD3Xk1y4H8BPs2JQtT1n4/";
  const root1 = '0x486048819872b8bad022b996e0de31aae3e5160b7c03de01a94d4bbadf4af63a';
  const root2 = '0x486048819872b8bad022b996e0de31aae3e5160b7c03de01a94d4bbadf4af63a';

  beforeEach(async () => {
    let contract = await ethers.getContractFactory("Y2123");
    yContract = await contract.deploy(uri, root1, root2);
    await yContract.deployed();
    /*
        contract = await ethers.getContractFactory("Oxygen");
        oContract = await contract.deploy();
        await oContract.deployed();
    
        contract = await ethers.getContractFactory("Clans");
        cContract = await contract.deploy();
        await cContract.deployed();
        await cContract.setContracts(yContract.address, oContract.address)
    */
    accounts = await ethers.getSigners();
  });

  it("Should have basic info right", async () => {
    expect(await yContract.name()).to.equal("Y2123");
    expect(await yContract.symbol()).to.equal("Y2123");
    expect(await yContract.owner()).to.equal(accounts[0].address);
    expect(await yContract.maxMintPerAddress()).to.equal(1);

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

    expect(await yContract.maxMintPerTx()).to.equal(3);
    await yContract.setMaxMintPerTx(4);
    expect(await yContract.maxMintPerTx()).to.equal(4);

    expect(await yContract.maxMintPerAddress()).to.equal(1);
    await yContract.setMaxMintPerAddress(2);
    expect(await yContract.maxMintPerAddress()).to.equal(2);

    expect(await yContract.toggleSale())
      .to.emit(yContract, "SaleActive")
      .withArgs(true);

    expect(await yContract.togglePresale())
      .to.emit(yContract, "PresaleActive")
      .withArgs(false);
  });

  it("Public sale minting", async () => {
    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();
    //console.log("nftPrice is %s", ethers.utils.formatEther(nftPrice));

    await expect(yContract.paidMint(1, [], { value: nftPrice, }))
      .to.be.revertedWith('Sale not enabled');

    await yContract.toggleSale();
    await yContract.togglePresale();

    await expect(yContract.paidMint(2, [], { value: BigInt(nftPrice), }))
      .to.be.revertedWith('More ETH please');

    await expect(yContract.paidMint(2, [], { value: BigInt(nftPrice * 2), }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    //const minted = await cContract.printY2123();
    //expect(minted).to.equal(2);
    //console.log("y2123 totalSupply is %s", minted);

    const maxMintPerTxPlus1 = await yContract.maxMintPerTx() + 1;
    await expect(yContract.paidMint(maxMintPerTxPlus1, [], { value: BigInt(nftPrice * maxMintPerTxPlus1), }))
      .to.be.revertedWith('Exceeded max mint per transaction');

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

    expect(await yContract.tokenURI(0)).to.equal(uri + '0')

    await yContract.setBaseURI("ipfs://Test123/");
    expect(await yContract.tokenURI(0)).to.equal("ipfs://Test123/0");
    expect(await yContract.tokenURI(1)).to.equal("ipfs://Test123/1");
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
    //console.log("owner proof is %s", proof);

    await expect(yContract.paidMint(1, proof, { value: nftPrice, }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await expect(yContract.paidMint(1, proof, { value: nftPrice, }))
      .to.be.revertedWith('Exceeded max mint per address for whitelist, try minting with less');

    proof = merkleTree.getHexProof(keccak256(accounts[1].address));
    //console.log("addr1 proof is %s", proof);
    tokenId = await yContract.totalSupply();

    await expect(yContract.connect(accounts[1]).paidMint(1, proof, { value: nftPrice, }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[1].address, tokenId);

    //Inject metamask Test2 account at the top
    list[0] = "0x043f292c37e1De0B53951d1e478b59BC5358F359";
    list[1] = "0x043f292c37e1De0B53951d1e478b59BC5358F359";
    //console.log("list is %s", list);

    merkleTree = new MerkleTree(list, keccak256, { hashLeaves: true, sortPairs: true });
    root = merkleTree.getHexRoot();
    //console.log("root is %s", root);
    await yContract.setMerkleRoot(root);

    proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    //console.log("owner proof is %s", proof);

    await expect(yContract.paidMint(1, proof, { value: nftPrice, }))
      .to.be.revertedWith('You are not on the whitelist');

    proof = merkleTree.getHexProof(keccak256(accounts[1].address));
    //console.log("addr1 proof is %s", proof);

    await expect(yContract.connect(accounts[1]).paidMint(1, proof, { value: nftPrice, }))
      .to.be.revertedWith('You are not on the whitelist');

    proof = merkleTree.getHexProof(keccak256("0x043f292c37e1De0B53951d1e478b59BC5358F359"));
    //console.log("Test2 proof is %s", proof);
  });

  it("Free minting with proof testing", async () => {
    await expect(yContract.connect(accounts[0]).freeMint([]))
      .to.be.revertedWith('Free mint not enabled');

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
    //console.log("root is %s", root);
    await yContract.setFreeRoot(root);

    let proof = merkleTree.getHexProof(keccak256(accounts[0].address));
    //console.log("addr1 proof is %s", proof);
    await expect(yContract.connect(accounts[0]).freeMint(proof))
      .to.be.revertedWith('You are not on the free list');

    let proof2 = merkleTree.getHexProof(keccak256(accounts[1].address));
    //console.log("addr2 proof is %s", proof2);
    await expect(yContract.connect(accounts[1]).freeMint(proof2))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[1].address, tokenId);

    await expect(yContract.connect(accounts[1]).freeMint(proof2))
      .to.be.revertedWith('You already minted your free nft');

    await yContract.setMaxFreeMint(1);

    let proof3 = merkleTree.getHexProof(keccak256(accounts[2].address));
    await expect(yContract.connect(accounts[2]).freeMint(proof3))
      .to.be.revertedWith('No more supply');

    await yContract.setMaxFreeMint(2);

    tokenId = await yContract.totalSupply();
    await expect(yContract.connect(accounts[2]).freeMint(proof3))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[2].address, tokenId);

    expect(await yContract.freeMintMinted(accounts[2].address)).to.equal(1);
    expect(await yContract.freeMintCount()).to.equal(2);
  });

  it("Reserve minting", async () => {
    let tokenId = await yContract.totalSupply();
    await expect(yContract.reserve(2))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    expect(await yContract.reserveMintCount()).to.equal(2);

    //expect(await yContract.getTokenIDs(accounts[0].address)).to.equal([0, 1]);

    await expect(yContract.reserve(50))
      .to.be.revertedWith('Reserved more then available');

    await yContract.setMaxReserveMint(100);

    tokenId = await yContract.totalSupply();
    await expect(yContract.reserve(50))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await expect(yContract.connect(accounts[1]).reserve(50))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it("Airdrop minting", async () => {
    let tokenId = await yContract.totalSupply();
    await expect(yContract.airDrop([accounts[0].address, accounts[1].address], [10, 9]))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    expect(await yContract.addressMinted(accounts[0].address)).to.equal(10);
    expect(await yContract.addressMinted(accounts[1].address)).to.equal(9);

    await expect(yContract.airDrop([accounts[0].address, accounts[1].address], [10]))
      .to.be.revertedWith('Please provide equal quantities and recipients');

    await expect(yContract.airDrop([accounts[0].address, accounts[1].address], [300, 300]))
      .to.be.revertedWith('Not enough supply');
  });

  it("Testing withdrawAll", async () => {
    const nftPrice = await yContract.mintPrice();
    let tokenId = await yContract.totalSupply();

    await yContract.toggleSale();
    await yContract.togglePresale();

    const initialBalance = ethers.utils.formatEther(await accounts[0].getBalance());
    //console.log("initialBalance is %s", initialBalance);

    await expect(yContract.connect(accounts[1]).paidMint(2, [], { value: BigInt(nftPrice * 2), }))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[1].address, tokenId);

    await expect(yContract.connect(accounts[1]).withdrawAll())
      .to.be.revertedWith('Ownable: caller is not the owner');

    await yContract.connect(accounts[0]).withdrawAll();
    const currentBalance = ethers.utils.formatEther(await accounts[0].getBalance());
    //console.log("Balance after withdrawAll is %s", currentBalance);

    expect(parseFloat(currentBalance)).to.greaterThan(parseFloat(initialBalance));
  });

  it("Contract minting", async () => {
    await expect(yContract.mint(accounts[0].address))
      .to.be.revertedWith('Pausable: paused');

    await yContract.setPaused(false);

    await expect(yContract.mint(accounts[0].address))
      .to.be.revertedWith('Admins only!');

    await yContract.addAdmin(accounts[0].address);

    let tokenId = await yContract.totalSupply();
    await expect(yContract.mint(accounts[0].address))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    tokenId = await yContract.totalSupply();
    await expect(yContract.mint(accounts[0].address))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    expect(await yContract.addressMinted(accounts[0].address)).to.equal(2);

    await yContract.removeAdmin(accounts[0].address);

    await expect(yContract.mint(accounts[0].address))
      .to.be.revertedWith('Admins only!');
  });

  it("Contract burning", async () => {
    await expect(yContract.burn(0))
      .to.be.revertedWith('Pausable: paused');

    await yContract.setPaused(false);

    await expect(yContract.burn(0))
      .to.be.revertedWith('Admins only!');

    await yContract.addAdmin(accounts[0].address);

    await expect(yContract.burn(0))
      .to.be.revertedWith('ERC721: owner query for nonexistent token');

    let tokenId = await yContract.totalSupply();
    await expect(yContract.mint(accounts[0].address))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await expect(yContract.burn(0))
      .to.emit(yContract, "Transfer")
      .withArgs(accounts[0].address, ethers.constants.AddressZero, 0);
  });

  it("Update origin", async () => {
    await expect(yContract.updateOriginAccess([0]))
      .to.be.revertedWith('Admins only!');

    await yContract.addAdmin(accounts[0].address);

    await yContract.updateOriginAccess([0]);

    await yContract.setPaused(false);

    let tokenId = await yContract.totalSupply();
    await expect(yContract.mint(accounts[0].address))
      .to.emit(yContract, "Transfer")
      .withArgs(ethers.constants.AddressZero, accounts[0].address, tokenId);

    await yContract.removeAdmin(accounts[0].address);

    const tokenid1 = await yContract.tokenOfOwnerByIndex(accounts[0].address, 0);
    expect(tokenid1).to.equal(0);

    const balance = await yContract.balanceOf(accounts[0].address);
    expect(balance).to.equal(1);

    const address = await yContract.ownerOf(0);
    expect(address).to.equal(accounts[0].address);

    const tokenid2 = await yContract.tokenByIndex(0);
    expect(tokenid2).to.equal(0);

    await yContract.approve(accounts[1].address, 0);

    const address1 = await yContract.getApproved(0);
    expect(address1).to.equal(accounts[1].address);

    await yContract.setApprovalForAll(accounts[1].address, true);

    const approved = await yContract.isApprovedForAll(accounts[0].address, accounts[1].address);
    expect(approved).to.equal(true);

    await expect(yContract.transferFrom(accounts[0].address, accounts[1].address, 0))
      .to.emit(yContract, "Transfer")
      .withArgs(accounts[0].address, accounts[1].address, 0);

  });

});