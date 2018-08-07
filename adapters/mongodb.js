const { MongoClient } = require('mongodb'); // eslint-disable-line import/no-unresolved
const { snakeCase } = require('lodash');

let DB;

const grantable = new Set([
  'access_token',
  'authorization_code',
  'refresh_token',
  'device_code',
]);

class CollectionSet extends Set {
  add(name) {                                                                                   // add/create collections
    const nu = this.has(name);
    super.add(name);
    if (!nu) {
      DB.collection(name).createIndexes([
        ...( grantable.has(name)?
          [{
            key: { grantId: 1 },
            partialFilterExpression: { grantId: { $exists: true } },
          }] : []),
        ...( name === 'device_code'
          ? [{
            key: { userCode: 1 },
            partialFilterExpression: { userCode: { $exists: true } },
          }] : []),
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      ]).catch(console.error); // eslint-disable-line no-console
    }
  }
}

const collections = new CollectionSet();

class MongoAdapter {
  constructor(name) {
    this.name = snakeCase(name);
    collections.add(this.name);
  }

upsert(_id, payload, expiresIn) {                                                               // update clients/codes in database
    let expiresAt;

    if (expiresIn) {
      expiresAt = new Date(Date.now() + (expiresIn * 1000));
    }

    // HEROKU EXAMPLE ONLY, do not use the following block unless you want to drop dynamic
    //   registrations 24 hours after registration
    if (this.name === 'client') {
      expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
    }
    
    // console.log('------------------------Upserting-----------------')
    // console.log('\x1b[36m%s\x1b[0m',this.name)
    // console.log(payload)
    // console.log('\x1b[36m%s\x1b[0m','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    return this.coll().updateOne({ _id }, {
      $set: {
        _id,
        ...payload,
        ...(expiresAt ? { expiresAt } : undefined),
      },
    }, { upsert: true });
  }

  find(_id) {
    return this.coll().find({ _id }).limit(1).next();
  }

  findByUserCode(userCode) {
    return this.coll().find({ userCode }).limit(1).next();
  }

  destroy(_id) {                                                                                //Destroy codes/tokens
    return this.coll().findOneAndDelete({ _id })
      .then((found) => {
        // console.log('----Destroy',this.name)
        // console.log(_id)
        if (found.value && found.value.grantId) {
          const promises = [];
          collections.forEach((name) => {
            if (grantable.has(name)) {
              promises.push(this.coll(name).deleteMany({ grantId: found.value.grantId }));
            }
          });

          return Promise.all(promises);
        }
        return undefined;
      });
  }

  consume(_id) {                                                                                // update consumed time
    return this.coll().findOneAndUpdate({ _id }, { $currentDate: { consumed: true } });
  }

  coll(name) {                                                                                  // transmit collection's name to coll() static function
    return this.constructor.coll(name || this.name);
  }

  static coll(name) {                                                                           // connect to collection
    return DB.collection(name);
  }

  static async connect() {                                                                      // connect to MongoDB database
    const connection = await MongoClient.connect("mongodb://localhost:27017/", {
      useNewUrlParser: true,
    });
    DB = connection.db("oidc-provider");
  }
}

module.exports = MongoAdapter;