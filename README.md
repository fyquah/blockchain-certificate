# BlockChain Certification Protocol

Blockchain Certification Protocol is a protocol to digitally sign and verify documents in a semi-decentralized manner. Features include signature identification, decentralized signature verification and document timestamp and signature verification.

This project won the first <a href="http://imperial.ac.uk/bitcoin/">Imperial Bitcoin Forum</a>.

This document is about using this package to certify / verify documents, runnning tests, dependencies and using using the package. To read more about the protocol itself, click <a href="https://github.com/fyquah95/blockchain-certificate/blob/master/protocol.md">here</a>

The package runs as a JSON RPC server. To make queries.

## Dependencies

* Node.js (tested on 0.10.31)
* npm (tested on 1.4.23)
* Bitcoin daemon
* mysql

## Installation

~~~bash
source <(curl -L https://raw.github.com/fyquah95/blockchain-certificate/master/scripts/bootstrap.sh)
~~~

## In case you want to manually manage the dependencies

~~~bash
npm install -g blockchain-certificate
~~~

## Usage : JSON RPC Server

~~~bash
bcp-server # start the JSON RPC server
~~~

This will start the JSON RPC server which listens to port `9339`. To specify a port:

~~~bash
bcp-server --port 1946
~~~

## Usage : Daemon

~~~bash
bcp-deamon
~~~

## Usage : CommandLine

~~~bash
bcp-cli --help
~~~


## Testing

The project employs <a target="_blank" href="http://mochajs.org/">mocha</a> to run tests. Test transactions happen in the testnet. Testing requires the following:

* running the testnet bitcoin daemon
* Testnet wallet with approximately 1 BTC
* a stable internet connection

Then to test:

~~~bash
./node_modules/mocha/bin/mocha test
~~~

## Todo

* Usage : Command Line
* Documentation of methods
* Run and test on newer versions of node.js
* Implement Node spreading
* Implement external event listener

## License

MIT License
