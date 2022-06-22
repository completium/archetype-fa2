const {
  deploy,
  getAccount,
  getValueFromBigMap,
  setQuiet,
  expectToThrow,
  exprMichelineToJson,
  jsonMichelineToExpr,
  setMockupNow,
} = require('@completium/completium-cli');
const { errors, mkTransferPermit, mkTransferGaslessArgs, getPermitNb, getTransferPermitData, getSignHashPermit, getPermit, GetIsoStringFromTimestamp, mkPackDataTransferGasless, getMetadata } = require('./utils');
const assert = require('assert');

require('mocha/package.json');

setQuiet('true');
const timestamp_now = Math.floor(Date.now() / 1000)

setMockupNow(timestamp_now)

const mockup_mode = true;

// contracts
let fa2;
let permits;

// accounts
const alice = getAccount(mockup_mode ? 'alice' : 'alice');
const bob = getAccount(mockup_mode ? 'bob' : 'bob');
const carl = getAccount(mockup_mode ? 'carl' : 'carl');
const daniel = getAccount(mockup_mode ? 'bootstrap1' : 'daniel');

const amount = 1;
let tokenId = 0;
const testAmount_1 = 1;
const testAmount_2 = 11;
let alicePermitNb = 0;
let bobPermitNb = 0;
let carlPermitNb = 0;

// permits
let permit;

async function expectToThrowMissigned(f, e) {
  const m = 'Failed to throw' + (e !== undefined ? e : '');
  try {
    await f();
    throw new Error(m);
  } catch (ex) {
    if ((ex.message && e !== undefined) || (ex && e !== undefined)) {
      if (ex.message)
        assert(
          ex.message.includes(e),
          `${e} was not found in the error message`
        );
      else
        assert(
          ex.value.includes(e),
          `${e} was not found in the error message`
        );
    } else if (ex.message === m) {
      throw e;
    }
  }
}

