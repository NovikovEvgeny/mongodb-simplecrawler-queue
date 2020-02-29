import { Collection } from 'mongodb';
import { MongoQueueItem } from './typings/queue';
import { Operations } from './utils';

export class Monitor {
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
