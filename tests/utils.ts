import { prim_annot_to_mich_type, Bytes, blake2b, mich_array_to_mich, Address, Or, Account, expect_to_fail, get_account, Nat, Option, option_to_mich_type, pack, pair_array_to_mich_type, pair_to_mich, pair_to_mich_type, prim_to_mich_type, set_mockup, set_mockup_now, set_quiet, sign, string_to_mich, Signature } from '@completium/experiment-ts'

import { transfer_param, transfer_param_mich_type } from './binding/fa2-fungible'

export const get_permit_hash = (tp : transfer_param) : Bytes => {
  return blake2b(pack(tp.to_mich(), transfer_param_mich_type))
}

const permit_data_type = pair_array_to_mich_type([
  pair_array_to_mich_type([
    prim_annot_to_mich_type("address", []),
    prim_annot_to_mich_type("chain_id", [])
  ]),
  pair_array_to_mich_type([
      prim_annot_to_mich_type("nat", []),
      prim_annot_to_mich_type("bytes", [])
  ])
])

export const get_transfer_permit_data = (tp : transfer_param, contract : Address, permit_counter : Nat | undefined) : Bytes => {
  if (permit_counter == undefined) {
    throw new Error("permit_counter is undefined")
  }
  const chain_id = 'NetXynUjJNZm7wi';
  const permit_data = mich_array_to_mich([
    mich_array_to_mich([ contract.to_mich(), string_to_mich(chain_id) ]),
    mich_array_to_mich([ permit_counter.to_mich(), get_permit_hash(tp).to_mich() ])
  ])
  return pack(permit_data, permit_data_type);
}

export const get_transfer_permit = async (tp : transfer_param, contract : Address, permit_counter : Nat | undefined) : Promise<[Bytes, Signature]> => {
  const permit_data = get_transfer_permit_data(tp, contract, permit_counter)
  const sig = await sign(permit_data, tp.tp_from)
  return [permit_data, sig]
}