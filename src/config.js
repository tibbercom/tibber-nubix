var AWS = require('aws-bluebird');

var config = {};

try {
    config = require('../config.json');
} catch (error) { 
    console.log('config.json not found');
}

AWS.config.region = AWS.config.region || config.AWS_REGION || config.awsRegion ||'eu-west-1';

module.exports= config;