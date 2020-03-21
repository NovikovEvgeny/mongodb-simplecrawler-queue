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
import { Db, MongoClient, ObjectId } from 'mongodb';
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

  // update method
  it('should update element', async () => {
    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    const mockedQueueItem = { queue: 'item', _id: new ObjectId() };
    const mockedResponse = { ok: 1, value: mockedQueueItem };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const updates = { url: 'http://localhost', nested: { hello: { _id: new ObjectId() }, nestedPrimitive: 'world' } };
    // @ts-ignore
    await expect(queue.update(mockedQueueItem._id, updates)).resolves.toEqual(mockedQueueItem);

    const expectedSetRequest = {
      url: 'http://localhost',
      modificationTimestamp: mockedTimestamp,
      modifiedBy: queue.config.crawlerName,
      'nested.hello._id': updates.nested.hello._id,
      'nested.nestedPrimitive': updates.nested.nestedPrimitive,
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: mockedQueueItem._id },
      { $set: expectedSetRequest },
      { returnOriginal: false },
    );

    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should throw error if not found on update element', async () => {
    const mockedTimestamp = Date.now();
    const dateMock = jest.spyOn(global.Date, 'now').mockReturnValue(mockedTimestamp);

    const mockedQueueItem = { queue: 'item', _id: new ObjectId() };
    const mockedResponse = { ok: 1, value: undefined };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    const updates = { url: 'http://localhost', _id: new ObjectId() };

    // @ts-ignore
    await expect(queue.update(mockedQueueItem._id, updates))
      .rejects.toThrow('No queueItem found with that ID');

    const expectedSetRequest = {
      url: 'http://localhost',
      modificationTimestamp: mockedTimestamp,
      modifiedBy: queue.config.crawlerName,
      _id: updates._id,
    };
    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: mockedQueueItem._id },
      { $set: expectedSetRequest },
      { returnOriginal: false },
    );

    expect(dateMock).toHaveBeenCalled();
    dateMock.mockRestore();
  });

  it('should throw error if result is not OK on update', async () => {
    const mockedResponse = { ok: 0 };
    const findOneAndUpdateMock = jest.fn().mockResolvedValue(mockedResponse);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    // @ts-ignore
    await expect(queue.update(new ObjectId(), { url: 'http://localhost' }))
      .rejects.toThrow('didnt update');
  });

  it('should rethrow error on update', async () => {
    const findOneAndUpdateMock = jest.fn().mockRejectedValue(testError);
    mockProperty(queue, 'collection', { findOneAndUpdate: findOneAndUpdateMock });

    // @ts-ignore
    await expect(queue.update(new ObjectId(), { url: 'http://localhost' }))
      .rejects.toThrow(testError);
  });

  // countItems method
  it('should count items', async () => {
    const countMock = jest.fn().mockResolvedValue(5);
    const findMock = jest.fn().mockReturnValue({ count: countMock });
    mockProperty(queue, 'collection', { find: findMock });

    const comparator = {
      _id: '5e75decdb84007350c850a27',
      url: 'http://localhost:8080',
      nested: { hello: { _id: new ObjectId() } },
    };
    await expect(queue.countItems(comparator)).resolves.toEqual(5);

    const requestFilter = {
      _id: { $eq: new ObjectId('5e75decdb84007350c850a27') },
      url: { $eq: 'http://localhost:8080' },
      'nested.hello._id': { $eq: comparator.nested.hello._id },
    };
    expect(findMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should throw error on countItems if MongoDbId is invalid', async () => {
    const findMock = jest.fn();
    mockProperty(queue, 'collection', { find: findMock });

    const comparator = { _id: 'abc' };
    const errMsg = 'Argument passed in must be a single String of 12 bytes or a string of 24 hex characters';
    await expect(queue.countItems(comparator)).rejects.toThrow(errMsg);

    expect(findMock).not.toHaveBeenCalled();
  });

  it('should rethrow error on countItens from count', async () => {
    const countMock = jest.fn().mockRejectedValue(testError);
    const findMock = jest.fn().mockReturnValue({ count: countMock });
    mockProperty(queue, 'collection', { find: findMock });

    const comparator = { a: 'b' };
    await expect(queue.countItems(comparator)).rejects.toThrow(testError);

    expect(findMock).toHaveBeenCalledWith({ a: { $eq: 'b' } });
  });

  // filterItems method
  it('should filter items', async () => {
    const toArrayMock = jest.fn().mockResolvedValue([{ mocked: 'result' }]);
    const findMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    mockProperty(queue, 'collection', { find: findMock });

    const comparator = { _id: '5e75decdb84007350c850a27', url: 'http://localhost:8080', nested: { hello: 'world' } };
    await expect(queue.filterItems(comparator)).resolves.toEqual([{ mocked: 'result' }]);

    const requestFilter = {
      _id: { $eq: new ObjectId('5e75decdb84007350c850a27') },
      url: { $eq: 'http://localhost:8080' },
      'nested.hello': { $eq: 'world' },
    };
    expect(findMock).toHaveBeenCalledWith(requestFilter);
  });

  it('should throw error on filter items if MongoDbId is invalid', async () => {
    const findMock = jest.fn();
    mockProperty(queue, 'collection', { find: findMock });

    const comparator = { _id: 'abc' };
    const errMsg = 'Argument passed in must be a single String of 12 bytes or a string of 24 hex characters';
    await expect(queue.filterItems(comparator)).rejects.toThrow(errMsg);

    expect(findMock).not.toHaveBeenCalled();
  });

  it('should rethrow error on filter items from find', async () => {
    const toArrayMock = jest.fn().mockRejectedValue(testError);
    const findMock = jest.fn().mockReturnValue({ toArray: toArrayMock });
    mockProperty(queue, 'collection', { find: findMock });

    const comparator = { a: 'b' };
    await expect(queue.filterItems(comparator)).rejects.toThrow(testError);

    expect(findMock).toHaveBeenCalledWith({ a: { $eq: 'b' } });
  });

  // freeze method
  it('should return true on freeze', async () => {
    await expect(queue.freeze('filename.json')).resolves.toBeTrue();
  });

  // defrost method
  it('should return true on freeze', async () => {
    await expect(queue.defrost('filename.json')).resolves.toBeTrue();
  });
});
