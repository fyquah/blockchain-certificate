# Bitcoin BlockChain Certification Protocol

Bitcoin Blockchain Certification Protocol (BCC) is the technology powering bitcoin certification of equitybits. This protocol requires a middleman, which by no means have any rights of changing history (unless he carries out a 51% attack), removing the need of trusting the middleman.

The beauty of the protocol is despite having the need of a middleman to broadcast a certification signature, the verification process can be carried out by any node in the blockchain using this protocol.

This protocol opens up possibility to various events:

* A company might want to sign certificate with an investor. While a party may issue a certificate and another will keep a copy, the chances of forging a certificate is high. With digital signatures and block chain we can easily eliminate that possibility.

## Key Terms

**Node** refers to a node in the bitcoin network which can acts as signature broadcasters

**User** refers to a party who wants certificates and hence signatures broadcasted in the blockchain.

**Certificate** refers to a real document that is to be digital signed by two users. Both users should agree on the certificate before signing it.

**Signature** refers to the digital signature of the certificate.

## Cryptography

The underlying cryptography behind certification is the <a href="http://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm">ECDSA</a>, specifically the secp256k1, similiar to those employed by bitcoin.

## Specification

A node will have to initiallly broadcast an initialization transaction, announcing to other certification nodes that the node will be starting to certify transactions. One of the outputs (first output, specifically) will be . The concept of labelling output is inspired by colored coins.

To register a user to a node, the user should provide the node with a 33-byte compressed public key. The node will broadcast a transaction to the user, which contains certain op_codes and the 33-byte compressed public key. Then, the user should publish in a financial statement / shareholder report that he will be using this address for certification.

Signing a certificate should be done offline by the user himself. Then, the user should provide a copy of the document and the signature, which are two coordinates in the finite field. The node will broadcast two transactions into the bitcoin blockchain, one with the x-coordinates and another with the y-coordinates of the signature. Note that after this point, verifying the signature of a certificate and trivially be done by any party within the P2P network.

## Spreading of Node

One of the limitation within the bitcoin network is the number of transactions per user per block. An easy way out is to create various certification nodes. This manner will however require an additional protocol to recognize such scenarios.

To solve this issue, a certification right can be divided to as many portion as possible within a transaction, with the first output being the administrator output. Hence, every bitcoin wallet which receives the certification rights output will have the right to certify new certificates. The wallet that owns the administrator output, will have the additional rights to spawn new children, terminate existing children or terminate the service as a whole.

## Rationale

By utilizing bitcoin addresses, only the certifying-node will have to be certificate aware. The user(s) will not need specified wallets to certify real-world documents.

In the case a middle-man node becomes non-trust-worthy, it is computational less worthy for him to certify an non-existing certificate. He is better off being honest and collecting a small transaction fee for certification services.

## Transactions Format

The first transaction input (except for node initialization) must be a certification right input, otherwise, such transaction is considered invalid BCC transaction.

The transaction outputs are as follows :

1. Certification Rights - An output corresponding to a transaction right
2. Marker Output - An OP_RETURN output that contains specification of the transaction
3. Affected address output - A transaction of arbirtary value to signify the affected address. there is only 1 at a time.
4. Further outputs are irrelevant and considered to be regular bitcoin outputs.

The marker output (40 bytes) is in the following format:

* **namespace** - BCC 3 bytes
* **OP_CODE** - the op_code corresponding to the operation - 1 byte
* **length of message** - the length of the instruction / key / signature - 1 byte
* **message** - the signature / key / hash - 0-35 bytes

## Address Format

The format of an adress is similiar to those of bitcoin, except using version 0x27 for base58check encoding.

## Operations

In the current version (0x01), there are the following op_codes

<table>
  <thead>
    <th>OP Code</th>
    <th>Description</th>
  </thead>
  <tbody>
    <tr>
      <td>0x00</td>
      <td>The creation of a new certification Right</td>
    </tr>
    <tr>
      <td>0x01</td>
      <td>Binding an address to a 33 bit-compressed public key for the specific certification right</td>
    </tr>
    <tr>
      <td>0x02</td>
      <td>
        The **r** / **x-coordinate** of signatures
      </td>
    </tr>
    <tr>
      <td>0x03</td>
      <td>
        The **s** / **y-coordinate** of signatures
      </td>
    </tr>
    <tr>
      <td>0xE0</td>
      <td>Do nothing (outputs can be used to manage child-spawning)</td>
    </tr>
    <tr>
      <td>0xF0</td>
      <td>Destroying a child node</td>
    </tr>
    <tr>
      <td>0xFF</td>
      <td>Termination of service as a whole</td>
    </tr>
  </tbody>
</table>
