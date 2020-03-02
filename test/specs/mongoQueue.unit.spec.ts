/* eslint-disable import/order,import/first */
/* eslint-env jest */
import 'jest-extended';
import { mockMongoClient, mockProperty } from '../utils';

const mocks = mockMongoClient();
const {
  clientConnectionMock,
  clientDbMock,
  clientCloseMock,
  dbCollectionMock,
  collectionDropMock,
} = mocks;
import { Db, MongoClient } from 'mongodb';
import { MongoDbQueue } from '../../src';

describe('Mongo Queue unit tests', () => {
  const testError = 'test error';
  let queue: MongoDbQueue;

  beforeEach(() => {
    queue = new MongoDbQueue({});
  });

  afterEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it('Should create MongoClient instance', async () => {
    expect(queue.client).toBeInstanceOf(MongoClient);
  });

  it('Should put default values if no config were provided', async () => {
    const expectedConfig = {
      GCConfig: {
        msInterval: 120000,
        run: false,
      },
      crawlerName: 'crawler',
      monitorConfig: {
        msInterval: 120000,
        run: false,
        statisticCollectionName: 'statistic',
      },
    };

    expect(queue.config).toStrictEqual(expectedConfig);
  });

  it('Should handle init connect error with callback', () => {
    clientConnectionMock.mockRejectedValue(new Error(testError));

    queue.init((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(testError);
    });
  });

  it('Should handle init connect error', async () => {
    clientConnectionMock.mockRejectedValue(new Error(testError));

    await expect(queue.init()).rejects.toThrowError(testError);
  });

  it('Should execute init function and create indexes', async () => {
    clientDbMock.mockReturnValue(new Db('db', {} as any));
    dbCollectionMock.mockImplementation(() => {
    });
    mockProperty(queue, 'collection', { createIndex: jest.fn() });
    const createIndexSpy = jest.spyOn(queue.collection, 'createIndex');

    await expect(queue.init()).resolves.toBeNull();
    expect(createIndexSpy).toBeCalledTimes(2);
  });

  it('Should handle close errors with callback', () => {
    clientCloseMock.mockRejectedValue(new Error(testError));

    queue.finalize((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(testError);
    });
  });

  it('Should handle close error', async () => {
    clientCloseMock.mockRejectedValue(new Error(testError));

    await expect(queue.finalize()).rejects.toThrowError(testError);
  });

  it('Should finalize properly', async () => {
    clientCloseMock.mockResolvedValue(null);

    await expect(queue.finalize()).resolves.toBeNull();
  });

  it('Should handle drop error with callback', () => {
    mockProperty(queue, 'collection', { drop: collectionDropMock });
    collectionDropMock.mockRejectedValue(new Error(testError));

    queue.drop((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(testError);
    });
  });

  it('Should handle drop error', async () => {
    mockProperty(queue, 'collection', { drop: collectionDropMock });
    collectionDropMock.mockRejectedValue(new Error(testError));

    await expect(queue.drop()).rejects.toThrowError(testError);
  });

  it('Should drop properly', async () => {
    mockProperty(queue, 'collection', { drop: collectionDropMock });
    collectionDropMock.mockResolvedValue(null);

    await expect(queue.drop()).resolves.toBeNull();
  });
});
