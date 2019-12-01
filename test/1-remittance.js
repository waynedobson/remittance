const Remittance = artifacts.require("Remittance");
const truffleAssert = require("truffle-assertions");
const { duration, increaseTime } = require("truffle-test-helpers");

contract("Remittance features", accounts => {
  let instance;
  let exchange;
  let storeLocation;

  const [sender, receiver, owner, stranger] = accounts;

  const { BN, toWei, utf8ToHex } = web3.utils;

  const senderpassword = utf8ToHex("123456");
  const receiverpassword = utf8ToHex("654321");

  const commission = new BN(1000);

  beforeEach("create instance", async function() {
    instance = await Remittance.new({ from: owner });
    exchange = instance.address;
    storeLocation = await instance.getStoreLocation(
      senderpassword,
      receiverpassword,
      owner
    );
  });

  describe("======= Deposit tests =======", () => {
    it("Creates new deposit", async () => {
      const txObj = await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      assert.strictEqual(txObj.logs.length, 2, "There should be 2 events");

      const logCommissionMade = txObj.logs[0];

      assert.strictEqual(
        logCommissionMade.event,
        "LogCommissionMade",
        "First event is not LogCommissionMade"
      );

      assert.strictEqual(
        logCommissionMade.args.emitter,
        sender,
        "Event emitter address is sender"
      );

      assert.strictEqual(
        logCommissionMade.args.exchangeOwnerAddress,
        await instance.getOwner(),
        "Incorrect owner address"
      );

      assert.strictEqual(
        logCommissionMade.args.amount.toString(),
        "1000",
        "Incorrect commission amount"
      );

      assert.strictEqual(
        logCommissionMade.args.storeLocation.toString(),
        storeLocation.toString(),
        "Incorrect storeLocation"
      );

      const logDepositMade = txObj.logs[1];

      assert.strictEqual(
        logDepositMade.event,
        "LogNewDepositMade",
        "Second event is not LogNewDepositMade"
      );

      assert.strictEqual(
        logDepositMade.args.emitter,
        sender,
        "Incorrect Sender address"
      );

      assert.strictEqual(
        logDepositMade.args.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commission).toString(),
        "Incorrect Eth amount in event(taking into acccount commission)"
      );

      assert.strictEqual(
        logDepositMade.args.storeLocation,
        storeLocation,
        "Incorrect storeLocation"
      );

      const deposit = await instance.deposits.call(storeLocation);
      assert.strictEqual(
        deposit.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commission).toString(),
        "Incorrect Eth amount (taking into acccount commission)"
      );

      const commissionPaid = await instance.commissions.call(owner);

      assert.strictEqual(
        commissionPaid.toString(),
        commission.toString(),
        "Incorrect commission amount)"
      );
    });

    it("Allows re-use of password after withdrawal", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      await increaseTime(duration.days(3));

      await instance.withdraw(senderpassword, receiverpassword, {
        from: owner
      });

      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      deposit = await instance.deposits.call(storeLocation);
      assert.strictEqual(
        deposit.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commission).toString()
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

      let txObj = await instance.cancelDeposit(storeLocation, {
        from: sender
      });

      const logDepositCancelled = txObj.logs[0];

      assert.strictEqual(txObj.logs.length, 1);
      assert.strictEqual(logDepositCancelled.event, "LogDepositCancelled");
      assert.strictEqual(logDepositCancelled.args.emitter, sender);
      assert.strictEqual(
        logDepositCancelled.args.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commission).toString()
      );
      assert.strictEqual(logDepositCancelled.args.storeLocation, storeLocation);

      const deposit = instance.deposits.call(storeLocation);
      assert.strictEqual(deposit.sender, undefined);
    });

    it("Prevents a stranger canceling a deposit", async () => {
      await increaseTime(duration.days(3));

      await truffleAssert.reverts(
        instance.cancelDeposit(storeLocation, { from: stranger })
      );
    });

    it("Prevents a deposit from being canceled with incorrect storeLocation", async () => {
      const badStoreLocation = utf8ToHex("wrong");

      await increaseTime(duration.days(3));

      await truffleAssert.reverts(
        instance.cancelDeposit(badStoreLocation, { from: sender }),
        "No deposit at this storeLocation"
      );
    });

    it("Prevents a deposit from being canceled before it's expired", async () => {
      await truffleAssert.reverts(
        instance.cancelDeposit(storeLocation, { from: sender }),
        "Cannot cancel a deposit before it has expired"
      );
    });

    it("Allows re-use of password after cancel", async () => {
      await increaseTime(duration.days(3));

      await instance.cancelDeposit(storeLocation, { from: sender });

      txObj = await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });

      deposit = await instance.deposits.call(storeLocation);
      assert.strictEqual(
        deposit.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commission).toString()
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

    it("Allows owner to withdraw balance", async () => {
      const startExchangeBalance = new BN(await web3.eth.getBalance(exchange));

      const txObj = await instance.withdraw(senderpassword, receiverpassword, {
        from: owner
      });

      const logWithdrawn = txObj.logs[0];

      assert.strictEqual(txObj.logs.length, 1);
      assert.strictEqual(logWithdrawn.event, "LogWithdrawn");
      assert.strictEqual(logWithdrawn.args.exchangerAddress, owner);
      assert.strictEqual(logWithdrawn.args.storeLocation, storeLocation);
      assert.strictEqual(
        logWithdrawn.args.amount.toString(),
        new BN(toWei("0.1", "ether")).sub(commission).toString()
      );

      const tx = await web3.eth.getTransaction(txObj.tx);

      const gasPrice = new BN(tx.gasPrice);

      const gasUsed = new BN(txObj.receipt.gasUsed);
      const txCost = gasPrice.mul(gasUsed);

      const endExchangeBalance = new BN(await web3.eth.getBalance(exchange));

      assert.strictEqual(
        await web3.eth.getBalance(exchange),
        new BN(commission).toString(),
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
        instance.withdraw(senderpassword, badPassword, { from: owner })
      );
    });
  });

  describe("======= withdraw Commission test =======", () => {
    beforeEach("Create deposit", async () => {
      await instance.deposit(storeLocation, duration.days(3), {
        from: sender,
        value: toWei("0.1", "ether")
      });
    });

    it("Allows owner to withdraw commission", async () => {
      const startCommissionBalance = instance.commissions.call(owner);

      const startOwnerBalance = new BN(await web3.eth.getBalance(owner));

      const txObj = await instance.withdrawCommission({
        from: owner
      });

      const logCommissionWithdrawn = txObj.logs[0];

      assert.strictEqual(txObj.logs.length, 1);
      assert.strictEqual(
        logCommissionWithdrawn.event,
        "LogCommissionWithdrawn"
      );
      assert.strictEqual(
        logCommissionWithdrawn.args.exchangeOwnerAddress,
        owner
      );
      assert(logCommissionWithdrawn.args.amount.eq(commission));

      const tx = await web3.eth.getTransaction(txObj.tx);

      const gasPrice = new BN(tx.gasPrice);

      const gasUsed = new BN(txObj.receipt.gasUsed);
      const txCost = gasPrice.mul(gasUsed);

      endOwnerBalance = new BN(await web3.eth.getBalance(owner));

      assert.strictEqual(
        await startOwnerBalance
          .sub(txCost)
          .add(commission)
          .toString(),
        endOwnerBalance.toString(),
        "Eth Balance for owner not valid after withdrawal of commission"
      );
    });

    it("Allows only the owner to withdraw Commission", async () => {
      await truffleAssert.reverts(
        instance.withdrawCommission({
          from: stranger
        })
      );
    });
  });
});
