const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const { duration, increaseTime } = require("truffle-test-helpers");

contract("Remittance features", accounts => {
  let instance;
  let exchange;
  let storeLocation;

  const [sender, receiver, owner, stranger] = accounts;

  const { BN, toWei, utf8ToHex } = web3.utils;

  const password = utf8ToHex("123456");
  const receiverPassword = utf8ToHex("123456");
  const senderPassword = utf8ToHex("654321");

  const commision = new BN(1000);

  beforeEach("create instance", async function() {
    instance = await Remittance.new({ from: owner });
    exchange = instance.address;
    storeLocation = await instance.getStoreLocation(password, owner);
  });

  describe("======= storeLocation tests =======", () => {
    noPassword = utf8ToHex("");

    it("Needs password", async () => {
      await truffleAssert.reverts(
        instance.getStoreLocation(noPassword, receiver)
      );
    });
  });

  describe("======= Deposit tests =======", () => {
    it("Creates new deposit", async () => {
      const txObj = await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      assert.strictEqual(txObj.logs.length, 2, "There should be 2 events");

      const logCommisionMade = txObj.logs[0];

      assert.strictEqual(
        logCommisionMade.event,
        "LogCommisionMade",
        "First event is not LogCommisionMade"
      );
      assert.strictEqual(
        logCommisionMade.args[0],
        sender,
        "Event emmitter address is sender"
      );
      assert.strictEqual(
        logCommisionMade.args[1],
        await instance.getOwner(),
        "Incorrect owner address"
      );
      assert.strictEqual(
        logCommisionMade.args[2].toString(),
        "1000",
        "Incorrect commision amount"
      );

      const logDepositMade = txObj.logs[1];

      assert.strictEqual(
        logDepositMade.event,
        "LogNewDepositMade",
        "Second event is not LogNewDepositMade"
      );
      assert.strictEqual(
        logDepositMade.args[0],
        sender,
        "Incorrect Sender address"
      );

      assert.strictEqual(
        logDepositMade.args[2].toString(),
        new BN(toWei("0.1", "ether")).sub(commision).toString(),
        "Incorrect Eth amount in event(taking into acccount commision)"
      );

      assert.strictEqual(
        txObj.logs[1].args[3],
        storeLocation,
        "Incorrect storeLocation"
      );

      const deposit = await instance.deposits.call(storeLocation);
      assert.strictEqual(
        deposit.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commision).toString(),
        "Incorrect Eth amount (taking into acccount commision)"
      );

      const commisionPaid = await instance.commisions.call(owner);
      assert.strictEqual(
        commisionPaid.toString(),
        commision.toString(),
        "Incorrect commision amount)"
      );
    });

    it("Allows re-use of password after withdrawal", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      await increaseTime(duration.days(3));

      await instance.withdraw(password, {
        from: owner
      });

      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      deposit = await instance.deposits.call(storeLocation);
      assert.strictEqual(
        deposit.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commision).toString()
      );
    });

    it("Fails if nil deposit", async () => {
      await truffleAssert.reverts(
        instance.deposit(storeLocation, duration.days(3), {
          from: sender,
          value: toWei("0", "ether")
        }),
        "Not Enough Ether sent"
      );
    });

    it("Needs delay value to make deposit", async () => {
      await truffleAssert.reverts(
        instance.deposit(storeLocation, 0, {
          from: sender,
          value: toWei(".1", "ether")
        }),
        "Delay required"
      );
    });

    it("Needs storeLocation", async () => {
      const noStoreLocation = utf8ToHex("");

      await truffleAssert.reverts(
        instance.deposit(noStoreLocation, duration.days(3), {
          from: sender,
          value: toWei("0.1", "ether")
        }),
        "storeLocation required"
      );
    });

    it("Requires unique storeLocation", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      await truffleAssert.reverts(
        instance.deposit(storeLocation, duration.days(3), {
          from: sender,
          value: toWei("0.1", "ether")
        }),
        "storeLocation in use"
      );
    });
  });

  describe("======= Cancel deposit tests =======", () => {
    beforeEach("Create deposit", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });
    });

    it("Cancels a deposit after it is expired", async () => {
      await increaseTime(duration.days(3));

      let txObj = await instance.cancelDeposit(password, owner, {
        from: sender
      });

      const logDepositCancelled = txObj.logs[0];

      assert.strictEqual(txObj.logs.length, 1); // correct number of logs
      assert.strictEqual(logDepositCancelled.event, "LogDepositCancelled"); // log is LogDepositCancelled
      assert.strictEqual(logDepositCancelled.args[0], sender); // owner address matches
      assert.strictEqual(
        logDepositCancelled.args[1].toString(),
        new BN(toWei("0.1", "ether")).sub(commision).toString()
      ); // amount is correct less commision
      assert.strictEqual(logDepositCancelled.args[2], storeLocation); // Password is correct

      const deposit = instance.deposits.call(storeLocation);
      assert.strictEqual(deposit.sender, undefined);
    });

    it("Prevents a stranger canceling a deposit", async () => {
      await increaseTime(duration.days(3));

      await truffleAssert.reverts(
        instance.cancelDeposit(password, owner, { from: stranger })
      );
    });

    it("Prevents a deposit from being canceled with incorrect password", async () => {
      const badPassword = utf8ToHex("wrong");

      await increaseTime(duration.days(3));

      await truffleAssert.reverts(
        instance.cancelDeposit(badPassword, owner, { from: sender }),
        "No deposit at this storeLocation"
      );
    });

    it("Prevents a deposit from being canceled before it's expired", async () => {
      await truffleAssert.reverts(
        instance.cancelDeposit(password, owner, { from: sender }),
        "Cannot cancel a deposit before it has expired"
      );
    });

    it("Allows re-use of password after cancel", async () => {
      await increaseTime(duration.days(3));

      await instance.cancelDeposit(password, owner, { from: sender });

      txObj = await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      deposit = await instance.deposits.call(storeLocation);
      assert.strictEqual(
        deposit.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commision).toString()
      );
    });
  });

  describe("======= withdraw test =======", () => {
    beforeEach("Create deposit", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });
    });

    it("Allows exchange owner to withdraw balance", async () => {
      const startExchangeBalance = new BN(await web3.eth.getBalance(exchange));

      const txObj = await instance.withdraw(password, {
        from: owner
      });

      const logWithdrawn = txObj.logs[0];

      assert.strictEqual(txObj.logs.length, 1);
      assert.strictEqual(logWithdrawn.event, "LogWithdrawn");
      assert.strictEqual(logWithdrawn.args[0], owner);
      assert.strictEqual(logWithdrawn.args[1], storeLocation);
      assert.strictEqual(
        logWithdrawn.args[2].toString(),
        new BN(toWei("0.1", "ether")).sub(commision).toString()
      );

      const tx = await web3.eth.getTransaction(txObj.tx);

      const gasPrice = new BN(tx.gasPrice);

      const gasUsed = new BN(txObj.receipt.gasUsed);
      const txCost = gasPrice.mul(gasUsed);

      const endExchangeBalance = new BN(await web3.eth.getBalance(exchange));

      assert.strictEqual(
        await web3.eth.getBalance(exchange),
        new BN(commision).toString(),
        "invalid amount of Eth left on exchange after withdrawal"
      );

      const deposit = await instance.deposits.call(storeLocation);

      assert.strictEqual(
        deposit.amount.toString(),
        "0",
        "None zero amount left after withdrawal"
      );
    });

    it("Prevents withdrawal with wrong password", async () => {
      const badPassword = utf8ToHex("wrong");

      await truffleAssert.reverts(
        instance.withdraw(badPassword, { from: owner })
      );
    });
  });

  describe("======= withdraw Commision test =======", () => {
    beforeEach("Create deposit", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });
    });

    it("Allows owner to withdraw commision", async () => {
      const startCommisionBalance = instance.commisions(owner);

      const startOwnerBalance = new BN(await web3.eth.getBalance(owner));

      const txObj = await instance.withdrawCommision({
        from: owner
      });

      const logCommisionWithdrawn = txObj.logs[0];

      assert.strictEqual(txObj.logs.length, 1);
      assert.strictEqual(logCommisionWithdrawn.event, "LogCommisionWithdrawn");
      assert.strictEqual(logCommisionWithdrawn.args[0], owner);
      assert(logCommisionWithdrawn.args[1].eq(commision));

      const tx = await web3.eth.getTransaction(txObj.tx);

      const gasPrice = new BN(tx.gasPrice);

      const gasUsed = new BN(txObj.receipt.gasUsed);
      const allowedGas = gasPrice.mul(gasUsed);

      endOwnerBalance = new BN(await web3.eth.getBalance(owner));

      assert.strictEqual(
        await startOwnerBalance
          .sub(allowedGas)
          .add(commision)
          .toString(),
        endOwnerBalance.toString(),
        "Eth Balance for owner not valid after withdrawal of commision"
      );
    });

    it("Allows only the owner to withdraw Commision", async () => {
      await truffleAssert.reverts(
        instance.withdrawCommision({
          from: stranger
        })
      );
    });
  });
});
