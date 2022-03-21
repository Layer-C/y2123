//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

/*

Y2123 Land

y2123.com

*/

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "erc721a/contracts/ERC721A.sol";
import "./ILand.sol";
import "./IOxygen.sol";

contract Land is ERC721A, Ownable, ReentrancyGuard {
  address public y2123Nft;
  IOxygen public oxgnToken;

  uint256 public MAX_SUPPLY = 500;
  string private baseURI;
  uint256 public mintPrice = 0.063 ether;
  bool public saleEnabled = true;

  event Minted(address indexed addr, uint256 indexed id, bool recipientOrigin);
  event Burned(uint256 indexed id);
  event SaleActive(bool active);
  event Stake(uint256 tokenId, address contractAddress, address owner, uint256 indexed landTokenId);
  event Unstake(uint256 tokenId, address contractAddress, address owner);

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

  /** STAKING */

  using Counters for Counters.Counter;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  struct StakedContract {
    bool active;
    IERC721 instance;
  }

  mapping(address => mapping(address => EnumerableSet.UintSet)) addressToStakedTokensSet;
  mapping(address => mapping(uint256 => address)) contractTokenIdToOwner;
  mapping(address => mapping(uint256 => uint256)) contractTokenIdToStakedTimestamp;
  mapping(address => StakedContract) public contracts;
  mapping(address => Counters.Counter) addressToNonce;

  EnumerableSet.AddressSet activeContracts;

  modifier ifContractExists(address contractAddress) {
    require(activeContracts.contains(contractAddress), "contract does not exists");
    _;
  }

  modifier incrementNonce() {
    addressToNonce[_msgSender()].increment();
    _;
  }

  function stake(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 landTokenId
  ) external incrementNonce nonReentrant {
    StakedContract storage _contract = contracts[contractAddress];
    require(_contract.active, "token contract is not active");

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      contractTokenIdToOwner[contractAddress][tokenId] = _msgSender();
      _contract.instance.transferFrom(_msgSender(), address(this), tokenId);
      addressToStakedTokensSet[contractAddress][_msgSender()].add(tokenId);
      contractTokenIdToStakedTimestamp[contractAddress][tokenId] = block.timestamp;

      emit Stake(tokenId, contractAddress, _msgSender(), landTokenId);
    }
  }

  function unstake(address contractAddress, uint256[] memory tokenIds) external incrementNonce ifContractExists(contractAddress) nonReentrant {
    StakedContract storage _contract = contracts[contractAddress];

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      require(addressToStakedTokensSet[contractAddress][_msgSender()].contains(tokenId), "token is not staked");

      delete contractTokenIdToOwner[contractAddress][tokenId];
      _contract.instance.transferFrom(address(this), _msgSender(), tokenId);
      addressToStakedTokensSet[contractAddress][_msgSender()].remove(tokenId);
      delete contractTokenIdToStakedTimestamp[contractAddress][tokenId];

      emit Unstake(tokenId, contractAddress, _msgSender());
    }
  }

  function stakedTokensOfOwner(address contractAddress, address owner) public view ifContractExists(contractAddress) returns (uint256[] memory) {
    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[contractAddress][owner];
    uint256[] memory tokenIds = new uint256[](userTokens.length());

    for (uint256 i = 0; i < userTokens.length(); i++) {
      tokenIds[i] = userTokens.at(i);
    }

    return tokenIds;
  }

  function stakedOfOwner(address contractAddress, address owner) public view ifContractExists(contractAddress) returns (uint256[] memory stakedIds, uint256[] memory stakedTimestamps) {
    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[contractAddress][owner];
    stakedIds = new uint256[](userTokens.length());
    stakedTimestamps = new uint256[](userTokens.length());

    for (uint256 i = 0; i < userTokens.length(); i++) {
      uint256 tokenId = userTokens.at(i);
      stakedIds[i] = tokenId;
      stakedTimestamps[i] = contractTokenIdToStakedTimestamp[contractAddress][tokenId];
    }

    return (stakedIds, stakedTimestamps);
  }

  function stakedTokenTimestamp(address contractAddress, uint256 tokenId) public view ifContractExists(contractAddress) returns (uint256) {
    return contractTokenIdToStakedTimestamp[contractAddress][tokenId];
  }

  function addContract(address contractAddress) public onlyOwner {
    contracts[contractAddress].active = true;
    contracts[contractAddress].instance = IERC721(contractAddress);
    activeContracts.add(contractAddress);
  }

  function updateContract(address contractAddress, bool active) public onlyOwner ifContractExists(contractAddress) {
    require(activeContracts.contains(contractAddress), "contract not added");
    contracts[contractAddress].active = active;
  }

  function accountNonce(address accountAddress) public view returns (uint256) {
    return addressToNonce[accountAddress].current();
  }
}
