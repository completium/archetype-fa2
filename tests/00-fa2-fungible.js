const {
  deploy,
  expectToThrow,
  exprMichelineToJson,
  getAccount,
  getValueFromBigMap,
  jsonMichelineToExpr,
  runGetter,
  setEndpoint,
  setMockupNow,
  setQuiet,
} = require('@completium/completium-cli');
const { errors, mkTransferPermit, getBalanceLedger, mkTransferGaslessArgs, getPermitNb, getTransferPermitData, getSignHashPermit, getPermit, GetIsoStringFromTimestamp, mkPackDataTransferGasless, getMetadata } = require('./utils');
const assert = require('assert');

// contracts
let fa2;
let permits;

// accounts
const alice = getAccount('alice');
const bob = getAccount('bob');
const carl = getAccount('carl');
const user1 = getAccount('bootstrap1');
const user2 = getAccount('bootstrap2');
const user3 = getAccount('bootstrap3');
const user4 = getAccount('bootstrap4');

// constants
const tokenId = 0

//set endpointhead
setEndpoint('mockup');

setQuiet(true);
const timestamp_now = Math.floor(Date.now() / 1000)
setMockupNow(timestamp_now)

describe('[FA2 fungible] Contracts deployment', async () => {
  it('Permits contract deployment should succeed', async () => {
    [permits, _] = await deploy(
      './contracts/permits.arl',
      {
        parameters: {
          owner: alice.pkh,
        },
        as: alice.pkh,
      }
    )
  });
  it('FA2 fungible contract deployment should succeed', async () => {
    [fa2, _] = await deploy(
      './contracts/fa2-fungible.arl',
      {
        parameters: {
          owner: alice.pkh,
          permits: permits.address
        },
        as: alice.pkh,
      }
    );
  });
});

describe('[FA2 fungible] Contract configuration', async () => {
  it("Add FA2 as permit consumer", async () => {
    await permits.manage_consumer({
      arg: {
        p : { "kind" : "left", "value" : `${fa2.address}` }
      },
      as: alice.pkh
    })
  })
})

