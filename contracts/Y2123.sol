//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/*

Y2123 Game

Impact driven blockchain game with collaborative protocol.
Save our planet by completing missions.

https://y2123.com

*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IOxygen {
  function transferTokens(address _from, address _to) external;

  function burn(address user, uint256 amount) external;
}

contract Y2123 is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard {
  using MerkleProof for bytes32[];
  bytes32 merkleRoot;
  bytes32 freeRoot;

  IOxygen public Oxygen;
  IOxygen private stakingContract;

  uint256 public constant MAX_SUPPLY_GENESIS = 500;
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

  mapping(address => uint256) public freeMintMinted;
  mapping(address => uint256) public nftPerAddressCount;

  //event Mint(address owner, uint256 tokenId);
  event PresaleActive(bool active);
  event SaleActive(bool active);

  constructor() ERC721("Y2123", "Y2123") {
    baseURI = "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/";
    merkleRoot = 0x486048819872b8bad022b996e0de31aae3e5160b7c03de01a94d4bbadf4af63a;
    freeRoot = 0x486048819872b8bad022b996e0de31aae3e5160b7c03de01a94d4bbadf4af63a;
  }

  function setMerkleRoot(bytes32 root) public onlyOwner {
    merkleRoot = root;
  }

  function setFreeRoot(bytes32 root) public onlyOwner {
    freeRoot = root;
  }

  function _baseURI() internal view override returns (string memory) {
    return baseURI;
  }

  function setBaseURI(string memory newBaseURI) external onlyOwner {
    baseURI = newBaseURI;
  }

  function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
    if (MAX_SUPPLY != newMaxSupply) {
      require(newMaxSupply >= totalSupply(), "Value lower than total supply");
      MAX_SUPPLY = newMaxSupply;
    }
  }

  function setMaxReserveMint(uint256 newMaxReserveMint) external onlyOwner {
    if (MAX_RESERVE_MINT != newMaxReserveMint) {
      require(newMaxReserveMint >= reserveMintCount, "Value lower then reserve minted");
      MAX_RESERVE_MINT = newMaxReserveMint;
    }
  }

  function setMaxFreeMint(uint256 newMaxFreeMint) external onlyOwner {
    if (MAX_FREE_MINT != newMaxFreeMint) {
      require(newMaxFreeMint >= freeMintCount, "Value lower then free minted");
      MAX_FREE_MINT = newMaxFreeMint;
    }
  }

  function setMintPrice(uint256 newPrice) external onlyOwner {
    mintPrice = newPrice;
  }

  function toggleSale() external onlyOwner {
    saleEnabled = !saleEnabled;
    emit SaleActive(saleEnabled);
  }

  function togglePresale() external onlyOwner {
    presaleEnabled = !presaleEnabled;
    emit PresaleActive(presaleEnabled);
  }

  function toggleFreeMint() external onlyOwner {
    freeMintEnabled = !freeMintEnabled;
  }

  function setMaxMintPerTx(uint256 newMaxMintPerTx) public onlyOwner {
    maxMintPerTx = newMaxMintPerTx;
  }

  function setMaxMintPerAddress(uint256 newMaxMintPerAddress) public onlyOwner {
    maxMintPerAddress = newMaxMintPerAddress;
  }

  function getNFTCount(address addr) external view returns (uint256[] memory) {
    uint256 count = balanceOf(addr);

    uint256[] memory tokens = new uint256[](count);
    for (uint256 i; i < count; i++) {
      tokens[i] = tokenOfOwnerByIndex(addr, i);
    }

    return tokens;
  }

  function getMintOxygenCost(uint256 tokenId) public view returns (uint256) {
    if (tokenId <= MAX_SUPPLY_GENESIS) return 0;
    if (tokenId <= (MAX_SUPPLY * 2) / 5) return 20000 ether;
    if (tokenId <= (MAX_SUPPLY * 4) / 5) return 40000 ether;
    return 80000 ether;
  }

  // reserve NFT's for core team
  function reserve(uint256 amount) public onlyOwner {
    uint256 totalMinted = totalSupply();

    require(reserveMintCount + amount <= MAX_RESERVE_MINT, "Reserved more then available");

    for (uint256 i; i < amount; i++) {
      _safeMint(msg.sender, totalMinted + i);
      nftPerAddressCount[msg.sender]++;
      reserveMintCount += 1;
    }
  }

  function airDrop(address[] calldata recipient, uint256[] calldata quantity) external onlyOwner {
    require(quantity.length == recipient.length, "Please provide equal quantities and recipients");

    uint256 totalQuantity = 0;
    uint256 supply = totalSupply();
    for (uint256 i = 0; i < quantity.length; ++i) {
      totalQuantity += quantity[i];
    }
    require(supply + totalQuantity <= (MAX_SUPPLY - reserveMintUnclaimed - freeMintUnclaimed), "Not enough supply");
    delete totalQuantity;

    for (uint256 i = 0; i < recipient.length; ++i) {
      for (uint256 j = 0; j < quantity[i]; ++j) {
        _safeMint(recipient[i], supply++);
        nftPerAddressCount[recipient[i]]++;
      }
    }
  }

  function freeMint(bytes32[] memory proof) public payable nonReentrant {
    uint256 totalMinted = totalSupply();

    require(msg.sender == tx.origin);
    require(freeMintEnabled, "Free mint not enabled");
    require(proof.verify(freeRoot, keccak256(abi.encodePacked(msg.sender))), "You are not on the free list");
    require(freeMintCount + 1 <= MAX_FREE_MINT, "No more supply");
    require(freeMintMinted[msg.sender] < 1, "You already minted your free nft");

    _safeMint(msg.sender, totalMinted);
    nftPerAddressCount[msg.sender]++;

    freeMintMinted[msg.sender] = 1;
    freeMintCount += 1;
  }

  function paidMint(uint256 amount, bytes32[] memory proof) public payable nonReentrant {
    uint256 totalMinted = totalSupply();

    require(msg.sender == tx.origin);
    require(saleEnabled, "Sale not enabled");
    if (presaleEnabled == true) {
      require(proof.verify(merkleRoot, keccak256(abi.encodePacked(msg.sender))), "You are not on the whitelist");
    }
    require(amount <= maxMintPerTx, "Exceed max mint per tx");
    require(nftPerAddressCount[msg.sender] <= maxMintPerAddress, "Exceed max mint per address");
    require(amount * mintPrice <= msg.value, "More ETH please");
    require(amount + totalMinted <= (MAX_SUPPLY - reserveMintUnclaimed - freeMintUnclaimed), "Please try minting with less");

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

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Enumerable) returns (bool) {
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
    if (msg.sender != address(stakingContract)) {
      require(_isApprovedOrOwner(msg.sender, tokenId), "transfer not owner nor approved");
    }
    Oxygen.transferTokens(from, to);
    nftPerAddressCount[from]--;
    nftPerAddressCount[to]++;
    //ERC721.transferFrom(from, to, tokenId);
    _transfer(from, to, tokenId);
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