describe('[FA2 NFT] Contract deployment', async () => {
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
  it('FA2 NFT contract deployment should succeed', async () => {
    [fa2, _] = await deploy(
      './contracts/fa2-nft.arl',
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

describe('[FA2 NFT] Contract configuration', async () => {
  it("Add FA2 as permit consumer", async () => {
    await permits.manage_consumer({
      arg: {
        p : { "kind" : "left", "value" : `${fa2.address}` }
      },
      as: alice.pkh
    })
  })
})

describe('[FA2 NFT] Minting', async () => {
  it('Mint tokens on FA2 as owner for owner should succeed', async () => {
    await fa2.mint({
      arg: {
        tid: tokenId,
        tow: alice.pkh,
        tmd: [{ key: '', value: '0x' }],
        roy: [
          [alice.pkh, 1000],
          [bob.pkh, 500],
        ],
      },
      as: alice.pkh,
    });
    const storage = await fa2.getStorage();
    var balance = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(balance.string == alice.pkh);
  });

  it('Mint tokens on FA2 as non owner should fail', async () => {
    await expectToThrow(async () => {
      await fa2.mint({
        arg: {
          tid: tokenId + 1,
          tow: bob.pkh,
          tmd: [{ key: '', value: '0x' }],
          roy: [
            [alice.pkh, 1000],
            [bob.pkh, 500],
          ],
        },
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Mint tokens on FA2 as owner for someone else should succeed', async () => {
    await fa2.mint({
      arg: {
        tid: tokenId + 3,
        tow: carl.pkh,
        tmd: [{ key: '', value: '0x' }],
        roy: [
          [alice.pkh, 1000],
          [bob.pkh, 500],
        ],
      },
      as: alice.pkh,
    });
    const storage = await fa2.getStorage();
    var balance = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId + 3}`),
      exprMichelineToJson(`nat`)
    );
    assert(balance.string == carl.pkh);
  });

  it('Re-Mint same tokens on FA2 contract should fail', async () => {
    await expectToThrow(async () => {
      await fa2.mint({
        arg: {
          tid: tokenId,
          tow: alice.pkh,
          tmd: [{ key: '', value: '0x' }],
          roy: [
            [alice.pkh, 1000],
            [bob.pkh, 500],
          ],
        },
        as: alice.pkh,
      });
    }, errors.KEY_EXISTS);
  });

});

describe('[FA2 NFT] Update operators', async () => {
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
        `(Pair "${fa2.address}" (Pair ${tokenId} "${alice.pkh}"))`
      ),
      exprMichelineToJson(`(pair address (pair nat address))'`)
    );
    assert(operatorsAfterRemoval == null);
  });
});

describe('[FA2 NFT] Add permit', async () => {
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

describe('[FA2 NFT] Transfers', async () => {
  it('Transfer a token not owned should fail', async () => {
    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[alice.pkh, [[bob.pkh, 777, 1]]]],
        },
        as: alice.pkh,
      });
    }, errors.FA2_NOT_OPERATOR);
  });

  it('Transfer a token from another user without a permit or an operator should fail', async () => {
    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[alice.pkh, [[bob.pkh, tokenId, 1]]]],
        },
        as: bob.pkh,
      });
    }, errors.FA2_NOT_OPERATOR);
  });

  it('Transfer more tokens than owned should fail', async () => {
    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[alice.pkh, [[bob.pkh, tokenId, 666]]]],
        },
        as: alice.pkh,
      });
    }, errors.FA2_INSUFFICIENT_BALANCE);
  });

  it('Transfer tokens without operator and an expired permit should fail', async () => {

    setMockupNow(timestamp_now);

    const counter = await getPermitNb(permits, alice.pkh);

    permit = await mkTransferPermit(
      alice,
      bob,
      permits.address,
      amount,
      tokenId,
      counter
    );
    const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
    await permits.permit({
      argMichelson: argM,
      as: bob.pkh,
    });

    const argMExp = `(Pair (Some 1) (Some 0x${permit.hash}))`;

    const expiry = 3600;

    await permits.set_expiry({
      argMichelson: `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`,
      as: alice.pkh,
    });

    setMockupNow(timestamp_now + expiry + 10);

    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[alice.pkh, [[bob.pkh, tokenId, amount]]]],
        },
        as: carl.pkh,
      });
    }, errors.PERMIT_EXPIRED);
  });

  it('Transfer tokens with an operator and with permit (permit not consumed) should succeed', async () => {
    var storage = await permits.getStorage();

    const counter = await getPermitNb(permits, alice.pkh);

    permit = await mkTransferPermit(
      alice,
      carl,
      permits.address,
      amount,
      tokenId,
      counter
    );
    const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
    await permits.permit({
      argMichelson: argM,
      as: carl.pkh,
    });

    var initState = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${alice.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    const permits_nb = initState.args[2].length

    await fa2.update_operators({
      argMichelson: `{Left (Pair "${alice.pkh}" "${carl.pkh}" ${tokenId})}`,
      as: alice.pkh,
    });

    storage = await fa2.getStorage();

    var aliceBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(aliceBalances.string == alice.pkh);
    var bobBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(bobBalances.string == alice.pkh);

    await fa2.transfer({
      arg: {
        txs: [[alice.pkh, [[bob.pkh, tokenId, amount]]]],
      },
      as: carl.pkh,
    });

    storage = await permits.getStorage();

    var addedPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${alice.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    assert(
      permits_nb == addedPermit.args[2].length &&
      JSON.stringify(initState.args[2]) == JSON.stringify(addedPermit.args[2])
    );

    storage = await fa2.getStorage();

    var alicePostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(alicePostTransferBalances.string == bob.pkh);
    var bobPostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(bobPostTransferBalances.string == bob.pkh);
  });

  it('Transfer tokens without an operator and a valid permit (permit consumed)', async () => {
    // permit to transfer from payer to usdsReceiver
    var storage = await permits.getStorage();

    await fa2.mint({
      arg: {
        tid: tokenId + 11,
        tow: alice.pkh,
        tmd: [{ key: '', value: '0x' }],
        roy: [
          [alice.pkh, 1000],
          [bob.pkh, 500],
        ],
      },
      as: alice.pkh,
    });

    const counter = await getPermitNb(permits, alice.pkh);

    permit = await mkTransferPermit(
      alice,
      bob,
      permits.address,
      amount,
      tokenId + 11,
      counter
    );
    const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
    await permits.permit({
      argMichelson: argM,
      as: alice.pkh,
    });

    var initState = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${alice.pkh}"`),
      exprMichelineToJson(`address'`)
    );
    const permits_nb = initState.args[2].length
    storage = await fa2.getStorage();

    var aliceBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId + 11}`),
      exprMichelineToJson(`nat`)
    );
    assert(aliceBalances.string == alice.pkh);
    var bobBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId + 11}`),
      exprMichelineToJson(`nat`)
    );
    assert(bobBalances.string == alice.pkh);

    await fa2.update_operators({
      argMichelson: `{Right (Pair "${alice.pkh}" "${bob.pkh}" ${tokenId + 11})}`,
      as: alice.pkh,
    });

    await fa2.transfer({
      arg: {
        txs: [[alice.pkh, [[bob.pkh, tokenId + 11, amount]]]],
      },
      as: bob.pkh,
    });

    storage = await permits.getStorage();
    var addedPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${alice.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    assert(
      permits_nb > addedPermit.args[2].length
    );
    storage = await fa2.getStorage();
    var alicePostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId + 11}`),
      exprMichelineToJson(`nat`)
    );
    assert(alicePostTransferBalances.string == bob.pkh);
    var bobPostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${tokenId + 11}`),
      exprMichelineToJson(`nat`)
    );
    assert(bobPostTransferBalances.string == bob.pkh);
  });
});