describe('[FA2 fungible] Minting', async () => {
  it('Mint tokens as owner for ourself should succeed', async () => {
    const balance_alice_before = await getBalanceLedger(fa2, alice.pkh);
    assert(balance_alice_before === '123000000000000', "Invalid amount")

    await fa2.mint({
      arg: {
        tow: alice.pkh,
        nbt: 1000,
      },
      as: alice.pkh,
    });

    const balance_alice_after = await getBalanceLedger(fa2, alice.pkh);
    assert(balance_alice_after === '123000000001000', "Invalid amount")
  });

  it('Mint tokens as non owner for ourself should fail', async () => {
    await expectToThrow(async () => {
      await fa2.mint({
        arg: {
          tow: bob.pkh,
          nbt: 1000,
        },
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Mint tokens as non owner for someone else should fail', async () => {
    await expectToThrow(async () => {
      await fa2.mint({
        arg: {
          tow: carl.pkh,
          nbt: 1000,
        },
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Mint tokens as owner for someone else should succeed', async () => {
    const balance_carl_before = await getBalanceLedger(fa2, carl.pkh);
    assert(balance_carl_before === '0', "Invalid amount")

    await fa2.mint({
      arg: {
        tow: carl.pkh,
        nbt: 1000,
      },
      as: alice.pkh,
    });

    const balance_carl_after = await getBalanceLedger(fa2, carl.pkh);
    assert(balance_carl_after === '1000', "Invalid amount")
  });

  it('Mint token for user 1', async () => {
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    assert(balance_user1_before === '0', "Invalid amount")

    await fa2.mint({
      arg: {
        tow: user1.pkh,
        nbt: 1,
      },
      as: alice.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    assert(balance_user1_after === '1', "Invalid amount")
  });
});

describe('[FA2 fungible] Update operators', async () => {
  it('Add an operator for ourself should succeed', async () => {
    const storage = await fa2.getStorage();
    const initialOperators = await getValueFromBigMap(
      parseInt(storage.operator),
      exprMichelineToJson(
        `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
      ),
      exprMichelineToJson(`(pair address (pair nat address))'`)
    );
    assert(initialOperators == null);
    await fa2.update_operators({
      argMichelson: `{Left (Pair "${alice.pkh}" "${fa2.address}" ${tokenId})}`,
      as: alice.pkh,
    });
    const operatorsAfterAdd = await getValueFromBigMap(
      parseInt(storage.operator),
      exprMichelineToJson(
        `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
      ),
      exprMichelineToJson(`(pair address (pair nat address))'`)
    );
    assert(operatorsAfterAdd.prim == 'Unit');
  });

  it('Remove a non existing operator should succeed', async () => {
    await fa2.update_operators({
      argMichelson: `{Right (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId})}`,
      as: alice.pkh,
    });
  });

  it('Remove an existing operator for another user should fail', async () => {
    await expectToThrow(async () => {
      await fa2.update_operators({
        argMichelson: `{Right (Pair "${alice.pkh}" "${fa2.address}" ${tokenId})}`,
        as: bob.pkh,
      });
    }, errors.CALLER_NOT_OWNER);
  });

  it('Add operator for another user should fail', async () => {
    await expectToThrow(async () => {
      await fa2.update_operators({
        argMichelson: `{Left (Pair "${bob.pkh}" "${fa2.address}" ${tokenId})}`,
        as: alice.pkh,
      });
    }, errors.CALLER_NOT_OWNER);
  });

  it('Remove an existing operator should succeed', async () => {
    const storage = await fa2.getStorage();
    const initialOperators = await getValueFromBigMap(
      parseInt(storage.operator),
      exprMichelineToJson(
        `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
      ),
      exprMichelineToJson(`(pair address (pair nat address))'`)
    );
    assert(initialOperators.prim == 'Unit');
    await fa2.update_operators({
      argMichelson: `{Right (Pair "${alice.pkh}" "${fa2.address}" ${tokenId})}`,
      as: alice.pkh,
    });
    const operatorsAfterRemoval = await getValueFromBigMap(
      parseInt(storage.operator),
      exprMichelineToJson(
        `(Pair "${permits.address}" (Pair ${tokenId} "${alice.pkh}"))`
      ),
      exprMichelineToJson(`(pair address (pair nat address))'`)
    );
    assert(operatorsAfterRemoval == null);
  });
});

describe('[FA2 fungible] Add permit', async () => {
  it('Add a permit with the wrong signature should fail', async () => {
    const amount = 123;
    const alicePermitNb = await getPermitNb(permits, alice.pkh);
    const { _, tosign } = await getTransferPermitData(alice, bob, permits.address, amount, tokenId, alicePermitNb);
    const error = `(Pair \"MISSIGNED\"\n        0x${tosign})`
    await expectToThrow(async () => {
      const permit = await mkTransferPermit(
        alice,
        bob,
        permits.address,
        amount,
        tokenId,
        alicePermitNb
      );
      const signature = "edsigu3QDtEZeSCX146136yQdJnyJDfuMRsDxiCgea3x7ty2RTwDdPpgioHWJUe86tgTCkeD2u16Az5wtNFDdjGyDpb7MiyU3fn";
      await permits.permit({
        argMichelson: `(Pair "${alice.pubk}" (Pair "${signature}" 0x${permit.hash}))`,
        as: bob.pkh,
      });
    }, error);
  });

  it('Add a permit with the wrong hash should fail', async () => {
    const amount = 123;
    const hashPermit = '9aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
    const alicePermitNb = await getPermitNb(permits, alice.pkh);
    const { _, tosign } = await getSignHashPermit(hashPermit, permits.address, alicePermitNb);
    const error = `(Pair \"MISSIGNED\"\n        0x${tosign})`
    await expectToThrow(async () => {
      const permit = await mkTransferPermit(
        alice,
        bob,
        permits.address,
        amount,
        tokenId,
        alicePermitNb
      );
      await permits.permit({
        argMichelson: `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${hashPermit}))`,
        as: bob.pkh,
      });
    }, error);
  });

  it('Add a permit with the wrong public key should fail', async () => {
    const amount = 123;
    const alicePermitNb = await getPermitNb(permits, alice.pkh);
    const { _, tosign } = await getTransferPermitData(alice, bob, permits.address, amount, tokenId, alicePermitNb);
    const error = `(Pair \"MISSIGNED\"\n        0x${tosign})`
    await expectToThrow(async () => {
      const permit = await mkTransferPermit(
        alice,
        bob,
        permits.address,
        amount,
        tokenId,
        alicePermitNb
      );
      await permits.permit({
        argMichelson: `(Pair "${bob.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
        as: bob.pkh,
      });
    }, error);
  });

  it('Add a permit with the good hash, signature and public key should succeed', async () => {
    const amount = 123;
    const alicePermitNb = await getPermitNb(permits, alice.pkh);

    const permit = await mkTransferPermit(
      alice,
      bob,
      permits.address,
      amount,
      tokenId,
      alicePermitNb
    );

    const initialPermit = await getPermit(permits, alice.pkh);
    assert(initialPermit == null);

    await permits.permit({
      argMichelson: `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: bob.pkh,
    });
    const addedPermit = await getPermit(permits, alice.pkh)

    const addedPermitValue = jsonMichelineToExpr(addedPermit)
    const ref = `(Pair 1 None {Elt 0x12035464014ab9ab0dfcd16f27cbfaedf2329968d7daa9f2462b4867fa311073 (Pair (Some 31556952) "${GetIsoStringFromTimestamp(timestamp_now + 1)}")})`
    assert(addedPermitValue == ref)
  });

  it('Add a duplicated permit should succeed', async () => {
    const amount = 123;
    const initialPermit = await getPermit(permits, alice.pkh);

    const initialPermitValue = jsonMichelineToExpr(initialPermit)
    const initialref = `(Pair 1 None {Elt 0x12035464014ab9ab0dfcd16f27cbfaedf2329968d7daa9f2462b4867fa311073 (Pair (Some 31556952) "${GetIsoStringFromTimestamp(timestamp_now + 1)}")})`
    assert(initialPermitValue == initialref)

    const alicePermitNb = await getPermitNb(permits, alice.pkh);
    const permit = await mkTransferPermit(
      alice,
      bob,
      permits.address,
      amount,
      tokenId,
      alicePermitNb
    );
    await permits.permit({
      argMichelson: `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: bob.pkh,
    });

    const addedPermit = await getPermit(permits, alice.pkh);

    const addedPermitValue = jsonMichelineToExpr(addedPermit)
    const ref = `(Pair 2 None {Elt 0x12035464014ab9ab0dfcd16f27cbfaedf2329968d7daa9f2462b4867fa311073 (Pair (Some 31556952) "${GetIsoStringFromTimestamp(timestamp_now + 1)}")})`
    assert(addedPermitValue == ref)
  });

  it('Expired permit are removed when a new permit is added should succeed', async () => {
    const amount = 123;
    const expiry = 1;

    let alicePermitNb = await getPermitNb(permits, alice.pkh);
    const permit = await mkTransferPermit(
      alice,
      bob,
      permits.address,
      amount,
      tokenId,
      alicePermitNb
    );
    await permits.permit({
      argMichelson: `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: bob.pkh,
    });

    const addedPermit = await getPermit(permits, alice.pkh);
    const addedPermitValue = jsonMichelineToExpr(addedPermit)
    const addedPermitref = `(Pair 3 None {Elt 0x12035464014ab9ab0dfcd16f27cbfaedf2329968d7daa9f2462b4867fa311073 (Pair (Some 31556952) "${GetIsoStringFromTimestamp(timestamp_now + 1)}")})`
    assert(addedPermitValue == addedPermitref, "invalid value")

    await permits.set_expiry({
      argMichelson: `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`,
      as: alice.pkh,
    });

    const expiryRes = await getPermit(permits, alice.pkh);
    const expiryResValue = jsonMichelineToExpr(expiryRes)
    const expiryResRef = `(Pair 3 None {Elt 0x12035464014ab9ab0dfcd16f27cbfaedf2329968d7daa9f2462b4867fa311073 (Pair (Some 1) "${GetIsoStringFromTimestamp(timestamp_now + 1)}")})`
    assert(expiryResValue == expiryResRef, "invalid value")

    setMockupNow(timestamp_now + 1100);

    alicePermitNb = await getPermitNb(permits, alice.pkh);
    const permitAfter = await mkTransferPermit(
      alice,
      carl,
      permits.address,
      amount,
      tokenId,
      alicePermitNb
    );

    await permits.permit({
      argMichelson: `(Pair "${alice.pubk}" (Pair "${permitAfter.sig.prefixSig}" 0x${permitAfter.hash}))`,
      as: bob.pkh,
    });

    const afterSecondPermitRes = await getPermit(permits, alice.pkh);
    const afterSecondPermitResResValue = jsonMichelineToExpr(afterSecondPermitRes)
    const afterSecondPermitResResRef = `(Pair 4 None {Elt 0x5da618ea94d598930a3d5de331ea4335e7115840e8c21a233c1711f864f8042e (Pair (Some 31556952) "${GetIsoStringFromTimestamp(timestamp_now + 1101)}")})`
    assert(afterSecondPermitResResValue == afterSecondPermitResResRef, "invalid value")
  });
});

describe('[FA2 fungible] Transfers', async () => {
  it('Transfer simple amount of token', async () => {
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '1', "Invalid amount")
    assert(balance_user2_before === '0', "Invalid amount")

    await fa2.transfer({
      arg: {
        txs: [[user1.pkh, [[user2.pkh, tokenId, 1]]]],
      },
      as: user1.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '0', "Invalid amount")
    assert(balance_user2_after === '1', "Invalid amount")

  });

  it('Transfer a token from another user without a permit or an operator should fail', async () => {
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[user1.pkh, [[user2.pkh, tokenId, 1]]]],
        },
        as: user2.pkh,
      });
    }, errors.NO_ENTRY_FOR_USER);

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '0', "Invalid amount")
    assert(balance_user2_after === '1', "Invalid amount")
  });

  it('Transfer more tokens than owned should fail', async () => {
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[user2.pkh, [[user1.pkh, tokenId, 2]]]],
        },
        as: user2.pkh,
      });
    }, errors.FA2_INSUFFICIENT_BALANCE);

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '0', "Invalid amount")
    assert(balance_user2_after === '1', "Invalid amount")
  });

  it('Transfer tokens with an operator', async () => {
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    await fa2.update_operators({
      argMichelson: `{Left (Pair "${user2.pkh}" "${user3.pkh}" ${tokenId})}`,
      as: user2.pkh,
    });

    await fa2.transfer({
      arg: {
        txs: [[user2.pkh, [[user1.pkh, tokenId, 1]]]],
      },
      as: user3.pkh,
    });

    await fa2.update_operators({
      argMichelson: `{Right (Pair "${user2.pkh}" "${user3.pkh}" ${tokenId})}`,
      as: user2.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '1', "Invalid amount")
    assert(balance_user2_after === '0', "Invalid amount")
  });

});

describe('[FA2 fungible] Transfers gasless ', async () => {
  it('Transfer gasless simple amount of token', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, user1.pkh);
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '1', "Invalid amount")
    assert(balance_user2_before === '0', "Invalid amount")

    const p = await mkTransferGaslessArgs(user1, user2, permits.address, amount, tokenId, counter, user1.name);

    await fa2.transfer_gasless({
      // argMichelson: `{Pair {Pair "${user1.pkh}" {Pair "${user2.pkh}" (Pair ${tokenId} ${amount})}} (Pair "${user1.pubk}" "${p.sig.prefixSig}")}`,
      arg: {
        batch: [[[[user1.pkh, [[user2.pkh, tokenId, amount]]]], user1.pubk, p.sig.prefixSig]],
      },
      as: user3.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '0', "Invalid amount")
    assert(balance_user2_after === '1', "Invalid amount")
  });

  it('Transfer a token from another user with wrong a permit should fail', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, user2.pkh);
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    const p = await mkTransferGaslessArgs(user2, user1, permits.address, amount, tokenId, counter, user1.name);

    const error = `(Pair \"MISSIGNED\"\n        0x${p.tosign})`

    await expectToThrow(async () => {
      await fa2.transfer_gasless({
        arg: {
          batch: [[[[user2.pkh, [[user1.pkh, tokenId, amount]]]], user2.pubk, p.sig.prefixSig]],
        },
        as: user3.pkh,
      });
    }, error);

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '0', "Invalid amount")
    assert(balance_user2_after === '1', "Invalid amount")
  });

  it('Transfer gasless', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, user2.pkh);
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    const p = await mkTransferGaslessArgs(user2, user1, permits.address, amount, tokenId, counter, user2.name);

    await fa2.transfer_gasless({
      arg: {
        batch: [[[[user2.pkh, [[user1.pkh, tokenId, amount]]]], user2.pubk, p.sig.prefixSig]],
      },
      as: user3.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '1', "Invalid amount")
    assert(balance_user2_after === '0', "Invalid amount")
  });

});

