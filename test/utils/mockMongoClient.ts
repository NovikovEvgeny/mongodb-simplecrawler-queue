// eslint-disable-next-line max-classes-per-file
import { MongoClientOptions } from 'mongodb';

export function mockMongoClient() {
  const clientConnectionMock = jest.fn().mockImplementation(() => ({ body: true }));
  const clientCloseMock = jest.fn().mockImplementation(() => ({ body: true }));
  const clientDbMock = jest.fn().mockImplementation(() => true);

  const dbCollectionMock = jest.fn().mockImplementation(() => ({ body: true }));

  const collectionCreateIndexMock = jest.fn().mockImplementation(() => true);
  const collectionDropMock = jest.fn().mockImplementation(() => true);
  const collectionFindMock = jest.fn().mockImplementation(() => true);
  const collectionFindOneMock = jest.fn().mockImplementation(() => true);
  const collectionFindOneAndUpdateMock = jest.fn().mockImplementation(() => true);
  const collectionAggregateMock = jest.fn().mockImplementation(() => true);
  const collectionCountDocumentsMock = jest.fn().mockImplementation(() => true);

  jest.mock('mongodb', () => ({
    MongoClient: class MockedMongoClient {
      url: string;

      opts: MongoClientOptions;

      // @ts-ignore
      private connect: jest.Mock;

      // @ts-ignore
      private db: jest.Mock;

      // @ts-ignore
      private close: jest.Mock;

      constructor(url: string, opts: MongoClientOptions) {
        this.url = url;
        this.opts = opts;
        this.connect = clientConnectionMock;
        this.db = clientDbMock;
        this.close = clientCloseMock;
      }
    },
    Db: class MockedMongoDb {
      name: string;

      // @ts-ignore
      private collection: jest.Mock;

      constructor(name: string) {
        this.name = name;
        this.collection = dbCollectionMock;
      }
    },
    Collection: class MockedMongoCollection {
      // @ts-ignore
      private createIndex: jest.Mock;

      // @ts-ignore
      private drop: jest.Mock;

      // @ts-ignore
      private aggregate: jest.Mock;

      // @ts-ignore
      private find: jest.Mock;

      // @ts-ignore
      private findOne: jest.Mock;

      // @ts-ignore
      private findOneAndUpdate: jest.Mock;

      // @ts-ignore
      private countDocuments: jest.Mock;

      constructor() {
        this.createIndex = collectionCreateIndexMock;
        this.drop = collectionDropMock;
        this.aggregate = collectionAggregateMock;
        this.find = collectionFindMock;
        this.findOne = collectionFindOneMock;
        this.findOneAndUpdate = collectionFindOneAndUpdateMock;
        this.countDocuments = collectionCountDocumentsMock;
      }
    },
  }));

  return {
    clientConnectionMock,
    clientDbMock,
    clientCloseMock,
    dbCollectionMock,
    collectionCreateIndexMock,
    collectionDropMock,
    collectionFindMock,
    collectionFindOneMock,
    collectionFindOneAndUpdateMock,
    collectionCountDocumentsMock,
  };
}
