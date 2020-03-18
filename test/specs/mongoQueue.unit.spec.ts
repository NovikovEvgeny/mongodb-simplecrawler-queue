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

  it('Should handle init connect error with callback', (done) => {
    clientConnectionMock.mockRejectedValue(new Error(testError));

    queue.init((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(testError);
      done();
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

  it('Should handle close errors with callback', (done) => {
    clientCloseMock.mockRejectedValue(new Error(testError));

    queue.finalize((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(testError);
      done();
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

  it('Should handle drop error with callback', (done) => {
    mockProperty(queue, 'collection', { drop: collectionDropMock });
    collectionDropMock.mockRejectedValue(new Error(testError));

    queue.drop((err: Error) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(testError);
      done();
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

  // exists method
  it('should return true on exists if item exists', async () => {
    const findOneMock = jest.fn().mockResolvedValue({ id: 'fakeId', url: 'fakeUrl' });
    mockProperty(queue, 'collection', { findOne: findOneMock });

    await expect(queue.exists('fakeUrl')).resolves.toBeTrue();
    expect(findOneMock).toHaveBeenCalled();
    expect(findOneMock).toHaveBeenCalledWith({ url: 'fakeUrl' });
  });

  it('should return false on exists if item does not exist', async () => {
    const findOneMock = jest.fn().mockResolvedValue(null);
    mockProperty(queue, 'collection', { findOne: findOneMock });

    await expect(queue.exists('fakeUrl')).resolves.toBeFalse();
    expect(findOneMock).toHaveBeenCalled();
    expect(findOneMock).toHaveBeenCalledWith({ url: 'fakeUrl' });
  });

  it('should re-throw error on exists', async () => {
    const findOneMock = jest.fn().mockRejectedValue(testError);
    mockProperty(queue, 'collection', { findOne: findOneMock });

    await expect(queue.exists('fakeUrl')).rejects.toThrow(testError);
    expect(findOneMock).toHaveBeenCalled();
    expect(findOneMock).toHaveBeenCalledWith({ url: 'fakeUrl' });
  });

  // get method
  it('should return queueItem on get', async () => {
    const queueItem = { _id: '1', url: 'http://test.com' };
    const findOneMock = jest.fn().mockResolvedValue(queueItem);
    mockProperty(queue, 'collection', { findOne: findOneMock });

    await expect(queue.get(5)).resolves.toEqual({
      ...queueItem,
      id: queueItem._id,
    });
    expect(findOneMock).toHaveBeenCalled();
    expect(findOneMock).toHaveBeenCalledWith({}, { skip: 5, limit: 6 });
  });

  it('should throw out of range on get if number is too big', async () => {
    const findOneMock = jest.fn().mockResolvedValue(null);
    mockProperty(queue, 'collection', { findOne: findOneMock });

    await expect(queue.get(5)).rejects.toThrow('out of range');
    expect(findOneMock).toHaveBeenCalled();
    expect(findOneMock).toHaveBeenCalledWith({}, { skip: 5, limit: 6 });
  });

  it('should re-throw on get', async () => {
    const findOneMock = jest.fn().mockRejectedValue(testError);
    mockProperty(queue, 'collection', { findOne: findOneMock });

    await expect(queue.get(5)).rejects.toThrow(testError);
  });

  // getLength method
  it('should return length of queue', async () => {
    const countDocumentsMock = jest.fn().mockResolvedValue(5);
    mockProperty(queue, 'collection', { countDocuments: countDocumentsMock });

    await expect(queue.getLength()).resolves.toEqual(5);
    expect(countDocumentsMock).toHaveBeenCalled();
    expect(countDocumentsMock).toHaveBeenCalledWith({});
  });

  it('should rethrow error from countDocuments', async () => {
    const countDocumentsMock = jest.fn().mockRejectedValue(testError);
    mockProperty(queue, 'collection', { countDocuments: countDocumentsMock });

    await expect(queue.getLength()).rejects.toThrow(testError);
    expect(countDocumentsMock).toHaveBeenCalled();
    expect(countDocumentsMock).toHaveBeenCalledWith({});
  });

  // freeze method
  it('should return true on freeze', async () => {
    await expect(queue.freeze('a')).resolves.toBeTrue();
  });

  // defrost method
  it('should return true on freeze', async () => {
    await expect(queue.defrost('a')).resolves.toBeTrue();
  });
});
