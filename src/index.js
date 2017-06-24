if (!global._babelPolyfill) {
    require('babel-polyfill')
}
import rp from 'request-promise';
import fs from 'fs';
import moment from 'moment-timezone';
import uuid from 'uuid';
import xml2js from 'xml2js';
import flatten from 'lodash.flatten';
import Handlebars from 'handlebars';

const createGetMeteringPointPayload = Handlebars.compile(fs.readFileSync(__dirname + '/getMeteringPoint.xml', 'utf8'));
const createVerifyMeteringPointPayload = Handlebars.compile(fs.readFileSync(__dirname + '/verifyMeteringPoint.xml', 'utf8'));

function find(source, propertyName) {

    if (!source || (typeof source != 'object'))
        return undefined;

    var keys = Object.keys(source);

    if (keys.length == 0)
        return undefined;

    if (keys.includes(propertyName)) {
        return source[propertyName];
    }

    for (let i = 0; i < keys.length; i++) {
        const result = find(source[keys[i]], propertyName);

        if (result != undefined)
            return result;
    }

    return undefined;
}

const parseXml = async xml =>
    await new Promise((resolve, reject) =>
        new xml2js.Parser({ explicitArray: false, normalizeTags: true })
            .parseString(xml, (err, result) => err ? reject(err) : resolve(result))
    );

export class NubixClient {

    constructor(username, password, gln_no) {
        this._username = username;
        this._password = password;
        this._gln_no = gln_no;
        this._errorTypes = ['GridOwnerError', 'NoGridOwner', 'NubixError', 'GridOwnerCommunicationError', 'InvalidRequest'];
    }

    async verifyMeteringPoint(request) {

        const model = Object.assign({ requestId: uuid.v4(), userName: this._username, password: this._password, gln: this._gln_no }, request);
        const payload = createVerifyMeteringPointPayload(model);
        const options = {
            uri: 'https://ws.nubix.no/2011/NubixService.svc',
            method: 'POST',
            headers: {
                "SOAPAction": "Statnett.Nubix.NubixService:verifyMeteringPointIdIn",
                "Content-Type": "text/xml; charset=utf-8"
            },
            body: payload,
            timeout: 10000
        };

        let response = await rp(options);        
        const result = await parseXml(response);
        const resultResponse = find(result, 'meteringpointverifications');

        if (this._errorTypes.includes(resultResponse.responsestatus.statuscode))
            throw new Error(resultResponse.responsestatus.description);

        let returnResult = {
            found: resultResponse.responsestatus.statuscode === 'Found'
        };

        if (!returnResult.found) return returnResult;

        let readingType = find(resultResponse, 'meterreadingtransmissiontype');
        readingType = readingType == 'Z50' ? 'remote' : readingType == 'Z51' ? 'manual' : readingType == 'Z52' ? 'unread' : 'unknown'

        return Object.assign(returnResult, {    
            name: find(resultResponse,'name'),
            birthDate: find(resultResponse,'birthdate'),       
            orgNo: find(resultResponse,'orgno'),
            gridOwner: {
                name: resultResponse.gridowner.name,
                gln: resultResponse.gridowner.gln
            },
            address: {
                address: find(resultResponse, 'address1'),
                postalCode: find(resultResponse, 'postcode'),
                city: find(resultResponse, 'location')
            },
            installation: {
                description: find(resultResponse, 'description'),
                meteringPointId: find(resultResponse, 'meteringpointid'),
                meterNumber: resultResponse.meternumber,
                readingType: readingType,
                lastMeterReadingDate: find(resultResponse, 'lastmeterreadingdate')
            }
        });
    }

    async getMeteringPoint(request) {

        if ((!request.company && !request.person) || (request.company && request.person))
            throw new Error('request needs a valid "company" or "person" property');

        const model = Object.assign({ requestId: uuid.v4(), userName: this._username, password: this._password, gln: this._gln_no }, request);
        const payload = createGetMeteringPointPayload(model);
        const options = {
            uri: 'https://ws.nubix.no/2011/NubixService.svc',
            method: 'POST',
            headers: {
                "SOAPAction": "Statnett.Nubix.NubixService:getMeteringPointIdIn",
                "Content-Type": "text/xml; charset=utf-8"
            },
            body: payload,
            timeout: 10000
        };

        let response = await rp(options);
        const result = await parseXml(response);

        let resultResponse = find(result, 'response');

        if (!Array.isArray(resultResponse))
            resultResponse = [resultResponse];

        const error = resultResponse.filter(r => this._errorTypes.includes(r.responsestatus.statuscode))[0];

        if (error) throw new Error(error.responsestatus.description);

        return flatten(resultResponse.filter(r => r.responsestatus.statuscode === "Found").map(m => {

            m.customers = m.customers.domesticcustomer || m.customers.commercialcustomer;
            m.customers = Array.isArray(m.customers) ? m.customers : [m.customers];

            const gridOwner = {
                name: m.gridowner.name,
                gln: m.gridowner.gln
            };

            return m.customers.map(c => {
                let readingType = find(c, 'meterreadingtransmissiontype');
                readingType = readingType == 'Z50' ? 'remote' : readingType == 'Z51' ? 'manual' : readingType == 'Z52' ? 'unread' : 'unknown'

                let entity = request.company ? {
                    name: find(c, 'name'),
                    orgNo: find(c, 'orgno')
                } : {
                        lastName: find(c, 'lastname'),
                        firstName: find(c, 'firstname'),
                        birthDate: find(c, 'birthdate')
                    };

                return Object.assign(entity, {
                    address: {
                        address: find(c, 'address1'),
                        postalCode: find(c, 'postcode'),
                        city: find(c, 'location')
                    },
                    installation: {
                        description: find(c, 'description'),
                        meteringPointId: find(c, 'meteringpointid'),
                        meterNumber: c.meternumber,
                        readingType: readingType,
                        lastMeterReadingDate: find(c, 'lastmeterreadingdate')
                    },
                    gridOwner
                });
            });
        }));

    }
    //kept for back compat
    async getMeteringPointInfo(request) {
        return await this.getMeteringPoint({ person: request });
    }
}
