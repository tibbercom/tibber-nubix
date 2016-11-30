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
