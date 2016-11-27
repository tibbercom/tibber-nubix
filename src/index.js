
import rp from 'request-promise';
import fs from 'fs';
import moment from 'moment-timezone';
import uuid from 'uuid';
import xml2js from 'xml2js';


const template = fs.readFileSync(__dirname + '/getMeteringPoint.xml', "utf8");

function _validateAndReturn(source, propName) {

    if (source[propName] === undefined)
        throw new Error(`property "${propName}" is required"`);

    return source[propName];

}

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
        const result = find(source[keys[i]],propertyName);
        
        if (result != undefined)
            return result;
    }

    return undefined;
}

export class NubixClient {

    constructor(username, password, gln_no) {

        this._username = username;
        this._password = password;
        this._gln_no = gln_no;
    }

    async getMeteringPointInfo(request) {

        request.address = request.address || {};

        const firstName = _validateAndReturn(request, 'firstName');
        const lastName = _validateAndReturn(request, 'lastName');
        const birthDate = moment.tz(_validateAndReturn(request, 'birthDate'), 'Europe/Oslo').format('YYYY-MM-DD');
        const address = _validateAndReturn(request.address, 'address');
        const postalCode = _validateAndReturn(request.address, 'postalCode');
        const city = _validateAndReturn(request.address, 'city');

        let body = template.replace('{#firstName#}', firstName);
        body = body.replace('{#lastName#}', lastName);
        body = body.replace('{#birthDate#}', birthDate);
        body = body.replace('{#address#}', address);
        body = body.replace('{#postalCode#}', postalCode);
        body = body.replace('{#city#}', city);
        body = body.replace('{#requestId#}', uuid.v4());
        body = body.replace('{#gln#}', this._gln_no);
        body = body.replace('{#username#}', this._username);
        body = body.replace('{#password#}', this._password);

        const options = {
            uri: 'https://ws.nubix.no/2011/NubixService.svc',
            method: 'POST',
            headers: {
                "SOAPAction": "Statnett.Nubix.NubixService:getMeteringPointIdIn",
                "Content-Type": "text/xml; charset=utf-8"
            },
            body: body
        };

        let response = await rp(options);

        const result = await new Promise((resolve, reject) => {
            const parser = new xml2js.Parser({ explicitArray: false, normalizeTags: true });
            parser.parseString(response, function (err, result) {
                if (err) {
                    reject(err);
                    return
                }
                resolve(result);
            });
        });        

        return find(result,'response').filter(r=> r.responsestatus.statuscode === "Found").map(m=>{
            
            if (!Array.isArray(m.customers)){
                m.customers = [m.customers];
            }
             return{
                
                gridOwner : {
                    name: m.gridowner.name,
                    gln: m.gridowner.gln
                },                
                customers : m.customers.map(c=>{
                  
                  let readingType = find(c,'meterreadingtransmissiontype');
                  readingType = readingType == 'Z50' ? 'remote' : readingType == 'Z51' ? 'manual' : readingType == 'Z52' ? 'unread' : 'unknown' 

                  return {
                     lastName : lastName,
                     firstName: firstName,
                     birthDate: birthDate,
                     address:{
                         address: find(c, 'address1'),
                         postalCode: find(c, 'postcode'),
                         city: find(c,'location')
                     },                     
                     installation :{
                         description : find(c,'description'),
                         meteringPointId : find(c,'meteringpointid'),
                         meterNumber: c.domesticcustomer.meternumber,
                         readingType: readingType,
                         lastMeterReadingDate: find(c,'lastmeterreadingdate')
                         
                     }
                  }

                })
            }
        });
    }
}