describe('[FA2 fungible] Consume permit', async () => {

  it('Set global expiry with too big value should fail', async () => {
    await expectToThrow(async () => {
      await permits.set_expiry({
        argMichelson: `(Pair (Some 999999999999999999999999999999999999999) (None))`,
        as: alice.pkh,
      });
    }, errors.EXPIRY_TOO_BIG);
  });

  it('Simple transfer with permit', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, user1.pkh);

    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '1', "Invalid amount")
    assert(balance_user2_before === '0', "Invalid amount")

    const permit = await mkTransferPermit(
      user1,
      user2,
      permits.address,
      amount,
      tokenId,
      counter
    );

    await permits.permit({
      argMichelson: `(Pair "${user1.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: bob.pkh,
    });

    await fa2.transfer({
      arg: {
        txs: [[user1.pkh, [[user2.pkh, tokenId, 1]]]],
      },
      as: user3.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '0', "Invalid amount")
    assert(balance_user2_after === '1', "Invalid amount")
  });

  it('Set expiry for an existing permit with too big value should fail', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, user2.pkh);

    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    const permit = await mkTransferPermit(
      user2,
      user1,
      permits.address,
      amount,
      tokenId,
      counter
    );

    await permits.permit({
      argMichelson: `(Pair "${user2.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: user2.pkh,
    });

    await expectToThrow(async () => {
      await permits.set_expiry({
        argMichelson: `(Pair (Some 999999999999999999999999999999999999999) (Some 0x${permit.hash}))`,
        as: user2.pkh,
      });
    }, errors.EXPIRY_TOO_BIG);
  });

  it('Set expiry with a correct value should succeed', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, user2.pkh);

    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_before = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_before === '0', "Invalid amount")
    assert(balance_user2_before === '1', "Invalid amount")

    const permit = await mkTransferPermit(
      user2,
      user1,
      permits.address,
      amount,
      tokenId,
      counter
    );

    setMockupNow(timestamp_now)

    await permits.permit({
      argMichelson: `(Pair "${user2.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: user2.pkh,
    });

    const expiry = 3600;

    await permits.set_expiry({
      argMichelson: `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`,
      as: user2.pkh,
    });

    setMockupNow(timestamp_now + expiry + 10)
    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[user2.pkh, [[user1.pkh, tokenId, 1]]]],
        },
        as: user3.pkh,
      });
    }, errors.PERMIT_EXPIRED);

    setMockupNow(timestamp_now)
    await fa2.transfer({
      arg: {
        txs: [[user2.pkh, [[user1.pkh, tokenId, 1]]]],
      },
      as: user3.pkh,
    });
    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    const balance_user2_after = await getBalanceLedger(fa2, user2.pkh);
    assert(balance_user1_after === '1', "Invalid amount")
    assert(balance_user2_after === '0', "Invalid amount")
  });

  it('Set expiry with 0 (permit get deleted) should succeed', async () => {
    const amount = 12;
    const counter = await getPermitNb(permits, carl.pkh);

    const permit = await mkTransferPermit(
      carl,
      bob,
      permits.address,
      amount,
      tokenId,
      counter
    );

    const initialPermit = await getPermit(permits, carl.pkh);
    assert(initialPermit == null);

    await permits.permit({
      argMichelson: `(Pair "${carl.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: carl.pkh,
    });

    const addedPermit = await getPermit(permits, carl.pkh);
    const addedPermitValue = jsonMichelineToExpr(addedPermit)
    const addedPermitRef = `(Pair 1 None {Elt 0x976a3d63af06ce34e879432448471fde168fb92099514e6168467445273a82f6 (Pair (Some 31556952) "${GetIsoStringFromTimestamp(timestamp_now + 1)}")})`
    assert(addedPermitValue == addedPermitRef, "Invalid Value")

    await permits.set_expiry({
      argMichelson: `(Pair (Some 0) (Some 0x${permit.hash}))`,
      as: carl.pkh,
    });

    const finalPermit = await getPermit(permits, carl.pkh);
    const finalPermitValue = jsonMichelineToExpr(finalPermit)
    const finalPermitRef = '(Pair 1 None {})'
    assert(finalPermitValue == finalPermitRef, "Invalid Value")
  });

});

