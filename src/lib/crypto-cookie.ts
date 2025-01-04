import {AdsegCookieParser} from './adseg-cookie-parser';
import {OverrideCookie} from './override-cookie';
import {IBaseEncryptorOption} from "./base_encryptor";

export interface ICryptoCookieOption {
  encryptor: IBaseEncryptorOption,
  cookie: {
    allow_all: boolean,
    allowed: string[],
    options?: {
      domain?: string,
      expires?: number,
      maxAge?: number,
      path?: string,
      sameSite?: boolean,
      secure?: boolean,
      httpOnly?: boolean
    }
  }
}

export class CryptoCookie {
  get parser(): AdsegCookieParser {
    return this._parser;
  }

  /** Cookie Parser */
  private readonly _parser: AdsegCookieParser;
  /** Cookie Override */
  private cookieOverride: OverrideCookie;

  constructor(private options: ICryptoCookieOption) {
    this._parser = new AdsegCookieParser(this.options);
    this.cookieOverride = new OverrideCookie(this.options)
  }

  /**
   * override express response cookie method
   *
   * @param express_instance
   */
  overrideCookie(express_instance) {
    if (!this.validExpressInstance(express_instance))
      throw new Error('overrideCookie express argument not an express instance');

    return this.cookieOverride.cookieMethod(express_instance)
  }

  /**
   * Cookie Parser Middleware for Express Js
   */
  cookieParser() {
    return this._parser.cookieParser()
  }

  /**
   * Socket Cookie Parser Middleware for socket.io
   */
  socketCookieParser() {
    return this._parser.socketCookieParser()
  }

  /**
   * check if a valid express instance
   *
   * @param express_instance
   */
  validExpressInstance(express_instance) {
    return express_instance.constructor.name === 'EventEmitter' &&
      express_instance.hasOwnProperty('mountpath') &&
      express_instance.hasOwnProperty('settings')
  }
}
