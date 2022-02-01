// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IClans.sol";
import "./IOxygen.sol";

contract Clans is IClans, ERC1155, EIP712, Ownable, ReentrancyGuard {
  using Strings for uint256;
  string private baseURI;
  using Counters for Counters.Counter;
  Counters.Counter public clanIdTracker;
  bool public featureFlagCreateClan = true;
  bool public featureFlagSwitchColony = false;
  bool public featureFlagSuperDemote = false;
  uint256 public creatorInitialClanTokens = 100;
  uint256 public changeLeaderPercentage = 10;
  uint256 public createClanCostMultiplier = 100;
  uint256 public switchColonyCost = 10000;
  uint256 public switchClanCostBase = 10;
  uint256 public switchClanCostMultiplier = 100000;
  uint256 public updateRankCostMultiplierOxgn = 10;
  uint256 public updateRankCostMultiplierClanToken = 10;
  uint256 public clanRankCap = 5;
  uint256 public minClanInColony = 3;
  address public y2123Nft;
  IOxygen public oxgnToken;

  mapping(address => bool) private admins;
  mapping(uint256 => uint256) public clanToHighestOwnedCount;
  mapping(uint256 => address) public clanToHighestOwnedAccount;
  mapping(uint256 => uint256) public clanToColony;

  event Minted(address indexed addr, uint256 indexed id, uint256 amount, bool recipientOrigin);
  event Burned(address indexed addr, uint256 indexed id, uint256 amount);
  event ClanCreated(address indexed leader, uint256 indexed clanId, uint256 indexed colonyId);
  event SwitchColony(address indexed leader, uint256 indexed clanId, uint256 indexed colonyId);
  event ChangeLeader(address indexed oldLeader, address indexed newLeader, uint256 indexed clanId, uint256 clanTokens);
  event PromoteClanRank(address indexed addr, uint256 clanId, address indexed leader, uint256 rank, uint256 oxgnCost, uint256 clanTokenCost);
  event DemoteClanRank(address indexed addr, uint256 clanId, address indexed leader, uint256 rank, uint256 oxgnCost, uint256 clanTokenCost);
  event SwitchClan(address indexed addr, uint256 indexed oldClanId, uint256 indexed newClanId, uint256 switchClanCost);
  event Stake(uint256 tokenId, address contractAddress, address owner, uint256 indexed clanId);
  event Unstake(uint256 tokenId, address contractAddress, address owner);
  event Claim(address indexed addr, uint256 oxgnTokenClaim, uint256 oxgnTokenDonate, uint256 indexed clanId, uint256 clanTokenClaim, address indexed benificiaryOfTax, uint256 oxgnTokenTax);

  constructor(
    string memory _baseURI,
    address _oxgnToken,
    address _y2123Nft
  ) ERC1155(_baseURI) EIP712("y2123", "1.0") {
    baseURI = _baseURI;
    addAdmin(_msgSender());
    setTokenContract(_oxgnToken);
    addContract(_y2123Nft);
    y2123Nft = _y2123Nft;
    clanIdTracker.increment(); // start with clanId = 1
    createClan(1);
    createClan(2);
    createClan(3);
    featureFlagCreateClan = false;
  }

  function uri(uint256 clanId) public view override returns (string memory) {
    return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, clanId.toString())) : baseURI;
  }

  function toggleFeatureFlagCreateClan() external onlyOwner {
    featureFlagCreateClan = !featureFlagCreateClan;
  }

  function toggleFeatureFlagSwitchColony() external onlyOwner {
    featureFlagSwitchColony = !featureFlagSwitchColony;
  }

  function toggleFeatureFlagSuperDemote() external onlyOwner {
    featureFlagSuperDemote = !featureFlagSuperDemote;
  }

  function setChangeLeaderPercentage(uint256 newVal) public onlyOwner {
    require(changeLeaderPercentage > 0, "Value lower then 1");
    changeLeaderPercentage = newVal;
  }

  function setCreatorInitialClanTokens(uint256 newVal) public onlyOwner {
    creatorInitialClanTokens = newVal;
  }

  function setCreateClanCostMultiplier(uint256 newVal) public onlyOwner {
    createClanCostMultiplier = newVal;
  }

  function setSwitchColonyCost(uint256 newVal) public onlyOwner {
    switchColonyCost = newVal;
  }

  function setSwitchClanCostBase(uint256 newVal) public onlyOwner {
    switchClanCostBase = newVal;
  }

  function setSwitchClanCostMultiplier(uint256 newVal) public onlyOwner {
    switchClanCostMultiplier = newVal;
  }

  function setUpdateRankCostMultiplierOxgn(uint256 newVal) public onlyOwner {
    updateRankCostMultiplierOxgn = newVal;
  }

  function setUpdateRankCostMultiplierClanToken(uint256 newVal) public onlyOwner {
    updateRankCostMultiplierClanToken = newVal;
  }

  function setMinClanInColony(uint256 newVal) public onlyOwner {
    minClanInColony = newVal;
  }

  function shouldChangeLeader(
    address member,
    uint256 clanId,
    uint256 amount
  ) public view returns (bool) {
    //Check if already clan leader for this clan
    if (clanToHighestOwnedAccount[clanId] == member) {
      return false;
    }

    //Can't become leader if not in this clan
    if (clanStructs[member].clanId != clanId) {
      return false;
    }

    return amount > getChangeClanLeaderThreshold(clanId);
  }

  /** ADMIN */

  function setTokenContract(address _oxgnToken) public onlyOwner {
    oxgnToken = IOxygen(_oxgnToken);
  }

  function addAdmin(address addr) public onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) public onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }

  function mint(
    address recipient,
    uint256 id,
    uint256 amount
  ) external {
    require(admins[_msgSender()], "Admins only!");
    emit Minted(recipient, id, amount, tx.origin == recipient);
    _mint(recipient, id, amount, "");
  }

  function burn(uint256 id, uint256 amount) external {
    require(admins[_msgSender()], "Admins only!");
    require(balanceOf(tx.origin, id) != 0, "Oops you don't own that");
    emit Burned(tx.origin, id, amount);
    _burn(tx.origin, id, amount);
  }

  function _hash(
    address account,
    uint256 oxgnTokenClaim,
    uint256 oxgnTokenDonate,
    uint256 clanId,
    uint256 clanTokenClaim,
    address benificiaryOfTax,
    uint256 oxgnTokenTax,
    uint256 nonce
  ) internal view returns (bytes32) {
    return
      _hashTypedDataV4(
        keccak256(
          abi.encode(
            keccak256("Claim(address account,uint256 oxgnTokenClaim,uint256 oxgnTokenDonate,uint256 clanId,uint256 clanTokenClaim,address benificiaryOfTax,uint256 oxgnTokenTax,uint256 nonce)"),
            account,
            oxgnTokenClaim,
            oxgnTokenDonate,
            clanId,
            clanTokenClaim,
            benificiaryOfTax,
            oxgnTokenTax,
            nonce
          )
        )
      );
  }

  function recoverAddress(
    address account,
    uint256 oxgnTokenClaim,
    uint256 oxgnTokenDonate,
    uint256 clanId,
    uint256 clanTokenClaim,
    address benificiaryOfTax,
    uint256 oxgnTokenTax,
    uint256 nonce,
    bytes calldata signature
  ) public view returns (address) {
    return ECDSA.recover(_hash(account, oxgnTokenClaim, oxgnTokenDonate, clanId, clanTokenClaim, benificiaryOfTax, oxgnTokenTax, nonce), signature);
  }

  /** CLAIM & DONATE */

  address _signerAddress;

  function setSignerAddress(address signerAddress) external onlyOwner {
    _signerAddress = signerAddress;
  }

  struct ClaimInfo {
    uint256 oxgnTokenClaim;
    uint256 oxgnTokenDonate;
    uint256 clanId;
    uint256 clanTokenClaim;
    address benificiaryOfTax;
    uint256 oxgnTokenTax;
    uint256 nonce;
    uint256 blocktime;
  }
  mapping(address => ClaimInfo) public accountToLastClaim;

  // % tax assigned by a queue system
  function claim(
    uint256 oxgnTokenClaim,
    uint256 oxgnTokenDonate,
    uint256 clanId,
    uint256 clanTokenClaim,
    address benificiaryOfTax,
    uint256 oxgnTokenTax,
    bytes calldata signature
  ) external nonReentrant {
    require(oxgnTokenClaim > 0, "empty claim");
    require(_signerAddress == recoverAddress(_msgSender(), oxgnTokenClaim, oxgnTokenDonate, clanId, clanTokenClaim, benificiaryOfTax, oxgnTokenTax, accountNonce(_msgSender()), signature), "invalid signature");

    oxgnToken.mint(_msgSender(), oxgnTokenClaim);
    addressToNonce[_msgSender()].increment();
    accountToLastClaim[_msgSender()] = ClaimInfo(oxgnTokenClaim, oxgnTokenDonate, clanId, clanTokenClaim, benificiaryOfTax, oxgnTokenTax, accountNonce(_msgSender()), block.timestamp);

    if (oxgnTokenDonate > 0) {
      oxgnToken.mint(address(this), oxgnTokenDonate);
    }
    if (benificiaryOfTax != address(0) && oxgnTokenTax > 0) {
      oxgnToken.mint(benificiaryOfTax, oxgnTokenTax);
    }
    if (clanId > 0 && clanId < clanIdTracker.current() && clanTokenClaim > 0) {
      _mint(_msgSender(), clanId, clanTokenClaim, "");
    }

    emit Claim(_msgSender(), oxgnTokenClaim, oxgnTokenDonate, clanId, clanTokenClaim, benificiaryOfTax, oxgnTokenTax);
  }

  function withdrawForDonation() external onlyOwner {
    uint256 amount = oxgnToken.balanceOf(address(this));
    oxgnToken.transfer(_msgSender(), amount);
  }

  /** CLAN */

  function createClan(uint256 colonyId) public nonReentrant {
    require(featureFlagCreateClan, "feature not enabled");
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    require(!isClanLeader(_msgSender()), "clan leader can't create new clan");

    if (!admins[_msgSender()]) {
      require(isEntity(_msgSender()), "must be in a clan");

      uint256 cost = getCreateClanCost();
      if (cost > 0) {
        oxgnToken.burn(_msgSender(), cost);
      }
    }

    uint256 clanId = clanIdTracker.current();
    clanToColony[clanId] = colonyId;
    clanIdTracker.increment();
    emit ClanCreated(_msgSender(), clanId, colonyId);

    // Switch to created clan
    clanStructs[_msgSender()].clanId = clanId;
    clanStructs[_msgSender()].updateClanTimestamp = block.timestamp;
    // Reset rank
    clanStructs[_msgSender()].rank = 0; //Start from 0 or max rank?
    clanStructs[_msgSender()].updateRankTimestamp = block.timestamp;

    // Clan leader assigned to _msgSender() thru mint
    _mint(_msgSender(), clanId, creatorInitialClanTokens, "");
  }

  function switchColony(uint256 clanId, uint256 colonyId) external nonReentrant {
    require(featureFlagSwitchColony, "feature not enabled");
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    require(clanId > 0 && clanId < clanIdTracker.current(), "invalid clan");
    require(clanToColony[clanId] != colonyId, "clan already belongs to this colony");
    uint256 currentColony = clanToColony[clanId];
    uint256 currentColonyCount = getClanCountInColony(currentColony);
    require(currentColonyCount > minClanInColony, "colony needs to have at least some clan");
    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      oxgnToken.burn(_msgSender(), switchColonyCost);
    }

    emit SwitchColony(_msgSender(), clanId, colonyId);
    clanToColony[clanId] = colonyId;
  }

  function getClanCountInColony(uint256 colonyId) public view returns (uint256 clans) {
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    uint256 clanCount = 0;
    for (uint256 i = 0; i < clanIdTracker.current(); i++) {
      if (clanToColony[i] == colonyId) {
        clanCount++;
      }
    }
    return clanCount;
  }

  function getClansInColony(uint256 colonyId) public view returns (uint256[] memory) {
    require(colonyId > 0 && colonyId < 4, "only 3 colonies ever");
    uint256 clanCount = getClanCountInColony(colonyId);
    uint256[] memory clans = new uint256[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < clanIdTracker.current(); i++) {
      if (clanToColony[i] == colonyId) {
        clans[clanIndex] = i;
        clanIndex++;
      }
    }
    return clans;
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override(ERC1155) {
    for (uint256 i = 0; i < ids.length; ++i) {
      uint256 id = ids[i];
      uint256 newAmount = balanceOf(to, id) + amounts[i];

      //console.log("After transfer, %s will have %s tokens.", to, newAmount);
      // If an account in ClanID1, but holds the highest ClanID2Token, upon switch to ClanID2 will only be the new leader after performing a buy/sell/transfer ClanID2Token transaction
      if (shouldChangeLeader(to, id, newAmount)) {
        // Tracking address start and stop being a clan leader
        address oldLeader = clanToHighestOwnedAccount[id];
        emit ChangeLeader(oldLeader, to, id, newAmount);

        clanToHighestOwnedCount[id] = newAmount;
        clanToHighestOwnedAccount[id] = to;
      }
    }

    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }

  /** CLAN RECORDS */

  struct ClanStruct {
    uint256 clanId;
    uint256 rank;
    uint256 updateClanTimestamp;
    uint256 updateRankTimestamp;
    bool isEntity;
  }

  struct ClanRecordsStruct {
    address entity;
    uint256[] stakedNftIds;
    uint256[] stakedNftTimestamps;
    ClanStruct clanData;
  }

  mapping(address => ClanStruct) public clanStructs;
  address[] public entityList;

  function isEntity(address entityAddress) public view returns (bool isIndeed) {
    return clanStructs[entityAddress].isEntity;
  }

  function getEntityCount() public view returns (uint256 entityCount) {
    return entityList.length;
  }

  function getEntityClanCount(uint256 clanId) public view returns (uint256 entityCount) {
    uint256 clanCount = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        clanCount++;
      }
    }
    return clanCount;
  }

  function getAccountsInClan(uint256 clanId) public view returns (address[] memory) {
    uint256 clanCount = getEntityClanCount(clanId);
    address[] memory e = new address[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        e[clanIndex] = entityList[i];
        clanIndex++;
      }
    }
    return e;
  }

  function getClanRecords(uint256 clanId) public view returns (ClanRecordsStruct[] memory) {
    uint256 clanCount = getEntityClanCount(clanId);
    ClanRecordsStruct[] memory e = new ClanRecordsStruct[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        e[clanIndex].entity = entityList[i];
        e[clanIndex].clanData = getClan(entityList[i]);
        clanIndex++;
      }
    }
    return e;
  }

  function getClanAndStakedRecords(uint256 clanId, address nftContractAddress) public view returns (ClanRecordsStruct[] memory) {
    uint256 clanCount = getEntityClanCount(clanId);
    ClanRecordsStruct[] memory e = new ClanRecordsStruct[](clanCount);
    uint256 clanIndex = 0;
    for (uint256 i = 0; i < entityList.length; i++) {
      if (clanStructs[entityList[i]].clanId == clanId) {
        e[clanIndex].entity = entityList[i];
        e[clanIndex].clanData = getClan(entityList[i]);
        e[clanIndex].stakedNftIds = stakedTokensOfOwner(nftContractAddress, entityList[i]);
        if (e[clanIndex].stakedNftIds.length > 0) {
          uint256[] memory ts = new uint256[](e[clanIndex].stakedNftIds.length);
          for (uint256 j = 0; j < e[clanIndex].stakedNftIds.length; j++) {
            ts[j] = stakedTokenTimestamp(nftContractAddress, e[clanIndex].stakedNftIds[j]);
          }
          e[clanIndex].stakedNftTimestamps = ts;
        }
        clanIndex++;
      }
    }
    return e;
  }

  function getClan(address entityAddress) public view returns (ClanStruct memory) {
    return clanStructs[entityAddress];
  }

  //possible remove
  function getClanLeader(uint256 clanId) public view returns (address entityAddress) {
    return clanToHighestOwnedAccount[clanId];
  }

  function isClanLeader(address entityAddress) public view returns (bool) {
    if (clanStructs[entityAddress].isEntity) {
      return clanToHighestOwnedAccount[clanStructs[entityAddress].clanId] == entityAddress;
    }
    return false;
  }

  function getChangeClanLeaderThreshold(uint256 clanId) public view returns (uint256 amount) {
    return (clanToHighestOwnedCount[clanId] * (changeLeaderPercentage + 100)) / 100;
  }

  function getCreateClanCost() public view returns (uint256 amount) {
    return clanIdTracker.current() * createClanCostMultiplier;
  }

  function getSwitchClanCost(uint256 clanId) public view returns (uint256 amount) {
    return switchClanCostBase + ((getEntityClanCount(clanId) * switchClanCostMultiplier) / 100000);
  }

  function updateEntityClan(address entityAddress, uint256 clanId) internal {
    require(clanId > 0 && clanId < clanIdTracker.current(), "invalid clan");

    if (isEntity(entityAddress)) {
      //switch clan flow
      if (clanStructs[entityAddress].clanId != clanId) {
        uint256 switchClanCost = getSwitchClanCost(clanId);
        oxgnToken.burn(_msgSender(), switchClanCost);

        emit SwitchClan(entityAddress, clanStructs[entityAddress].clanId, clanId, switchClanCost);

        clanStructs[entityAddress].clanId = clanId;
        clanStructs[entityAddress].updateClanTimestamp = block.timestamp;
        //reset rank
        clanStructs[entityAddress].rank = 0;
        clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
      }
    } else {
      //create clan record flow
      clanStructs[entityAddress].clanId = clanId;
      clanStructs[entityAddress].rank = 0;
      clanStructs[entityAddress].updateClanTimestamp = block.timestamp;
      clanStructs[entityAddress].updateRankTimestamp = block.timestamp;
      clanStructs[entityAddress].isEntity = true;
      entityList.push(entityAddress);
    }
  }

  // clan leader can promote and demote their own rank
  function promoteClanRank(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank < clanRankCap, "max rank reached");

    uint256 costOxgn = 0;
    uint256 costClanToken = 0;
    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      costOxgn = clanStructs[entityAddress].rank * updateRankCostMultiplierOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
      }
      costClanToken = clanStructs[entityAddress].rank * updateRankCostMultiplierClanToken;
      if (costClanToken > 0) {
        _burn(_msgSender(), clanId, costClanToken);
      }
    }

    clanStructs[entityAddress].rank = clanStructs[entityAddress].rank + 1;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;

    emit PromoteClanRank(entityAddress, clanId, _msgSender(), clanStructs[entityAddress].rank, costOxgn, costClanToken);

    return true;
  }

  function demoteClanRank(address entityAddress, uint256 clanId) public returns (bool success) {
    require(isEntity(entityAddress), "account not in any clan");
    require(clanStructs[entityAddress].clanId == clanId, "account not in clan");
    require(clanStructs[entityAddress].rank > 0, "rank is 0");

    uint256 costOxgn = 0;
    uint256 costClanToken = 0;
    if (!admins[_msgSender()]) {
      require(clanToHighestOwnedAccount[clanId] == _msgSender(), "clan leader only");
      costOxgn = clanStructs[entityAddress].rank * updateRankCostMultiplierOxgn;
      if (costOxgn > 0) {
        oxgnToken.burn(_msgSender(), costOxgn);
      }
      costClanToken = clanStructs[entityAddress].rank * updateRankCostMultiplierClanToken;
      if (costClanToken > 0) {
        _burn(_msgSender(), clanId, costClanToken);
      }
    }

    clanStructs[entityAddress].rank = clanStructs[entityAddress].rank - 1;
    clanStructs[entityAddress].updateRankTimestamp = block.timestamp;

    emit DemoteClanRank(entityAddress, clanId, _msgSender(), clanStructs[entityAddress].rank, costOxgn, costClanToken);

    return true;
  }

  /** STAKING */

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
    uint256 clanId
  ) external incrementNonce nonReentrant {
    StakedContract storage _contract = contracts[contractAddress];
    require(_contract.active, "token contract is not active");
    if (isClanLeader(_msgSender())) {
      require(clanStructs[_msgSender()].clanId == clanId, "clan leader can't switch clans!");
    }

    updateEntityClan(_msgSender(), clanId);

    for (uint256 i = 0; i < tokenIds.length; i++) {
      uint256 tokenId = tokenIds[i];
      contractTokenIdToOwner[contractAddress][tokenId] = _msgSender();
      _contract.instance.transferFrom(_msgSender(), address(this), tokenId);
      addressToStakedTokensSet[contractAddress][_msgSender()].add(tokenId);
      contractTokenIdToStakedTimestamp[contractAddress][tokenId] = block.timestamp;

      emit Stake(tokenId, contractAddress, _msgSender(), clanId);
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

  /** COLLAB.LAND */

  function balanceOf(address owner) public view returns (uint256) {
    EnumerableSet.UintSet storage userTokens = addressToStakedTokensSet[y2123Nft][owner];
    return userTokens.length();
  }

  function ownerOf(uint256 tokenId) public view returns (address) {
    return contractTokenIdToOwner[y2123Nft][tokenId];
  }
}
