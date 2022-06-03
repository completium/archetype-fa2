const { deploy, setEndpoint, getAccount, setQuiet, getContract } = require('@completium/completium-cli');
const fs = require('fs');

// contracts
let fa2;

const stage = 'testnet'
const prefix = ''

const getName = name => stage + '_' + prefix + '_' + name

const env = {
  stages: {
    mockup: {
      quiet: true,
      endpoint: 'mockup',
      originator: 'tz1Lc2qBKEWCBeDU8npG6zCeCqpmaegRi6Jg',
      owner: 'tz1Lc2qBKEWCBeDU8npG6zCeCqpmaegRi6Jg',
      metadata: 'ipfs://QmTFDfFMe8CwPKXTNoStrcDTXz4ZiZ5ZiY3sUDGrey1j4g'
    },
    testnet: {
      quiet: false,
      endpoint: 'https://ithacanet.ecadinfra.com',
      originator: 'tz1Lc2qBKEWCBeDU8npG6zCeCqpmaegRi6Jg',
      owner: 'tz1Lc2qBKEWCBeDU8npG6zCeCqpmaegRi6Jg',
      metadata: 'ipfs://QmTFDfFMe8CwPKXTNoStrcDTXz4ZiZ5ZiY3sUDGrey1j4g'
    },
    mainnet: {
      quiet: false,
      endpoint: 'https://mainnet.api.tez.ie',
      originator: '',
      owner: '',
      metadata: ''
    }
  },
  contracts: {
    fa2: {
      id: 'fa2_fungible',
      path: './contracts/fa2-fungible.arl'
    }
  }
}

const objstage = env.stages[stage];
const originator = objstage.originator
const owner = objstage.owner
const metadata_uri = objstage.metadata

setEndpoint(objstage.endpoint);
setQuiet(objstage.quiet);


// describe("Retrieve", async () => {
//   it("FA2 fungible", async () => {
//     co = await getContract(getName(env.contracts.fa2.id))
//   });
// });

describe("Deploy", async () => {
  it("FA2 fungible", async () => {
    [fa2, _] = await deploy(env.contracts.fa2.path, {
      parameters: {
        owner: owner
      },
      named: getName(env.contracts.fa2.id),
      metadata_uri: metadata_uri,
      as: originator
    });
  });
});
