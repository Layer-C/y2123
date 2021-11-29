//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/*

Y2123 Game

Impact driven blockchain game with collaborative protocol.
Save our planet by completing missions.

https://y2123.com

*/

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IOxygen {
    function transferTokens(address _from, address _to) external;

    function burn(address user, uint256 amount) external;
}

contract Y2123 is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
    IOxygen public Oxygen;

    uint256 public MAX_SUPPLY_GENESIS = 500;
    uint256 public MAX_SUPPLY = 500;
    uint256 public MAX_RESERVE_MINT = 50;
    uint256 public MAX_FREE_MINT = 50;

    string private baseURI;
    uint256 public mintPrice = 0.063 ether;
    uint256 public maxMintPerTx = 10;
    uint256 public maxMintPerAddress = 10;
    bool public presaleEnabled = true;
    bool public saleEnabled = false;
    bool public freeMintEnabled = false;

    uint256 public reserveMintCount = 0;
    uint256 public freeMintCount = 0;
    uint256 public reserveMintUnclaimed = MAX_RESERVE_MINT - reserveMintCount;
    uint256 public freeMintUnclaimed = MAX_FREE_MINT - freeMintCount;
    mapping(address => bool) public freeMintAllowed;
    mapping(address => uint256) public freeMintMinted;
    mapping(address => uint256) public nftPerAddressCount;

    constructor() ERC721("Y2123", "Y2123") {
        baseURI = "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/";
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        if (MAX_SUPPLY != newMaxSupply) {
            require(
                newMaxSupply >= totalSupply(),
                "Value lower than total supply"
            );
            MAX_SUPPLY = newMaxSupply;
        }
    }

    function setMaxReserveMint(uint256 newMaxReserveMint) external onlyOwner {
        if (MAX_RESERVE_MINT != newMaxReserveMint) {
            require(
                newMaxReserveMint <= totalSupply(),
                "Value higher than total supply"
            );
            MAX_RESERVE_MINT = newMaxReserveMint;
        }
    }

    function setMaxFreeMint(uint256 newMaxFreeMint) external onlyOwner {
        if (MAX_FREE_MINT != newMaxFreeMint) {
            require(
                newMaxFreeMint <= totalSupply(),
                "Value higher than total supply"
            );
            MAX_FREE_MINT = newMaxFreeMint;
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

    function toggleFreeMint() external onlyOwner {
        freeMintEnabled = !freeMintEnabled;
    }

    function setMaxMintPerTx(uint256 newMaxMintPerTx) public onlyOwner {
        maxMintPerTx = newMaxMintPerTx;
    }

    function setMaxMintPerAddress(uint256 newMaxMintPerAddress)
        public
        onlyOwner
    {
        maxMintPerAddress = newMaxMintPerAddress;
    }

    function addFreeMint(address[] memory addr) public onlyOwner {
        for (uint256 i; i < addr.length; i++) {
            freeMintAllowed[addr[i]] = true;
        }
    }

    function checkFreeMint(address addr) public view returns (bool) {
        return freeMintAllowed[addr];
    }

    function getNFTCount(address addr)
        external
        view
        returns (uint256[] memory)
    {
        uint256 count = balanceOf(addr);

        uint256[] memory tokens = new uint256[](count);
        for (uint256 i; i < count; i++) {
            tokens[i] = tokenOfOwnerByIndex(addr, i);
        }

        return tokens;
    }

    // reserve NFT's for core team
    function reserve(uint256 amount) public onlyOwner {
        uint256 totalMinted = totalSupply();

        require(
            reserveMintCount + amount <= MAX_RESERVE_MINT,
            "Reserved more then available"
        );

        for (uint256 i; i < amount; i++) {
            _safeMint(msg.sender, totalMinted + i);
            nftPerAddressCount[msg.sender]++;
            reserveMintCount += 1;
        }
    }

    function freeMint() public payable nonReentrant {
        uint256 totalMinted = totalSupply();

        require(freeMintEnabled, "Free mint not enabled");
        require(freeMintCount + 1 <= MAX_FREE_MINT, "No more supply");
        require(freeMintAllowed[msg.sender], "You are not on free list");
        require(
            freeMintMinted[msg.sender] < 1,
            "You already minted your free nft"
        );

        _safeMint(msg.sender, totalMinted);
        nftPerAddressCount[msg.sender]++;

        freeMintMinted[msg.sender] = 1;
        freeMintCount += 1;
    }

    function airDrop(address[] calldata recipient, uint256[] calldata quantity)
        external
        onlyOwner
    {
        require(
            quantity.length == recipient.length,
            "Please provide equal quantities and recipients"
        );

        uint256 totalQuantity = 0;
        uint256 supply = totalSupply();
        for (uint256 i = 0; i < quantity.length; ++i) {
            totalQuantity += quantity[i];
        }
        require(
            supply + totalQuantity <=
                (MAX_SUPPLY - reserveMintUnclaimed - freeMintUnclaimed),
            "Not enough supply"
        );
        delete totalQuantity;

        for (uint256 i = 0; i < recipient.length; ++i) {
            for (uint256 j = 0; j < quantity[i]; ++j) {
                _safeMint(recipient[i], supply++);
                nftPerAddressCount[recipient[i]]++;
            }
        }
    }

    function paidMint(uint256 amount) public payable nonReentrant {
        uint256 totalMinted = totalSupply();

        require(saleEnabled, "Sale not enabled");
        require(amount <= maxMintPerTx, "Exceed max mint per tx");
        require(
            amount <= nftPerAddressCount[msg.sender],
            "Exceed max mint per address"
        );
        require(amount * mintPrice <= msg.value, "More money please");
        require(
            amount + totalMinted <=
                (MAX_SUPPLY - reserveMintUnclaimed - freeMintUnclaimed),
            "Please try minting with less"
        );

        for (uint256 i; i < amount; i++) {
            _safeMint(msg.sender, totalMinted + i);
            nftPerAddressCount[msg.sender]++;
        }
    }

    function setOxygen(address _oxygen) external onlyOwner {
        Oxygen = IOxygen(_oxygen);
    }

    function withdrawAll() external onlyOwner {
        require(payable(msg.sender).send(address(this).balance));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        Oxygen.transferTokens(from, to);
        nftPerAddressCount[from]--;
        nftPerAddressCount[to]++;
        ERC721.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        Oxygen.transferTokens(from, to);
        nftPerAddressCount[from]--;
        nftPerAddressCount[to]++;
        ERC721.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override {
        Oxygen.transferTokens(from, to);
        nftPerAddressCount[from]--;
        nftPerAddressCount[to]++;
        ERC721.safeTransferFrom(from, to, tokenId, data);
    }
}
