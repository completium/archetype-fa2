import * as ex from "@completium/experiment-ts";
export class operator_param implements ex.ArchetypeType {
    constructor(public opp_owner: ex.Address, public opp_operator: ex.Address, public opp_token_id: ex.Nat) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.opp_owner.to_mich(), ex.pair_to_mich([this.opp_operator.to_mich(), this.opp_token_id.to_mich()])]);
    }
    equals(v: operator_param): boolean {
        return (this.opp_owner.equals(v.opp_owner) && this.opp_owner.equals(v.opp_owner) && this.opp_operator.equals(v.opp_operator) && this.opp_token_id.equals(v.opp_token_id));
    }
}
export class transfer_destination implements ex.ArchetypeType {
    constructor(public to_dest: ex.Address, public token_id_dest: ex.Nat, public token_amount_dest: ex.Nat) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.to_dest.to_mich(), ex.pair_to_mich([this.token_id_dest.to_mich(), this.token_amount_dest.to_mich()])]);
    }
    equals(v: transfer_destination): boolean {
        return (this.to_dest.equals(v.to_dest) && this.to_dest.equals(v.to_dest) && this.token_id_dest.equals(v.token_id_dest) && this.token_amount_dest.equals(v.token_amount_dest));
    }
}
export class transfer_item implements ex.ArchetypeType {
    constructor(public from_: ex.Address, public txs: Array<transfer_destination>) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.from_.to_mich(), ex.list_to_mich(this.txs, x => {
                return x.to_mich();
            })]);
    }
    equals(v: transfer_item): boolean {
        return (this.from_.equals(v.from_) && this.from_.equals(v.from_) && JSON.stringify(this.txs) == JSON.stringify(v.txs));
    }
}
export class balance_of_request implements ex.ArchetypeType {
    constructor(public bo_owner: ex.Address, public btoken_id: ex.Nat) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.bo_owner.to_mich(), this.btoken_id.to_mich()]);
    }
    equals(v: balance_of_request): boolean {
        return (this.bo_owner.equals(v.bo_owner) && this.bo_owner.equals(v.bo_owner) && this.btoken_id.equals(v.btoken_id));
    }
}
export class balance_of_response implements ex.ArchetypeType {
    constructor(public request: balance_of_request, public balance_: ex.Nat) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.request.to_mich(), this.balance_.to_mich()]);
    }
    equals(v: balance_of_response): boolean {
        return (this.request == v.request && this.request == v.request && this.balance_.equals(v.balance_));
    }
}
export const operator_param_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("address", ["%owner"]),
    ex.pair_array_to_mich_type([
        ex.prim_annot_to_mich_type("address", ["%operator"]),
        ex.prim_annot_to_mich_type("nat", ["%token_id"])
    ])
]);
export const transfer_destination_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("address", ["%to_"]),
    ex.pair_array_to_mich_type([
        ex.prim_annot_to_mich_type("nat", ["%token_id"]),
        ex.prim_annot_to_mich_type("nat", ["%amount"])
    ])
]);
export const transfer_item_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("address", ["%from_"]),
    ex.list_annot_to_mich_type(ex.pair_array_to_mich_type([
        ex.prim_annot_to_mich_type("address", ["%to_"]),
        ex.pair_array_to_mich_type([
            ex.prim_annot_to_mich_type("nat", ["%token_id"]),
            ex.prim_annot_to_mich_type("nat", ["%amount"])
        ])
    ]), ["%txs"])
]);
export const balance_of_request_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("address", ["%owner"]),
    ex.prim_annot_to_mich_type("nat", ["%token_id"])
]);
export const balance_of_response_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.pair_array_to_mich_type([
        ex.prim_annot_to_mich_type("address", ["%owner"]),
        ex.prim_annot_to_mich_type("nat", ["%token_id"])
    ]),
    ex.prim_annot_to_mich_type("nat", ["%balance"])
]);
export const mich_to_operator_param = (v: ex.Micheline, collapsed: boolean = false): operator_param => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, operator_param_mich_type);
    }
    return new operator_param(ex.mich_to_address(fields[0]), ex.mich_to_address(fields[1]), ex.mich_to_nat(fields[2]));
};
export const mich_to_transfer_destination = (v: ex.Micheline, collapsed: boolean = false): transfer_destination => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, transfer_destination_mich_type);
    }
    return new transfer_destination(ex.mich_to_address(fields[0]), ex.mich_to_nat(fields[1]), ex.mich_to_nat(fields[2]));
};
export const mich_to_transfer_item = (v: ex.Micheline, collapsed: boolean = false): transfer_item => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, transfer_item_mich_type);
    }
    return new transfer_item(ex.mich_to_address(fields[0]), ex.mich_to_list(fields[1], x => { return mich_to_transfer_destination(x, collapsed); }));
};
export const mich_to_balance_of_request = (v: ex.Micheline, collapsed: boolean = false): balance_of_request => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, balance_of_request_mich_type);
    }
    return new balance_of_request(ex.mich_to_address(fields[0]), ex.mich_to_nat(fields[1]));
};
export const mich_to_balance_of_response = (v: ex.Micheline, collapsed: boolean = false): balance_of_response => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, balance_of_response_mich_type);
    }
    return new balance_of_response(mich_to_balance_of_request(fields[0], collapsed), ex.mich_to_nat(fields[1]));
};
export type ledger_key = ex.Nat;
export class operator_key implements ex.ArchetypeType {
    constructor(public oaddr: ex.Address, public otoken: ex.Nat, public oowner: ex.Address) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.oaddr.to_mich(), ex.pair_to_mich([this.otoken.to_mich(), this.oowner.to_mich()])]);
    }
    equals(v: operator_key): boolean {
        return (this.oaddr.equals(v.oaddr) && this.oaddr.equals(v.oaddr) && this.otoken.equals(v.otoken) && this.oowner.equals(v.oowner));
    }
}
export const ledger_key_mich_type: ex.MichelineType = ex.prim_annot_to_mich_type("nat", []);
export const operator_key_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("address", ["%oaddr"]),
    ex.pair_array_to_mich_type([
        ex.prim_annot_to_mich_type("nat", ["%otoken"]),
        ex.prim_annot_to_mich_type("address", ["%oowner"])
    ])
]);
export type ledger_value = ex.Address;
export class operator_value implements ex.ArchetypeType {
    constructor() { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.unit_to_mich();
    }
    equals(v: operator_value): boolean {
        return true;
    }
}
export const ledger_value_mich_type: ex.MichelineType = ex.prim_annot_to_mich_type("address", []);
export const operator_value_mich_type: ex.MichelineType = ex.prim_annot_to_mich_type("unit", []);
export const mich_to_ledger_value = (v: ex.Micheline, collapsed: boolean = false): ledger_value => {
    return ex.mich_to_address(v);
};
export const mich_to_operator_value = (v: ex.Micheline, collapsed: boolean = false): operator_value => {
    throw new Error("mich_to_operator_value should not be called");
};
export type ledger_container = Array<[
    ledger_key,
    ledger_value
]>;
export type operator_container = Array<[
    operator_key,
    operator_value
]>;
export const ledger_container_mich_type: ex.MichelineType = ex.pair_to_mich_type("big_map", ex.prim_annot_to_mich_type("nat", []), ex.prim_annot_to_mich_type("address", []));
export const operator_container_mich_type: ex.MichelineType = ex.pair_to_mich_type("big_map", ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("address", ["%oaddr"]),
    ex.pair_array_to_mich_type([
        ex.prim_annot_to_mich_type("nat", ["%otoken"]),
        ex.prim_annot_to_mich_type("address", ["%oowner"])
    ])
]), ex.prim_annot_to_mich_type("unit", []));
const update_operators_arg_to_mich = (upl: Array<ex.Or<operator_param, operator_param>>): ex.Micheline => {
    return ex.list_to_mich(upl, x => {
        return x.to_mich();
    });
}
const transfer_arg_to_mich = (itxs: Array<transfer_item>): ex.Micheline => {
    return ex.list_to_mich(itxs, x => {
        return x.to_mich();
    });
}
export class Fa2_basic {
    address: string | undefined;
    get_address(): ex.Address {
        if (undefined != this.address) {
            return new ex.Address(this.address);
        }
        throw new Error("Contract not initialised");
    }
    async get_balance(): Promise<ex.Tez> {
        if (null != this.address) {
            return await ex.get_balance(new ex.Address(this.address));
        }
        throw new Error("Contract not initialised");
    }
    async deploy(params: Partial<ex.Parameters>) {
        const address = await ex.deploy("./contracts/fa2_basic.arl", {}, params);
        this.address = address;
    }
    async update_operators(upl: Array<ex.Or<operator_param, operator_param>>, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            await ex.call(this.address, "update_operators", update_operators_arg_to_mich(upl), params);
        }
    }
    async transfer(itxs: Array<transfer_item>, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            await ex.call(this.address, "transfer", transfer_arg_to_mich(itxs), params);
        }
    }
    async get_ledger_value(key: ledger_key): Promise<ledger_value | undefined> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const data = await ex.get_big_map_value(BigInt(storage.ledger), key.to_mich(), ledger_key_mich_type);
            if (data != undefined) {
                return mich_to_ledger_value(data, true);
            }
            else {
                return undefined;
            }
        }
        throw new Error("Contract not initialised");
    }
    async get_operator_value(key: operator_key): Promise<operator_value | undefined> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const data = await ex.get_big_map_value(BigInt(storage.operator), key.to_mich(), operator_key_mich_type);
            if (data != undefined) {
                return mich_to_operator_value(data, true);
            }
            else {
                return undefined;
            }
        }
        throw new Error("Contract not initialised");
    }
    errors = {
        FA2_NOT_OPERATOR: ex.string_to_mich("\"FA2_NOT_OPERATOR\""),
        CALLER_NOT_OWNER: ex.string_to_mich("\"CALLER NOT OWNER\"")
    };
}
export const fa2_basic = new Fa2_basic();
