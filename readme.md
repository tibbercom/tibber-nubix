## Install

```
$ npm install --save tibber-nubix
```

## Usage - search for person data

```js
const client = new NubixClient(<nubixUser>, <nubixPwd>, <requesterGlnNo>);
const response = await client.getMeteringPoint({person:{
              firstName: 'Ola',
              lastName: 'Nordmann',
              birthDate: '1983-03-22',
              address: {
                 address: '',
                 postalCode: '6800',
                 city: 'FØRDE'
              }
    }});


// Response:
//   [
//     {
//       "lastName": "Normann",
//       "firstName": "Ola",
//       "birthDate": "1977-01-13",
//       "address": {
//         "address": "SomeAddress 12",
//         "postalCode": "6800",
//         "city": "FØRDE"
//       },
//       "installation": {
//         "description": "rekke B3, leil 16",
//         "meteringPointId": "707057500084133439",
//         "meterNumber": "166634341",
//         "readingType": "remote"
//       },
//       "gridOwner": {
//         "name": "Sunnfjord Energi AS Nett",
//         "gln": "7080005051064"
//       }
//     }
//   ]
```

## Usage - search for company data

```js
const client = new NubixClient(<nubixUser>, <nubixPwd>, <requesterGlnNo>);
const response = await client.getMeteringPoint({
        company: {
            orgNo: "999999999"
            , address: { address: "SomeAddress 12", postalCode: "6800" }
        }
    });


// Response:
//   [
//     {
//       "name": 'Company Name',
//       "orgNo": '999999999',
//       "address": {
//         "address": "SomeAddress 12",
//         "postalCode": "6800",
//         "city": "FØRDE"
//       },
//       "installation": {
//         "description": "rekke B3, leil 16",
//         "meteringPointId": "707057500084133439",
//         "meterNumber": "166634341",
//         "readingType": "remote"
//       },
//       "gridOwner": {
//         "name": "Sunnfjord Energi AS Nett",
//         "gln": "7080005051064"
//       }
//     }
//   ]
```
## Usage - verify customer data

```js
const client = new NubixClient(<nubixUser>, <nubixPwd>, <requesterGlnNo>);
const response = await client.verifyMeteringPoint({
        meteringPointId: "707057500084133439",
        birthDate: "1977-01-13",
        postalCode: "6800"
    });


// Response:
// { found: true,
//   name: 'Ola Normann',
//   birthDate: '1977-01-13',
//   gridOwner: { name: 'Sunnfjord Energi AS Nett', gln: '7080005051064' },
//   address: { address: 'SomeAddress 12', postalCode: '6800', city: 'FØRDE' },
//   installation: 
//   { description: 'Bustad',
//     meteringPointId: '707057500084133439',
//    readingType: 'manual',
//    lastMeterReadingDate: '2017-01-21' } }
```
## Usage - verify company data

```js
const client = new NubixClient(<nubixUser>, <nubixPwd>, <requesterGlnNo>);
const response = await client.verifyMeteringPoint({
        meteringPointId: "707057500084133439",
        orgNo: "999999999",
        postalCode: "6800"
    });


// Response:
// { found: true,
//   name: 'Some Company',
//   orgNo: '999999999',
//   gridOwner: { name: 'Sunnfjord Energi AS Nett', gln: '7080005051064' },
//   address: { address: 'SomeAddress 12', postalCode: '6800', city: 'FØRDE' },
//   installation: 
//   { description: 'Bustad',
//     meteringPointId: '707057500084133439',
//    readingType: 'manual',
//    lastMeterReadingDate: '2017-01-21' } }
```