import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import { QueueItemStatus } from '../types/queue/FetchQueueInterface';
import { TimeUnit, Utils } from './util';

const services: any = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : null;
let url: any = null;
let dbName: any = null;

if (services) {
  url = services.mongodb[0].credentials.uri;
  dbName = services.mongodb[0].credentials.dbname;
}

const connectionConfig = {
  url: url || 'mongodb://192.168.99.100:27017', // mongodb://localhost:27017
  dbName: dbName || 'crawler',
  collectionName: 'queue',
  statisticCollection: 'statistic',
};

async function run(): Promise<void> {
  const client = new MongoClient(connectionConfig.url);
  await client.connect();
  const db: Db = client.db(connectionConfig.dbName);
  const queueCollection: Collection = db.collection(connectionConfig.collectionName);

  let totalCount = 0;
  let fetchedCount = 0;
  let crawlerJobFinished = false;
  let currentTime: number;

  let noChangesIterations = 0;

  // invalid period in milliseconds (=10 minutes)
  const invalidPeriod = TimeUnit.MINUTE * 10;

  while (!crawlerJobFinished) {
    currentTime = new Date().getTime();

    totalCount = await queueCollection.countDocuments();
    fetchedCount = await queueCollection.find({ fetched: true }).count();

    console.log(`[${currentTime}]: Total count: ${totalCount}`);
    console.log(`[${currentTime}]: Fetched count: ${fetchedCount}`);

    const res = await queueCollection.updateMany(
      {
        $and: [
          { fetched: { $ne: true } },
          { status: { $ne: QueueItemStatus.Queued } },
          { modificationTimestamp: { $lt: currentTime - invalidPeriod } },
        ],
      },
      { $set: { status: QueueItemStatus.Queued, modificationTimestamp: currentTime } },
    );

    if (res && res.result && res.result.ok === 1) {
      console.log(`${res.result.nModified} document were rolled back to Queued status`);
    }

    if (totalCount === fetchedCount) {
      noChangesIterations += 1;
    } else {
      noChangesIterations = 0;
    }

    if (noChangesIterations === 15) {
      console.log(`[${currentTime}]: INFO: Count of total items equal to count of fetched items for 15 minutes. Stop the GC`);
      crawlerJobFinished = true;
    }
    await Utils.wait(invalidPeriod);
  }
}

run().then(() => {
  console.log(`[${new Date().getTime()}]: Crawler job finished!`);
  process.exit(0);
}).catch((err) => {
  console.log(`[${new Date().getTime()}]: Error: ${err}`);
  process.exit(1);
});
