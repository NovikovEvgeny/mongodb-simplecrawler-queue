import { Collection, Db, MongoClient, ObjectId } from 'mongodb';
import { AllowedStatistics, FetchQueue, QueueError, QueueItem, QueueItemStatus } from './FetchQueueInterface';
import { MongoDbQueueConfig } from './MongoDBQueueConfig';
import { MongoQueueItem } from './MongoQueueItem';
import { Operations } from '../../utils/operations';

export class MongoDbQueue implements FetchQueue {
  config: MongoDbQueueConfig;
  client: MongoClient;
  db!: Db;
  collection!: Collection<MongoQueueItem>;
  garbageCollector!: GarbageCollector;
  monitor!: Monitor;

  constructor(config: MongoDbQueueConfig | any) {
    this.config = config;
    if (this.config.GCConfig) {
      this.config.GCConfig.run = this.config.GCConfig.run || false;
      this.config.GCConfig.msInterval = this.config.GCConfig.msInterval || 1000 * 60 * 2;
    } else {
      this.config.GCConfig = {
        run: false,
        msInterval: 1000 * 60 * 2,
      };
    }
    if (this.config.monitorConfig) {
      if (!this.config.monitorConfig.msInterval) {
        this.config.monitorConfig.msInterval = 1000 * 60 * 2;
      }
      if (!this.config.monitorConfig.statisticCollectionName) {
        this.config.monitorConfig.statisticCollectionName = 'statistic';
      }
    } else {
      this.config.monitorConfig = {
        run: false,
        msInterval: 1000 * 60 * 2,
        statisticCollectionName: 'statistic',
      };
    }

    this.client = new MongoClient(this.config.url);
  }

  private async addToQueue(queueItem: QueueItem, filter: object): Promise<MongoQueueItem | null> {
    const addItemCopy = Object.assign({}, queueItem);
    addItemCopy.status = QueueItemStatus.Queued;

    // upsert means add element if no elements found by the filter
    const res = await this.collection
                          .updateOne(
                            filter,
                            { $setOnInsert: addItemCopy },
                            { upsert: true });
    // upserted count count = 0 -> no elements were added
    if (res.upsertedCount === 0) {
      return null;
    }
    if (res.result.ok === 1) {
      const elem = await this.collection.findOne({ _id: new ObjectId(res.upsertedId._id) });
      if (elem !== null) {
        elem.id = elem._id;
      }
      return elem;
    }

    throw new Error('Unexpected error happened');
  }

