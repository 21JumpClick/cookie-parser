import SocketIO from 'socket.io';
import {Encryptor} from "./Encryptor";
import {ICryptoCookieOption} from "./crypto-cookie";

export class AdsegCookieParser {

  /** regexp */
   readonly pairSplitRegExp = /; */;
  /** regexp */
   readonly fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
  /** allowed cookies */
   allowed: any = [];
  /** allow all not allowed cookies to be populate to req.cookies, but not deciphered */
   allow_all: boolean = false;

  /** encryptor */
   cipher: Encryptor;

  constructor(private options : ICryptoCookieOption) {
    this.allow_all = options.cookie.allow_all;
    this.cipher = new Encryptor(this.options.encryptor);
    this.allowed = this.options.cookie.allowed || [];
  }

  /**
   * decode
   *
   * @param data
   */
   decode(data) {
    return this.cipher.decrypt(decodeURIComponent(data));
  }

  /**
   * Encode
   *
   * @param data
   */
   encode(data) {
    return encodeURIComponent(this.cipher.encryptSync(data));
  }

  /**
   * Cookie Parser
   * original cookieParser method from cookie-parser module
   *  with added function to decode only what we allow
   */
  cookieParser() {
    return (req, res, next) => {
      if (req.cookies) {
        return next()
      }

      const cookies = req.headers.cookie;

      req.cookies = Object.create(null);

      // no cookies
      if (!cookies) {
        return next()
      }

      req.cookies = this.parse(cookies);

      next()
    }
  }

  /**
   * Socket Cookie Parser
   * original cookieParser method from cookie-parser module
   *  with added function to decode only what we allow
   */
  socketCookieParser() {
    return (socket: SocketIO.Socket, next) => {
      if (socket.handshake.headers.cookie) {
        return next()
      }

      const cookies = socket.handshake.headers.cookie;

      socket.handshake.headers.cookie = Object.create(null) as any;

      // no cookies
      if (!cookies) {
        return next()
      }

      socket.handshake.headers.cookie = this.parse(cookies) as any;

      next()
    }
  }

  /**
   * Socket Cookie Parser
   * original cookieParser method from cookie-parser module
   *  with added function to decode only what we allow
   */
  socketCookieParserMiddleWare(socket: SocketIO.Socket, next) {
    if (socket.handshake.headers.cookie) {
      return next()
    }

    const cookies = socket.handshake.headers.cookie;

    socket.handshake.headers.cookie = Object.create(null) as any;

    // no cookies
    if (!cookies) {
      return next()
    }

    socket.handshake.headers.cookie = this.parse(cookies) as any;

    next()
  }

  /**
   * Parser
   *  original parse method from cookie-parser module
   *  with added function to decode only what we allow
   * @param str
   */
   parse(str) {
    if (typeof str !== 'string') {
      throw new TypeError('argument str must be a string');
    }

    var obj = {};

    var pairs = str.split(this.pairSplitRegExp);

    //console.log(pairs)
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i];
      var eq_idx = pair.indexOf('=');

      // skip things that don't look like key=value
      if (eq_idx < 0) {
        continue;
      }

      const key = pair.substr(0, eq_idx).trim();
      let val = pair.substr(++eq_idx, pair.length).trim();

      // quoted values
      if ('"' == val[0]) {
        val = val.slice(1, -1);
      }

      // only assign once
      if (undefined == obj[key]) {
        if (this.allowed.includes(key)) {
          obj[key] = this.decode(val).split('|')[1];
        } else if (this.allow_all) {
          obj[key] = decodeURIComponent(val);
        }
      }
    }
    return obj;
  }
}


