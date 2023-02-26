import * as functions from "firebase-functions";
import {
    config,
    send,
    transaction,
    args,
    arg,
    payer,
    proposer,
    authorizations,
    limit,
    t,
    sansPrefix,
    withPrefix,
//@ts-ignore
} from '@onflow/fcl';
import {sign} from './crypto'


export const payer_address = functions.https.onCall((data, context) => {
    const address = process.env.PAYER_ADDRESS
    const keyId = 0;
    return {address, key_id: keyId}
})

export const account = functions.https.onCall(async (data, context) => {
    const pk = data.pk
    console.log(pk)

    config({
        'accessNode.api': process.env.API!
    })

    const cadence = `
    transaction(publicKey: String) {
        prepare(signer: AuthAccount) {
            let key = PublicKey(
                publicKey: publicKey.decodeHex(),
                signatureAlgorithm: SignatureAlgorithm.ECDSA_P256
            )
    
            let account = AuthAccount(payer: signer)
    
            account.keys.add(
                publicKey: key,
                hashAlgorithm: HashAlgorithm.SHA2_256,
                weight: 1000.0
            )
        }
    }
    `

    const tx = await send([
        transaction(cadence),
        args([arg(pk, t.String)]),
        payer(authz),
        proposer(authz),
        authorizations([authz]),
        limit(9999)
    ]);

    console.log(tx);
    return tx.transactionId;
})

export const airdrop = functions.https.onRequest(async (request, response) => {
    console.log(request.path);
    const amount = 1.0;
    const to = request.path.substring(1);

    config({
        'accessNode.api': process.env.API!
    })

    const cadence = `
    import FungibleToken from 0x9a0766d93b6608b7
    transaction(amount: UFix64, to: Address) {
        let vault: @FungibleToken.Vault

        prepare(signer: AuthAccount) {
            self.vault <- signer
                .borrow<&{FungibleToken.Provider}>(from: /storage/flowTokenVault)!
                .withdraw(amount: amount)
        }

        execute {
            getAccount(to)
                .getCapability(/public/flowTokenReceiver)!
                .borrow<&{FungibleToken.Receiver}>()!
                .deposit(from: <-self.vault)
        }
    }
    `
    const tx = await send([
        transaction(cadence),
        args([arg(amount.toFixed(8), t.UFix64), arg(to, t.Address)]),
        payer(authz),
        proposer(authz),
        authorizations([authz]),
        limit(9999)
    ]);

    console.log(tx);
    response.json(tx.transactionId);
})

const authz = async(account: any) => {
    return {
        ...account,
        addr: sansPrefix(process.env.PAYER_ADDRESS!),
        keyId: 0,
        signingFunction: (signable: any) => {
            const signature = sign(process.env.PAYER_SK!, signable.message)

            return {
                addr: withPrefix(process.env.PAYER_ADDRESS!),
                keyId: 0,
                signature: signature,
            }
        }
    }
}