import {
  Collection, Db, MongoClient, ObjectId,
} from 'mongodb';
import {
  AllowedStatistics,
  FetchQueue,
  QueueError,
  QueueItem,
  QueueItemStatus,
  MongoDbQueueConfig,
  MongoQueueItem,
} from './typings';
import { GarbageCollector } from './GarbageCollector';
import { Monitor } from './Monitor';

export class MongoDbQueue implements FetchQueue {
  config: MongoDbQueueConfig;

  client: MongoClient;

  db!: Db;

  collection!: Collection<MongoQueueItem>;

  garbageCollector!: GarbageCollector;

  monitor!: Monitor;

  constructor(config: MongoDbQueueConfig | any) {
    this.config = config;

    if (!this.config.crawlerName) {
      this.config.crawlerName = 'crawler';
    }

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

    this.client = new MongoClient(this.config.url, { useNewUrlParser: true, useUnifiedTopology: true });
  }

  private async addToQueue(queueItem: QueueItem, filter: object): Promise<MongoQueueItem | null> {
    const addItemCopy = { ...queueItem };
    addItemCopy.status = QueueItemStatus.Queued;

    // upsert means add element if no elements found by the filter
    const res = await this.collection
      .updateOne(
        filter,
        { $setOnInsert: addItemCopy },
        { upsert: true },
      );
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
    Object.entries(obj).forEach(([key, value]) => {
      if (value && typeof value === 'object' && key !== '_id') {
        this.convertForUpdate(value, (parent ? `${parent}.` : '') + key, finalObject);
      } else if (key === '_id') {
        // eslint-disable-next-line no-param-reassign
        finalObject[`${parent ? `${parent}.` : ''}${key.toString()}`] = new ObjectId(String(value));
      } else {
        // eslint-disable-next-line no-param-reassign
        finalObject[`${parent ? `${parent}.` : ''}${key.toString()}`] = value;
      }
    });
  }

  private convertForFilter(obj: any, parent: string, finalObject: any) {
    Object.entries(obj).forEach(([key, value]) => {
      if (value && typeof value === 'object' && key !== '_id') {
        this.convertForFilter(value, (parent ? `${parent}.` : '') + key, finalObject);
      } else if (key === '_id') {
        // eslint-disable-next-line no-param-reassign
        finalObject[`${parent ? `${parent}.` : ''}${key.toString()}`] = { $eq: new ObjectId(String(value)) };
      } else {
        // eslint-disable-next-line no-param-reassign
        finalObject[`${parent ? `${parent}.` : ''}${key.toString()}`] = { $eq: value };
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private handleCallback<T>(error: any, returnResult: any, callback?: Function): Promise<T> {
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

  async init(callback?: Function): Promise<void> {
    let returnError = null;
    try {
      await this.client.connect();
      this.db = this.client.db(this.config.dbName);
      this.collection = this.db.collection(this.config.collectionName);

      await this.collection.createIndex(
        { status: 1 },
        { partialFilterExpression: { status: { $eq: QueueItemStatus.Queued } } },
      );

      await this.collection.createIndex({ url: 'hashed' });

      if (this.config.GCConfig.run) {
        this.garbageCollector = new GarbageCollector(this.collection, this.config.GCConfig.msInterval);
        this.garbageCollector.start();
      }

      if (this.config.monitorConfig.run) {
        const statisticCollection = this.db
          .collection(this.config.monitorConfig.statisticCollectionName || 'statistic');

        this.monitor = new Monitor(this.collection, statisticCollection, this.config.monitorConfig.msInterval);

        this.monitor.start();
      }
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, null, callback);
  }

  async finalize(callback?: Function): Promise<void> {
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

  async drop(callback?: Function): Promise<void> {
    let returnError = null;
    try {
      await this.collection.drop();
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, null, callback);
  }

  async add(queueItemOriginal: QueueItem, force: boolean, callback?: Function): Promise<QueueItem | void> {
    let returnError = null;
    let elem = null;
    try {
      const queueItem = {
        modificationTimestamp: Date.now(),
        modifiedBy: this.config.crawlerName,
        ...queueItemOriginal,
      };
      delete queueItem.id;

      if (force) {
        elem = await this.addToQueue(queueItem, queueItem);
        if (elem === null) {
          throw new Error('Can\'t add a queueItem instance twice. '
            + 'You may create a new one from the same URL however.');
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

  async exists(url: string, callback?: Function): Promise<boolean | void> {
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

  async get(index: number, callback?: Function): Promise<QueueItem | void> {
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

  async update(id: number, updates: QueueItem, callback?: Function): Promise<MongoQueueItem | void> {
    let returnError = null;
    let resultQueueItem = null;
    try {
      const updatesAsAnObject: any = {};
      this.convertForUpdate(updates, '', updatesAsAnObject);

      updatesAsAnObject.modificationTimestamp = Date.now();
      updatesAsAnObject.modifiedBy = this.config.crawlerName;

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

  async oldestUnfetchedItem(callback?: Function): Promise<QueueItem | void> {
    let returnError = null;
    let oldestUnfetchedItem = null;
    try {
      const res = await this
        .collection
        .findOneAndUpdate(
          { status: QueueItemStatus.Queued },
          {
            $set: {
              status: QueueItemStatus.Pulled,
              modificationTimestamp: Date.now(),
              modifiedBy: this.config.crawlerName,
            },
          },
        );

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

  async max(statisticName: string, callback?: Function): Promise<number | void> {
    let returnError = null;
    let result: any = null;
    try {
      if (!(statisticName in AllowedStatistics)) {
        throw new Error('Invalid statistic');
      }

      const matchObject: any = {};
      matchObject.fetched = true;
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

  async min(statisticName: string, callback?: Function): Promise<number | void> {
    let returnError = null;
    let result: any = null;
    try {
      if (!(statisticName in AllowedStatistics)) {
        throw new Error('Invalid statistic');
      }

      const matchObject: any = {};
      matchObject.fetched = true;
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

  async avg(statisticName: string, callback?: Function): Promise<number | void> {
    let returnError = null;
    let result: any = null;
    try {
      if (!(statisticName in AllowedStatistics)) {
        throw new Error('Invalid statistic');
      }

      const matchObject: any = {};
      matchObject.fetched = true;
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

  async countItems(comparator: object, callback?: Function): Promise<number | void> {
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

  async filterItems(comparator: object, callback?: Function): Promise<QueueItem[] | void> {
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

  async getLength(callback?: Function): Promise<number | void> {
    let returnError = null;
    let result = null;
    try {
      result = await this.collection.countDocuments({});
    } catch (error) {
      returnError = error;
    }
    return this.handleCallback(returnError, result, callback);
  }

  async freeze(filename: string, callback?: Function): Promise<boolean | void> {
    return this.handleCallback(null, true, callback);
  }

  async defrost(filename: string, callback?: Function): Promise<boolean | void> {
    return this.handleCallback(null, true, callback);
  }
}
