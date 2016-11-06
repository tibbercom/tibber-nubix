## Install

```
$ npm install --save tibber-nubix
```

## Usage

```js
const client = new NubixClient(<nubixUser>, <nubixPwd>, <requesterGlnNo>);
const response = await client.getMeteringPointInfo({
              firstName: 'Ola',
              lastName: 'Nordmann',
              birthDate: '1983-03-22',
              address: {
                 address: '',
                 postalCode: '6800',
                 city: 'FØRDE'
              }
    });


// Response:
// [
//     {
//         "gridOwner": {
//             "name": "Sunnfjord Energi AS Nett",
//             "gln": "7080005051064"
//         },
//         "customers": [
//             {
//                 "lastName": "Nordmann",
//                 "firstName": "Ola",
//                 "birthDate": "1983-03-21T23:00:00.000Z",
//                 "address": {
//                     "address": "",
//                     "postalCode": "6800",
//                     "city": "FØRDE"
//                 },
//                 "installation": {
//                     "description": "Bustad",
//                     "meteringPoinIid": "7070575000833338072",
//                     "meterNumber": "1623242"
//                 }
//             }
//         ]
//     }
// ]
```
