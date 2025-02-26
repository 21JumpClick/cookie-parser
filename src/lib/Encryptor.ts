import {Base_encryptor, IBaseEncryptorOption} from "./base_encryptor";
import {EncryptorError} from "./EncryptorError";
import {Serializer} from "./Serializer";

// Cipher steps:
// serialize
// cipher
// base64 iv
// hash HMac: iv + encrypted
// json_encode {iv, encrypted, MAC}
// base64

/**
 * Class to Encrypt/Decrypt data compatible
 *  with Laravel 5.8 Illuminate/Encryption/Encrypter.php (and maybe lower versions)
 *
 *  Only [aes-128-cbc] and [aes-256-cbc] algorithms are available
 *
 * Use:
 *      foo = new Encryptor({key})
 *
 *      foo.encrypt('ferrets better than cats')
 *          return Promise [base64 string] of a serialized object {iv, encrypted, mac}
 *
 *      foo.decrypt(payload)
 *          payload: [base64 string] of a serialized or unserialized object {iv, encrypted, mac}
 *          return Promise decrypted value of payload.value
 */
export class Encryptor extends Base_encryptor {

    constructor(options:IBaseEncryptorOption, driver?: Serializer) {
        super(options, driver);
    }

    /**
     * encrypt
     *
     * @param data
     * @param force_serialize
     */
    public encrypt(data: any, force_serialize?: boolean): Promise<any> {
        if(! data) throw new EncryptorError('encrypt no data given');

        const payload  = this.prepareDataToCipher(data, force_serialize);

        if(!payload){
            throw new EncryptorError("payload not found")
        }

        return this
            .encryptIt(payload)
            .then(Encryptor.stringifyAndBase64, Encryptor.throwError)
    }

    /**
     * encrypt Sync mode
     *
     * @param data
     * @param force_serialize
     */
    public encryptSync(data: any, force_serialize?: boolean): string {
        if(! data) throw new EncryptorError('encryptSync no data given');

        const payload  = this.prepareDataToCipher(data, force_serialize);

        if(!payload){
            throw new EncryptorError("payload not found")
        }

        return Encryptor.stringifyAndBase64(this.encryptItSync(payload))
    }

    /**
     * decrypt
     *
     * @param data
     */
    public decrypt(data: string): any {
        if(! data) throw new EncryptorError('decrypt no data given');

        const payload = this.prepareDataToDecipher(data);
        return this.decryptIt(payload)
    }


    /**
     * static_decipher
     *  helper method
     *
     * @param key
     * @param data
     * @param serialize_mode
     */
    static static_decipher(key: string, data: string, serialize_mode?: 'json|php'){
        if(! key) throw new EncryptorError('static_decipher no key given');
        if(! data) throw new EncryptorError('static_decipher no data given');

        const encrypt = new Encryptor({key});
        return encrypt.decrypt(data)
    }

    /**
     * static_cipher
     *  helper method
     * @param key
     * @param data
     * @param serialize_mode
     * @param cb
     */
    static static_cipher(key: string, data: any, serialize_mode?: 'json'|'php', cb?: any){
        if(! key) throw new EncryptorError('static_cipher no key given');
        if(! data) throw new EncryptorError('static_cipher no data given');

        const encrypt = new Encryptor({key});

        if(typeof cb === 'function') {
            encrypt.encrypt(data)
                .then(enc => cb(null, enc))
                .catch(e => cb(e));
        }else {
            return encrypt.encryptSync(data)
        }
    }
}
