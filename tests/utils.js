const { isMockup, getValueFromBigMap, exprMichelineToJson, packTyped, blake2b, sign, keccak } = require('@completium/completium-cli');
const { BigNumber } = require('bignumber.js');
const assert = require('assert');

const transferParamType = exprMichelineToJson('(list (pair (address %from_) (list %txs (pair (address %to_) (nat %token_id) (nat %amount)))))');
const singleStepTransferParamType = exprMichelineToJson("(list (pair (address %from_) (list %txs (pair (address %to_) (nat %token_id) (nat %amount)))))");
const dataTransferGaslessDataType = exprMichelineToJson("(pair address (pair nat (list (pair (address %from_) (list %txs (pair (address %to_) (nat %token_id) (nat %amount)))))))");
const permitDataType = exprMichelineToJson('(pair (pair address chain_id) (pair nat bytes))');
const gaslessDataType = exprMichelineToJson('(pair address (pair nat bytes))');


getPermit = async (permits, pkh) => {
  const storage = await permits.getStorage();

  const permit = await getValueFromBigMap(
    parseInt(storage.permits),
    exprMichelineToJson(`"${pkh}"`),
    exprMichelineToJson(`address'`)
  );

  return permit
}

exports.getPermitNb = async (permits, pkh) => {
  const permit = await getPermit(permits, pkh)
  if (permit == null) return 0;
  return parseInt(permit.args[0].int)
}

exports.getPermit = getPermit

exports.GetIsoStringFromTimestamp = (timestamp) => {
  return new Date(timestamp * 1000).toISOString().split('.')[0] + 'Z';
}

const gethashPermit = async (
  from,
  to,
  contract,
  amount,
  tokenid,
  permit_counter
) => {
  const michelsonData = `{ Pair "${from.pkh}" { Pair "${to.pkh}" (Pair ${tokenid} ${amount}) } }`;
  const transferParam = exprMichelineToJson(michelsonData);
  const permit = packTyped(transferParam, transferParamType);
  const hashPermit = blake2b(permit);
  return hashPermit
}

const signHashPermit = async (
  hashPermit,
  contract,
  permit_counter
) => {
  const chainid = 'NetXynUjJNZm7wi';
  const permitData = exprMichelineToJson(
    `(Pair (Pair "${contract}" "${chainid}") (Pair ${permit_counter} 0x${hashPermit}))`
  );
  const tosign = packTyped(permitData, permitDataType);
  return { hashPermit, tosign };
}

const gettosign = async (
  from,
  to,
  contract,
  amount,
  tokenid,
  permit_counter
) => {
  const hashPermit = await gethashPermit(from, to, contract, amount, tokenid, permit_counter);
  return signHashPermit(hashPermit, contract, permit_counter)
}

exports.getTransferPermitData = gettosign
exports.getSignHashPermit = signHashPermit

exports.mkTransferPermit = async (
  from,
  to,
  contract,
  amount,
  tokenid,
  permit_counter
) => {
  const { hashPermit, tosign } = await gettosign(from, to, contract, amount, tokenid, permit_counter);
  const signature = await sign(tosign, { as: from.name });
  return { hash: hashPermit, sig: signature };
};

exports.mkTransferGaslessArgs = async (
  from,
  to,
  contract,
  amount,
  tokenid,
  permit_counter,
  signer
) => {
  const michelsonData = `{ Pair "${from.pkh}" { Pair "${to.pkh}" (Pair ${tokenid} ${amount}) } }`;
  const transferParam = exprMichelineToJson(michelsonData);
  const permit = packTyped(transferParam, singleStepTransferParamType);
  const hashPermit = blake2b(permit);
  const permitData = exprMichelineToJson(
    `(Pair "${contract}" (Pair ${permit_counter} 0x${hashPermit}))`
  );
  const tosign = packTyped(permitData, gaslessDataType);
  const signature = await sign(tosign, { as: signer });
  return { hash: hashPermit, sig: signature, tosign: tosign };
};

const getCounter = async (c, k) => {
  const storage = await c.getStorage();
  const id = storage.counter;
  const key = exprMichelineToJson(`"${k}"`);
  const keytyp = exprMichelineToJson('address');
  const res = await getValueFromBigMap(id, key, keytyp);
  if (res == null) {
    return 0;
  }
  const data = jsonMichelineToExpr(res);
  return parseInt(data);
}

const packDataToSign = async (ccounter, ccollection, cseller, owner, user, tokenId) => {
  const michelsonDataType = exprMichelineToJson('(pair address (pair nat address))');
  const michelsonData = `(Pair "${ccollection.address}" (Pair ${tokenId} "${user.pkh}"))`;
  const transferParam = exprMichelineToJson(michelsonData);
  const permit = packTyped(transferParam, michelsonDataType);
  const hashPermit = blake2b(permit);

  const counter = await getCounter(ccounter, user.pkh);
  const chainid = isMockup() ? 'NetXynUjJNZm7wi' : 'NetXZSsxBpMQeAT'; // else hangzhou

  const permitDataType = exprMichelineToJson('(pair (pair address chain_id) (pair nat bytes))');
  const permitData = exprMichelineToJson(`(Pair (Pair "${cseller.address}" "${chainid}") (Pair ${counter} 0x${hashPermit}))`);
  const tosign = packTyped(permitData, permitDataType);

  return tosign;
}

exports.getPackDataToSign = packDataToSign

exports.getBalanceLedger = async (fa2, pkh) => {
  const storage = await fa2.getStorage();
  const balance = await getValueFromBigMap(
    parseInt(storage.ledger),
    exprMichelineToJson(`"${pkh}"`),
    exprMichelineToJson(`address`)
  );
  return balance != null && balance.int !== undefined ? balance.int : '0';
}

exports.getMetadata = async (fa2, key) => {
  const storage = await fa2.getStorage();
  const res = await getValueFromBigMap(
    parseInt(storage.metadata),
    exprMichelineToJson(`"${key}"`),
    exprMichelineToJson(`string`)
  );
  return res != null && res.bytes !== undefined ? res.bytes : null;
}

exports.errors = {
  CALLER_NOT_OWNER: '"CALLER_NOT_OWNER"',
  CONTRACT_NOT_PAUSED: '"CONTRACT_NOT_PAUSED"',
  CONTRACT_PAUSED: '"CONTRACT_PAUSED"',
  EXPIRY_TOO_BIG: '"EXPIRY_TOO_BIG"',
  INVALID_CALLER: '"INVALID_CALLER"',
  FA2_INSUFFICIENT_BALANCE: '"FA2_INSUFFICIENT_BALANCE"',
  FA2_INVALID_AMOUNT: '"FA2_INVALID_AMOUNT"',
  FA2_NOT_OPERATOR: '"FA2_NOT_OPERATOR"',
  FA2_TOKEN_UNDEFINED: '"FA2_TOKEN_UNDEFINED"',
  MISSIGNED: '"MISSIGNED"',
  NO_ENTRY_FOR_USER: '"USER_PERMIT_NOT_FOUND"',
  PERMIT_EXPIRED: '"PERMIT_EXPIRED"',
  PERMIT_NOT_FOUND: '"PERMIT_NOT_FOUND"',
  PERMIT_USER_NOT_FOUND: '"PERMIT_USER_NOT_FOUND"',
  SIGNER_NOT_FROM: '"SIGNER_NOT_FROM"',
}
