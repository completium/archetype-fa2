import { list_to_mich_type, list_to_mich, prim_annot_to_mich_type, Bytes, blake2b, mich_array_to_mich, Address, Or, Account, expect_to_fail, get_account, Nat, Option, option_to_mich_type, pack, pair_array_to_mich_type, pair_to_mich, pair_to_mich_type, prim_to_mich_type, set_mockup, set_mockup_now, set_quiet, sign, string_to_mich, Signature } from '@completium/experiment-ts'

import { transfer_param, transfer_param_mich_type } from './binding/fa2_fungible'

export const get_packed_transfer_params = (tps : transfer_param[]) : Bytes => {
  const mich = list_to_mich(tps, x => {
    return x.to_mich();
  })
  return (pack(mich, list_to_mich_type(transfer_param_mich_type)))
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

export const get_transfer_permit_data = (ptps : Bytes, contract : Address, permit_counter : Nat | undefined) : Bytes => {
  let counter = new Nat(0)
  if (permit_counter != undefined) {
    counter = permit_counter
  }
  const chain_id = 'NetXynUjJNZm7wi';
  const permit_data = mich_array_to_mich([
    mich_array_to_mich([ contract.to_mich(), string_to_mich(chain_id) ]),
    mich_array_to_mich([ counter.to_mich(), ptps.to_mich() ])
  ])
  return pack(permit_data, permit_data_type);
}
