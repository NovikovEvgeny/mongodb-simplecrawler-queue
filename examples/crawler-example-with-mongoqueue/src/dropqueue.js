const Utils = require('../../../dist/index').Utils;

const services = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : null;
let url = null;
let dbName = null;

if (services) {
    url = services.mongodb[0].credentials.uri;
    dbName = services.mongodb[0].credentials.dbname;
}

const connectionConfig = {
    url:  url || 'mongodb://192.168.99.100:27017', // mongodb://localhost:27017
    dbName: dbName || 'crawler',
    collectionName: 'queue',
    GCConfig: {
        run: process.argv.indexOf('gc') !== -1,
        msInterval: 1000 * 60 * 5,
    },
    monitorConfig: {
        run: process.argv.indexOf('monitor') !== -1,
        statisticCollectionName: 'statistic',
        msInterval: 1000 * 5,
    },
};

new Utils().dropQueue(connectionConfig)
    .then(() => {
        console.log("Queue is dropped!");
    })
    .catch((err) => {
        console.log(err);
    });
