// SPDX-License-Identifier: MIT LICENSE
pragma solidity ^0.8.11;

interface ILand {
  function stake(
    address contractAddress,
    uint256[] memory tokenIds,
    uint256 clanId
  ) external;

  function mint(
    address recipient,
    uint256 id,
    uint256 amount
  ) external;

  function burn(uint256 id, uint256 amount) external;

  function stakedTokensOfOwner(address contractAddress, address owner) external view returns (uint256[] memory);

  function claimableOfOwner(address contractAddress, address owner) external view returns (uint256[] memory stakedTimestamps, uint256[] memory claimableTimestamps);
}
