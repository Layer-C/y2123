const { expect } = require("chai");

describe("Land Contract", function () {
  let landContract, accounts;
  const uri = "https://api.y2123.io/land-asset?id=";
  const oxgnAddress = "0x374EEBeCA0e2E23658072Df3Bd31A77f216490A0";
  const clansAddress = "0x93f5e53C1D31BFA6Ec4086C0Ca87411086D2E621";
  const proxyRegistryAddress = "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A";

  beforeEach(async () => {
    let contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(uri, oxgnAddress, clansAddress, proxyRegistryAddress);
    await landContract.deployed();

    contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    await oContract.addAdmin(landContract.address);

    accounts = await ethers.getSigners();
    await oContract.addAdmin(accounts[0].address);
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

    let contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(uri, oContract.address, clansAddress, proxyRegistryAddress);
    await landContract.deployed();


    let totSupply = await landContract.totalSupply();
    expect(totSupply).to.equal(0);

    const [...tokenOwner] = await landContract.getTokenIDs(landContract.owner());
    expect(await tokenOwner.length).to.equal(0);

    await oContract.addAdmin(landContract.address);
    await oContract.addAdmin(landContract.owner());
    //await oContract.removeAdmin(landContract.owner());
    await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));
    await landContract.paidMint(1);

    const [...tokenOwner1] = await landContract.getTokenIDs(landContract.owner());
    expect(await tokenOwner1.length).to.equal(1);

    totSupply = await landContract.totalSupply();
    expect(totSupply).to.equal(tokenOwner1.length);


  });

  it("Staking", async () => {

    contract = await ethers.getContractFactory("Y2123");
    const uri = "https://api.y2123.io/asset?id=";
    yContract = await contract.deploy(uri);
    await yContract.deployed();

    contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    contract = await ethers.getContractFactory("contracts/Clans.sol:Clans");
    const clan_uri = "https://api.y2123.io/clan-asset?id=";
    cContract = await contract.deploy(clan_uri, oContract.address, yContract.address);
    await cContract.deployed();

    contract = await ethers.getContractFactory("Land");
    const land_uri = "https://api.y2123.io/land-asset?id="
    landContract = await contract.deploy(land_uri, oContract.address, cContract.address, proxyRegistryAddress);
    await landContract.deployed();

    await oContract.addAdmin(landContract.address);
    await oContract.addAdmin(landContract.owner());

    await landContract.addContract(yContract.address);

    await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));
    await landContract.paidMint(1);

    await oContract.mint(yContract.owner(), ethers.utils.parseEther("1000.0"));
    // the code was showing some error will do it tomorrow.

    //await yContract.paidMint(3, []);

    //await landContract.stakedByOwner(yContract.address, yContract.owner);


  });

  it("Oxygen in Land", async () => {
    let contract = await ethers.getContractFactory("Oxygen");
    oContract = await contract.deploy();
    await oContract.deployed();

    contract = await ethers.getContractFactory("Land");
    landContract = await contract.deploy(uri, oContract.address, clansAddress, proxyRegistryAddress);
    await landContract.deployed();


    let nextLevel = await landContract.nextLevelTankPrice(landContract.owner());

    //await oContract.addAdmin(landContract.address);
    //await oContract.addAdmin(landContract.owner());
    //await oContract.mint(landContract.owner(), ethers.utils.parseEther("1000.0"));

    //await landContract.upgradeTank();
    //let tankLevel = await landContract.tankLevelOfOwner(landContract.owner());
    //expect(tankLevel).to.equal(nextLevel);


  });
});


