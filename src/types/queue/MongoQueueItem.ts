import { QueueItem } from './FetchQueueInterface';
import { ObjectId } from 'mongodb';

export interface MongoQueueItem extends QueueItem {
  // system MongoDb field
  _id: ObjectId;
  modificationTimestamp: number;
}