  private convertForUpdate(obj: any, parent: string, finalObject: any) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object') {
          this.convertForUpdate(obj[key], (parent ? parent + '.' : '') + key, finalObject);
        } else {
          if (key === '_id') {
            finalObject[`${parent ? parent + '.' : ''}${key.toString()}`] = new ObjectId('${obj[key]}');
          } else {
            finalObject[`${parent ? parent + '.' : ''}${key.toString()}`] = obj[key];
          }
        }
      }
    }
  }

  private convertForFilter(obj: any, parent: string, finalObject: any) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object') {
          this.convertForFilter(obj[key], (parent ? parent + '.' : '') + key, finalObject);
        } else {
          if (key === '_id') {
            finalObject[`${parent ? parent + '.' : ''}${key.toString()}`] = { $eq: new ObjectId('${obj[key]}') };
          } else {
            finalObject[`${parent ? parent + '.' : ''}${key.toString()}`] = { $eq: obj[key] };
          }
        }
      }
    }
  }

  private handleCallback<T>(error: any, returnResult: any, callback: Function | null): Promise<T> {
    let returnError = error;
    if (returnError) {
      returnError = returnError instanceof Error ? returnError : new Error(returnError);
    }

    if (callback) {
      return callback(returnError, returnResult);
    }
    if (error) {
      return Promise.reject(returnError);
    }
    return Promise.resolve(returnResult);
  }

  async init(callback: Function | null): Promise<void> {
    let returnError = null;
    try {

      await this.client.connect();
      this.db = this.client.db(this.config.dbName);
      this.collection = this.db.collection(this.config.collectionName);

      await this.collection.createIndex(
        { status: 1 },
        { partialFilterExpression: { status: { $eq: QueueItemStatus.Queued } } });

      if (this.config.GCConfig.run) {
        this.garbageCollector =
          new GarbageCollector(this.collection, this.config.GCConfig.msInterval);
        this.garbageCollector.start();
      }

      if (this.config.monitorConfig.run) {
        const statisticCollection =
          this.db.collection(this.config.monitorConfig.statisticCollectionName || 'statistic');

        this.monitor =
          new Monitor(this.collection, statisticCollection, this.config.monitorConfig.msInterval);

        this.monitor.start();
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, null, callback);
  }

  async finalize(callback: Function | null): Promise<void> {
    let returnError = null;
    try {
      if (this.config.GCConfig.run && this.garbageCollector) {
        this.garbageCollector.stop();
      }

      if (this.config.monitorConfig.run && this.monitor) {
        this.monitor.stop();
      }
      await this.client.close();
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, null, callback);
  }

  async drop(callback: Function | null): Promise<void> {
    let returnError = null;
    try {
      await this.collection.drop();
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, null, callback);
  }

  async add(queueItemOriginal: QueueItem, force: boolean, callback: Function | null): Promise<QueueItem | void> {
    let returnError = null;
    let elem = null;
    try {
      const queueItem = Object.assign({ modificationTimestamp: Date.now() }, queueItemOriginal);
      delete queueItem.id;

      if (force) {
        elem = await this.addToQueue(queueItem, queueItem);
        if (elem === null) {
          throw new Error('Can\'t add a queueItem instance twice. ' +
            'You may create a new one from the same URL however.');
        }
      } else {
        elem = await this.addToQueue(queueItem, { url: queueItem.url });
        // workaround to throw what FetchQueue requires
        if (elem === null) {
          throw new QueueError('Resource already exists in queue!', 'DUPLICATE');
        }
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, elem, callback);
  }

  async exists(url: string, callback: Function | null): Promise<boolean | void> {
    let res = null;
    let returnError = null;
    try {
      const element = await this.collection.findOne({ url });
      res = element !== null;
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, res, callback);
  }

  async get(index: number, callback: Function | null): Promise<QueueItem | void> {
    let returnError = null;
    let res = null;
    try {
      res = await this.collection.findOne({}, { skip: index, limit: index + 1 });
      if (res) {
        res.id = res._id;
      } else {
        throw new Error('out of range');
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, res, callback);
  }

  async update(id: number, updates: QueueItem, callback: Function | null): Promise<MongoQueueItem | void> {
    let returnError = null;
    let resultQueueItem = null;
    try {
      const updatesAsAnObject: any = {};
      this.convertForUpdate(updates, '', updatesAsAnObject);

      updatesAsAnObject.modificationTimestamp = Date.now();

      const res = await this.collection
                            .findOneAndUpdate({ _id: new ObjectId(id) },
                              { $set: updatesAsAnObject },
                              { returnOriginal: false });

      if (res.ok === 1) {
        resultQueueItem = res.value;
        if (resultQueueItem === undefined) {
          throw new Error('No queueItem found with that ID');
        }
        resultQueueItem.id = resultQueueItem._id;
      } else {
        throw new Error('didnt update');
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, resultQueueItem, callback);
  }

  async oldestUnfetchedItem(callback: Function | null): Promise<QueueItem | void> {
    let returnError = null;
    let oldestUnfetchedItem = null;
    try {
      const res = await this.collection
                            .findOneAndUpdate(
                              { status: QueueItemStatus.Queued },
                              { $set: { status: QueueItemStatus.Pulled, modificationTimestamp: Date.now() } });
      if (res.ok === 1) {
        oldestUnfetchedItem = res.value;
        if (oldestUnfetchedItem) {
          oldestUnfetchedItem.id = oldestUnfetchedItem._id;
        }
      } else {
        throw new Error('Error occurred during getting an item');
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, oldestUnfetchedItem, callback);
  }

  async max(statisticName: string, callback: Function | null): Promise<number | void> {
    let returnError = null;
    let result: any = null;
    try {
      if (!Object.values(AllowedStatistics).includes(statisticName)) {
        throw new Error('Invalid statistic');
      }

      const matchObject: any = {};
      matchObject['fetched'] = true;
      matchObject[`stateData.${statisticName}`] = { $type: ['number'] };

      result = await this.collection.aggregate([
        { $match: matchObject },
        {
          $group: {
            _id: `stateData.${statisticName}`,
            max: { $max: `$stateData.${statisticName}` },
          },
        },
      ]).next();
      if (result) {
        result = result.max;
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async min(statisticName: string, callback: Function | null): Promise<number | void> {
    let returnError = null;
    let result: any = null;
    try {
      if (!Object.values(AllowedStatistics).includes(statisticName)) {
        throw new Error('Invalid statistic');
      }

      const matchObject: any = {};
      matchObject['fetched'] = true;
      matchObject[`stateData.${statisticName}`] = { $type: ['number'] };

      result = await this.collection.aggregate([
        { $match: matchObject },
        {
          $group: {
            _id: `stateData.${statisticName}`,
            min: { $min: `$stateData.${statisticName}` },
          },
        },
      ]).next();
      if (result) {
        result = result.min;
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async avg(statisticName: string, callback: Function | null): Promise<number | void> {
    let returnError = null;
    let result: any = null;
    try {
      if (!Object.values(AllowedStatistics).includes(statisticName)) {
        throw new Error('Invalid statistic');
      }

      const matchObject: any = {};
      matchObject['fetched'] = true;
      matchObject[`stateData.${statisticName}`] = { $type: ['number'] };

      result = await this.collection.aggregate([
        { $match: matchObject },
        {
          $group: {
            _id: `stateData.${statisticName}`,
            avg: { $avg: `$stateData.${statisticName}` },
          },
        },
      ]).next();
      if (result) {
        result = result.avg;
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async countItems(comparator: object, callback: Function | null): Promise<number | void> {
    let returnError = null;
    let result = null;
    try {
      const filterObject = {};
      this.convertForFilter(comparator, '', filterObject);
      result = await this.collection.find(filterObject).count();
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async filterItems(comparator: object, callback: Function | null): Promise<QueueItem[] | void> {
    let returnError = null;
    let result = null;
    try {
      const filterObject = {};
      this.convertForFilter(comparator, '', filterObject);
      result = await this.collection.find(filterObject).toArray();
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async getLength(callback: Function | null): Promise<number | void> {
    // return await this.wrapTo(this.innerGetLength.bind(this), callback);
    let returnError = null;
    let result = null;
    try {
      result = await this.collection.countDocuments({});
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async freeze(filename: string, callback: Function | null): Promise<boolean | void> {
    return this.handleCallback(null, true, callback);
  }

  async defrost(filename: string, callback: Function | null): Promise<boolean | void> {
    return this.handleCallback(null, true, callback);
  }
}

class GarbageCollector {
  collection: Collection<MongoQueueItem>;
  timeoutId: any;
  msInterval: number; // default is 2 min (see constructor)

  constructor(collection: Collection<MongoQueueItem>, msInterval: number = 1000 * 60 * 2) {
    this.collection = collection;
    this.msInterval = msInterval;
  }

  start() {
    this.timeoutId = setTimeout(
      () => {
        Operations.gcTask(this.collection, this.msInterval)
                  .then(() => {
                    setTimeout(
                      () => {
                        this.start();
                      },
                      this.msInterval);
                  })
                  .catch((error: Error) => {
                    console.log(error);
                  });
      }, this.msInterval);
  }

  stop() {
    clearTimeout(this.timeoutId);
  }
}

class Monitor {
  statisticCollection: Collection<MongoQueueItem>;
  queue: Collection<MongoQueueItem>;
  timeoutId: any;
  msInterval: number; // default is 1 min

  constructor(queueCollection: Collection<MongoQueueItem>,
              statisticCollection: Collection<MongoQueueItem>,
              msInterval: number = 1000 * 60) {
    this.statisticCollection = statisticCollection;
    this.queue = queueCollection;
    this.msInterval = msInterval;
  }

  start() {
    this.onMonitorTask();
  }

  onMonitorTask() {
    Operations.monitorTask(this.queue, this.statisticCollection)
              .then(() => {
                setTimeout(() => {
                  this.onMonitorTask();
                }, this.msInterval);
              })
              .catch((error: Error) => {
                console.log(error);
              });
  }

  stop() {
    clearTimeout(this.timeoutId);
  }
}
