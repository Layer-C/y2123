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
  IOxygen public oxgnToken;
  uint256 public MAX_SUPPLY = 500;
  string private baseURI;
  uint256 public mintPrice = 500 ether;
  bool public saleEnabled = true;

  event Minted(address indexed addr, uint256 indexed id, bool recipientOrigin);
  event Burned(uint256 indexed id);
  event SaleActive(bool active);
  event Stake(uint256 tokenId, address contractAddress, address owner, uint256 indexed landTokenId);
  event Unstake(uint256 tokenId, address contractAddress, address owner, uint256 indexed landTokenId);
  event StakeInternal(uint256 tokenId, address contractAddress, address owner, uint256 indexed landTokenId);
  event UnstakeInternal(uint256 tokenId, address contractAddress, address owner, uint256 indexed landTokenId);

  constructor(string memory uri) ERC721A("Y2123.Land", "Y2123.Land") {
    baseURI = uri;
  }

  function _baseURI() internal view override returns (string memory) {
    return baseURI;
  }

  function setBaseURI(string memory newBaseURI) external onlyOwner {
    baseURI = newBaseURI;
  }

  function setOxgnContract(address _oxgnToken) public onlyOwner {
    oxgnToken = IOxygen(_oxgnToken);
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

  function getTokenIDs(address addr) public view returns (uint256[] memory) {
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

  function paidMint(uint256 amount) public nonReentrant {
    uint256 totalMinted = totalSupply();

    require(msg.sender == tx.origin);
    require(saleEnabled, "Sale not enabled");
    require(amount + totalMinted <= MAX_SUPPLY, "Please try minting with less, not enough supply!");

    oxgnToken.burn(_msgSender(), amount * mintPrice);

    _safeMint(msg.sender, amount);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public virtual override {
    safeTransferFrom(from, to, tokenId, "");
  }

  /** STAKING */

  using Counters for Counters.Counter;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  struct StakedContract {
    bool active;
    IERC721 instance;
  }
  mapping(address => StakedContract) public contracts;
  EnumerableSet.AddressSet activeContracts;

  modifier ifContractExists(address contractAddress) {
    require(activeContracts.contains(contractAddress), "contract does not exists");
    _;
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

  /** STAKE ON LAND - LAND OWNERS */

  mapping(address => mapping(uint256 => EnumerableSet.UintSet)) landToStakedTokensSetInternal;
  mapping(address => mapping(uint256 => uint256)) contractTokenIdToStakedTimestampInternal;

  function stakeInternal(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 landTokenId
  ) external nonReentrant {
    StakedContract storage _contract = contracts[contractAddress];
    require(_contract.active, "token contract is not active");
    require(ownerOf(landTokenId) == _msgSender());

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      _contract.instance.transferFrom(_msgSender(), address(this), tokenId);
      landToStakedTokensSetInternal[contractAddress][landTokenId].add(tokenId);
      contractTokenIdToStakedTimestampInternal[contractAddress][tokenId] = block.timestamp;

      emit StakeInternal(tokenId, contractAddress, _msgSender(), landTokenId);
    }
  }

  function unstakeInternal(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 landTokenId
  ) external ifContractExists(contractAddress) nonReentrant {
    require(ownerOf(landTokenId) == _msgSender());
    StakedContract storage _contract = contracts[contractAddress];

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      require(landToStakedTokensSetInternal[contractAddress][landTokenId].contains(tokenId), "token is not staked");

      _contract.instance.transferFrom(address(this), _msgSender(), tokenId);
      landToStakedTokensSetInternal[contractAddress][landTokenId].remove(tokenId);
      delete contractTokenIdToStakedTimestampInternal[contractAddress][tokenId];

      emit UnstakeInternal(tokenId, contractAddress, _msgSender(), landTokenId);
    }
  }

  function stakedByOwnerInternal(address contractAddress, address owner)
    public
    view
    ifContractExists(contractAddress)
    returns (
      uint256[] memory stakedIds,
      uint256[] memory stakedTimestamps,
      uint256[] memory landIds
    )
  {
    uint256[] memory landTokens = getTokenIDs(owner);
    uint256 totalStakedTokens;
    for (uint256 i = 0; i < landTokens.length; i++) {
      EnumerableSet.UintSet storage userTokens = landToStakedTokensSetInternal[contractAddress][landTokens[i]];
      totalStakedTokens += userTokens.length();
    }

    if (totalStakedTokens > 0) {
      stakedIds = new uint256[](totalStakedTokens);
      stakedTimestamps = new uint256[](totalStakedTokens);
      landIds = new uint256[](totalStakedTokens);

      uint256 index;
      for (uint256 i = 0; i < landTokens.length; i++) {
        EnumerableSet.UintSet storage userTokens = landToStakedTokensSetInternal[contractAddress][landTokens[i]];
        for (uint256 j = 0; j < userTokens.length(); j++) {
          landIds[index] = landTokens[i];
          stakedIds[index] = userTokens.at(j);
          stakedTimestamps[index] = contractTokenIdToStakedTimestampInternal[contractAddress][userTokens.at(j)];
          index++;
        }
      }
    }

    return (stakedIds, stakedTimestamps, landIds);
  }

  function stakedByLandInternal(address contractAddress, uint256 landId)
    public
    view
    ifContractExists(contractAddress)
    returns (
      uint256[] memory stakedIds,
      uint256[] memory stakedTimestamps,
      address[] memory owners
    )
  {
    EnumerableSet.UintSet storage stakedTokens = landToStakedTokensSetInternal[contractAddress][landId];
    stakedIds = new uint256[](stakedTokens.length());
    stakedTimestamps = new uint256[](stakedTokens.length());
    owners = new address[](stakedTokens.length());

    for (uint256 i = 0; i < stakedTokens.length(); i++) {
      uint256 tokenId = stakedTokens.at(i);
      stakedIds[i] = tokenId;
      stakedTimestamps[i] = contractTokenIdToStakedTimestampInternal[contractAddress][tokenId];
      owners[i] = ownerOf(landId);
    }

    return (stakedIds, stakedTimestamps, owners);
  }

  function stakedByTokenInternal(address contractAddress, uint256 tokenId)
    public
    view
    ifContractExists(contractAddress)
    returns (
      address,
      uint256,
      uint256
    )
  {
    uint256 total = totalSupply();
    uint256 landId;
    address owner;
    for (uint256 i; i < total; i++) {
      if (landToStakedTokensSetInternal[contractAddress][i].contains(tokenId)) {
        landId = i;
        owner = ownerOf(i);
        break;
      }
    }
    return (owner, landId, contractTokenIdToStakedTimestampInternal[contractAddress][tokenId]);
  }

  /** STAKE ON LAND - COLONY HELPERS */

  mapping(address => mapping(address => EnumerableSet.UintSet)) addressToStakedTokensSet;
  mapping(address => mapping(uint256 => address)) contractTokenIdToOwner;
  mapping(address => mapping(uint256 => uint256)) contractTokenIdToStakedTimestamp;
  mapping(address => mapping(uint256 => EnumerableSet.UintSet)) landToStakedTokensSet;
  mapping(address => mapping(address => EnumerableSet.UintSet)) addressToLandTokensSet;

  function stake(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 landTokenId
  ) external nonReentrant {
    StakedContract storage _contract = contracts[contractAddress];
    require(_contract.active, "token contract is not active");

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      contractTokenIdToOwner[contractAddress][tokenId] = _msgSender();
      _contract.instance.transferFrom(_msgSender(), address(this), tokenId);
      addressToStakedTokensSet[contractAddress][_msgSender()].add(tokenId);
      landToStakedTokensSet[contractAddress][landTokenId].add(tokenId);
      contractTokenIdToStakedTimestamp[contractAddress][tokenId] = block.timestamp;

      emit Stake(tokenId, contractAddress, _msgSender(), landTokenId);
    }

    if (!addressToLandTokensSet[contractAddress][_msgSender()].contains(landTokenId)) {
      addressToLandTokensSet[contractAddress][_msgSender()].add(landTokenId);
    }
  }

  function unstake(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 landTokenId
  ) external ifContractExists(contractAddress) nonReentrant {
    StakedContract storage _contract = contracts[contractAddress];

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      require(addressToStakedTokensSet[contractAddress][_msgSender()].contains(tokenId), "token is not staked");

      delete contractTokenIdToOwner[contractAddress][tokenId];
      _contract.instance.transferFrom(address(this), _msgSender(), tokenId);
      addressToStakedTokensSet[contractAddress][_msgSender()].remove(tokenId);
      landToStakedTokensSet[contractAddress][landTokenId].remove(tokenId);
      delete contractTokenIdToStakedTimestamp[contractAddress][tokenId];

      emit Unstake(tokenId, contractAddress, _msgSender(), landTokenId);
    }

    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[contractAddress][_msgSender()];
    bool allRemovedFromLand = true;
    for (uint256 i = 0; i < userTokens.length(); i++) {
      if (landToStakedTokensSet[contractAddress][landTokenId].contains(userTokens.at(i))) {
        allRemovedFromLand = false;
        break;
      }
    }
    if (allRemovedFromLand) {
      addressToLandTokensSet[contractAddress][_msgSender()].remove(landTokenId);
    }
  }

  function stakedByOwner(address contractAddress, address owner)
    public
    view
    ifContractExists(contractAddress)
    returns (
      uint256[] memory stakedIds,
      uint256[] memory stakedTimestamps,
      uint256[] memory landIds
    )
  {
    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[contractAddress][owner];
    stakedIds = new uint256[](userTokens.length());
    stakedTimestamps = new uint256[](userTokens.length());
    landIds = new uint256[](userTokens.length());

    for (uint256 i = 0; i < userTokens.length(); i++) {
      uint256 tokenId = userTokens.at(i);
      stakedIds[i] = tokenId;
      stakedTimestamps[i] = contractTokenIdToStakedTimestamp[contractAddress][tokenId];

      EnumerableSet.UintSet storage landTokens = addressToLandTokensSet[contractAddress][owner];
      for (uint256 j = 0; j < landTokens.length(); j++) {
        if (landToStakedTokensSet[contractAddress][landTokens.at(j)].contains(tokenId)) {
          landIds[i] = landTokens.at(j);
        }
      }
    }

    return (stakedIds, stakedTimestamps, landIds);
  }

  function stakedByLand(address contractAddress, uint256 landId)
    public
    view
    ifContractExists(contractAddress)
    returns (
      uint256[] memory stakedIds,
      uint256[] memory stakedTimestamps,
      address[] memory owners
    )
  {
    EnumerableSet.UintSet storage stakedTokens = landToStakedTokensSet[contractAddress][landId];
    stakedIds = new uint256[](stakedTokens.length());
    stakedTimestamps = new uint256[](stakedTokens.length());
    owners = new address[](stakedTokens.length());

    for (uint256 i = 0; i < stakedTokens.length(); i++) {
      uint256 tokenId = stakedTokens.at(i);
      stakedIds[i] = tokenId;
      stakedTimestamps[i] = contractTokenIdToStakedTimestamp[contractAddress][tokenId];
      owners[i] = contractTokenIdToOwner[contractAddress][tokenId];
    }

    return (stakedIds, stakedTimestamps, owners);
  }

  function stakedByToken(address contractAddress, uint256 tokenId)
    public
    view
    ifContractExists(contractAddress)
    returns (
      address,
      uint256,
      uint256
    )
  {
    address owner = contractTokenIdToOwner[contractAddress][tokenId];
    uint256 landId;
    EnumerableSet.UintSet storage landTokens = addressToLandTokensSet[contractAddress][owner];
    for (uint256 i = 0; i < landTokens.length(); i++) {
      if (landToStakedTokensSet[contractAddress][landTokens.at(i)].contains(tokenId)) {
        landId = landTokens.at(i);
        break;
      }
    }
    return (owner, landId, contractTokenIdToStakedTimestamp[contractAddress][tokenId]);
  }

  /** OXGN TANK */

  mapping(address => uint8) _addressToTankLevel;
  uint256[] public tankPrices = [500 ether, 1000 ether, 2000 ether, 4000 ether, 8000 ether, 16000 ether, 32000 ether, 64000 ether, 128000 ether];

  function upgradeTank() external nonReentrant {
    require(tankLevelOfOwner(_msgSender()) < tankPrices.length + 1, "tank is at max level");
    oxgnToken.burn(_msgSender(), nextLevelTankPrice(_msgSender()));
    _addressToTankLevel[_msgSender()]++;
  }

  function upgradeTank(address receiver) external onlyOwner {
    require(tankLevelOfOwner(receiver) < tankPrices.length + 1, "tank is at max level");
    _addressToTankLevel[receiver]++;
  }

  function nextLevelTankPrice(address owner) public view returns (uint256) {
    return tankPrices[_addressToTankLevel[owner]];
  }

  function tankLevelOfOwner(address owner) public view returns (uint256) {
    return _addressToTankLevel[owner] + 1;
  }

  function setTankPrices(uint256[] memory newPrices) external onlyOwner {
    tankPrices = newPrices;
  }
}
