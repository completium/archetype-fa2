import { Account, Bytes, expect_to_fail, get_account, Key, Nat, Option, option_to_mich_type, Or, pack, pair_array_to_mich_type, pair_to_mich, pair_to_mich_type, prim_to_mich_type, set_mockup, set_mockup_now, set_quiet, sign, Signature, string_to_mich, transfer } from '@completium/experiment-ts'

import { get_packed_transfer_params, get_transfer_permit_data } from './utils'

const assert = require('assert');

/* Contracts */

import { fa2_fungible, gasless_param, operator_key, operator_param, transfer_destination, transfer_param } from './binding/fa2_fungible';
import { add, permits, permits_value, user_permit } from './binding/permits';

/* Accounts ----------------------------------------------------------------- */

const alice = get_account('alice');
const bob   = get_account('bob');
const carl  = get_account('carl');
const user1 = get_account('bootstrap1');
const user2 = get_account('bootstrap2');
const user3 = get_account('bootstrap3');
const user4 = get_account('bootstrap4');

/* Endpoint ---------------------------------------------------------------- */

set_mockup()

/* Verbose mode ------------------------------------------------------------ */

set_quiet(true);

/* Now --------------------------------------------------------------------- */

const now = new Date(Date.now())
set_mockup_now(now)

/* Constants & Utils ------------------------------------------------------- */

const token_id = new Nat(0)
const amount = new Nat(123)
const expiry = new Nat(31556952)

const wrong_sig = new Signature("edsigu3QDtEZeSCX146136yQdJnyJDfuMRsDxiCgea3x7ty2RTwDdPpgioHWJUe86tgTCkeD2u16Az5wtNFDdjGyDpb7MiyU3fn");
const wrong_packed_transfer_params = new Bytes('9aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc');

const get_ref_user_permits = (counter : Nat, packed_data : Bytes, expiry : Nat, now : Date) => {
  return new permits_value(counter, Option.None<Nat>(), [[
    packed_data,
    new user_permit(Option.Some<Nat>(expiry), new Date(now.getTime() - now.getMilliseconds()))
  ]])
}

const get_missigned_error = (permit_data : Bytes) => {
  return pair_to_mich([string_to_mich("\"MISSIGNED\""), permit_data.to_mich()])
}

/* Scenarios --------------------------------------------------------------- */
describe('[FA2 fungible] Contracts deployment', async () => {
  it('Permits contract deployment should succeed', async () => {
    await permits.deploy( alice.get_address(), { as: alice })
  });
  it('FA2 fungible contract deployment should succeed', async () => {
    await fa2_fungible.deploy(alice.get_address(), permits.get_address(), { as: alice })
  });
});

describe('[FA2 fungible] Contract configuration', async () => {
  it("Add FA2 as permit consumer", async () => {
    await permits.manage_consumer(new add(fa2_fungible.get_address()),  { as: alice })
  })
})

describe('[FA2 fungible] Minting', async () => {
  it('Mint tokens as owner for ourself should succeed', async () => {
    const balance_alice_before = await fa2_fungible.get_ledger_value(alice.get_address())
    assert(balance_alice_before?.equals(new Nat('123000000000000')), "Invalid amount")

    await fa2_fungible.mint(alice.get_address(), new Nat(1000), { as: alice })

    const balance_alice_after = await fa2_fungible.get_ledger_value(alice.get_address())
    assert(balance_alice_after?.equals(new Nat('123000000001000')), "Invalid amount")
  });

  it('Mint tokens as non owner for ourself should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible.mint(bob.get_address(), new Nat(1000), { as: bob })
    }, fa2_fungible.errors.INVALID_CALLER);
  });

  it('Mint tokens as non owner for someone else should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible.mint(carl.get_address(), new Nat(1000), { as: bob })
    }, fa2_fungible.errors.INVALID_CALLER);
  });

  it('Mint tokens as owner for someone else should succeed', async () => {
    const balance_carl_before = await fa2_fungible.get_ledger_value(carl.get_address())
    assert(balance_carl_before == undefined, "Invalid amount")

    await fa2_fungible.mint(carl.get_address(), new Nat(1000), { as: alice })

    const balance_carl_after = await fa2_fungible.get_ledger_value(carl.get_address())
    assert(balance_carl_after?.equals(new Nat(1000)), "Invalid amount")
  });

  it('Mint token for user 1', async () => {
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    assert(balance_user1_before == undefined, "Invalid amount")

    await fa2_fungible.mint(user1.get_address(), new Nat(1), { as: alice })

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    assert(balance_user1_after?.equals(new Nat(1)), "Invalid amount")
  });
});

