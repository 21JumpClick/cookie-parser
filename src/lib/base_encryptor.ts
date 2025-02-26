import {Serializer} from "./Serializer";
import {EncryptorError} from "./EncryptorError";
import {PhpSerializer} from "./serializers/phpSerializer";
import {JsonSerializer} from "./serializers/jsonSerializer";
import cryptTypes from "crypto";

const valid_aes = [128, 256];
const default_aes = 256;

let crypto;
//Determining if crypto support is unavailable
try {
  crypto = require('crypto');
} catch (e) {
  throw new EncryptorError(e.message);
}

export interface IBaseEncryptorOption {
  key: string,
  key_length?: number,
  random_bytes?: number,
  serialize_mode?: 'json' | 'php' | 'custom'
}

/**
 * Base encryptor Class
 */
export class Base_encryptor {

  /** Cypher type */
  protected algorithm: string;

  /** SECRET KEY Buffer */
  protected readonly secret: any;

  /** AES 128/256 */
  protected aes_mode = default_aes;

  /** valid key length in laravel aes-[128]-cbc aes-[256]-cbc */
  protected valid_aes_modes = valid_aes;

  /** Bytes number crypto.randomBytes default 8 */
  protected random_bytes = 8;

  /** serialize driver */
  private serialize_driver: Serializer;

  /** default serialize lib */
  protected default_serialize_mode = 'php';

  /** constructor options */
  protected options: IBaseEncryptorOption

  /** for test only */
  private raw_decrypted: any;

  constructor(options:IBaseEncryptorOption, driver?: Serializer) {
    this.options = Object.assign({}, {serialize_mode: this.default_serialize_mode}, options);

    this.setSerializerDriver(driver);
    this.setAlgorithm();

    this.secret = Base_encryptor.prepareAppKey(this.options.key);
    this.random_bytes = this.options.random_bytes ? this.options.random_bytes : this.random_bytes;
  }

  /**
   * encryptIt
   *
   * @return Promise object {iv, value, mac}
   */
  protected encryptIt(data: string): Promise<any> {
    return this
      .generate_iv()
      .then(this.createCypherIv())
      .then(this.cipherIt(data))
      .then(this.generateEncryptedObject())
  }

  /**
   * encryptIt
   *
   * @param data
   * @return object {iv, value, mac}
   */
  protected encryptItSync(data: string): any {
    const iv = this.generate_iv_sync();
    if(!iv){
      throw new EncryptorError("IV not found")
    }

    const cipher = this.createCipher(iv);

    if(!cipher){
      throw new EncryptorError("Cipher not found")
    }

    const value = Base_encryptor.cryptoUpdate(cipher, data);

    return this.generateEncryptedObject()({iv, value})
  }

  /**
   * decryptIt
   *
   * @param encrypted
   */
  protected decryptIt(encrypted: string): any {
    let payload;

    try {
      payload = JSON.parse(encrypted);
    } catch (e) {
      Base_encryptor.throwError('Encryptor decryptIt cannot parse json')
    }

    //check hmac payload.mac with crypto.timingSafeEqual to prevent timing attacks
    if (!Base_encryptor.validPayload(payload))
      Base_encryptor.throwError('The payload is invalid.');

    if (!this.validMac(payload))
      Base_encryptor.throwError('The MAC is invalid.');

    const decipherIv = this.createDecipheriv(payload.iv);

    if(!decipherIv){
      throw new EncryptorError("decipherIv not found")
    }

    const decrypted = Base_encryptor.cryptoDecipher(payload, decipherIv);

    if (process.env.NODE_ENV === 'test')
      this.raw_decrypted = decrypted;

    if(!decrypted){
      throw new EncryptorError("decrypted not found")
    }

    return this.ifserialized_unserialize(decrypted)
  }

  /**
   * prepareAppKey
   *
   * @param key
   */
  static prepareAppKey(key: string): Buffer {
    if (!key)
      Base_encryptor.throwError('no app key given');

    return Buffer.from(key, 'base64');
  }

  /**
   * set serializer driver
   *
   * @param driver
   */
  setSerializerDriver(driver?: any) {
    if (driver) {
      if (!Base_encryptor.validateSerializerDriver(driver))
        Base_encryptor.throwError('validateSerializerDriver');
      this.serialize_driver = new Serializer(new driver);
      this.options.serialize_mode = 'custom';
    } else {
      this.serialize_driver = new Serializer(this.pickSerializeDriver());
    }
  }

