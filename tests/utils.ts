import { list_to_mich_type, list_to_mich, prim_annot_to_mich_type, Bytes, mich_array_to_mich, Address, Or, Nat, Option, option_to_mich_type, pair_array_to_mich_type, pair_to_mich, pair_to_mich_type, prim_to_mich_type, string_to_mich, Signature } from '@completium/archetype-ts-types'
import { blake2b, Account, expect_to_fail, get_account, pack, set_mockup, set_mockup_now, set_quiet, sign } from '@completium/experiment-ts'

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
    mich_array_to_mich([ counter.to_mich(), blake2b(ptps).to_mich() ])
  ])
  return pack(permit_data, permit_data_type);
}

export const wrong_sig = new Signature("edsigu3QDtEZeSCX146136yQdJnyJDfuMRsDxiCgea3x7ty2RTwDdPpgioHWJUe86tgTCkeD2u16Az5wtNFDdjGyDpb7MiyU3fn");
export const wrong_packed_transfer_params = new Bytes('9aabe91d035d02ffb550bb9ea6fe19970f6fb41b5e69459a60b1ae401192a2dc');

export const get_missigned_error = (permit_data : Bytes) => {
  return pair_to_mich([string_to_mich("\"MISSIGNED\""), permit_data.to_mich()])
}
