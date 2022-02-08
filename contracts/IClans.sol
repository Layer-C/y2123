// SPDX-License-Identifier: MIT LICENSE
pragma solidity ^0.8.10;

interface IClans {
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
}