  /**
   * validateSerializerDriver
   *
   * @param driver
   */
  static validateSerializerDriver(driver: any) {
    try {
      const custom_driver = new driver;
      return Base_encryptor
        .validateSerializerImplementsSerializerInterface(custom_driver)
    } catch (e) {
      Base_encryptor.throwError('validateSerializerDriver')
    }
  }

  /**
   * validateSerializerDriver
   *
   * @param driver
   */
  static validateSerializerImplementsSerializerInterface(driver: any) {
    return (typeof driver['serialize'] === 'function')
      && (typeof driver['unSerialize'] === 'function')
  }

  /**
   * pickSerializeDriver
   */
  pickSerializeDriver() {
    if (!this.options.serialize_mode)
      this.options.serialize_mode = 'php';

    switch (this.options.serialize_mode) {
      case 'json': {
        return new JsonSerializer;
      }
      case 'php': {
        return new PhpSerializer;
      }
      default: {
        throw new EncryptorError(
          `Serializer Encryptor Class unknown option ${this.options.serialize_mode} serialize_mode`
        )
      }
    }
  }

  /**
   * setAlgorithm
   *  will populate this.algorithm with valid one aes-[128]-cbc aes-[256]-cbc
   *  from options.aes_mode or this.key_length
   *
   *  if there is an error will push it to errors (and return as reject at public methods)
   */
  protected setAlgorithm() {
    if (this.options.key_length && this.valid_aes_modes.indexOf(this.options.key_length) < 0)
      Base_encryptor.throwError(
        'The only supported ciphers are AES-128-CBC and AES-256-CBC with the correct key lengths.'
      );

    this.algorithm = this.options.key_length ?
      `aes-${this.options.key_length}-cbc` : `aes-${this.aes_mode}-cbc`;
  }

  /**
   * Prepare Data
   *  will receive data from this.encrypt(data)
   *  and check if is a number to convert to string,
   *  return data serialized if need it
   *
   * @param data
   * @param force_serialize
   */
  protected prepareDataToCipher(data: any, force_serialize?: boolean): string | undefined  {
    if (force_serialize === true && this.serialize_driver.getDriverName() === 'PhpSerializer') {
      return this.serialize_driver.serialize(data);
    }

    data = Base_encryptor.ifNumberToString(data);

    return this.ifObjectToString(data);
  }

  /**
   * prepareDataToDecipher
   *  will parse base64 to utf8
   * @param data
   */
  protected prepareDataToDecipher(data: any): string {
    return Base_encryptor.base64ToUtf8(data);
  }

  /**
   * validPayload
   *
   * @param payload
   */
  static validPayload(payload: any): boolean {
    return payload.hasOwnProperty('iv') && payload.hasOwnProperty('value') && payload.hasOwnProperty('mac')
      && Buffer.from(payload.iv, 'base64').toString('hex').length === 32;
  }

