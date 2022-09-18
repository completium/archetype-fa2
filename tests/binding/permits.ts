import * as ex from "@completium/experiment-ts";
export enum consumer_op_types {
    add = "add",
    remove = "remove"
}
export abstract class consumer_op extends ex.Enum<consumer_op_types> {
}
export class add extends consumer_op {
    constructor(private content: ex.Address) {
        super(consumer_op_types.add);
    }
    to_mich() { return ex.left_to_mich(this.content.to_mich()); }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    get() { return this.content; }
}
export class remove extends consumer_op {
    constructor(private content: ex.Address) {
        super(consumer_op_types.remove);
    }
    to_mich() { return ex.right_to_mich(ex.left_to_mich(this.content.to_mich())); }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    get() { return this.content; }
}
export class user_permit implements ex.ArchetypeType {
    constructor(public expiry: ex.Option<ex.Nat>, public created_at: Date) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.expiry.to_mich(), ex.date_to_mich(this.created_at)]);
    }
    equals(v: user_permit): boolean {
        return (this.expiry.equals(v.expiry) && this.expiry.equals(v.expiry) && (this.created_at.getTime() - this.created_at.getMilliseconds()) == (v.created_at.getTime() - v.created_at.getMilliseconds()));
    }
}
export const user_permit_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.option_annot_to_mich_type(ex.prim_annot_to_mich_type("nat", []), ["%expiry"]),
    ex.prim_annot_to_mich_type("timestamp", ["%created_at"])
]);
export const mich_to_user_permit = (v: ex.Micheline, collapsed: boolean = false): user_permit => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, user_permit_mich_type);
    }
    return new user_permit(ex.mich_to_option(fields[0], x => { return ex.mich_to_nat(x); }), ex.mich_to_date(fields[1]));
};
export type consumer_key = ex.Address;
export type permits_key = ex.Address;
export const consumer_key_mich_type: ex.MichelineType = ex.prim_annot_to_mich_type("address", []);
export const permits_key_mich_type: ex.MichelineType = ex.prim_annot_to_mich_type("address", []);
export class permits_value implements ex.ArchetypeType {
    constructor(public counter: ex.Nat, public user_expiry: ex.Option<ex.Nat>, public user_permits: Array<[
        ex.Bytes,
        user_permit
    ]>) { }
    toString(): string {
        return JSON.stringify(this, null, 2);
    }
    to_mich(): ex.Micheline {
        return ex.pair_to_mich([this.counter.to_mich(), ex.pair_to_mich([this.user_expiry.to_mich(), ex.list_to_mich(this.user_permits, x => {
                    const x_key = x[0];
                    const x_value = x[1];
                    return ex.elt_to_mich(x_key.to_mich(), x_value.to_mich());
                })])]);
    }
    equals(v: permits_value): boolean {
        return (this.counter.equals(v.counter) && this.counter.equals(v.counter) && this.user_expiry.equals(v.user_expiry) && JSON.stringify(this.user_permits) == JSON.stringify(v.user_permits));
    }
}
export const permits_value_mich_type: ex.MichelineType = ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("nat", ["%counter"]),
    ex.pair_array_to_mich_type([
        ex.option_annot_to_mich_type(ex.prim_annot_to_mich_type("nat", []), ["%user_expiry"]),
        ex.pair_to_mich_type("map", ex.prim_annot_to_mich_type("bytes", []), ex.pair_array_to_mich_type([
            ex.option_annot_to_mich_type(ex.prim_annot_to_mich_type("nat", []), ["%expiry"]),
            ex.prim_annot_to_mich_type("timestamp", ["%created_at"])
        ]))
    ])
]);
export const mich_to_permits_value = (v: ex.Micheline, collapsed: boolean = false): permits_value => {
    let fields: ex.Micheline[] = [];
    if (collapsed) {
        fields = ex.mich_to_pairs(v);
    }
    else {
        fields = ex.annotated_mich_to_array(v, permits_value_mich_type);
    }
    return new permits_value(ex.mich_to_nat(fields[0]), ex.mich_to_option(fields[1], x => { return ex.mich_to_nat(x); }), ex.mich_to_map(fields[2], (x, y) => [ex.mich_to_bytes(x), mich_to_user_permit(y, collapsed)]));
};
export type consumer_container = Array<consumer_key>;
export type permits_container = Array<[
    permits_key,
    permits_value
]>;
export const consumer_container_mich_type: ex.MichelineType = ex.list_annot_to_mich_type(ex.prim_annot_to_mich_type("address", []), []);
export const permits_container_mich_type: ex.MichelineType = ex.pair_to_mich_type("big_map", ex.prim_annot_to_mich_type("address", []), ex.pair_array_to_mich_type([
    ex.prim_annot_to_mich_type("nat", ["%counter"]),
    ex.pair_array_to_mich_type([
        ex.option_annot_to_mich_type(ex.prim_annot_to_mich_type("nat", []), ["%user_expiry"]),
        ex.pair_to_mich_type("map", ex.prim_annot_to_mich_type("bytes", []), ex.pair_array_to_mich_type([
            ex.option_annot_to_mich_type(ex.prim_annot_to_mich_type("nat", []), ["%expiry"]),
            ex.prim_annot_to_mich_type("timestamp", ["%created_at"])
        ]))
    ])
]));
const declare_ownership_arg_to_mich = (candidate: ex.Address): ex.Micheline => {
    return candidate.to_mich();
}
const claim_ownership_arg_to_mich = (): ex.Micheline => {
    return ex.unit_mich;
}
const pause_arg_to_mich = (): ex.Micheline => {
    return ex.unit_mich;
}
const unpause_arg_to_mich = (): ex.Micheline => {
    return ex.unit_mich;
}
const set_metadata_arg_to_mich = (k: string, d: ex.Option<ex.Bytes>): ex.Micheline => {
    return ex.pair_to_mich([
        ex.string_to_mich(k),
        d.to_mich()
    ]);
}
const manage_consumer_arg_to_mich = (op: consumer_op): ex.Micheline => {
    return op.to_mich();
}
const set_expiry_arg_to_mich = (iv: ex.Option<ex.Nat>, ip: ex.Option<ex.Bytes>): ex.Micheline => {
    return ex.pair_to_mich([
        iv.to_mich(),
        ip.to_mich()
    ]);
}
const set_default_expiry_arg_to_mich = (v: ex.Nat): ex.Micheline => {
    return v.to_mich();
}
const permit_arg_to_mich = (pk: ex.Key, sig: ex.Signature, data: ex.Bytes): ex.Micheline => {
    return ex.pair_to_mich([
        pk.to_mich(),
        sig.to_mich(),
        data.to_mich()
    ]);
}
const consume_arg_to_mich = (signer: ex.Address, data: ex.Bytes, err: string): ex.Micheline => {
    return ex.pair_to_mich([
        signer.to_mich(),
        data.to_mich(),
        ex.string_to_mich(err)
    ]);
}
const check_arg_to_mich = (signer: ex.Key, sig: ex.Signature, data: ex.Bytes): ex.Micheline => {
    return ex.pair_to_mich([
        signer.to_mich(),
        sig.to_mich(),
        data.to_mich()
    ]);
}
export class Permits {
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
    async deploy(owner: ex.Address, params: Partial<ex.Parameters>) {
        const address = await ex.deploy("./contracts/permits.arl", {
            owner: owner.to_mich()
        }, params);
        this.address = address;
    }
    async declare_ownership(candidate: ex.Address, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "declare_ownership", declare_ownership_arg_to_mich(candidate), params);
        }
        throw new Error("Contract not initialised");
    }
    async claim_ownership(params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "claim_ownership", claim_ownership_arg_to_mich(), params);
        }
        throw new Error("Contract not initialised");
    }
    async pause(params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "pause", pause_arg_to_mich(), params);
        }
        throw new Error("Contract not initialised");
    }
    async unpause(params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "unpause", unpause_arg_to_mich(), params);
        }
        throw new Error("Contract not initialised");
    }
    async set_metadata(k: string, d: ex.Option<ex.Bytes>, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "set_metadata", set_metadata_arg_to_mich(k, d), params);
        }
        throw new Error("Contract not initialised");
    }
    async manage_consumer(op: consumer_op, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "manage_consumer", manage_consumer_arg_to_mich(op), params);
        }
        throw new Error("Contract not initialised");
    }
    async set_expiry(iv: ex.Option<ex.Nat>, ip: ex.Option<ex.Bytes>, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "set_expiry", set_expiry_arg_to_mich(iv, ip), params);
        }
        throw new Error("Contract not initialised");
    }
    async set_default_expiry(v: ex.Nat, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "set_default_expiry", set_default_expiry_arg_to_mich(v), params);
        }
        throw new Error("Contract not initialised");
    }
    async permit(pk: ex.Key, sig: ex.Signature, data: ex.Bytes, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "permit", permit_arg_to_mich(pk, sig, data), params);
        }
        throw new Error("Contract not initialised");
    }
    async consume(signer: ex.Address, data: ex.Bytes, err: string, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "consume", consume_arg_to_mich(signer, data, err), params);
        }
        throw new Error("Contract not initialised");
    }
    async check(signer: ex.Key, sig: ex.Signature, data: ex.Bytes, params: Partial<ex.Parameters>): Promise<any> {
        if (this.address != undefined) {
            return await ex.call(this.address, "check", check_arg_to_mich(signer, sig, data), params);
        }
        throw new Error("Contract not initialised");
    }
    async get_owner(): Promise<ex.Address> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            return new ex.Address(storage.owner);
        }
        throw new Error("Contract not initialised");
    }
    async get_owner_candidate(): Promise<ex.Option<ex.Address>> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            return new ex.Option<ex.Address>(storage.owner_candidate == null ? null : (x => { return new ex.Address(x); })(storage.owner_candidate));
        }
        throw new Error("Contract not initialised");
    }
    async get_paused(): Promise<boolean> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            return storage.paused;
        }
        throw new Error("Contract not initialised");
    }
    async get_consumer(): Promise<consumer_container> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const res: Array<ex.Address> = [];
            for (let i = 0; i < storage.consumer.length; i++) {
                res.push((x => { return new ex.Address(x); })(storage.consumer[i]));
            }
            return res;
        }
        throw new Error("Contract not initialised");
    }
    async get_permits_value(key: permits_key): Promise<permits_value | undefined> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const data = await ex.get_big_map_value(BigInt(storage.permits), key.to_mich(), permits_key_mich_type);
            if (data != undefined) {
                return mich_to_permits_value(data, true);
            }
            else {
                return undefined;
            }
        }
        throw new Error("Contract not initialised");
    }
    async has_permits_value(key: permits_key): Promise<boolean> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const data = await ex.get_big_map_value(BigInt(storage.permits), key.to_mich(), permits_key_mich_type);
            if (data != undefined) {
                return true;
            }
            else {
                return false;
            }
        }
        throw new Error("Contract not initialised");
    }
    async get_default_expiry(): Promise<ex.Nat> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            return new ex.Nat(storage.default_expiry);
        }
        throw new Error("Contract not initialised");
    }
    async get_metadata_value(key: string): Promise<ex.Bytes | undefined> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const data = await ex.get_big_map_value(BigInt(storage.metadata), ex.string_to_mich(key), ex.prim_annot_to_mich_type("bytes", []));
            if (data != undefined) {
                return ex.mich_to_bytes(data);
            }
            else {
                return undefined;
            }
        }
        throw new Error("Contract not initialised");
    }
    async has_metadata_value(key: string): Promise<boolean> {
        if (this.address != undefined) {
            const storage = await ex.get_storage(this.address);
            const data = await ex.get_big_map_value(BigInt(storage.metadata), ex.string_to_mich(key), ex.prim_annot_to_mich_type("bytes", []));
            if (data != undefined) {
                return true;
            }
            else {
                return false;
            }
        }
        throw new Error("Contract not initialised");
    }
    errors = {
        p8: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"p8\"")]),
        INVALID_CALLER: ex.string_to_mich("\"INVALID_CALLER\""),
        p7: ex.string_to_mich("\"PERMIT_EXPIRED\""),
        p6: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"p6\"")]),
        p4: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"p4\"")]),
        r3: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"r3\"")]),
        r2: ex.string_to_mich("\"EXPIRY_TOO_BIG\""),
        r1: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"r1\"")]),
        md_r1: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"md_r1\"")]),
        pausable_r2: ex.string_to_mich("\"CONTRACT_NOT_PAUSED\""),
        pausable_r1: ex.pair_to_mich([ex.string_to_mich("\"INVALID_CONDITION\""), ex.string_to_mich("\"pausable_r1\"")]),
        ownership_r1: ex.string_to_mich("\"INVALID_CALLER\""),
        CONTRACT_PAUSED: ex.string_to_mich("\"CONTRACT_PAUSED\"")
    };
}
export const permits = new Permits();
