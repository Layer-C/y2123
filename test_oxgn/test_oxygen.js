const { expect } = require('chai');

describe("Oxygen functions", function () {
    beforeEach(async () => {
        contract = await ethers.getContractFactory("Y2123");
        const uri = "https://api.y2123.io/asset?id=";
        yContract = await contract.deploy(uri);
        await yContract.deployed();

        y2Contract = await contract.deploy(uri);
        await y2Contract.deployed();

        contract = await ethers.getContractFactory("Oxygen");
        oContract = await contract.deploy();
        await oContract.deployed();

         contract = await ethers.getContractFactory("Clans");
         const clan_uri = "https://api.y2123.io/clan-asset?id=";
         cContract = await contract.deploy(clan_uri, oContract.address, yContract.address);
         await cContract.deployed();
        cContract.addContract(y2Contract.address);
        
        await oContract.addAdmin(cContract.address);

        accounts = await ethers.getSigners();
        await oContract.addAdmin(accounts[0].address);
    });

    it("Oxgn functions", async () => {
        expect(await oContract.mintedCount()).to.equal(ethers.utils.parseEther("0"));
        expect(await oContract.burnedCount()).to.equal(ethers.utils.parseEther("0"));
        expect(await oContract.MAX_SUPPLY()).to.equal(ethers.BigNumber.from(0));
        expect(await oContract.rewardCount()).to.equal(ethers.BigNumber.from(0));
        expect(await oContract.donationCount()).to.equal(ethers.BigNumber.from(0));
        expect(await oContract.taxCount()).to.equal(ethers.BigNumber.from(0));
        expect(await oContract.tokenCapSet()).to.equal(false);

        await oContract.mint(accounts[0].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("100.0"));

        await oContract.mint(accounts[1].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("100.0"));

        await oContract.burn(accounts[0].address, ethers.utils.parseEther("50.0"));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("50.0"));

        await oContract.burn(accounts[1].address, ethers.utils.parseEther("50.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("50.0"));

        await expect(oContract.connect(accounts[1]).mint(accounts[0].address, ethers.utils.parseEther("100.0"))).to.be.revertedWith("Only admins can mint");

        await expect(oContract.connect(accounts[1]).transferFrom(accounts[1].address, accounts[0].address, ethers.utils.parseEther("10.0"))).to.be.revertedWith("ERC20: insufficient allowance");

        await oContract.transferFrom(accounts[0].address, accounts[1].address, ethers.utils.parseEther("10.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("60.0"));

        await expect(oContract.transferFrom(accounts[0].address, accounts[1].address, ethers.utils.parseEther("100.0"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        expect(await oContract.mintedCount()).to.equal(ethers.utils.parseEther("200"));
        expect(await oContract.burnedCount()).to.equal(ethers.utils.parseEther("100"));
        expect(await oContract.totalSupply()).to.equal(ethers.utils.parseEther("100"));

        await oContract.donate(accounts[0].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("140.0"));

        await oContract.donate(accounts[1].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("160.0"));

        expect(await oContract.donationCount()).to.equal(ethers.utils.parseEther("200"));
        expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("200"));

        await oContract.tax(accounts[0].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("240.0"));

        await oContract.tax(accounts[1].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("260.0"));

        expect(await oContract.taxCount()).to.equal(ethers.utils.parseEther("200"));
        expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("400"));

        //REWARD
        await oContract.reward(accounts[0].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("340.0"));

        await oContract.reward(accounts[1].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("360.0"));

        expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("600"));

        //Set MaxSupply
        let supply = await oContract.totalSupply();
        await expect(oContract.setMaxSupply(supply)).to.be.revertedWith("Value is smaller than the number of existing tokens");

        await oContract.setMaxSupply(supply + ethers.utils.parseEther("1000.0"));

        await expect(oContract.setMaxSupply(supply + ethers.utils.parseEther("2000.0"))).to.be.revertedWith("Token cap has been already set");

        expect(await oContract.MAX_SUPPLY()).to.equal(supply + ethers.utils.parseEther("1000.0"));
        expect(await oContract.tokenCapSet()).to.equal(true);

        //REWARD AFTER SET MaxSupply
        await oContract.reward(accounts[0].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.utils.parseEther("440.0"));

        await oContract.reward(accounts[1].address, ethers.utils.parseEther("100.0"));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.utils.parseEther("460.0"));

        expect(await oContract.rewardCount()).to.equal(ethers.utils.parseEther("800"));
        expect(await oContract.balanceOf(oContract.address)).to.equal(ethers.utils.parseEther("100.0"));

        let maxSupply = await oContract.MAX_SUPPLY();
        await expect(oContract.reward(accounts[1].address, maxSupply)).to.be.revertedWith("Amount exceeds max cap or max cap reached!");

        await expect(oContract.reward(accounts[1].address, ethers.BigNumber.from(maxSupply).mul(2).div(5))).to.be.revertedWith("Amount exceeds 40% rewards pool!");

        let reserve = await oContract.balanceOf(oContract.address);
        await expect(oContract.withdrawReserve(accounts[1].address, reserve + ethers.utils.parseEther("1.0"))).to.be.revertedWith("amount exceeds balance");

        let acc0 = await oContract.balanceOf(accounts[0].address);
        let acc1 = await oContract.balanceOf(accounts[1].address);
        console.log("acc0 before withdrawReserve: " + acc0);
        console.log("acc1 before withdrawReserve: " + acc1);
        console.log("reserve before withdrawReserve: " + reserve);
        await oContract.connect(accounts[0]).withdrawReserve(accounts[1].address, ethers.BigNumber.from(reserve).div(2));
        expect(await oContract.balanceOf(oContract.address)).to.equal(ethers.BigNumber.from(reserve).div(2));
        expect(await oContract.balanceOf(accounts[1].address)).to.equal(ethers.BigNumber.from(acc1).add(ethers.BigNumber.from(reserve).div(2)));
        expect(await oContract.balanceOf(accounts[0].address)).to.equal(ethers.BigNumber.from(acc0));

        reserve = await oContract.balanceOf(oContract.address);
        acc0 = await oContract.balanceOf(accounts[0].address);
        acc1 = await oContract.balanceOf(accounts[1].address);
        console.log("acc0 after withdrawReserve: " + acc0);
        console.log("acc1 after withdrawReserve: " + acc1);
        console.log("reserve after withdrawReserve: " + reserve);

        //Burn half the reserve
        reserve = await oContract.balanceOf(oContract.address);
        console.log("Before burning half: " + reserve);
        await oContract.connect(accounts[0]).burnReserve(ethers.BigNumber.from(reserve).div(2));
        expect(await oContract.balanceOf(oContract.address)).to.equal(ethers.BigNumber.from(reserve).div(2));
        reserve = await oContract.balanceOf(oContract.address);
        console.log("After burning half: " + reserve);
    });

})