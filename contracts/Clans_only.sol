// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./IClans.sol";

import "hardhat/console.sol";

contract Clans_only is IClans, ERC1155, Ownable, Pausable {
  using Strings for uint256;
  string private baseURI;
  using Counters for Counters.Counter;
  Counters.Counter public clanIdTracker;
  uint256 public creatorInitialClanTokens = 100;
  uint256 public changeLeaderPercentage = 10;

  mapping(address => bool) private admins;
  mapping(uint256 => uint256) public highestOwnedCount;
  mapping(uint256 => address) public highestOwned;

  constructor(string memory _baseURI) ERC1155(_baseURI) {
    baseURI = _baseURI;
    _pause();
  }

  function uri(uint256 clanId) public view override returns (string memory) {
    return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, clanId.toString())) : baseURI;
  }

  function shouldChangeLeader(uint256 clanId, uint256 amount) public view returns (bool) {
    return amount > (highestOwnedCount[clanId] * (changeLeaderPercentage + 100)) / 100;
  }

  function createClan() external whenNotPaused {
    uint256 clanId = clanIdTracker.current();
    clanIdTracker.increment();
    _mint(msg.sender, clanId, creatorInitialClanTokens, "");
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

      console.log("After transfer, %s will have %s tokens.", to, newAmount);

      if (shouldChangeLeader(id, newAmount)) {
        highestOwnedCount[id] = newAmount;
        highestOwned[id] = to;
      }
    }

    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }

  /** ADMIN */

  function setPaused(bool _paused) external onlyOwner {
    if (_paused) _pause();
    else _unpause();
  }

  function addAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }
}