describe('[FA2 NFT] Transfers gasless ', async () => {
  it('Transfer a token not owned should fail', async () => {
    const counter = await getPermitNb(permits, alice.pkh);
    await expectToThrowMissigned(async () => {
      const testTokenId = 777
      permit = await mkTransferGaslessArgs(
        alice,
        bob,
        permits.address,
        amount,
        tokenId,
        counter
      );
      await fa2.transfer_gasless({
        argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${alice.pubk}" "${permit.sig.prefixSig}" )}`,
        as: alice.pkh,
      });
    }, errors.MISSIGNED);
  });

  it('Transfer a token from another user with wrong a permit should fail', async () => {
    const counter = await getPermitNb(permits, alice.pkh);

    await expectToThrowMissigned(async () => {
      const testTokenId = 1
      permit = await mkTransferGaslessArgs(
        alice,
        bob,
        permits.address,
        amount,
        tokenId,
        counter
      );
      await fa2.transfer_gasless({
        argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${bob.pubk}" "${permit.sig.prefixSig}" )}`,
        as: bob.pkh,
      });
    }, errors.MISSIGNED);
  });

  it('Transfer more tokens than owned should fail', async () => {
    const counter = await getPermitNb(permits, alice.pkh);

    await expectToThrowMissigned(async () => {
      const testTokenId = 1
      permit = await mkTransferGaslessArgs(
        alice,
        bob,
        permits.address,
        7777777,
        testTokenId,
        counter
      );
      await fa2.transfer_gasless({
        argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${bob.pubk}" "${permit.sig.prefixSig}" )}`,
        as: alice.pkh,
      });
    }, errors.MISSIGNED);
  });


  it('Transfer tokens with permit should succeed', async () => {
    var storage = await fa2.getStorage();
    const testTokenId = 11111

    await fa2.mint({
      arg: {
        tid: testTokenId,
        tow: alice.pkh,
        tmd: [{ key: '', value: '0x' }],
        roy: [
          [alice.pkh, 1000],
          [bob.pkh, 500],
        ],
      },
      as: alice.pkh,
    });

    var counter = await getPermitNb(permits, alice.pkh);
    permit = await mkTransferGaslessArgs(
      alice,
      bob,
      permits.address,
      amount,
      testTokenId,
      counter
    );

    var aliceBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(aliceBalances.string == alice.pkh);
    var bobBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(bobBalances.string == alice.pkh);

    await fa2.transfer_gasless({
      argMichelson: `{ Pair { Pair "${alice.pkh}" { Pair "${bob.pkh}" (Pair ${testTokenId} ${amount}) } } (Pair "${alice.pubk}" "${permit.sig.prefixSig}" )}`,
      as: bob.pkh,
    });

    storage = await permits.getStorage();
    var addedPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${alice.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    assert(
      "" + (counter+1) == addedPermit.args[0].int
    );
    storage = await fa2.getStorage();
    var alicePostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(alicePostTransferBalances.string == bob.pkh);
    var bobPostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(bobPostTransferBalances.string == bob.pkh);
  });

});

describe('[FA2 NFT] Set metadata', async () => {
  it('Set metadata with empty content should succeed', async () => {
    const argM = `(Pair "key" (Some 0x))`;
    const storage = await fa2.getStorage();
    await fa2.set_metadata({
      argMichelson: argM,
      as: alice.pkh,
    });
    var metadata = await getValueFromBigMap(
      parseInt(storage.metadata),
      exprMichelineToJson(`""`),
      exprMichelineToJson(`string'`)
    );
    assert(metadata.bytes == '');
  });

  it('Set metadata called by not owner should fail', async () => {
    await expectToThrow(async () => {
      const argM = `(Pair "key" (Some 0x))`;
      await fa2.set_metadata({
        argMichelson: argM,
        as: bob.pkh,
      });
    }, errors.INVALID_CALLER);
  });

  it('Set metadata with valid content should succeed', async () => {
    const bytes =
      '0x05070707070a00000016016a5569553c34c4bfe352ad21740dea4e2faad3da000a00000004f5f466ab070700000a000000209aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc';
    const argM = `(Pair "" (Some ${bytes}))`;
    const storage = await fa2.getStorage();

    await fa2.set_metadata({
      argMichelson: argM,
      as: alice.pkh,
    });

    var metadata = await getValueFromBigMap(
      parseInt(storage.metadata),
      exprMichelineToJson(`""`),
      exprMichelineToJson(`string'`)
    );
    assert('0x' + metadata.bytes == bytes);
  });
});

describe('[FA2 NFT] Set expiry', async () => {

  it('Set global expiry with too big value should fail', async () => {
    const argMExp = `(Pair (Some 999999999999999999999999999999999999999) (None))`;
    await expectToThrow(async () => {
      await permits.set_expiry({
        argMichelson: argMExp,
        as: alice.pkh,
      });
    }, errors.EXPIRY_TOO_BIG);
  });

  it('Set expiry for an existing permit with too big value should fail', async () => {
    const counter = await getPermitNb(permits, alice.pkh);
    await expectToThrow(async () => {
      const testAmount = 11;
      permit = await mkTransferPermit(
        alice,
        bob,
        permits.address,
        testAmount,
        tokenId,
        counter
      );
      const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;
      await permits.permit({
        argMichelson: argM,
        as: alice.pkh,
      });
      const argMExp = `(Pair (Some 999999999999999999999999999999999999999) (Some 0x${permit.hash}))`;

      await permits.set_expiry({
        argMichelson: argMExp,
        as: bob.pkh,
      });
    }, errors.EXPIRY_TOO_BIG);
  });

  it('Set expiry with 0 (permit get deleted) should succeed', async () => {
    const testAmount = testAmount_2;
    var counter = await getPermitNb(permits, carl.pkh);

    permit = await mkTransferPermit(
      carl,
      alice,
      permits.address,
      testAmount,
      tokenId,
      counter
    );
    const argM = `(Pair "${carl.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

    var storage = await permits.getStorage();
    var initialPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${carl.pkh}"`),
      exprMichelineToJson(`address'`)
    );
    assert(initialPermit == null);

    await permits.permit({
      argMichelson: argM,
      as: alice.pkh,
    });

    storage = await permits.getStorage();
    var addedPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${carl.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    counter = await getPermitNb(permits, carl.pkh);

    assert(
      addedPermit.args.length == 3 &&
      addedPermit.prim == 'Pair' &&
      addedPermit.args[0].int == '' + counter &&
      addedPermit.args[1].prim == 'None' &&
      addedPermit.args[2].length == 1 &&
      addedPermit.args[2][0].prim == 'Elt' &&
      addedPermit.args[2][0].args[0].bytes == permit.hash &&
      addedPermit.args[2][0].args[1].prim == 'Pair' &&
      addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
      addedPermit.args[2][0].args[1].args[0].args[0].int == '31556952'
    );

    const argMExp = `(Pair (Some 0) (Some 0x${permit.hash}))`;

    await permits.set_expiry({
      argMichelson: argMExp,
      as: carl.pkh,
    });

    storage = await permits.getStorage();
    var finalPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${carl.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    counter = await getPermitNb(permits, carl.pkh);

    assert(
      finalPermit.args.length == 3 &&
      finalPermit.prim == 'Pair' &&
      finalPermit.args[0].int == '' + counter &&
      finalPermit.args[1].prim == 'None' &&
      finalPermit.args[2].length == 0
    );

  });

  it('Set expiry with a correct value should succeed', async () => {
    const testAmount = 11;
    const expiry = 8;
    var storage = await permits.getStorage();

    var counter = await getPermitNb(permits, carl.pkh);

    permit = await mkTransferPermit(
      carl,
      bob,
      permits.address,
      testAmount,
      tokenId,
      counter
    );
    const argM = `(Pair "${carl.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

    var initialPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${carl.pkh}"`),
      exprMichelineToJson(`address'`)
    );
    assert(
      initialPermit.args.length == 3 &&
      initialPermit.prim == 'Pair' &&
      initialPermit.args[0].int == '' + counter &&
      initialPermit.args[1].prim == 'None' &&
      initialPermit.args[2].length == 0
    );
    await permits.permit({
      argMichelson: argM,
      as: alice.pkh,
    });

    storage = await permits.getStorage();
    var createdAt = await await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${carl.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    counter = await getPermitNb(permits, carl.pkh);
    assert(
      createdAt.args.length == 3 &&
      createdAt.prim == 'Pair' &&
      createdAt.args[0].int == '' + counter &&
      createdAt.args[1].prim == 'None' &&
      createdAt.args[2].length == 1 &&
      createdAt.args[2][0].prim == 'Elt' &&
      createdAt.args[2][0].args[0].bytes == permit.hash &&
      createdAt.args[2][0].args[1].prim == 'Pair' &&
      createdAt.args[2][0].args[1].args[0].prim == 'Some' &&
      createdAt.args[2][0].args[1].args[0].args[0].int == '31556952'
    );

    var creationDate = createdAt.args[2][0].args[1].args[1].string;

    const argMExp = `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`;

    await permits.set_expiry({
      argMichelson: argMExp,
      as: carl.pkh,
    });

    storage = await permits.getStorage();

    var addedPermit = await getValueFromBigMap(
      parseInt(storage.permits),
      exprMichelineToJson(`"${carl.pkh}"`),
      exprMichelineToJson(`address'`)
    );

    counter = await getPermitNb(permits, carl.pkh);

    assert(
      addedPermit.args.length == 3 &&
      addedPermit.prim == 'Pair' &&
      addedPermit.args[0].int == '' + counter &&
      addedPermit.args[1].prim == 'None' &&
      addedPermit.args[2].length == 1 &&
      addedPermit.args[2][0].prim == 'Elt' &&
      addedPermit.args[2][0].args[0].bytes == permit.hash &&
      addedPermit.args[2][0].args[1].prim == 'Pair' &&
      addedPermit.args[2][0].args[1].args[0].prim == 'Some' &&
      addedPermit.args[2][0].args[1].args[0].args[0].int == expiry &&
      addedPermit.args[2][0].args[1].args[1].string == creationDate
    );
  });
});

