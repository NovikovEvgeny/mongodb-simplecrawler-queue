import { Collection } from 'mongodb';
import { MongoQueueItem } from './typings/queue';
import { Operations } from './utils';

export class GarbageCollector {
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
              this.msInterval,
            );
          })
          .catch((error: Error) => {
            console.log(error);
          });
      }, this.msInterval,
    );
  }

  stop() {
    clearTimeout(this.timeoutId);
  }
}
