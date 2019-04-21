import { Collection, Db, MongoClient } from 'mongodb';
import { MongoDbQueueConfig } from '..';
import { AggregationResult, Operations } from './operations';

export class Utils {
  private static wait(ms: number) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  }

  async runMonitotoring(connConfig: MongoDbQueueConfig, countToFinish: number = 0): Promise<void> {
    if (!connConfig || !connConfig.monitorConfig || !connConfig.monitorConfig.statisticCollectionName) {
      console.log('Monitor Config configured to not run GC tasks');
      return;
    }

    const client = new MongoClient(connConfig.url, { useNewUrlParser: true });
    await client.connect();
    const db: Db = client.db(connConfig.dbName || 'crawler');
    const queue: Collection = db.collection(connConfig.collectionName || 'queue');
    const statisticCollection: Collection = db.collection(connConfig.monitorConfig.statisticCollectionName);

    let crawlerJobFinished = false;
    let noChangesIterations = 0;

    while (!crawlerJobFinished) {
      const aggregationResult: AggregationResult = await Operations.monitorTask(queue, statisticCollection);

      if (aggregationResult.totalCount === aggregationResult.fetchedCount) {
        noChangesIterations += 1;
      } else {
        noChangesIterations = 0;
      }

      if (noChangesIterations === countToFinish && countToFinish !== 0) {
        const template = 'INFO: Count of total items equal to count of fetched items for 15 minutes. Stop the monitor';
        console.log(`[${aggregationResult.timestamp}]: ${template}`);
        crawlerJobFinished = true;
      }
      // wait for 1 minute
      await Utils.wait(TimeUnit.MINUTE);
    }
    await client.close();
  }

  async runGC(connectionConfig: MongoDbQueueConfig, countToFinish: number = 0): Promise<void> {
    if (!connectionConfig || !connectionConfig.GCConfig || !connectionConfig.GCConfig.run) {
      console.log('GC Config configured to not run GC tasks');
      return;
    }

    const client = new MongoClient(connectionConfig.url, { useNewUrlParser: true });
    await client.connect();
    const db: Db = client.db(connectionConfig.dbName || 'crawler');
    const queueCollection: Collection = db.collection(connectionConfig.collectionName || 'queue');

    let totalCount = 0;
    let fetchedCount = 0;
    let noChangesIterations = 0;

    let crawlerJobFinished = false;

    // invalid period in milliseconds (=10 minutes)
    const invalidPeriod = connectionConfig.GCConfig.msInterval || TimeUnit.MINUTE * 10;

    while (!crawlerJobFinished) {
      totalCount = await queueCollection.countDocuments();
      fetchedCount = await queueCollection.find({ fetched: true }).count();

      const res: any = Operations.gcTask(queueCollection, invalidPeriod);
      if (res && res.result && res.result.ok === 1) {
        console.log(`${res.result.nModified} document were rolled back to Queued status`);
      }

      if (totalCount === fetchedCount) {
        noChangesIterations += 1;
      } else {
        noChangesIterations = 0;
      }

      if (noChangesIterations === countToFinish && countToFinish !== 0) {
        const msg = ' INFO: Count of total items equal to count of fetched items for 15 minutes. Stop the GC';
        console.log(`[${new Date().getTime()}]: ${msg}`);
        crawlerJobFinished = true;
      }
      await Utils.wait(invalidPeriod);
    }
    await client.close();
  }

  async dropQueue(connectionConfig: MongoDbQueueConfig): Promise<void> {
    const client = new MongoClient(connectionConfig.url, { useNewUrlParser: true });
    await client.connect();
    const db: Db = client.db(connectionConfig.dbName);
    const statisticCollName = connectionConfig.monitorConfig.statisticCollectionName || 'statistic';

    await db.createCollection(connectionConfig.collectionName);
    await db.createCollection(statisticCollName);

    const queueCollection: Collection = db.collection(connectionConfig.collectionName);
    const statisticCollection: Collection = db.collection(statisticCollName);

    await statisticCollection.drop();
    await queueCollection.drop();

    await client.close();
  }
}

/*
  Helper to convert from ms to other time units
*/
enum TimeUnit {
  SECOND = 1000,
  MINUTE = 1000 * 60,
}
