const MongoDbQueue = require('../../../dist/index').MongoDbQueue;
const Crawler = require('simplecrawler');

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
    crawlerName: 'someCrawler',
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

console.log(connectionConfig);
const crawlerQueue = new MongoDbQueue(connectionConfig);

crawlerQueue.init(err => {
    if (err) {
        console.log(err);
        process.exit(0);
    }
    console.log('queue init is done');

    const crawler = new Crawler('https://en.wikipedia.org/wiki/Main_Page');
    crawler.maxDepth = 1;
    crawler.allowInitialDomainChange = false;
    crawler.filterByDomain = true;
    crawler.interval = 250;

    crawler.on('complete', () => {
        console.log('job is successfully finished!');
        crawlerQueue.getLength((err, len) => {
            console.log(`final length is ${len}`);
            crawlerQueue.finalize((err, res) => {
                process.nextTick(() => process.exit(0));
            })
        });
    });

    // here we are - tell crawler to use mongo as a queue
    crawler.queue = crawlerQueue;

    crawler.start();
});
