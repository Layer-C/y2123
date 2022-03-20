//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/*

Y2123 Land

y2123.com

*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "erc721a/contracts/ERC721A.sol";

contract Land is ERC721A, Ownable, ReentrancyGuard {
  mapping(address => bool) private admins;

  uint256 public MAX_SUPPLY = 500;
  string private baseURI;
  uint256 public mintPrice = 0.063 ether;
  bool public saleEnabled = true;

  event Minted(address indexed addr, uint256 indexed id, bool recipientOrigin);
  event Burned(uint256 indexed id);
  event SaleActive(bool active);

  constructor(string memory uri) ERC721A("Y2123.Land", "Y2123.Land") {
    baseURI = uri;
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

  function setMintPrice(uint256 newPrice) external onlyOwner {
    mintPrice = newPrice;
  }

  function toggleSale() external onlyOwner {
    saleEnabled = !saleEnabled;
    emit SaleActive(saleEnabled);
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

  function paidMint(uint256 amount) public payable nonReentrant {
    uint256 totalMinted = totalSupply();

    require(msg.sender == tx.origin);
    require(saleEnabled, "Sale not enabled");
    require(amount * mintPrice <= msg.value, "More ETH please");
    require(amount + totalMinted <= MAX_SUPPLY, "Please try minting with less, not enough supply!");

    _safeMint(msg.sender, amount);
  }
}
