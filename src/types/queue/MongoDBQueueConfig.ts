export interface MongoDbQueueConfig {
  url: string;
  collectionName: string;
  dbName: string;

  GCConfig: {
    run: boolean;
    msInterval?: number;
  };

  monitorConfig: {
    run: boolean,
    msInterval?: number;
    statisticCollectionName?: string;
  };
}