  /**
   * validMac
   *
   * @param payload
   */
  validMac(payload: any): boolean {
    try {
      const calculated = this.hashIt(payload.iv, payload.value);

      if(!calculated){
        throw new EncryptorError("calculated not found")
      }

      return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(payload.mac))
    } catch (e) {
      return false;
    }
  }


  /**
   * crypto update + final
   *
   * @param cipher
   * @param data
   */
  static cryptoUpdate(cipher: cryptTypes.Cipher, data: string) {
    try {
      return cipher.update(data, 'utf8', 'base64') + cipher.final('base64');
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }
  }

  /**
   * Create node crypto cipher Iv
   *
   * @param iv
   */
  protected createCipher(iv: string): cryptTypes.Cipher | undefined {
    try {
      return crypto.createCipheriv(this.algorithm, this.secret, iv);
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }
  }

  /**
   * crypto createCipheriv
   *
   * @return Promise crypto cipher
   */
  protected createCypherIv(): any {
    return (iv) => {
      return {iv, cipher: this.createCipher(iv)};
    }
  }

  /**
   * generate a la Laravel Encrypted Object
   *
   * @param data
   */
  protected cipherIt(data: string): any {
    return ({iv, cipher}: any) => {
      return {
        iv,
        value: Base_encryptor.cryptoUpdate(cipher, data)
      }
    }
  }

  /**
   * Generate 8 bytes IV
   *
   * @return Promise [16 hexadecimal string]
   */
  protected generate_iv(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(this.random_bytes, (err, buffer) => {
        if (err) return reject(err);
        resolve(buffer.toString('hex'))
      });
    });
  }

  /**
   * Generate 8 bytes IV
   *
   * @return string [16 hexadecimal string]
   */
  protected generate_iv_sync(): string | undefined {
    try {
      const buf = crypto.randomBytes(this.random_bytes);
      return buf.toString('hex');
    } catch (e) {
      Base_encryptor.throwError('generate_iv_sync error generating random bytes');
    }
  }

  /**
   * generate Laravel Encrypted Object
   */
  protected generateEncryptedObject() {
    return ({iv, value}: any) => {
      iv = Base_encryptor.toBase64(iv);
      return {
        iv,
        value,
        mac: this.hashIt(iv, value)
      };
    }
  }

  /**
   * crypto createDecipheriv
   *
   * @param iv
   * @return crypto decipher
   */
  protected createDecipheriv(iv: string): cryptTypes.Decipher| undefined  {
    try {
      return crypto.createDecipheriv(this.algorithm, this.secret, Buffer.from(iv, 'base64'));
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }
  }

  /**
   * cryptoDecipher
   *
   * @param payload
   * @param decipher
   */
  static cryptoDecipher(payload: {
    iv,
    value,
    mac
  }, decipher: cryptTypes.Decipher) {
    try {
      return decipher.update(payload.value, 'base64', 'utf8') + decipher.final('utf8');
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }
  }

  /**
   * ifserialized_unserialize
   *
   * @param decrypted
   */
  protected ifserialized_unserialize(decrypted: string): any {
    return this.serialize_driver.unSerialize(decrypted)
  }

  /**
   * Create HMAC hash a la laravel
   *
   * @param iv
   * @param encrypted
   * @return hex string
   */
  protected hashIt(iv: string, encrypted: string): string| undefined  {
    try {
      const hmac = Base_encryptor.createHmac("sha256", this.secret);

      if(!hmac){
        throw new EncryptorError("hmac not found")
      }

      return hmac
        .update(Base_encryptor.setHmacPayload(iv, encrypted))
        .digest("hex");
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }
  }

  /**
   * serialize data
   *
   * @param data
   * @return serialized data
   */
  protected serialize(data: any): string | undefined {
    return this.serialize_driver.serialize(data)
  }

  /**
   * Unserialize data
   *
   * @param data
   * @return unserialized data
   */
  protected unserialize(data: string): any {
    return this.serialize_driver.unSerialize(data)
  }

  /**
   * Convert data to base64
   *
   * @param data
   * @return base64 string
   */
  static toBase64(data): string {
    return Buffer.from(data).toString('base64');
  }

  /**
   * Parse base64 to utf8
   *
   * @param data
   * @return utf8 string
   */
  static base64ToUtf8(data: string): string {
    if (typeof data !== 'string')
      throw new EncryptorError('base64ToUtf8 Error data arg not a string');

    return Buffer.from(data, 'base64').toString('utf8');
  }

  /**
   * Create crypto Hmac
   *
   * @param alg
   * @param secret
   */
  static createHmac(alg: string, secret: Buffer): cryptTypes.Hmac| undefined  {
    try {
      return crypto.createHmac(alg, secret);
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }

  }

  /**
   * Set hmac payload
   *
   * @param iv
   * @param encrypted
   */
  static setHmacPayload(iv: string, encrypted: string): Buffer {
    return Buffer.from(iv + encrypted, 'utf-8')
  }

  /**
   * stringifyAndBase64
   *  will json.stringify object {iv, value, mac} and base64 it
   *
   * @param encrypted {iv, value, mac}
   * @return string base64
   */
  static stringifyAndBase64(encrypted: { iv, value, mac }): string {
    const payload = JSON.stringify(encrypted);
    return Buffer.from(payload).toString('base64');
  }

  /**
   * ifObjectToString serialize object
   *
   * @param data
   */
  protected ifObjectToString(data: any): string {
    return (typeof data === 'object') ? this.serialize(data) : data;
  }

  /**
   * number To String
   *  if data is a number convert to string
   *
   * @param data
   */
  static ifNumberToString(data: any): string {
    return (typeof data === 'number') ? data + '' : data;
  }

  /**
   * Throw Error.
   *
   * @param error
   */
  static throwError(error) {
    if (error.name === 'EncryptorError')
      throw error;

    throw new EncryptorError(error);
  }

  /**
   * Generate a random key for the application.
   *
   * @return string
   */
  static generateRandomKey(length?: number): string | undefined {
    length = length ? length : default_aes;

    //laravel supports 128/256
    if (valid_aes.indexOf(length) < 0) {
      console.error('valid options are: ', valid_aes);
      return;
    }

    try {
      const buf = crypto.randomBytes(length / 8);
      return buf.toString('base64');
    } catch (e) {
      Base_encryptor.throwError(e.message);
    }
  }

  /**
   * For testing only
   */
  getRawDecrypted() {
    return this.raw_decrypted
  }
}
