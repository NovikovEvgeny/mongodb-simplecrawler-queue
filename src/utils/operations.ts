import { Collection } from 'mongodb';
import { QueueItemStatus } from '..';
import { MongoQueueItem } from '../types/queue/MongoQueueItem';

/**
 * Aggregation result object used for monitoring tasks
 * Collects all statistic data about state of the queue at the moment
 */
export interface AggregationResult {
  actualDataSizeMax: number;
  contentLengthMax: number;
  downloadTimeMax: number;
  requestLatencyMax: number;
  requestTimeMax: number;
  actualDataSizeMin: number;
  contentLengthMin: number;
  downloadTimeMin: number;
  requestLatencyMin: number;
  requestTimeMin: number;
  actualDataSizeAvg: number;
  contentLengthAvg: number;
  downloadTimeAvg: number;
  requestLatencyAvg: number;
  requestTimeAvg: number;

  queued: number;
  downloaded: number;
  headers: number;
  spooled: number;
  downloadprevented: number;
  timeout: number;
  created: number;
  failed: number;
  notfound: number;
  redirected: number;
  pulled: number;

  totalCount: number;
  fetchedCount: number;
  timestamp: number;
  timestampFinish: number;
}

/**
 * Operations class - single tasks operation
 */
export class Operations {

  /**
   * Single Monitoring task operation - collect all statistic data about state of the queue
   * and put it to statistic collection as new Item
   *
   * @param queueCollection source QueueCollection of {@link QueueItem}
   * @param statisticCollection destination Statistic Collection of {@link AggregationResult} items
   */
  static async monitorTask(queueCollection: Collection<MongoQueueItem>,
                           statisticCollection: Collection<MongoQueueItem>): Promise<AggregationResult> {
    const currentTime = new Date().getTime();
    const totalCountPromise = queueCollection.countDocuments();
    const fetchedCountPromise = queueCollection.countDocuments({ fetched: true });
    const aggregationResultPromise: any = queueCollection.aggregate([
      { $match: { fetched: true } },
      {
        $group: {
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
    ]);
    const aggregationResultArrPromise: any = queueCollection.aggregate([
      {
        $group: {
          _id: '$status',
          total: { $sum: 1 },
        },
      },
    ]);

    try {
      const [totalCountPromiseRes, fetchedCountPromiseRes,
        aggregationResultPromiseRes, aggregationResultArrPromiseRes] =
        await Promise.all([totalCountPromise, fetchedCountPromise,
          aggregationResultPromise, aggregationResultArrPromise]);

      let aggregationResult = await aggregationResultPromiseRes.next();
      if (!aggregationResult) {
        aggregationResult = {};
      }
      aggregationResult.totalCount = totalCountPromiseRes;
      aggregationResult.fetchedCount = fetchedCountPromiseRes;
      aggregationResult.timestamp = currentTime;
      aggregationResult.timestampFinish = new Date().getTime();
      const aggregationResultArr = await aggregationResultArrPromiseRes.toArray();
      for (let i = 0; i < aggregationResultArr.length; i += 1) {
        aggregationResult[aggregationResultArr[i]._id] = aggregationResultArr[i].total;
      }
      delete aggregationResult._id;
      await statisticCollection.insertOne(aggregationResult);
      return aggregationResult;
    } catch (error) {
      console.log(error);
      throw error instanceof Error ? error : new Error(error);
    }
  }

  /**
   * Single garbage collector task. Roll back all spooled, but not fetched items with "old" modification timestamp
   *
   * @param queueCollection source QueueCollection of {@link QueueItem}
   * @param invalidPeriodMs invalid period in milliseconds, after this amount of ms item is considered as "old"
   */
  static async gcTask(queueCollection: Collection<MongoQueueItem>, invalidPeriodMs: number) {
    const currentTime = new Date().getTime();

    const res = await queueCollection.updateMany(
      {
        $and: [
          { fetched: { $ne: true } },
          { status: { $ne: QueueItemStatus.Queued } },
          { modificationTimestamp: { $lt: currentTime - invalidPeriodMs } },
        ],
      },
      { $set: { status: QueueItemStatus.Queued, modificationTimestamp: currentTime } },
    );
    return res;
  }
}
