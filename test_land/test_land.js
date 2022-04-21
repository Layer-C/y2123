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
    expect(totSupply).to.equal(0);

    const [...tokenOwner] = await landContract.getTokenIDs(landContract.owner());
    expect(await tokenOwner.length).to.equal(0);

    await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));
    await landContract.paidMint(1);

    const [...tokenOwner1] = await landContract.getTokenIDs(landContract.owner());
    expect(await tokenOwner1.length).to.equal(1);

    totSupply = await landContract.totalSupply();
    expect(totSupply).to.equal(tokenOwner1.length);
  });
  /*
  it("Staking", async () => {
    //await yContract.addAdmin(cContract.address);
    await cContract.addContract(y1Contract.address);

    await y1Contract.setApprovalForAll(cContract.address, true);
    await cContract.stake(y1Contract.address, [0, 1, 2], 1);

    await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));
    await landContract.paidMint(1);

    await oContract.mint(y1Contract.owner(), ethers.utils.parseEther("1000.0"));
    // the code was showing some error will do it tomorrow.

    //await yContract.paidMint(3, []);

    //await landContract.stakedByOwner(yContract.address, yContract.owner);
  });

  it("Oxygen in Land", async () => {
    let nextLevel = await landContract.nextLevelTankPrice(landContract.owner());

    //await oContract.addAdmin(landContract.address);
    //await oContract.addAdmin(landContract.owner());
    //await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));

    //await landContract.upgradeTank();
    //let tankLevel = await landContract.tankLevelOfOwner(landContract.owner());
    //expect(tankLevel).to.equal(nextLevel);
  });
*/

  it("Staking into Land NFT", async () => {
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

    /** STAKE ON LAND - LAND OWNERS */

    //Stake one CS1 into Land ID 0
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [0], 0);
      
    
     //Stake few CS1 into Land ID 0
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [1, 2, 3], 0);
    await landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [8], 0);

    await landContract.updateContract(y2Contract.address, false);
    await expect(landContract.connect(accounts[0]).stakeInternal(y2Contract.address, [4, 5, 6], 5)).to.be.revertedWith("Token contract is not active"); //checked it for understanding the code
    await landContract.updateContract(y2Contract.address, true);
    await landContract.connect(accounts[0]).stakeInternal(y2Contract.address, [4, 5, 6], 5);

    await expect(landContract.connect(accounts[0]).stakeInternal(y1Contract.address, [7, 8], 12)).to.be.revertedWith("You do not own this land!");
    //Stake one CS1 into Land ID 10
    await landContract.connect(accounts[1]).stakeInternal(y1Contract.address, [10], 10);
    //Stake few CS1 into Land ID 10
    await landContract.connect(accounts[1]).stakeInternal(y1Contract.address, [11, 12, 13], 10);


    //TEST function stakedByOwnerInternal(address contractAddress, address owner)

    let [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y1Contract.address, accounts[0].address);
    expect(stakedIds.length).equal(5);
    expect(stakedIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(1), ethers.BigNumber.from(2), ethers.BigNumber.from(3), ethers.BigNumber.from(8)]);
    expect(landIds).to.eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0)]);
    [stakedIds, stakedTimestamps, landIds] = await landContract.stakedByOwnerInternal(y2Contract.address, accounts[1].address);
    expect(stakedIds.length).equal(0);
    //let uniqueLandIds = Array.from(new Set(landIds));
    //expect(uniqueLandIds).to.equal(1);
    //console.log(stakedTimestamps);


    //TEST function stakedByLandInternal(address contractAddress, uint256 landId)

    let [LstakedIds, LstakedTimestamps, owners] = await landContract.stakedByLandInternal(y1Contract.address, 0);
    expect(stakedIds.length).equal(5);
    expect(parseInt(LstakedTimestamps[0])).greaterThan(0);
    for (let i = 0; i < LstakedIds.length; i++) {

      for_owner = owners[i];
      if (for_owner == accounts[0]) {
        expect(LstakedIds).lessThan(10);
      }
      else if (for_owner == accounts[1]) {
        expect(LstakedIds).greaterThan(9)
        expect(LstakedIds).lessThan(20)
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
    //Stake few CS1 into Land ID 0
    await landContract.connect(accounts[0]).stake(y1Contract.address, [5, 6, 7], 0);

    //Stake one CS1 into Land ID 0
    await landContract.connect(accounts[1]).stake(y1Contract.address, [14], 0);
    //Stake few CS1 into Land ID 0
    await landContract.connect(accounts[1]).stake(y1Contract.address, [15, 16, 17], 0);

    //TEST function stakedByOwner(address contractAddress, address owner)
    //TEST function stakedByLand(address contractAddress, uint256 landId)
    //TEST function stakedByToken(address contractAddress, uint256 tokenId)


  });
  it("All the remaining Functions", async () => {

    await landContract.addContract(oContract.address); // it should have sent an error but it is not doing so, oContract is not an NFT contract, similarly it won't show error on another NFT contract
    await oContract.mint(accounts[0].address, ethers.utils.parseEther("100000.0"));
    await expect(landContract.connect(accounts[0]).approve(oContract.address, 4)).to.be.revertedWith("OwnerQueryForNonexistentToken()");


  });
});
