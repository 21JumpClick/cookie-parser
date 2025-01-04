import {Serialize_Interface} from "../contracts/Serialize_Interface";
import {EncryptorError} from "../EncryptorError";
import {isSerialized, serialize, unserialize} from 'php-serialize'

export class PhpSerializer implements Serialize_Interface {

  /**
   * Serialize
   *
   * @param data
   */
  serialize(data: any): string {
    return serialize(data)
  }

  /**
   * Unserialize
   *  if not serialized return data untouched
   *
   * @param data
   */
  unSerialize(data: any): any {
    if (!isSerialized(data)) return data;
    try {
      return unserialize(data)
    } catch (e) {
      throw new EncryptorError('phpUnSerialize Error unserialize data')
    }
  }

}
