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