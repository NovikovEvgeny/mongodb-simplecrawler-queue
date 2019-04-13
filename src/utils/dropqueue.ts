import { Collection, Db, MongoClient } from 'mongodb';

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

async function run() {
  const client = new MongoClient(connectionConfig.url);
  await client.connect();
  const db: Db = client.db(connectionConfig.dbName);

  await db.createCollection(connectionConfig.collectionName);
  await db.createCollection(connectionConfig.statisticCollection);

  const queueCollection: Collection = db.collection(connectionConfig.collectionName);
  const statisticCollection: Collection = db.collection(connectionConfig.statisticCollection);

  await statisticCollection.drop();
  await queueCollection.drop();
}

run().then(() => {
  console.log(`[${new Date().getTime()}]: Queue is dropped!`);
  process.exit(0);
}).catch((err) => {
  console.log(`[${new Date().getTime()}]: Error in "drop queue" operation: ${err}`);
  process.exit(1);
});
