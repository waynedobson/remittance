pragma solidity 0.5.11;

import "./math/SafeMath.sol";
import "./Owned.sol";

contract Remittance is Owned {
  using SafeMath for uint256;

    struct Deposit {
      uint deadline;
      address sender;
      uint amount;
    }

    uint constant TX_COMM = 1000; // fixed commision

    mapping(bytes32 => Deposit) public deposits;
    mapping(address => uint) public commisions;

    event LogNewDepositMade(address indexed emitter, uint deadline, uint amount, bytes32 storeLocation);
    event LogCommisionMade(address indexed emitter, address owner, uint amount);
    event LogDepositCancelled(address indexed emitter, uint amount, bytes32 hashedOTP);
    event LogWithdrawn(address indexed emitter, bytes32 hashedOTP, uint amount);
    event LogCommisionWithdrawn(address indexed emitter, uint amount);

    constructor () public {
    }

    function () external {
      revert("No fallback function");
    }

    function getStoreLocation(bytes32 senderPassword, bytes32 receiverPassword) public view returns(bytes32 hash) {
      require(senderPassword != 0, "Sender password required");
      require(receiverPassword != 0, "Receiver password required");
      hash = keccak256(abi.encodePacked(address(this), senderPassword, receiverPassword));
    }

    function deposit(bytes32 storeLocation, uint delay) public payable returns(bool) {
      require(storeLocation != 0, "storeLocation required");
      require(msg.value > 0, "No Ether sent");
      require(delay > 0, "Delay required");
      require(deposits[storeLocation].sender == address(0), "storeLocation in use");

      uint amount = msg.value.sub(TX_COMM);
      uint deadline = now.add(delay);

      commisions[owner] = commisions[owner].add(TX_COMM);
      emit LogCommisionMade(msg.sender, owner, TX_COMM);

      emit LogNewDepositMade(msg.sender, deadline, amount, storeLocation);
      deposits[storeLocation] = Deposit({
          deadline: deadline,
          sender: msg.sender,
          amount: amount
      });

      return true;
    }

    function cancelDeposit(bytes32 storeLocation) public returns(bool success) {
      Deposit memory thisDeposit = deposits[storeLocation];

      require(thisDeposit.amount > 0, "No deposit at this storeLocation");
      require(now >= thisDeposit.deadline, "Cannot cancel a deposit before it has expired");
      require(thisDeposit.sender == msg.sender, "Only the depositor can cancel an order");

      delete(deposits[storeLocation]);

      emit LogDepositCancelled(msg.sender, thisDeposit.amount, storeLocation);

      (success,) = msg.sender.call.value(thisDeposit.amount)("");
    }

    function withdraw(bytes32 storeLocation) public returns(bool success) {
      uint amount = deposits[storeLocation].amount;

      require(amount > 0, "No deposit at this storeLocation");

      deposits[storeLocation].deadline = 0;
      deposits[storeLocation].amount = 0;

      emit LogWithdrawn(msg.sender, storeLocation, amount);

      (success,) = msg.sender.call.value(amount)("");
    }

    function withdrawCommision() public _onlyOwner returns(bool success) {
      uint amount = commisions[msg.sender];

      require(amount > 0, "No Commision to withdraw");

      commisions[msg.sender] = 0;

      emit LogCommisionWithdrawn(msg.sender, amount);

      (success,) = msg.sender.call.value(amount)("");
    }
}