describe('[FA2 NFT] Burn', async () => {
  it('Burn without tokens should fail', async () => {
    await expectToThrow(async () => {
      await fa2.burn({
        argMichelson: `${tokenId}`,
        as: alice.pkh,
      });
    }, errors.CALLER_NOT_OWNER);
  });

  it('Burn tokens of someone else should fail', async () => {
    await expectToThrow(async () => {
      await fa2.burn({
        argMichelson: `${tokenId}`,
        as: alice.pkh,
      });
    }, errors.CALLER_NOT_OWNER);
  });

  it('Burn tokens with enough tokens should succeed', async () => {
    const storage = await fa2.getStorage();
    const testTokenId = tokenId + 777;
    await fa2.mint({
      arg: {
        tid: testTokenId,
        tow: alice.pkh,
        tmd: [{ key: '', value: '0x' }],
        roy: [
          [alice.pkh, 1000],
          [bob.pkh, 500],
        ],
      },
      as: alice.pkh,
    });

    var aliceTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(aliceTransferBalances.string === alice.pkh);
    await fa2.burn({
      argMichelson: `${testTokenId}`,
      as: alice.pkh,
    });

    var alicePostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(alicePostTransferBalances === null);
  });

  it('Re-mint a burnt token', async () => {
    const storage = await fa2.getStorage();
    const testTokenId = tokenId + 777;
    await fa2.mint({
      arg: {
        tid: testTokenId,
        tow: alice.pkh,
        tmd: [{ key: '', value: '0x' }],
        roy: [
          [alice.pkh, 1000],
          [bob.pkh, 500],
        ],
      },
      as: alice.pkh,
    });

    var aliceTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(aliceTransferBalances.string === alice.pkh);
    await fa2.burn({
      argMichelson: `${testTokenId}`,
      as: alice.pkh,
    });

    var alicePostTransferBalances = await getValueFromBigMap(
      parseInt(storage.ledger),
      exprMichelineToJson(`${testTokenId}`),
      exprMichelineToJson(`nat`)
    );
    assert(alicePostTransferBalances === null);
  });
});