describe('[FA2 fungible] Set metadata', async () => {
  it('Set metadata with empty content should succeed', async () => {
    const metadata_before = await getMetadata(fa2, "key");
    assert(metadata_before == null);

    await fa2.set_metadata({
      arg: {
        k: 'key',
        d: '0x'
      },
      as: alice.pkh,
    });

    const metadata_after = await getMetadata(fa2, "key");
    assert(metadata_after == '');
  });

  it('Set metadata called by not owner should fail', async () => {
    await expectToThrow(async () => {
      await fa2.set_metadata({
        arg: {
          k: 'key',
          d: '0x'
        },
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Set metadata with valid content should succeed', async () => {
    const data = '697066733a2f2f516d617635756142437a4d77377871446f55364d444534743473695855484e4737664a68474c746f79774b35694a';
    const metadata_before = await getMetadata(fa2, "key");
    assert(metadata_before == '');

    await fa2.set_metadata({
      arg: {
        k: 'key',
        d: `0x${data}`
      },
      as: alice.pkh,
    });

    const metadata_after = await getMetadata(fa2, "key");
    assert(metadata_after == `${data}`);
  });
});

describe('[FA2 fungible] Burn', async () => {
  it('Burn token should succeed', async () => {
    const balance_user1_before = await getBalanceLedger(fa2, user1.pkh);
    assert(balance_user1_before === '1', "Invalid amount")

    await fa2.burn({
      arg: {
        nbt: 1
      },
      as: user1.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, user1.pkh);
    assert(balance_user1_after === '0', "Invalid amount")

  });

  it('Burn without tokens should fail', async () => {
    await expectToThrow(async () => {
      await fa2.burn({
        arg: {
          nbt: 1
        },
        as: user1.pkh,
      });
    }, errors.FA2_INSUFFICIENT_BALANCE);
  });

  it('Burn tokens with a partial amount of tokens should succeed', async () => {
    const amount = 500
    const balance_user1_before = await getBalanceLedger(fa2, carl.pkh);

    await fa2.burn({
      arg: {
        nbt: amount,
      },
      as: carl.pkh,
    });

    const balance_user1_after = await getBalanceLedger(fa2, carl.pkh);
    assert(parseInt(balance_user1_before) - amount == balance_user1_after, "Invalid Value")
  });

  it('Burn tokens with more tokens owned should failed', async () => {
    const balance_carl_before = await getBalanceLedger(fa2, carl.pkh);
    assert(balance_carl_before === '500', "Invalid amount")

    await expectToThrow(async () => {
      await fa2.burn({
        arg: {
          nbt: 1000,
        },
        as: carl.pkh,
      });
    }, errors.FA2_INSUFFICIENT_BALANCE);

    const balance_carl_after = await getBalanceLedger(fa2, carl.pkh);
    assert(balance_carl_after === '500', "Invalid amount")
  });

});

describe('[FA2 fungible] Pause', async () => {
  it('Set FA2 on pause should succeed', async () => {
    await fa2.pause({
      as: alice.pkh,
    });
    const storage = await fa2.getStorage();
    assert(storage.paused == true);
  });
  it('Set Permits on pause should succeed', async () => {
    await permits.pause({
      as: alice.pkh,
    });
    const storage = await permits.getStorage();
    assert(storage.paused == true);
  });

  it('Minting is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      await fa2.mint({
        arg: {
          tow: alice.pkh,
          nbt: 1000,
        },
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Update operators is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      await fa2.update_operators({
        argMichelson: `{Left (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId})}`,
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Add permit is not possible when contract is paused should fail', async () => {
    const amount = 1;
    const counter = await getPermitNb(permits, alice.pkh);

    const permit = await mkTransferPermit(
      alice,
      bob,
      permits.address,
      amount,
      tokenId,
      counter
    );
    await expectToThrow(async () => {
      await permits.permit({
        argMichelson: `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
        as: bob.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Transfer is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[alice.pkh, [[bob.pkh, tokenId, 123]]]],
        },
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Set metadata is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      const bytes =
        '0x05070707070a00000016016a5569553c34c4bfe352ad21740dea4e2faad3da000a00000004f5f466ab070700000a000000209aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
      const argM = `(Pair "" (Some ${bytes}))`;
      await fa2.set_metadata({
        argMichelson: argM,
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Set expiry is not possible when contract is paused should fail', async () => {
    const amount = 11;
    const expiry = 8;
    const counter = 1;

    const permit = await mkTransferPermit(
      carl,
      bob,
      permits.address,
      amount,
      tokenId,
      counter
    );

    await expectToThrow(async () => {
      await permits.set_expiry({
        argMichelson: `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`,
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Burn is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      await fa2.burn({
        arg: {
          nbt: 1
        },
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Unpause by not owner should fail', async () => {
    await expectToThrow(async () => {
      await fa2.unpause({
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Unpause by owner should succeed', async () => {
    await fa2.unpause({
      as: alice.pkh,
    });
    await permits.unpause({
      as: alice.pkh,
    });
  });
});

describe('[FA2 fungible] Transfer ownership', async () => {

  it('Transfer ownership when contract is paused should succeed', async () => {
    let storage = await fa2.getStorage();
    assert(storage.owner == alice.pkh);
    await fa2.declare_ownership({
      argMichelson: `"${alice.pkh}"`,
      as: alice.pkh,
    });
    storage = await fa2.getStorage();
    assert(storage.owner == alice.pkh);
  });

  it('Transfer ownership as non owner should fail', async () => {
    await expectToThrow(async () => {
      await fa2.declare_ownership({
        argMichelson: `"${bob.pkh}"`,
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Transfer ownership as owner should succeed', async () => {
    let storage = await fa2.getStorage();
    assert(storage.owner == alice.pkh);
    await fa2.declare_ownership({
      argMichelson: `"${bob.pkh}"`,
      as: alice.pkh,
    });
    await fa2.claim_ownership({
      as: bob.pkh,
    });
    storage = await fa2.getStorage();
    assert(storage.owner == bob.pkh);
  });
});


describe('[FA2 fungible] Balance of', async () => {

  it('Simple balance of', async () => {
    const balance_alice = await getBalanceLedger(fa2, alice.pkh);

    const res = await runGetter("balance_of", fa2.address, {
      argMichelson: `{ Pair "${alice.pkh}" ${tokenId} }`,
      as: alice.pkh,
    });

    const resRef = `{Pair (Pair 0x00006b82198cb179e8306c1bedd08f12dc863f328886 ${tokenId}) ${balance_alice}}`
    assert(res == resRef, "Invalid value")
  });

  it('Call balance of with other token id', async () => {
    const otherTokenId = 1

    const res = await runGetter("balance_of", fa2.address, {
      argMichelson: `{ Pair "${alice.pkh}" ${otherTokenId} }`,
      as: alice.pkh,
    });

    const resRef = `{Pair (Pair 0x00006b82198cb179e8306c1bedd08f12dc863f328886 ${otherTokenId}) 0}`
    assert(res == resRef, "Invalid value")
  });

  it('Call balance of with unknown address', async () => {
    const res = await runGetter("balance_of", fa2.address, {
      argMichelson: `{ Pair "${user4.pkh}" ${tokenId} }`,
      as: alice.pkh,
    });

    const resRef = `{Pair (Pair 0x0000a9ceae0f8909125492a7c4700acc59274cc6c846 ${tokenId}) 0}`
    assert(res == resRef, "Invalid value")
  });

});
