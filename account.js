//------------------------------Modules-----------------------------
const MongoClient = require('mongodb').MongoClient;

//------------------------------Constant----------------------------
const dbUri = 'mongodb://localhost:27017/';
const dbName = 'accounts';
const collName = 'bnbp';
const store = new Map();
const logins = new Map();
const emails = new Set();
const uuid = require('uuid/v4');
//------------------------------Main--------------------------------

class Account {
  constructor(id) {
    this.accountId = id;
    store.set(this.accountId, this);
  }

  /**
   * @param use - can either be "id_token" or "userinfo", depending on
   *   where the specific claims are intended to be put in.
   * @param scope - the intended scope, while oidc-provider will mask
   *   claims depending on the scope automatically you might want to skip
   *   loading some claims from external resources etc. based on this detail
   *   or not return them in id tokens but only userinfo and so on.
   */
  async claims(use, scope) { // eslint-disable-line no-unused-vars
    var ret = {
      sub : this.accountId
    };
    let connection = await MongoClient.connect(dbUri, {useNewUrlParser: true});
    let DB = await connection.db(dbName);
    let query = { sub: this.accountId };
    await DB.collection(collName).find(query).toArray()
    .then((result)=>{
      result[0] ? ret = result[0]:null
    }).catch((err) => {
      throw err;
    })
    return ret
  }

  static findByLogin(login) {
    if (logins.get(login)) {
      return Promise.resolve(logins.get(login));
    }
  }

  static async register(info) {
    let connection = await MongoClient.connect(dbUri, {useNewUrlParser: true});
    let DB = await connection.db(dbName);
    if (logins.get(info.sub) || emails.has(info.email)) {
      return {
        sub  : logins.get(info.sub) ? true : false,
        email     : emails.has(info.email) ? true : false
      }
    } else {
      await DB.collection(collName).insertOne(info)
      .then((result)=>{
        console.log('A new user registered')
        logins.set(login, new Account(sub));
      }).catch((err) => {
        throw err;
      })
    }
  }

  static async findById(ctx, id, token) {
    // token is a reference to the token used for which a given account is being loaded,
    // it is undefined in scenarios where account claims are returned from authorization endpoint
    // ctx is the koa request context
    if (!store.get(id)){
      new Account(id); // eslint-disable-line no-new
    } 
    // console.log(store)
    return store.get(id);
  }
}

//Connect DB
MongoClient.connect(dbUri, { useNewUrlParser: true },
(err, db) => {
  if (err) throw err;
  let connection = db.db(dbName)
  connection.collection(collName).find({}).toArray( (err, result) => {
      if (err) throw err;
      for (let i in result) {
        logins.set(result[i].sub, new Account(result[i].sub));
        emails.add(result[i].email)
      }
      db.close();
  });
});

module.exports = Account;
