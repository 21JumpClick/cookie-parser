const {it} = require("mocha");
const {expect} = require("chai");
const chai = require("chai");
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
import {ExpressServer} from "../lib/express-server";
import {Encryptor} from "node-laravel-encryptor";
const key = Encryptor.generateRandomKey();
const cookie = require('cookie');
const uuid = require('uuid/v1');
const server_id = uuid();

const cookie_name = 'fooBarCookie';
const cookie_name1 = 'kokoa';

const allowed = [cookie_name, cookie_name1];

const parseCookies = (str) => {
    if(typeof str === 'object' && str.length >= 0){
        let out = '';
        str.forEach((ele,i) => { if(i === 0){out +=ele}else{ out +=';' + ele}});
        return cookie.parse(out);
    } else {
        return cookie.parse(str);
    }

};

const options = () => {
    return {
        server_id,
        encryptor: {
            key
        },
        cookie: {
            allow_all: false,
            allowed,
            options: {
                secure: false,
                httpOnly: false
            }
        }
    }
};

/**
 * Decipher helper
 * @param encrypted
 */
const decipher = (encrypted) => {
    const cipher = new Encryptor({key});
    return cipher.decrypt(encrypted)
};

export default function suite() {

   it(`should receive cipher cookie with name ${cookie_name}`, done => {
        const server = new ExpressServer(options());

        const requester = chai.request.agent(server).keepOpen();

        requester.get('/')
            .then(response => {
                const cookies = cookie.parse(response.res.headers['set-cookie'][0]);
                const deciphered = decipher(cookies[cookie_name]);
                expect(deciphered).equal(server_id)
            })
            .then(() => {
                requester.close();
                done();
            })
    });

     it('should send cipher cookie and cookieParser should decipher it', async () => {
        const server = new ExpressServer(options());
        const agent = chai.request.agent(server);
        const request = await agent.get('/');
        const cookies = request.header['set-cookie'];
        const second_request = await agent.get('/cookies').set('Cookie', cookies);
        expect(second_request.res.text).equal(server_id)
     });

    it('should res.cookie not populate response Headers Set-Cookie when cookie name is not allowed ', async () => {
        const server = new ExpressServer(options());
        const agent = chai.request.agent(server);
        const request = await agent.get('/notallowedcookie');
        expect((parseCookies(request.res.headers['set-cookie']))['notAllowedCookie'])
            .equal(undefined);
        expect(request.status).equal(200)
    });

    it('should server res.cookie populate response Headers Set-Cookie when cookie name is not allowed and allow_all = true', async () => {
        const opt = JSON.parse(JSON.stringify(options()));
        opt.cookie.allow_all = true;
        const server = new ExpressServer(opt);
        const agent = chai.request.agent(server);
        const request = await agent.get('/notallowedcookie');
        expect(parseCookies(request.res.headers['set-cookie'])).hasOwnProperty('notAllowedCookie');
        expect(request.status).equal(200)
    });

    it('should client send not allowed cookie and cookieParser should discard', async () => {
        const server = new ExpressServer(options());
        const agent = chai.request.agent(server);
        const request = await agent.get('/unwanted_cookie').set('Cookie', 'bad_cookie=2');
        expect(request.res.text).equal('no cookies');
    });

    it('should client send not allowed cookie when allow_all option true and should not decipher but should be parsed in req.cookies', async () => {
        const opt = JSON.parse(JSON.stringify(options()));
        opt.cookie.allow_all = true;
        const server = new ExpressServer(opt);
        const agent = chai.request.agent(server);
        const request = await agent.get('/unwanted_cookie').set('Cookie', 'bad_cookie=2');
        expect(request.res.text).equal('2');
    });

}
