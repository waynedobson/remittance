pragma solidity 0.5.11;

contract Owned {

    address public owner;

    event LogOwnerChanged(address indexed emitter, address indexed newOwner);

    modifier _onlyOwner {
        require(msg.sender == owner, 'Access restricted to owner');
        _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function changeOwner(address newOwner) public _onlyOwner returns(bool success) {
        require(newOwner != address(0));
        require(newOwner != owner);

        owner = newOwner;

        emit LogOwnerChanged(msg.sender, newOwner);

        return true;
    }
}