describe('[FA2 fungible] Update operators', async () => {
  it('Add an operator for ourself should succeed', async () => {
    const op_key = new operator_key(fa2_fungible.get_address(), token_id, alice.get_address())
    const has_operator_before = await fa2_fungible.has_operator_value(op_key)
    assert(has_operator_before == false)
    await fa2_fungible.update_operators([
      Or.Left(new operator_param(alice.get_address(), fa2_fungible.get_address(), token_id))
    ], { as : alice })
    const has_operator_after = await fa2_fungible.has_operator_value(op_key)
    assert(has_operator_after == true)
  });

  it('Remove a non existing operator should succeed', async () => {
    await fa2_fungible.update_operators([
      Or.Right(new operator_param(alice.get_address(), bob.get_address(), token_id))
    ], { as : alice })
  });

  it('Remove an existing operator for another user should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible.update_operators([
        Or.Right(new operator_param(alice.get_address(), fa2_fungible.get_address(), token_id))
      ], { as : bob })
    }, fa2_fungible.errors.CALLER_NOT_OWNER);
  });

  it('Add operator for another user should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible.update_operators([
        Or.Left(new operator_param(bob.get_address(), fa2_fungible.get_address(), token_id))
      ], { as : alice });
    }, fa2_fungible.errors.CALLER_NOT_OWNER);
  });

  it('Remove an existing operator should succeed', async () => {
    const op_key = new operator_key(fa2_fungible.get_address(), token_id, alice.get_address())
    const has_operator_before = await fa2_fungible.has_operator_value(op_key)
    assert(has_operator_before == true)
    await fa2_fungible.update_operators([
      Or.Right(new operator_param(alice.get_address(), fa2_fungible.get_address(), token_id))
    ], { as : alice })
    const has_operator_after = await fa2_fungible.has_operator_value(op_key)
    assert(has_operator_after == false)
  });
});

