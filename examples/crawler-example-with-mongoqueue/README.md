Example of MongoDB mondule for simplecrawler project

## Locally

To run locally, run: `node src/init.js` - it will clean the queue and start monitoring and GC 
processes. Then run `node src/startcrawler.js` in another process - it will start crawler instance. 
You can run several `node src/startcrawler.js` and see how job is processed parallel using one queue. 

## Cloud Foundry

Use manifest.yml and CF-tasks to run crawler instances on CF:
```
git clone mongodb-simplecrawler-queue
cd mongodb-simplecrawler-queue

cf push -f examples/crawler-example-with-mongoqueue/manifest.yml

# this task will clean queue and start monitoring and GC tasks
cf run-task crawler "node examples/crawler-example-with-mongoqueue/src/init.js --name=monit -m=128M   

# this task will start crawler instance
cf run-task crawler "node examples/crawler-example-with-mongoqueue/src/startcrawler.js --name=crawler1 

# to run another parallel crawler instance, run
cf run-task crawler "node examples/crawler-example-with-mongoqueue/src/startcrawler.js --name=crawler2

```

Note: to run crawler on CF, you have to have MongoDB queue service named "mongoqueue" preinstalled. If 
you have service with another instance, please adapt "manifest.yml" accordingly.

## pm2
Use pm2 npm module and process.yml to run local cluster of Node.js apps

```
node src/dropqueue.js
pm2 start process.yml
```
