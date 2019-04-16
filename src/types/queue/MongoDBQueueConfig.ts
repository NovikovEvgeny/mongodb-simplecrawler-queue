/**
 * MongoDB Queue configuration.
 */
export interface MongoDbQueueConfig {
  /**
   * Connection url
   */
  url: string;
  /**
   * Collection name
   */
  collectionName: string;
  /**
   * database name
   */
  dbName: string;

  /**
   * Garbage collector task configuration.
   */
  GCConfig: {
    /**
     * Indicates whether tun this task or not. Default: false
     */
    run: boolean;
    /**
     * Interval in milliseconds between tasks
     */
    msInterval?: number;
  };

  /**
   * Monitoring task configuration
   */
  monitorConfig: {
    /**
     * Indicates whether tun this task or not. Default: false
     */
    run: boolean,
    /**
     * Interval in milliseconds between tasks
     */
    msInterval?: number;
    /**
     * Collection name to store statistic data. Default: 'statistic'
     */
    statisticCollectionName?: string;
  };
}
