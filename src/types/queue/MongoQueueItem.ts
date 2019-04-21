import { QueueItem } from './FetchQueueInterface';
import { ObjectId } from 'mongodb';

/**
 * MongoQueue Item interface. Extends {@link QueueItem} interface
 */
export interface MongoQueueItem extends QueueItem {
  /**
   * system MongoDb field
   */
  _id: ObjectId;

  /**
   * last modification timestamp. Useful for garbage collector tasks
   */
  modificationTimestamp: number;

  /**
   * Name of the crawler, which was the last crawler who modified this queue item. Default is "crawler"
   */
  modifiedBy: string;
}
