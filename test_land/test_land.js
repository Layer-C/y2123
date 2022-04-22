const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Land Contract", function () {
  let landContract, oContract, cContract, y1Contract, y2Contract, proxyContract, accounts;
  const land_uri = "https://api.y2123.io/land-asset?id=";
  const cs_uri = "https://api.y2123.io/cs2-asset?id=";
  const clan_uri = "https://api.y2123.io/clan-asset?id=";

  beforeEach(async () => {
    //Deploy fake ProxyRegistry contract to simulate OpenSea proxy contract
    let contract = await ethers.getContractFactory("contracts/Land.sol:ProxyRegistry");
    proxyContract = await contract.deploy();
    await proxyContract.deployed();

    //Deploy the ERC20 Oxygen contract
    contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    //So you can mint OXGN using accounts[0]
    accounts = await ethers.getSigners();
    await oContract.addAdmin(accounts[0].address);

    //Deploy Clans contract so we can test buyUpgrades which depends on which colony affliation
    contract = await ethers.getContractFactory("contracts/Clans.sol:Clans");
    cContract = await contract.deploy(clan_uri, oContract.address, accounts[0].address);
    await cContract.deployed();

    //Finally we deploy the land contract
    contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(land_uri, oContract.address, cContract.address, proxyContract.address);
    await landContract.deployed();

    //Deploy 2 different CS NFT contract so can be used to test stake into Land
    contract = await ethers.getContractFactory("Y2123");
    y1Contract = await contract.deploy(cs_uri, landContract.address, proxyContract.address);
    await y1Contract.deployed();
    y2Contract = await contract.deploy(cs_uri, landContract.address, proxyContract.address);
    await y2Contract.deployed();

    //So we can stake CS NFT into land
    landContract.addContract(y1Contract.address);
    landContract.addContract(y2Contract.address);

    //So Land contract can burn OXGN (needed to paidMint Land and buyUpgrades function)
    await oContract.addAdmin(landContract.address);

    //Mint OXGN for 3 test acc so can buy Land NFT
    await oContract.mint(accounts[0].address, ethers.utils.parseEther("100000.0"));
    await oContract.mint(accounts[1].address, ethers.utils.parseEther("100000.0"));
    await oContract.mint(accounts[2].address, ethers.utils.parseEther("100000.0"));

    //Mint 10 Land NFT for 3 test acc
    await landContract.connect(accounts[0]).paidMint(10);
    await landContract.connect(accounts[1]).paidMint(10);
    await landContract.connect(accounts[2]).paidMint(10);

    //Mint 10 CS1 NFT for 3 test acc
    let nftPrice = await y1Contract.mintPrice();
    await y1Contract.connect(accounts[0]).paidMint(10, [], { value: ethers.BigNumber.from(nftPrice).mul(10) });
    await y1Contract.connect(accounts[1]).paidMint(10, [], { value: ethers.BigNumber.from(nftPrice).mul(10) });
    await y1Contract.connect(accounts[2]).paidMint(10, [], { value: ethers.BigNumber.from(nftPrice).mul(10) });

    //Mint 10 CS2 NFT for 3 test acc
    nftPrice = await y2Contract.mintPrice();
    await y2Contract.connect(accounts[0]).paidMint(10, [], { value: ethers.BigNumber.from(nftPrice).mul(10) });
    await y2Contract.connect(accounts[1]).paidMint(10, [], { value: ethers.BigNumber.from(nftPrice).mul(10) });
    await y2Contract.connect(accounts[2]).paidMint(10, [], { value: ethers.BigNumber.from(nftPrice).mul(10) });
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

  it("Everthing about Tokens", async () => {
    let totSupply = await landContract.totalSupply();
    expect(totSupply).to.equal(30);

    let [...tokens] = await landContract.getTokenIDs(landContract.owner());
    expect(await tokens.length).to.equal(10);

    await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));
    await landContract.paidMint(1);

    [...tokens] = await landContract.getTokenIDs(landContract.owner());
    expect(await tokens.length).to.equal(11);

    await expect(landContract.paidMint(500)).to.be.revertedWith("Please try minting with less, not enough supply!");

    await landContract.toggleSale();
    await expect(landContract.paidMint(1)).to.be.revertedWith("Sale not enabled");
  });

  it("STAKE ON LAND - LAND OWNERS", async () => {
    //Revert tests
    await expect(landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [7, 8], 12)).to.be.revertedWith("You do not own this land!");
    await landContract.updateContract(y1Contract.address, false);
    await expect(landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [4, 5, 6], 5)).to.be.revertedWith("Token contract is not active");
    await landContract.updateContract(y1Contract.address, true);

    //Stake CS1 into Land ID 0
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [0], 0);
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [1, 2], 0);

    //TEST function stakedByOwnerInternal(address contractAddress, address owner)
    let [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(3);
    expect(stakedIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(2)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);
    expect(stakedTimestamps.length).equal(3);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[2]).toNumber()).to.be.greaterThan(0);

    //TEST function stakedByLandInternal(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 0);
    expect(stakedIds.length).equal(3);
    expect(stakedIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(2)]);
    expect(stakedTimestamps.length).equal(3);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[2]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address, accounts[0].address, accounts[0].address]);

    //TEST function stakedByTokenInternal(address contractAddress, uint256 tokenId)
    let [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 2);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    //Unstaking tests
    await landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [0], 0);

    //TEST function stakedByOwnerInternal(address contractAddress, address owner)
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(1), ethers.BigNumber.from(2)]); //Order not promised
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);
    expect(stakedTimestamps.length).equal(2);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);

    //TEST function stakedByLandInternal(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 0);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(1), ethers.BigNumber.from(2)]); //Order not promised
    expect(stakedTimestamps.length).equal(2);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address, accounts[0].address]);

    //TEST function stakedByTokenInternal(address contractAddress, uint256 tokenId)
    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 0);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.eql(0);

    //Stake into other land
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [3, 4], 1);

    //TEST function stakedByOwnerInternal(address contractAddress, address owner)
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(4);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(1), ethers.BigNumber.from(2), ethers.BigNumber.from(3), ethers.BigNumber.from(4)]); //Order not promised
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(1)]);
    expect(stakedTimestamps.length).equal(4);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[2]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[3]).toNumber()).to.be.greaterThan(0);

    //TEST function stakedByLandInternal(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 0);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(1), ethers.BigNumber.from(2)]); //Order not promised
    expect(stakedTimestamps.length).equal(2);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address, accounts[0].address]);

    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 1);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(3), ethers.BigNumber.from(4)]); //Order not promised
    expect(stakedTimestamps.length).equal(2);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address, accounts[0].address]);

    //TEST function stakedByTokenInternal(address contractAddress, uint256 tokenId)
    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 0);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.eql(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 1);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 2);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 3);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(1);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 4);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(1);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    //Unstake 1 NFT each from 2 land
    await landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [2], 0);
    await landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [3], 1);

    //TEST function stakedByOwnerInternal(address contractAddress, address owner)
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(1), ethers.BigNumber.from(4)]); //Order not promised
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1)]);
    expect(stakedTimestamps.length).equal(2);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);

    //TEST function stakedByLandInternal(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 0);
    expect(stakedIds.length).equal(1);
    expect(stakedIds).to.eql([ethers.BigNumber.from(1)]);
    expect(stakedTimestamps.length).equal(1);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address]);

    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 1);
    expect(stakedIds.length).equal(1);
    expect(stakedIds).to.eql([ethers.BigNumber.from(4)]);
    expect(stakedTimestamps.length).equal(1);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address]);

    //TEST function stakedByTokenInternal(address contractAddress, uint256 tokenId)
    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 0);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.eql(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 1);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 2);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.eql(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 3);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.eql(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByTokenInternal(y1Contract.address, 4);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(1);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    await landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [1], 0);

    //Stake & Unstake for another type of NFT
    await landContract.connect(accounts[1]).stakeInternal(y2Contract.address, [10, 11], 10);
    await landContract.connect(accounts[1]).unstakeInternal(y2Contract.address, [10, 11], 10);
  });

  it("STAKE ON LAND - EXTERNAL HELPERS", async () => {
    //Stake CS1 into Land ID 0
    await landContract.connect(accounts[0]).stake(y1Contract.address, [0], 0);
    await landContract.connect(accounts[0]).stake(y1Contract.address, [1, 2], 0);
    await landContract.connect(accounts[1]).stake(y1Contract.address, [10, 11], 0);
    await landContract.connect(accounts[2]).stake(y1Contract.address, [20], 0);

    //TEST function stakedByOwner(address contractAddress, address owner)
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(3);
    expect(stakedIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(2)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);

    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[1].address);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.eql([ethers.BigNumber.from(10), ethers.BigNumber.from(11)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);

    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[2].address);
    expect(stakedIds.length).equal(1);
    expect(stakedIds).to.eql([ethers.BigNumber.from(20)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0)]);

    //TEST function stakedByLand(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLand(y1Contract.address, 0);
    expect(stakedIds.length).equal(6);
    expect(stakedIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(2), ethers.BigNumber.from(10), ethers.BigNumber.from(11), ethers.BigNumber.from(20)]);
    expect(stakedTimestamps.length).equal(6);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[2]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[3]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[4]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[5]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.eql([accounts[0].address, accounts[0].address, accounts[0].address, accounts[1].address, accounts[1].address, accounts[2].address]);

    //TEST function stakedByToken(address contractAddress, uint256 tokenId)
    let [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 0);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 1);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 2);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 10);
    expect(owner).to.equal(accounts[1].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 11);
    expect(owner).to.equal(accounts[1].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 20);
    expect(owner).to.equal(accounts[2].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    //Unstaking tests
    await landContract.connect(accounts[0]).unstake(y1Contract.address, [1], 0);
    await landContract.connect(accounts[1]).unstake(y1Contract.address, [10], 0);
    await landContract.connect(accounts[2]).unstake(y1Contract.address, [20], 0);

    //TEST function stakedByOwner(address contractAddress, address owner)
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(2);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(0), ethers.BigNumber.from(2)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);

    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[1].address);
    expect(stakedIds.length).equal(1);
    expect(stakedIds).to.eql([ethers.BigNumber.from(11)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0)]);

    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[2].address);
    expect(stakedIds.length).equal(0);
    expect(stakedIds).to.eql([]);
    expect(landIds).to.eql([]);

    //TEST function stakedByLand(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLand(y1Contract.address, 0);
    expect(stakedIds.length).equal(3);
    expect(stakedIds).to.have.deep.members([ethers.BigNumber.from(0), ethers.BigNumber.from(2), ethers.BigNumber.from(11)]);
    expect(stakedTimestamps.length).equal(3);
    expect(ethers.BigNumber.from(stakedTimestamps[0]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[1]).toNumber()).to.be.greaterThan(0);
    expect(ethers.BigNumber.from(stakedTimestamps[2]).toNumber()).to.be.greaterThan(0);
    expect(owners).to.have.deep.members([accounts[0].address, accounts[0].address, accounts[1].address]);

    //Enumerable set does not promise order, so we need to test the values returned by array are alligned
    for (let i = 0; i < owners.length; i++) {
      if (owners[i] === accounts[1].address) {
        expect(stakedIds[i]).equal(ethers.BigNumber.from(11));
      }
    }

    //TEST function stakedByToken(address contractAddress, uint256 tokenId)
    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 0);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 1);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.equal(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 2);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 10);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.equal(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 11);
    expect(owner).to.equal(accounts[1].address);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.be.greaterThan(0);

    [owner, landId, stakedTimestamp] = await landContract.stakedByToken(y1Contract.address, 20);
    expect(owner).to.equal(ethers.constants.AddressZero);
    expect(landId).to.equal(0);
    expect(ethers.BigNumber.from(stakedTimestamp).toNumber()).to.equal(0);

    //Stake & Unstake for another type of NFT
    await landContract.connect(accounts[1]).stake(y2Contract.address, [10, 11], 10);
    await landContract.connect(accounts[1]).unstake(y2Contract.address, [10, 11], 10);
  });

  it("Land upgrades", async () => {
    await expect(landContract.connect(accounts[0]).buyUpgrades(0, 32, 50)).to.be.revertedWith("'This item does not belong to your colony!'");
    await expect(landContract.connect(accounts[1]).buyUpgrades(0, 32, 50)).to.be.revertedWith("You do not own this land!");
    await expect(landContract.connect(accounts[0]).buyUpgrades(0, 4, 50)).to.be.revertedWith("This item does not belong to your colony!");

    await landContract.connect(accounts[0]).buyUpgrades(0, 3, ethers.utils.parseEther("100"));
    let itemPrice = await landContract.landToItem(0, 3);
    expect(itemPrice).to.eql(ethers.utils.parseEther("100"));

    await landContract.connect(accounts[0]).buyUpgrades(0, 3, ethers.utils.parseEther("150"));
    itemPrice = await landContract.landToItem(0, 3);
    expect(itemPrice).to.eql(ethers.utils.parseEther("250"));

    await landContract.connect(accounts[0]).buyUpgrades(0, 9, ethers.utils.parseEther("15"));
    itemPrice = await landContract.landToItem(0, 9);
    expect(itemPrice).to.eql(ethers.utils.parseEther("15"));

    await landContract.connect(accounts[0]).buyUpgrades(1, 12, ethers.utils.parseEther("51"));
    itemPrice = await landContract.landToItem(1, 12);
    expect(itemPrice).to.eql(ethers.utils.parseEther("51"));
  });

  it("All the remaining Functions", async () => {
    await landContract["safeTransferFrom(address,address,uint256)"](accounts[0].address, accounts[1].address, 5);
    const [...tokens] = await landContract.getTokenIDs(accounts[0].address);
    expect(await tokens.length).to.equal(9);

    await expect(landContract["safeTransferFrom(address,address,uint256)"](accounts[0].address, accounts[1].address, 15)).to.be.revertedWith("TransferFromIncorrectOwner()");
    await expect(landContract["safeTransferFrom(address,address,uint256)"](accounts[2].address, accounts[1].address, 15)).to.be.revertedWith("TransferFromIncorrectOwner()");

    await expect(landContract.connect(accounts[0]).approve(accounts[1].address, 40)).to.be.revertedWith("OwnerQueryForNonexistentToken()");

    await landContract.setTankPrices([2, 3, 6]);
    let tankPrice0 = await landContract.tankPrices(0);
    expect(tankPrice0).to.eql(ethers.BigNumber.from(2));

    expect(await landContract.tankLevelOfOwner(accounts[0].address)).to.equal(1);
    await landContract.connect(accounts[0]).upgradeTank();
    expect(await landContract.tankLevelOfOwner(accounts[0].address)).to.equal(2);

    transferLogic = await landContract.transferLogicEnabled();
    expect(transferLogic).to.be.false;
    await landContract.toggleTransferLogic();
    transferLogic = await landContract.transferLogicEnabled();
    expect(transferLogic).to.be.true;

    proxyEnabled = await landContract.openseaProxyEnabled();
    expect(proxyEnabled).to.be.true;
    await landContract.toggleOpenseaProxy();
    proxyEnabled = await landContract.openseaProxyEnabled();
    expect(proxyEnabled).to.be.false;

    sameColonyEnabled = await landContract.upgradeSameColonyEnabled();
    expect(sameColonyEnabled).to.be.true;
    await landContract.toggleUpgradeSameColony();
    sameColonyEnabled = await landContract.upgradeSameColonyEnabled();
    expect(sameColonyEnabled).to.be.false;

    saleEnabled = await landContract.saleEnabled();
    expect(saleEnabled).to.be.true;
    await landContract.toggleSale();
    saleEnabled = await landContract.saleEnabled();
    expect(saleEnabled).to.be.false;

    await landContract.renounceOwnership();
    await expect(landContract.setBaseURI("a")).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Gaurav tests", async () => {
    //Stake one CS1 into Land ID 0
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [0], 0);

    //Stake few CS1 into Land ID 0
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [1, 2, 3], 0);
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [8], 0);

    await landContract.updateContract(y2Contract.address, false);
    await expect(landContract.connect(accounts[0]).stakeInternal(y2Contract.address, [4, 5, 6], 5)).to.be.revertedWith("Token contract is not active"); //checked it for understanding the code
    await landContract.updateContract(y2Contract.address, true);
    await landContract.connect(accounts[0]).stakeInternal(y2Contract.address, [4, 5, 6], 5);

    await expect(landContract.connect(accounts[1]).stakeInternal(y1Contract.address, [8], 0)).to.be.revertedWith("You do not own this land!");
    await expect(landContract.connect(accounts[1]).stakeInternal(y2Contract.address, [8], 13)).to.be.revertedWith("TransferFromIncorrectOwner()");
    await landContract.connect(accounts[1]).stakeInternal(y2Contract.address, [13], 13);

    await expect(landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [7, 8], 12)).to.be.revertedWith("You do not own this land!");
    //Stake one CS1 into Land ID 10
    await landContract.connect(accounts[1]).stakeInternal(y1Contract.address, [10], 10);
    //Stake few CS1 into Land ID 10
    await landContract.connect(accounts[1]).stakeInternal(y1Contract.address, [11, 12, 13], 10);

    await expect(landContract.connect(accounts[1]).stakeInternal(y2Contract.address, [13], 13)).to.be.revertedWith("TransferFromIncorrectOwner()");

    await expect(landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [10], 9)).to.be.revertedWith("Token is not staked"); // here token is staked but not owned by the account 0, wrong message
    await expect(landContract.connect(accounts[2]).stakeInternal(y1Contract.address, [21, 22], 9)).to.be.revertedWith("You do not own this land!");
    await expect(landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [1, 2, 11], 0)).to.be.revertedWith("Token is not staked");

    await expect(landContract.connect(accounts[2]).unstakeInternal(y1Contract.address, [1, 2, 11], 0)).to.be.revertedWith("You do not own this land!");
    await landContract.connect(accounts[2]).stakeInternal(y1Contract.address, [21, 22], 20);
    await expect(landContract.connect(accounts[2]).stakeInternal(y1Contract.address, [21, 17], 20)).to.be.revertedWith("TransferFromIncorrectOwner()");

    //TEST function stakedByOwnerInternal(address contractAddress, address owner)
    let [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(5);
    expect(stakedIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(2), ethers.BigNumber.from(3), ethers.BigNumber.from(8)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);
    expect(parseInt(stakedTimestamps[0])).greaterThan(0);

    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y2Contract.address, accounts[1].address);
    expect(stakedIds.length).equal(1);
    expect(stakedIds).to.eql([ethers.BigNumber.from(13)]);
    expect(landIds).to.eql([ethers.BigNumber.from(13)]);
    expect(parseInt(stakedTimestamps[0])).greaterThan(0);

    //TEST function stakedByLandInternal(address contractAddress, uint256 landId)
    let [LstakedIds, LstakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 0);
    expect(LstakedIds.length).equal(5);
    expect(parseInt(LstakedTimestamps[0])).greaterThan(0);
    for (let i = 0; i < LstakedIds.length; i++) {
      for_owner = owners[i];
      if (for_owner == accounts[0]) {
        expect(LstakedIds).lessThan(10);
      } else if (for_owner == accounts[1]) {
        expect(LstakedIds).greaterThan(9);
        expect(LstakedIds).lessThan(20);
      }
    }

    //TEST function stakedByTokenInternal(address contractAddress, uint256 tokenId)
    let [owner, landId, TimestampInternal] = await landContract.stakedByTokenInternal(y1Contract.address, 1);
    expect(owner).to.equal(accounts[0].address);
    expect(landId).to.equal(0);

    await landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [1, 2], 0);
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(3);

    contract = await ethers.getContractFactory("Y2123");
    y3Contract = await contract.deploy(cs_uri, landContract.address, proxyContract.address);
    await y3Contract.deployed();
    await expect(landContract.connect(accounts[0]).stakeInternal(y3Contract.address, [0], 0)).to.be.revertedWith("Token contract is not active");

    await expect(landContract.connect(accounts[1]).addContract(y2Contract.address)).to.be.revertedWith("Ownable: caller is not the owner");

    /** STAKE ON LAND - EXTERNAL HELPERS */

    //Stake one CS1 into Land ID 0
    await landContract.connect(accounts[0]).stake(y1Contract.address, [4], 0);
    await expect(landContract.connect(accounts[0]).stake(y1Contract.address, [25], 0)).to.be.revertedWith("TransferFromIncorrectOwner()");

    //Stake few CS1 into Land ID 0
    await landContract.connect(accounts[0]).stake(y1Contract.address, [5, 6, 7], 0);
    await landContract.connect(accounts[0]).stake(y1Contract.address, [1, 2], 0); // it was already staked before
    await expect(landContract.connect(accounts[0]).stake(y1Contract.address, [8], 15)).to.be.revertedWith("TransferFromIncorrectOwner()");
    await landContract.connect(accounts[0]).unstakeInternal(y1Contract.address, [8], 0);
    await landContract.connect(accounts[0]).stake(y1Contract.address, [8], 15);
    await expect(landContract.connect(accounts[0]).stake(y1Contract.address, [8], 35)).to.be.revertedWith("'Value higher than total supply'");
    await landContract.updateContract(y1Contract.address, false);
    await expect(landContract.connect(accounts[0]).stake(y1Contract.address, [8], 35)).to.be.revertedWith("Token contract is not active");
    await landContract.updateContract(y1Contract.address, true);

    //Stake one CS1 into Land ID 0
    await landContract.connect(accounts[1]).stake(y1Contract.address, [14], 0);
    //Stake few CS1 into Land ID 0
    await landContract.connect(accounts[1]).stake(y1Contract.address, [15, 16, 17], 0);
    await landContract.connect(accounts[1]).stake(y1Contract.address, [18, 19], 2);

    //TEST function stakedByOwner(address contractAddress, address owner)
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwner(y1Contract.address, accounts[1].address);
    expect(stakedIds.length).equal(6);
    expect(stakedIds).to.eql([ethers.BigNumber.from(14), ethers.BigNumber.from(15), ethers.BigNumber.from(16), ethers.BigNumber.from(17), ethers.BigNumber.from(18), ethers.BigNumber.from(19)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(2), ethers.BigNumber.from(2)]);
    expect(parseInt(stakedTimestamps[0])).greaterThan(0);

    //TEST function stakedByLand(address contractAddress, uint256 landId)
    [stakedIds, stakedTimestamps, owners] = await landContract.stakedByLand(y1Contract.address, 15);
    expect(stakedIds.length).equal(1);
    expect(stakedIds).to.eql([ethers.BigNumber.from(8)]);
    expect(owners).to.eql([accounts[0].address]);
    expect(parseInt(stakedTimestamps[0])).greaterThan(0);

    //TEST function stakedByToken(address contractAddress, uint256 tokenId)
    [owner, landId, TimestampInternal] = await landContract.stakedByToken(y1Contract.address, 17);
    expect(owner).to.equal(accounts[1].address);
    expect(landId).to.equal(0);
    expect(parseInt(stakedTimestamps[0])).greaterThan(0);
  });
});
