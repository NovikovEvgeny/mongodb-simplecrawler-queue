/* eslint-env jest */
import 'jest-extended';

import Crawler from 'simplecrawler';
import { MongoDbQueue, QueueItem } from '../../src';

const queue = require('../fixtures/queue.json');

describe('Queue methods', () => {
  const crawler = new Crawler('http://127.0.0.1:27017/');

  const connectionConfig = {
    url: 'mongodb://google:27017', // mongodb://localhost:27017
    dbName: 'crawler',
    collectionName: 'queue',
  };

  const crawlerQueue = new MongoDbQueue(connectionConfig);

  beforeEach(async () => {
    await crawlerQueue.init();
    // @ts-ignore
    crawler.queue = crawlerQueue;
  });

  const addToQueueRec = (index: number, done: Function, updating: any) => {
    if (index === queue.length) {
      crawler.queue.getLength((error, length) => {
        expect(length).toEqual(4);
        done();
      });
    } else {
      crawler.queue.add(queue[index], false, (err, queueItem) => {
        if (updating) {
          expect(err).toBe('error');
          addToQueueRec(index + 1, done, updating);
        } else {
          expect(err).toBeNil();
          // @ts-ignore
          queue[index]._id = queueItem._id;
          // @ts-ignore
          crawler.queue.update(queueItem._id, { status: queue[index].status }, () => {
            addToQueueRec(index + 1, done, updating);
          });
        }
      });
    }
  };

  const addToQueue = (done: Function, updating: boolean) => {
    addToQueueRec(0, done, updating);
  };

  it('should add to the queue', (done) => {
    addToQueue(done, false);
  });

  it("shouldn't add duplicates to the queue", (done) => {
    addToQueue(done, true);
  });

  it('should get items from the queue', (done) => {
    crawler.queue.get(3, (error, item) => {
      expect(error).toBeNil();
      expect(item!.url).toEqual(queue[3].url);
      done(error);
    });
  });

  it('should error when getting queue items out of range', (done) => {
    crawler.queue.getLength((error, length) => {
      expect(error).toBeNil();
      crawler.queue.get(length! * 2, (getErr, queueItem) => {
        expect(queueItem).toBeNil();
        expect(error).toBe('error');
        done();
      });
    });
  });

  it('should get the oldest unfetched item', (done) => {
    crawler.queue.oldestUnfetchedItem((error, item) => {
      expect(error).toBeNil();
      expect(item!.url).toEqual('http://127.0.0.1:3000/stage/3');
      done(error);
    });
  });

  it('should get a max statistic from the queue', (done) => {
    crawler.queue.max('downloadTime', (error, max) => {
      expect(error).toBeNil();
      expect(typeof max).toEqual('number');
      expect(max).toEqual(2);
      done(error);
    });
  });

  it('should get a min statistic from the queue', (done) => {
    crawler.queue.min('requestTime', (error, min) => {
      expect(error).toBeNil();
      expect(typeof min).toEqual('number');
      expect(min).toEqual(2);
      done(error);
    });
  });

  it('should get an average statistic from the queue', (done) => {
    crawler.queue.avg('contentLength', (error, avg) => {
      expect(error).toBeNil();
      expect(typeof avg).toEqual('number');
      expect(avg).toEqual((68 + 14 + 37) / 3);
      done(error);
    });
  });

  it('should get the number of completed queue items', (done) => {
    crawler.queue.countItems({ fetched: true }, (error, complete) => {
      expect(error).toBeNil();
      expect(typeof complete).toEqual('number');
      expect(complete).toEqual(3);
      done(error);
    });
  });

  it('should get queue items with a specific status', (done) => {
    crawler.queue.filterItems({ depth: 2 }, (error, items) => {
      expect(error).toBeNil();
      expect(items).toBeArray();
      expect(items!.map((item) => item.url)).toEqual(['http://127.0.0.1:3000/404', 'http://127.0.0.1:3000/stage2']);
      done(error);
    });
  });

  it('should count items with a specific status', (done) => {
    crawler.queue.countItems({ status: 'downloaded' }, (error, count) => {
      expect(error).toBeNil();
      expect(count).toBeNumber();
      expect(count).toEqual(2);
      done(error);
    });
  });

  it('should count items with a 200 HTTP status', (done) => {
    crawler.queue.countItems({
      stateData: { code: 200 },
    }, (error, count) => {
      expect(error).toBeNil();
      expect(count).toBeNumber();
      expect(count).toEqual(2);
      done(error);
    });
  });

  it('should get items that have failed', (done) => {
    crawler.queue.countItems({ status: 'failed' }, (error, count) => {
      expect(error).toBeNil();
      expect(count).toBeNumber();
      expect(count).toEqual(0);

      crawler.queue.countItems({ status: 'notfound' }, (errorCount, countNf) => {
        expect(errorCount).toBeNil();
        expect(countNf).toBeNumber();
        expect(countNf).toEqual(1);
        done(error);
      });
    });
  });

  it('should error when passing unknown properties to queue methods', (done) => {
    crawler.queue.max('humdidum', (error, max) => {
      expect(max).toBeNil();
      expect(error).toEqual('error');
      done();
    });
  });

  it('should add existing queueItems if forced to', (done) => {
    const queueItems: QueueItem[] = [];

    for (let i = 0; i < 3; i += 1) {
      // @ts-ignore
      queueItems.push(crawler.processURL('http://127.0.0.1/example'));
    }

    // @ts-ignore
    crawler.queue.add(queueItems[0], false, (error, newQueueItem) => {
      expect(error).toBeNil();
      expect(newQueueItem.url).toEqual(queueItems[0].url);

      // @ts-ignore
      crawler.queue.add(queueItems[1], false, (error1, newQueueItem1) => {
        expect(error1).toBeNil();
        expect(newQueueItem1.url).toEqual(queueItems[1].url);

        // @ts-ignore
        crawler.queue.add(queueItems[2], true, (error2, newQueueItem2) => {
          expect(error2).toBeNil();
          expect(newQueueItem2.url).toEqual(queueItems[2].url);

          crawler.queue.add(newQueueItem, true, (error3, newQueueItem3) => {
            expect(error).toMatch(/twice/i);
            expect(newQueueItem3).toBeNil();
            done();
          });
        });
      });
    });
  });

  it('should update items in the queue', (done) => {
    crawler.queue.update(queue[3]._id, {
      status: 'blablba',
      fetched: false,
    }, (error, queueItem) => {
      expect(error).toBeNil();
      expect(queueItem).toMatchObject({
        url: queue[3].url,
        status: 'blablba',
        fetched: false,
      });

      done(error);
    });
  });

  it('emits a queueerror event when update method errors', (done) => {
    const crawlerTest = new Crawler('http://127.0.0.1:27017');
    const originalQueueUpdate = crawlerTest.queue.update;

    crawlerTest.interval = 5;

    // @ts-ignore
    crawlerTest.queue.update = (url, updates, callback: Function) => {
      originalQueueUpdate.call(crawlerTest.queue, url, updates, (error, queueItem) => {
        if (!error) {
          // eslint-disable-next-line no-param-reassign
          error = new Error('Not updating this queueItem');
        }

        callback(error, queueItem);
      });
    };

    crawlerTest.on('queueerror', (error, queueItem) => {
      expect(error).toBe(Error);
      // @ts-ignore
      expect(error!.message).toEqual('Not updating this queueItem');
      expect(queueItem).not.toBeNil();
      expect(queueItem).toHaveProperty('url');
      expect(queueItem).toHaveProperty('fetched');
      expect(queueItem).toHaveProperty('status');
      crawler.stop(true);
      done();
    });

    crawler.start();
  });

  it("Doesn't queue URL with reordered query parameters", (done) => {
    const crawlerTest = new Crawler('http://127.0.0.1:27017');
    crawlerTest.sortQueryParameters = true;
    crawlerTest.queueURL('http://127.0.0.1:27017/sample.jsp?a=1&b=2');
    crawlerTest.queueURL('http://127.0.0.1:27017/sample.jsp?b=2&a=1');
    crawlerTest.queue.getLength((error, length) => {
      expect(length).toEqual(1);
      done();
    });
  });
});
