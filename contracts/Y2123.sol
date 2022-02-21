//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/*

Y2123 Game

Impact driven blockchain game with collaborative protocol.
Save our planet by completing missions.

y2123.com

*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./ERC721A.sol";

contract Y2123 is ERC721A, Ownable, ReentrancyGuard {
  mapping(address => bool) private admins;

  using MerkleProof for bytes32[];
  bytes32 merkleRoot;
  bytes32 freeRoot;

  uint256 public MAX_SUPPLY = 500;
  uint256 public MAX_RESERVE_MINT = 35;
  uint256 public MAX_FREE_MINT = 15;

  string private baseURI;
  uint256 public mintPrice = 0.063 ether;
  uint256 public maxMintPerTx = 3;
  uint256 public maxMintPerAddress = 2;
  bool public presaleEnabled = false;
  bool public saleEnabled = true;
  bool public freeMintEnabled = false;
  uint256 public reserveMintCount = 0;
  uint256 public freeMintCount = 0;

  mapping(address => uint256) public freeMintMinted;
  mapping(address => uint256) public whitelistMinted;
  mapping(address => uint256) public addressMinted;

  event Minted(address indexed addr, uint256 indexed id, bool recipientOrigin);
  event Burned(uint256 indexed id);
  event PresaleActive(bool active);
  event SaleActive(bool active);

  constructor(string memory uri) ERC721A("Y2123", "Y2123") {
    baseURI = uri;
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
      require(newMaxSupply >= MAX_RESERVE_MINT + MAX_FREE_MINT, "Value lower than total reserve & free mints");
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
    require(newMaxMintPerTx > 0, "Value lower then 1");
    maxMintPerTx = newMaxMintPerTx;
  }

  function setMaxMintPerAddress(uint256 newMaxMintPerAddress) public onlyOwner {
    require(newMaxMintPerAddress > 0, "Value lower then 1");
    maxMintPerAddress = newMaxMintPerAddress;
  }

  function availableSupplyIndex() public view returns (uint256) {
    return (MAX_SUPPLY - MAX_RESERVE_MINT - MAX_FREE_MINT + reserveMintCount + freeMintCount);
  }

  function getTokenIDs(address addr) external view returns (uint256[] memory) {
    uint256 total = totalSupply();
    uint256 count = balanceOf(addr);
    uint256[] memory tokens = new uint256[](count);
    uint256 tokenIndex = 0;
    for (uint256 i; i < total; i++) {
      if (addr == ownerOf(i)) {
        tokens[tokenIndex] = i;
        tokenIndex++;
      }
    }
    return tokens;
  }

  // reserve NFT's for core team
  function reserve(uint256 amount) public onlyOwner {
    require(reserveMintCount + amount <= MAX_RESERVE_MINT, "Reserved more then available");

    _safeMint(msg.sender, amount);
    reserveMintCount += amount;
  }

  function airDrop(address[] calldata recipient, uint256[] calldata quantity) external onlyOwner {
    require(quantity.length == recipient.length, "Please provide equal quantities and recipients");

    uint256 totalQuantity = 0;
    uint256 supply = totalSupply();
    for (uint256 i = 0; i < quantity.length; ++i) {
      totalQuantity += quantity[i];
    }
    require(supply + totalQuantity <= availableSupplyIndex(), "Not enough supply");
    delete totalQuantity;

    for (uint256 i = 0; i < recipient.length; ++i) {
      _safeMint(recipient[i], quantity[i]);
    }
  }

  // ONLY 1 free mint per address throughout all collections
  function freeMint(bytes32[] memory proof) public nonReentrant {
    require(msg.sender == tx.origin);
    require(freeMintEnabled, "Free mint not enabled");
    require(proof.verify(freeRoot, keccak256(abi.encodePacked(msg.sender))), "You are not on the free list");
    require(freeMintCount + 1 <= MAX_FREE_MINT, "No more supply");
    require(freeMintMinted[msg.sender] < 1, "You already minted your free nft");

    _safeMint(msg.sender, 1);

    freeMintMinted[msg.sender] = 1;
    freeMintCount += 1;
  }

  function paidMint(uint256 amount, bytes32[] memory proof) public payable nonReentrant {
    uint256 totalMinted = totalSupply();

    require(msg.sender == tx.origin);
    require(saleEnabled, "Sale not enabled");
    require(amount * mintPrice <= msg.value, "More ETH please");
    require(amount + totalMinted <= availableSupplyIndex(), "Please try minting with less, not enough supply!");

    if (presaleEnabled == true) {
      require(proof.verify(merkleRoot, keccak256(abi.encodePacked(msg.sender))), "You are not on the whitelist");
      require(amount + whitelistMinted[msg.sender] <= maxMintPerAddress, "Exceeded max mint per address for whitelist, try minting with less");
    } else {
      require(amount <= maxMintPerTx, "Exceeded max mint per transaction");
    }

    _safeMint(msg.sender, amount);
    if (presaleEnabled == true) {
      whitelistMinted[msg.sender] += amount;
    }
  }

  function withdrawAll() external onlyOwner {
    require(payable(msg.sender).send(address(this).balance));
  }

  /** ADMIN */

  function addAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }
}
