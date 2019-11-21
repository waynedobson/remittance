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

    event LogNewDepositMade(address indexed emitter, uint deadline, uint amount, bytes32 indexed storeLocation);
    event LogCommisionMade(address indexed emitter, address indexed owner, uint amount);
    event LogDepositCancelled(address indexed emitter, uint amount, bytes32 hashedOTP);
    event LogWithdrawn(address indexed emitter, bytes32 hashedOTP, uint amount);
    event LogCommisionWithdrawn(address indexed emitter, uint amount);

    constructor () public {
    }

    function () external {
      revert("No fallback function");
    }

    function getStoreLocation(bytes32 password, address exchange) public view returns(bytes32 hash) {
      require(password != 0, "Password required");
      hash = keccak256(abi.encodePacked(address(this), password, exchange));
    }

    function deposit(bytes32 storeLocation, uint delay) public payable returns(bool) {
      require(storeLocation != 0, "storeLocation required");
      require(msg.value > TX_COMM, "Not Enough Ether sent");
      require(delay > 0, "Delay required");
      require(deposits[storeLocation].sender == address(0), "storeLocation in use");

      uint amount = msg.value.sub(TX_COMM);
      uint deadline = now.add(delay);
      address owner = getOwner();

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

    function cancelDeposit(bytes32 password, address exchange) public returns(bool success) {
      bytes32 storeLocation = getStoreLocation(password, exchange);

      Deposit memory thisDeposit = deposits[storeLocation];

      require(thisDeposit.amount > 0, "No deposit at this storeLocation");
      require(now >= thisDeposit.deadline, "Cannot cancel a deposit before it has expired");
      require(thisDeposit.sender == msg.sender, "Only the depositor can cancel an order");

      emit LogDepositCancelled(msg.sender, thisDeposit.amount, storeLocation);

      delete(deposits[storeLocation]);

      (success,) = msg.sender.call.value(thisDeposit.amount)("");
      require(success, "Cancel deposit failed.");
    }

    function withdraw(bytes32 password) public returns(bool success) {
      bytes32 storeLocation = getStoreLocation(password, msg.sender);

      uint amount = deposits[storeLocation].amount;

      require(amount > 0, "No deposit at this storeLocation");

      emit LogWithdrawn(msg.sender, storeLocation, amount);

      delete(deposits[storeLocation]);

      (success,) = msg.sender.call.value(amount)("");
      require(success, "Withdrawal failed.");
    }

    function withdrawCommision() public _onlyOwner returns(bool success) {
      uint amount = commisions[msg.sender];

      require(amount > 0, "No Commision to withdraw");

      commisions[msg.sender] = 0;

      emit LogCommisionWithdrawn(msg.sender, amount);

      (success,) = msg.sender.call.value(amount)("");
      require(success, "Commision withdrawal failed.");
    }
}
