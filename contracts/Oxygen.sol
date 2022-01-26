// SPDX-License-Identifier: MIT LICENSE
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IOxygen.sol";

contract Oxygen is IOxygen, ERC20, Ownable {
  mapping(address => uint256) private lastWrite;
  mapping(address => bool) private admins;
  uint256 public startMaxCap = 8000000000;
  address public donationAccount;
  uint256 public donationCount;
  uint256 public mintedCount;

  constructor() ERC20("Y2123 OXGN", "OXGN") {}

  function setDonationAccount(address addr) external onlyOwner {
    donationAccount = addr;
  }

  function addAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = true;
  }

  function removeAdmin(address addr) external onlyOwner {
    require(addr != address(0), "empty address");
    admins[addr] = false;
  }

  function mint(address to, uint256 amount) external override {
    require(admins[msg.sender], "Only admins can mint");
    require(mintedCount + amount <= currentMaxCap(), "Amount exceeds max cap or max cap reached!");
    if (to == donationAccount) {
      donationCount = donationCount + amount;
    }
    mintedCount = mintedCount + amount;
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external override {
    require(admins[msg.sender], "Only admins can burn");
    _burn(from, amount);
  }

  function currentMaxCap() public view returns (uint256) {
    return startMaxCap - donationCount;
  }

  /** PROTECTION */

  modifier disallowIfStateIsChanging() {
    require(admins[_msgSender()] || lastWrite[tx.origin] < block.number, "state is changing");
    _;
  }

  function balanceOf(address account) public view virtual override(ERC20, IOxygen) disallowIfStateIsChanging returns (uint256) {
    require(admins[_msgSender()] || lastWrite[account] < block.number, "state is changing");
    return super.balanceOf(account);
  }

  function transfer(address recipient, uint256 amount) public virtual override(ERC20, IOxygen) disallowIfStateIsChanging returns (bool) {
    require(admins[_msgSender()] || lastWrite[_msgSender()] < block.number, "state is changing");
    return super.transfer(recipient, amount);
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override(ERC20, IOxygen) disallowIfStateIsChanging returns (bool) {
    require(admins[_msgSender()] || lastWrite[sender] < block.number, "state is changing");
    if (admins[_msgSender()]) {
      _transfer(sender, recipient, amount);
      return true;
    }
    return super.transferFrom(sender, recipient, amount);
  }
}