describe('[FA2 NFT] Pause', async () => {
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
          tid: tokenId,
          tow: alice.pkh,
          tmd: [{ key: '', value: '0x' }],
          roy: [
            [alice.pkh, 1000],
            [bob.pkh, 500],
          ],
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
    var counter = await getPermitNb(permits, alice.pkh);
    await expectToThrow(async () => {
      permit = await mkTransferPermit(
        alice,
        bob,
        permits.address,
        amount,
        tokenId,
        counter
      );
      const argM = `(Pair "${alice.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`;

      await permits.permit({
        argMichelson: argM,
        as: bob.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Transfer is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      await fa2.transfer({
        arg: {
          txs: [[alice.pkh, [[bob.pkh, tokenId, 777]]]],
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
    const testAmount = 11;
    const expiry = 8;
    var counter = await getPermitNb(permits, carl.pkh);

    permit = await mkTransferPermit(
      carl,
      bob,
      permits.address,
      testAmount,
      tokenId,
      counter
    );
    const argMExp = `(Pair (Some ${expiry}) (Some 0x${permit.hash}))`;
    await expectToThrow(async () => {
      await permits.set_expiry({
        argMichelson: argMExp,
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

  it('Burn is not possible when contract is paused should fail', async () => {
    await expectToThrow(async () => {
      await fa2.burn({
        argMichelson: `${tokenId}`,
        as: alice.pkh,
      });
    }, errors.CONTRACT_PAUSED);
  });

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

});

describe('[FA2 NFT] Transfer ownership', async () => {
  it('Transfer ownership as non owner should fail', async () => {
    await fa2.unpause({
      as: alice.pkh,
    });
    await permits.unpause({
      as: alice.pkh,
    });
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

