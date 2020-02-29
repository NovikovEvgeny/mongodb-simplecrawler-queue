# MongoDB Implementation of FetchQueue Interface for Simplecrawler

This is an implementation of FetchQueue Interface for [simplecrawler queue](https://github.com/simplecrawler/simplecrawler) with MongoDB usage as backend.

Preferences:
- Possibility to pause/stop/kill/terminate running job without queue state losing
- Possibility to run one crawler job in parallel with several crawler instances using one queue. (Including adding/removing instances in runtime)

# Installation
```
npm install --save mongodb-simplecrawler-queue
```

# Usage 
All you need is connection configuration: url of the MongoDB instance
```js
const MongoDbQueue = require('mongodb-simplecrawler-queue').MongoDbQueue; // or import { MongoDbQueue } from 'mongodb-simplecrawler-queue';
const Crawler = require('simplecrawler');

const connectionConfig = {
  url:  'mongodb://localhost:27017',
  dbName: 'crawler',
  collectionName: 'queue',
};

const crawlerQueue = new MongoDbQueue(connectionConfig);

crawlerQueue.init(err => {
  if (err) {
    console.log(err);
    process.exit(0);
  }

  const crawler = new Crawler('https://en.wikipedia.org/wiki/Main_Page');
  crawler.maxDepth = 3;
  crawler.allowInitialDomainChange = false;
  crawler.filterByDomain = true;
  
  // here we are - tell crawler to use mongo as a queue
  crawler.queue = crawlerQueue;

  crawler.start();
});
```

## Monitoring and garbage collector
It is possible to schedule the queue to execute monitoring tasks or garbage collector tasks periodically using queue configuration:
```js
const connectionConfig = {
  url:  'mongodb://localhost:27017',
  dbName: 'crawler',
  collectionName: 'queue',
  // Garbage collector configuration. 
  GCConfig: { 
    run: true,
    msInterval: 1000 * 60 * 5,
  },
  // monitoring configuration
  monitorConfig: {
    run: true,
    statisticCollectionName: 'statistic',
    msInterval: 1000 * 60,
  },
};
```

### Garbage collector
Garbage collector is a task which will be executed periodically and find "old" items which have been spooled but not fetched. It could happen in 
case when crawler instance [started to process new item](https://github.com/simplecrawler/simplecrawler/blob/master/lib/crawler.js#L1735)
but job failed/process has been terminated etc. So you don't have "missing" items in the queue.

Garbage collector config object properties:

| Property name | Type | Comment |
|---|---|---|
| run | boolean | disable/enable GC |
| msInterval | number | Interval between Monitoring tasks in milliseconds. |

### Monitoring
Monitoring task is a task which will aggregate all statistic information about current queue state and put data in another collection
of the MongoDB instance

Monitoring config object properties:

| Property name | Type | Comment |
|---|---|---|
| run | boolean | disable/enable GC |
| statisticCollectionName | String | [default = 'statistic'] Collection name to put data. *Warning* Please don't use same collections names for queue and statistic! It will break crawler logic and crawler job will never finish. |

Current aggregation data:
Queue monitoring will add statistic data items into statistic Collection each `msInterval` milliseconds. So you can use this collection in runtime to see progress sof the job.
Example of the statistic item:
```js
{
    // Aggregation statistic from the queue items - see https://github.com/simplecrawler/simplecrawler#queue-statistics-and-reporting
    actualDataSizeAvg: 40641.18656716418,
    actualDataSizeMax: 203492,
    actualDataSizeMin: 179,
    contentLengthAvg: 40641.18656716418,
    contentLengthMax: 203492,
    contentLengthMin: 179,
    downloadTimeAvg: 3629.634328358209,
    downloadTimeMax: 19584,
    downloadTimeMin: 2,
    requestLatencyAvg: 34.93283582089552,
    requestLatencyMax: 265,
    requestLatencyMin: 22,
    requestTimeAvg: 3664.5671641791046,
    requestTimeMax: 19608,
    requestTimeMin: 25,
    
    // reduced count of elements grouped by QueueItem.status (see https://github.com/simplecrawler/simplecrawler#queue-items):
    queued: 37449,
    downloaded: 696,
    headers: 7,
    spooled: 2,
    downloadprevented: 1,
    timeout: 1,
    created: 1,
    failed: 1,
    notfound: 1,
    redirected: 1,
    pulled: 0,
  
    // general info - total count of items
    totalCount: 22952,
    // general info - count of items with property "fetched": true. Means items is fully processed
    fetchedCount: 134,
    // timestamp of the request
    timestamp: 1554661504815,
    // mongoDB id
    _id: "5caa418467fa3c00083b4b7a"
}
```

Note: if there are no elements with some QueueItem.status, this property will not be included in the statistic item.

**WARNING**: These GC and Monitoring tasks could be slowed down by parallel general crawler execution. For better performance, 
please use GC and Monitoring as separate utilities in separate process.

## Additional utilities
You can run GCTasks, Monitoring as *blocking* operations using Utils class and `runGC` and `runMonitoring` methods.

Also you can fully drop the queue using `dropQueue` method. Note: this method also cleans statistic collection.
// TODO examples

## Performance
// TODO tests and results, some graphics


## MongoDB as a docker image locally

Start mongo as a docker

```
docker run --name <IMAGE_NAME> -p 27017:27017 -d mongo:3.6.17-xenial
```

Connect to the running image
```
docker exec -it <IMAGE_NAME> bash
```
