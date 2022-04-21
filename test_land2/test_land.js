const { expect } = require("chai");

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

    //Deploy Clans contract so we can test buyUpgradesColony which uses ERC1155 clan tokens
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

    //TEST function stakedByOwnerInternal(address contractAddress, address owner)
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
  });
});