describe('[FA2 fungible] Add permit', async () => {
  it('Add a permit with the wrong signature should fail', async () => {
    const alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter

    const tps = [new transfer_param(alice.get_address(), [ new transfer_destination(bob.get_address(), token_id, amount) ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const permit_data = get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);

    await expect_to_fail(async () => {
      await permits.permit(new Key(alice.pubk), wrong_sig, packed_transfer_params, { as : bob })
    }, get_missigned_error(permit_data))

  });

  it('Add a permit with the wrong hash should fail', async () => {
    const alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter

    const tps = [new transfer_param(alice.get_address(), [ new transfer_destination(bob.get_address(), token_id, amount) ])]
    const packed_transfer_params = get_packed_transfer_params(tps)

    const permit_data = get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);

    const wrong_permit_data = get_transfer_permit_data(
      wrong_packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);

    await expect_to_fail(async () => {
      const sig = await sign(permit_data, alice)
      await permits.permit(new Key(alice.pubk), sig, wrong_packed_transfer_params, { as : bob })
    }, get_missigned_error(wrong_permit_data));
  });

  it('Add a permit with the wrong public key should fail', async () => {
    const alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter

    const tps = [new transfer_param(alice.get_address(), [ new transfer_destination(bob.get_address(), token_id, amount) ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const permit_data = get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);

    await expect_to_fail(async () => {
      const sig = await sign(permit_data, alice)
      await permits.permit(new Key(bob.pubk), sig, packed_transfer_params, { as : bob })
    }, get_missigned_error(permit_data));
  });

  it('Add a permit with the good hash, signature and public key should succeed', async () => {
    const alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter
    const tps = [new transfer_param(alice.get_address(), [ new transfer_destination(bob.get_address(), token_id, amount) ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const permit_data = get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);
    const sig = await sign(permit_data, alice)
    await permits.permit(new Key(alice.pubk), sig, packed_transfer_params, { as : bob })

    const added_permit = await permits.get_permits_value(alice.get_address())
    assert(added_permit?.equals(get_ref_user_permits(new Nat(1), packed_transfer_params, expiry, now)))
  });

  it('Add a duplicated permit should succeed', async () => {
    const amount = new Nat(123);
    const initial_permit = await permits.get_permits_value(alice.get_address())

    const alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter
    const tps = [new transfer_param(alice.get_address(), [ new transfer_destination(bob.get_address(), token_id, amount) ])]
    const packed_transfer_params = get_packed_transfer_params(tps)

    assert(initial_permit?.equals(get_ref_user_permits(new Nat(1), packed_transfer_params, expiry, now)))

    const permit_data = get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);
    const sig = await sign(permit_data, alice)
    await permits.permit(new Key(alice.pubk), sig, packed_transfer_params, { as : bob })

    const added_permit = await permits.get_permits_value(alice.get_address())
    assert(added_permit?.equals(get_ref_user_permits(new Nat(2), packed_transfer_params, expiry, now)))
  });

  it('Expired permit are removed when a new permit is added should succeed', async () => {
    const new_expiry = new Nat(1);

    let alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter
    const tps = [new transfer_param(alice.get_address(), [ new transfer_destination(bob.get_address(), token_id, amount) ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const permit_data = get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);
    const sig = await sign(permit_data, alice)
    await permits.permit(new Key(alice.pubk), sig, packed_transfer_params, { as : bob })

    const added_permit = await permits.get_permits_value(alice.get_address())
    assert(added_permit?.equals(get_ref_user_permits(new Nat(3), packed_transfer_params, expiry, now)))

    await permits.set_expiry(Option.Some<Nat>(new_expiry), Option.Some<Bytes>(packed_transfer_params), { as : alice })

    const res_permit = await permits.get_permits_value(alice.get_address())
    assert(res_permit?.equals(get_ref_user_permits(new Nat(3), packed_transfer_params, new_expiry, now)))

    const new_now = new Date(now.getTime() + 1100 * 1000)
    set_mockup_now(new_now);

    alice_permit_counter = (await permits.get_permits_value(alice.get_address()))?.counter
    const after_packed_transfer_params = get_packed_transfer_params(tps)
    const after_permit_data = await get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      alice_permit_counter);
    const sig_after = await sign(after_permit_data, alice)

    await permits.permit(new Key(alice.pubk), sig_after, after_packed_transfer_params, { as : bob })

    const after_second_permit_res = (await permits.get_permits_value(alice.get_address()))
    assert(after_second_permit_res?.equals(get_ref_user_permits(new Nat(4), after_packed_transfer_params, expiry, new_now)))
  });
});

describe('[FA2 fungible] Transfers', async () => {
  it('Transfer simple amount of token', async () => {
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before?.equals(new Nat(1)), "Invalid amount user 1")
    assert(balance_user2_before == undefined, "Invalid amount user 2")

    await fa2_fungible.transfer([new transfer_param(
      user1.get_address(),
      [new transfer_destination(user2.get_address(), token_id, new Nat(1))])],
      { as: user1 }
    );

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user2")
  });

  it('Transfer a token from another user without a permit or an operator should fail', async () => {
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    await expect_to_fail(async () => {
      await fa2_fungible.transfer([new transfer_param(
        user1.get_address(),
        [new transfer_destination(user2.get_address(), token_id, new Nat(1))])],
        { as: user2 }
      );
    }, fa2_fungible.errors.FA2_NOT_OPERATOR);

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user 1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user 2")
  });

  it('Transfer more tokens than owned should fail', async () => {
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    await expect_to_fail(async () => {
      await fa2_fungible.transfer([new transfer_param(
        user1.get_address(),
        [new transfer_destination(user2.get_address(), token_id, new Nat(2))])],
        { as: user1 }
      );
    }, fa2_fungible.errors.FA2_INSUFFICIENT_BALANCE);

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user2")
  });

  it('Transfer tokens with an operator', async () => {
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    await fa2_fungible.update_operators([
      Or.Left<operator_param, operator_param>(new operator_param(user2.get_address(), user3.get_address(), token_id))
      ],
      { as: user2 }
    );

    await fa2_fungible.transfer([new transfer_param(
      user2.get_address(),
      [new transfer_destination(user1.get_address(), token_id, new Nat(1))])],
      { as: user3 }
    );

    await fa2_fungible.update_operators([
      Or.Right<operator_param, operator_param>(new operator_param(user2.get_address(), user3.get_address(), token_id))
      ],
      { as: user2 }
    );

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after?.equals(new Nat(1)), "Invalid amount after user1")
    assert(balance_user2_after == undefined, "Invalid amount after user2")
  });

});

describe('[FA2 fungible] Transfers gasless ', async () => {
  it('Transfer gasless simple amount of token', async () => {
    const amount = new Nat(1);
    const permit = await permits.get_permits_value(user1.get_address())
    const counter = permit?.counter
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before?.equals(new Nat(1)), "Invalid amount user1")
    assert(balance_user2_before == undefined, "Invalid amount user2")

    const tps = [new transfer_param(user1.get_address(),
      [ new transfer_destination(user2.get_address(), token_id, amount)
    ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const after_permit_data = await get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      counter);
    const sig = await sign(after_permit_data, user1)
    await fa2_fungible.transfer_gasless([
        new gasless_param(tps, user1.get_public_key(), sig)
      ], { as : user3 }
    )

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user2")
  });

  it('Transfer a token from another user with wrong permit should fail', async () => {
    const amount = new Nat(1);
    const permit = await permits.get_permits_value(user2.get_address())
    const counter = permit?.counter
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    const tps = [new transfer_param(user2.get_address(),
      [ new transfer_destination(user1.get_address(), token_id, amount)
    ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const permit_data = await get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      counter);
    const sig = await sign(permit_data, user1)

    await expect_to_fail(async () => {
      await fa2_fungible.transfer_gasless([
          new gasless_param(tps, user2.get_public_key(), sig)
        ], { as : user3 }
      )
    }, get_missigned_error(permit_data));

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount user1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount user2")
  });

  it('Transfer gasless', async () => {
    const amount = new Nat(1);
    const permit = await permits.get_permits_value(user2.get_address())
    const counter = permit?.counter
    const balance_user1_before = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    const tps = [new transfer_param(user2.get_address(),
      [ new transfer_destination(user1.get_address(), token_id, amount)
    ])]
    const packed_transfer_params = get_packed_transfer_params(tps)
    const after_permit_data = await get_transfer_permit_data(
      packed_transfer_params,
      permits.get_address(),
      counter);
    const sig = await sign(after_permit_data, user2)
    await fa2_fungible.transfer_gasless([
        new gasless_param(tps, user2.get_public_key(), sig)
      ], { as : user3 }
    )

    const balance_user1_after = await fa2_fungible.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible.get_ledger_value(user2.get_address())
    assert(balance_user1_after?.equals(new Nat(1)), "Invalid amount after user1")
    assert(balance_user2_after == undefined, "Invalid amount after user2")
  });

});

/*
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
      token_id,
      counter
    );

    await permits.permit({
      argMichelson: `(Pair "${user1.pubk}" (Pair "${permit.sig.prefixSig}" 0x${permit.hash}))`,
      as: bob.pkh,
    });

    await fa2.transfer({
      arg: {
        txs: [[user1.pkh, [[user2.pkh, token_id, 1]]]],
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
      token_id,
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
      token_id,
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
          txs: [[user2.pkh, [[user1.pkh, token_id, 1]]]],
        },
        as: user3.pkh,
      });
    }, errors.PERMIT_EXPIRED);

    setMockupNow(timestamp_now)
    await fa2.transfer({
      arg: {
        txs: [[user2.pkh, [[user1.pkh, token_id, 1]]]],
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
      token_id,
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
        argMichelson: `{Left (Pair "${alice.pkh}" "${bob.pkh}" ${token_id})}`,
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
      token_id,
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
          txs: [[alice.pkh, [[bob.pkh, token_id, 123]]]],
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
      token_id,
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
      argMichelson: `{ Pair "${alice.pkh}" ${token_id} }`,
      as: alice.pkh,
    });

    const resRef = `{Pair (Pair 0x00006b82198cb179e8306c1bedd08f12dc863f328886 ${token_id}) ${balance_alice}}`
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
      argMichelson: `{ Pair "${user4.pkh}" ${token_id} }`,
      as: alice.pkh,
    });

    const resRef = `{Pair (Pair 0x0000a9ceae0f8909125492a7c4700acc59274cc6c846 ${token_id}) 0}`
    assert(res == resRef, "Invalid value")
  });

});
*/