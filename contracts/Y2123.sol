//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

interface IOxygen {
    function transferTokens(address _from, address _to) external;
}

contract Y2123 is ERC721, ERC721Enumerable, Ownable {
    
    IOxygen public Oxygen;

    uint256 public MAX_SUPPLY = 500;
    uint256 public MAX_FREE_MINT = 50;
    uint256 public MAX_RESERVE_MINT = 50;
    uint256 MAX_SUPPLY_GENESIS = 500;

    string public baseURI;
    uint256 public mintPrice = 0.063 ether;
    uint256 public maxMintPerTx = 10;
    uint256 public maxMintPerAddress = 10;
    bool public saleEnabled = false;
    bool public presaleEnabled = false;

    uint256 public reserveMintCount = 0;
    uint256 public freeMintCount = 0;
    mapping(address => bool) freeMintAllowed;
    mapping(address => uint256) freeMintMinted;

    mapping(address => uint256) public nftCount;

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    modifier isSaleEnabled() {
        require(saleEnabled, "Cannot be sold yet.");
        _;
    }

    modifier isPresaleEnabled() {
        require(presaleEnabled, "Cannot be sold yet.");
        _;
    }

    constructor() ERC721("Y2123", "Y2123") {
        baseURI = "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/";
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function setMaxSupply(uint maxSupply) external onlyOwner{
        if (MAX_SUPPLY != maxSupply){
            require(maxSupply >= totalSupply(), "Supply lower than current balance" );
            MAX_SUPPLY = maxSupply;
        }
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function toggleSales() external onlyOwner {
        saleEnabled = !saleEnabled;
    }

    function togglePresales() external onlyOwner {
        presaleEnabled = !presaleEnabled;
    }

    function setMaxMintPerTx(uint256 newMaxMintPerTx) public onlyOwner {
        maxMintPerTx = newMaxMintPerTx;
    }

    function setMaxMintPerAddress(uint256 newMaxMintPerAddress) public onlyOwner {
        maxMintPerAddress = newMaxMintPerAddress;
    }

    function addFreeMint(address[] memory addr) public onlyOwner {
        for (uint256 i; i<addr.length; i++) {
            freeMintAllowed[addr[i]] = true;
            freeMintCount += 1;
        }
    }

    function checkFreeMint(address addr) public view returns (bool) {
        return freeMintAllowed[addr];
    }

    function setOxygen(address _oxygen) external onlyOwner { Oxygen = IOxygen(_oxygen); }

    function withdrawAll() external onlyOwner {
        require(payable(msg.sender).send(address(this).balance));
    }

    function getNFTCount(address addr) external view returns (uint256[] memory) {
        uint256 count = balanceOf(addr);

        uint256[] memory tokens = new uint256[](count);
        for (uint256 i; i<count; i++) {
            tokens[i] = tokenOfOwnerByIndex(addr, i);
        }

        return tokens;
    }

    // reserve NFT's for core team
    function reserve(uint256 amount) public onlyOwner {
        uint256 totalMinted = totalSupply();

        require(reserveMintCount + amount <= MAX_RESERVE_MINT, "Reserved more then available");

        for (uint256 i; i<amount; i++) {
            _safeMint(msg.sender, totalMinted + i);
            nftCount[msg.sender]++;
            reserveMintCount += 1;
        }
    }

    function freeMint() public payable isSaleEnabled {
        uint256 totalMinted = totalSupply();

        require(freeMintCount + 1 <= MAX_FREE_MINT, "No more supply");
        require(freeMintAllowed[msg.sender], "You are not on free nft list");
        require(freeMintMinted[msg.sender] < 1, "You already minted your free nft");

        _safeMint(msg.sender, totalMinted);
        nftCount[msg.sender]++;

        freeMintMinted[msg.sender] = 1;
        freeMintCount += 1;
    }

    function airDrop(uint[] calldata quantity, address[] calldata recipient) external onlyOwner {
        require(quantity.length == recipient.length, "Please provide equal quantities and recipients");

        uint totalQuantity = 0;
        uint256 supply = totalSupply();
        for(uint i = 0; i < quantity.length; ++i) {
            totalQuantity += quantity[i];
        }
        require(supply + totalQuantity <= MAX_SUPPLY, "Not enough supply");
        delete totalQuantity;

        for(uint i = 0; i < recipient.length; ++i) {
            for(uint j = 0; j < quantity[i]; ++j) {
                _safeMint(recipient[i], supply++);
                nftCount[recipient[i]]++;
            }
        }
    }

    function paidMint(uint256 amount) public payable isSaleEnabled {
        uint256 totalMinted = totalSupply();

        require(amount <= maxMintPerTx, "Exceed max mint per tx");
        require(amount * mintPrice <= msg.value, "More money please");
        require(amount + totalMinted <= (MAX_SUPPLY - MAX_FREE_MINT - MAX_RESERVE_MINT), "Please try minting with less");

        for (uint256 i;i<amount;i++) {
            _safeMint(msg.sender, totalMinted + i);
            nftCount[msg.sender]++;
        }
    }
 
    function transferFrom(address from, address to, uint256 tokenId) public override isSaleEnabled {
        Oxygen.transferTokens(from, to);
        nftCount[from]--;
        nftCount[to]++;
        ERC721.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public override isSaleEnabled {
        Oxygen.transferTokens(from, to);
        nftCount[from]--;
        nftCount[to]++;
        ERC721.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override isSaleEnabled {
        Oxygen.transferTokens(from, to);
        nftCount[from]--;
        nftCount[to]++;
        ERC721.safeTransferFrom(from, to, tokenId, data);
    }
}