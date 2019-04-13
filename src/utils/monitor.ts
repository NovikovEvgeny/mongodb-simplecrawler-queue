import { Collection, Db, MongoClient } from 'mongodb';
import { TimeUnit, Utils } from './util';

const services: any = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : null;
let url: any = null;
let dbName: any = null;

if (services) {
  url = services.mongodb[0].credentials.uri;
  dbName = services.mongodb[0].credentials.dbname;
}

const connectionConfig = {
  url:  url || 'mongodb://192.168.99.100:27017', // mongodb://localhost:27017
  dbName: dbName || 'crawler',
  collectionName: 'queue',
  statisticCollection: 'statistic',
};

async function run(): Promise<void> {
  const client = new MongoClient(connectionConfig.url);
  await client.connect();
  const db: Db = client.db(connectionConfig.dbName);
  const queue: Collection = db.collection(connectionConfig.collectionName);
  const statisticCollection: Collection = db.collection(connectionConfig.statisticCollection);

  let totalCount = 0;
  let fetchedCount = 0;
  let crawlerJobFinished = false;
  let currentTime: number;

  let noChangesIterations = 0;

  while (!crawlerJobFinished) {
    currentTime = new Date().getTime();

    totalCount = await queue.countDocuments();
    fetchedCount = await queue.countDocuments({ fetched: true });

    let aggregationResult: any = await queue.aggregate([
      { $match: { fetched: true } },
      { $group: {
          _id: 'null',
          actualDataSizeMax: { $max: '$stateData.actualDataSize' },
          contentLengthMax: { $max: '$stateData.contentLength' },
          downloadTimeMax: { $max: '$stateData.downloadTime' },
          requestLatencyMax: { $max: '$stateData.requestLatency' },
          requestTimeMax: { $max: '$stateData.requestTime' },
          actualDataSizeMin: { $min: '$stateData.actualDataSize' },
          contentLengthMin: { $min: '$stateData.contentLength' },
          downloadTimeMin: { $min: '$stateData.downloadTime' },
          requestLatencyMin: { $min: '$stateData.requestLatency' },
          requestTimeMin: { $min: '$stateData.requestTime' },
          actualDataSizeAvg: { $avg: '$stateData.actualDataSize' },
          contentLengthAvg: { $avg: '$stateData.contentLength' },
          downloadTimeAvg: { $avg: '$stateData.downloadTime' },
          requestLatencyAvg: { $avg: '$stateData.requestLatency' },
          requestTimeAvg: { $avg: '$stateData.requestTime' },
        },
      },
    ]).next();
    if (!aggregationResult) {
      aggregationResult = {};
    }
    aggregationResult.totalCount = totalCount;
    aggregationResult.fetchedCount = fetchedCount;
    aggregationResult.timestamp = currentTime;

    const aggregationResultArr: any = await queue.aggregate([
      { $group: {
          _id: '$status',
          total: { $sum: 1 },
        },
      },
    ]).toArray();

    for (let i = 0; i < aggregationResultArr.length; i += 1) {
      aggregationResult[aggregationResultArr[i]._id] = aggregationResultArr[i].total;
    }

    delete aggregationResult._id;

    await statisticCollection.insertOne(aggregationResult);

    if (totalCount === fetchedCount) {
      noChangesIterations += 1;
    } else {
      noChangesIterations = 0;
    }

    if (noChangesIterations === 15) {
      console.log(`[${currentTime}]: INFO: Count of total items equal to count of fetched items for 15 minutes. Stop the monitor`);
      crawlerJobFinished = true;
    }
    // wait for 1 minute
    await Utils.wait(TimeUnit.MINUTE);
  }
}

run().then(() => {
  console.log(`[${new Date().getTime()}]: Crawler job finished!`);
  process.exit(0);
}).catch((err) => {
  console.log(`[${new Date().getTime()}]: Error: ${err}`);
  process.exit(1);
});
