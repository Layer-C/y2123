const { expect } = require("chai");

describe("Land Contract", function () {
  let landContract, oContract, cContract, y1Contract, y2Contract, accounts;
  const land_uri = "https://api.y2123.io/land-asset?id=";
  const cs_uri = "https://api.y2123.io/asset?id=";
  const clan_uri = "https://api.y2123.io/clan-asset?id=";
  const proxyRegistryAddress = "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A";

  beforeEach(async () => {
    //Deploy the ERC20 Oxygen contract
    let contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    //So you can mint OXGN using accounts[0]
    accounts = await ethers.getSigners();
    await oContract.addAdmin(accounts[0].address);

    //Deploy Clans contract so we can test buyUpgradesColony which uses ERC1155 clan tokens
    contract = await ethers.getContractFactory("contracts/Clans.sol:Clans");
    cContract = await contract.deploy(clan_uri, oContract.address, accounts[0].address);
    await cContract.deployed();

    //Deploy 2 different CS NFT contract so can be used to test stake into Land
    contract = await ethers.getContractFactory("Y2123");
    y1Contract = await contract.deploy(cs_uri, cContract.address, proxyRegistryAddress);
    await y1Contract.deployed();
    y2Contract = await contract.deploy(cs_uri, cContract.address, proxyRegistryAddress);
    await y2Contract.deployed();

    //Finally we deploy the land contract
    contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(land_uri, oContract.address, cContract.address, proxyRegistryAddress);
    await landContract.deployed();

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

  it("Staking", async () => {
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
});