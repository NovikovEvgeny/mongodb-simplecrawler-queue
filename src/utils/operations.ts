import { Collection } from 'mongodb';
import { QueueItemStatus } from '..';
import { MongoQueueItem } from '../types/queue/MongoQueueItem';

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

export class Operations {

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
      const values = await Promise.all([totalCountPromise, fetchedCountPromise,
        aggregationResultPromise, aggregationResultArrPromise]);

      let aggregationResult = values[2].next();
      if (!aggregationResult) {
        aggregationResult = {};
      }

      aggregationResult.totalCount = values[0];
      aggregationResult.fetchedCount = values[1];
      aggregationResult.timestamp = currentTime;
      aggregationResult.timestampFinish = new Date().getTime();

      const aggregationResultArr = values[3].toArray();
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
