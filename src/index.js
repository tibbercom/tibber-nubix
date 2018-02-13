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
import holidays from 'holidays-norway';

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

        if (request.birthDate) {
            request.birthDate = moment.tz(request.birthDate, 'Europe/Oslo').format('YYYY-MM-DD');
        }

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
            name: find(resultResponse, 'name'),
            birthDate: find(resultResponse, 'birthdate'),
            orgNo: find(resultResponse, 'orgno'),
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
                lastMeterReadingDate: find(resultResponse, 'lastmeterreadingdate'),
                startOfSupplyDuty: find(resultResponse, 'startofsupplyduty')
            }
        });
    }

    async getMeteringPoint(request) {

        if ((!request.company && !request.person) || (request.company && request.person))
            throw new Error('request needs a valid "company" or "person" property');

        if (request.person && request.person.birthDate) {
            request.person.birthDate = moment.tz(request.person.birthDate, 'Europe/Oslo').format('YYYY-MM-DD');
        }

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
                        lastMeterReadingDate: find(c, 'lastmeterreadingdate'),
                        startOfSupplyDuty: find(c, 'startofsupplyduty')
                    },
                    gridOwner
                });
            }).map(r => {
                r.canChangeSupplierWithoutReading = !(estimateNeedForReading(r.installation.lastMeterReadingDate, r.installation.readingType));
                return r;

            });
        }));
    }

    async getMeteringPointTriangulate(request) {

        const personRequest = request.person;
        const companyRequest = request.company;

        const search = async (request, retries) => {

            const searchQuality = request.searchQuality;
            delete request.searchQuality;

            try {

                const results = await this.getMeteringPoint(request);

                return results.map(r => {
                    r.resultStrength = searchQuality;
                    return r;
                });
            }
            catch (err) {
                if (retries == 1) {

                    return await search({ ...request, searchQuality }, ++retries);
                }
                return []
            }
        };

        const requests = [
            personRequest && personRequest.birthDate && personRequest.lastName && personRequest.address.address && !!!personRequest.organizationNo
            && {
                searchQuality: 0,
                person: {
                    lastName: personRequest.lastName,
                    birthDate: personRequest.birthDate,
                    address: { address: personRequest.address.address, postalCode: personRequest.address.postalCode }
                }
            },
            personRequest && personRequest.birthDate && personRequest.lastName && {
                searchQuality: 1,
                person: {
                    lastName: personRequest.lastName,
                    birthDate: personRequest.birthDate,
                    address: { postalCode: personRequest.address.postalCode }
                }
            },
            personRequest && personRequest.lastName && personRequest.address.address && {
                searchQuality: 1,
                person: {
                    lastName: personRequest.lastName,
                    address: { address: personRequest.address.address, postalCode: personRequest.address.postalCode }
                }
            },
            personRequest && personRequest.birthDate && personRequest.address.address && {
                searchQuality: 2,
                person: {
                    birthDate: personRequest.birthDate,
                    address: { address: personRequest.address.address, postalCode: personRequest.address.postalCode }
                }
            },
            personRequest && personRequest.birthDate && personRequest.meterNo && {
                searchQuality: 0,
                person: {
                    birthDate: personRequest.birthDate,
                    meterNo: personRequest.meterNo,
                    address: { postalCode: personRequest.address.postalCode }
                }
            },
            personRequest && personRequest.birthDate && personRequest.meterNo && personRequest.address.address && {
                searchQuality: 1,
                person: {
                    lastName: personRequest.lastName,
                    meterNo: personRequest.meterNo,
                    address: { address: personRequest.address.address, postalCode: personRequest.address.postalCode }
                }
            },
            companyRequest && companyRequest.orgNo && companyRequest.meterNo && companyRequest.address.address && {
                searchQuality: 0,
                company: {
                    orgNo: companyRequest.orgNo,
                    meterNo: companyRequest.meterNo,
                    address: { address: companyRequest.address.address, postalCode: companyRequest.address.postalCode }
                }
            },
            companyRequest && companyRequest.name && companyRequest.meterNo && {
                searchQuality: 0,
                company: {
                    name: companyRequest.name,
                    meterNo: companyRequest.meterNo,
                    address: { postalCode: companyRequest.address.postalCode }
                }
            },
            companyRequest && companyRequest.name && companyRequest.orgNo && {
                searchQuality: 2,
                company: {
                    name: companyRequest.name,
                    orgNo: companyRequest.orgNo,
                    address: { postalCode: companyRequest.address.postalCode }
                }
            },
            companyRequest && companyRequest.orgNo && companyRequest.address.address && {
                searchQuality: 0,
                company: {
                    orgNo: companyRequest.orgNo,
                    address: { address: companyRequest.address.address, postalCode: companyRequest.address.postalCode }
                }
            },
            companyRequest && companyRequest.name && companyRequest.address.address && {
                searchQuality: 0,
                company: {
                    name: companyRequest.name,
                    address: { address: companyRequest.address.address, postalCode: companyRequest.address.postalCode }
                }
            }].filter(r => r);

        let results = await Promise.all(requests.map(async r => await search(r)));

        results = results.reduce((p, c) => p.concat(c), []);

        if (!results.some(r => true)) return [];

        const result = results.sort((a, b) => a.resultStrength > b.resultStrength ? -1 : 1)
            .reduce((p, c) => { p[c.installation.meteringPointId] = c; return p }, {})

        return Object.keys(result).map(key => result[key]);
    }

    //kept for back compat
    async getMeteringPointInfo(request) {
        return await this.getMeteringPoint({ person: request });
    }
}

const estimateNeedForReading = (lastReading, readingType) => {

    let needsMeterReading = false;

    if (readingType == 'manual' && lastReading) {

        let takeOverDate = moment.tz('Europe/Oslo').add(15, 'days');
        let year = takeOverDate.year();
        let holidays_year = holidays.by_year(year).reduce((p, c) => { p[c.date] = true; return p; }, {});
        let workingDays = 0;

        while (workingDays < 20) {
            takeOverDate.subtract(1, 'day');

            let currentYear = takeOverDate.year();

            if (currentYear != year) {
                year = currentYear;
                holidays_year = holidays.by_year(year).reduce((p, c) => { p[c.date] = true; return p; }, {});
            }

            const weekDay = takeOverDate.isoWeekday();

            if (weekDay == 6 || weekDay == 7 || holidays_year[takeOverDate.format('YYYY-MM-DD')]) {
                continue;
            }
            workingDays++;
        }

        needsMeterReading = takeOverDate.isAfter(moment.tz(lastReading, 'Europe/Oslo'));
    }
    return needsMeterReading;
};
