//------------------------------Modules-----------------------------
  //
var events = require('events');
var eventEmitter = new events.EventEmitter();
const crypto = require('crypto');
const path = require('path');
const querystring = require('querystring');
const { set } = require('lodash');
  // Koa framework
const Koa = require('koa');
const bodyParser = require('koa-body');
const Router = require('koa-router');
const render = require('koa-ejs');
const helmet = require('koa-helmet');
const session = require('koa-session')
  // Oidc Provider
const Provider = require('oidc-provider');
const Account = require('./account');                                           //User's account
const { issuer, config, certificates } = require('./settings');                //get settings of 3 property
// const { renderError } = require('../lib/helpers/defaults'); // make your own, you'll need it anyway
const { errors: { SessionNotFound } } = Provider;
config.findById = Account.findById;

//------------------------------Constant----------------------------
const app = new Koa();
const port = process.env.PORT || 3000;                                          //define PORT
const provider = new Provider(issuer, config);                                  //define PROVIDER
const router = new Router();
const body = bodyParser();
provider.defaultHttpOptions = { timeout: 15000 };                               //define HTTP options
const SESSION_KEY = 'op:sess';

//------------------------------Implement--------------------------------
eventEmitter.on('interaction.started', (detail, ctx) => {
  console.log(detail,ctx)
});

provider.use(helmet());                                                         //secure HEADER
provider.initialize({                                                           //initiate provider
  adapter: require('./adapters/mongodb'),                                       //import client database
  // clients,                                                                   //import all clients manually
  keystore: { keys: certificates },                                             //import certificates
})
.then(() => {
  app.keys = ['some secret hurr'];
  app.use(session({
    key: SESSION_KEY,
    store: {
      get(key) {
        return LRU.get(key);
      },
      set(key, sess, maxAge) {
        LRU.set(key, sess, maxAge);
      },
      destroy(key) {
        LRU.del(key);resizeBy
      },
    },
  },app));
  app.use((ctx, next) => {
    ctx.session.save(); // save this session no matter whether it is populated
    return next();
  });

  render(provider.app, {                                                        //render UI's layout
    cache: false,
    layout: '_layout',
    root: path.join(__dirname, 'views'),
  });

  if (process.env.NODE_ENV === 'production') {
    provider.proxy = true;
    set(config, 'cookies.short.secure', true);
    set(config, 'cookies.long.secure', true);

    provider.use(async (ctx, next) => {
      if (ctx.secure) {
        await next();
      } else if (ctx.method === 'GET' || ctx.method === 'HEAD') {
        ctx.redirect(ctx.href.replace(/^http:\/\//i, 'https://'));
      } else {
        ctx.body = {
          error: 'invalid_request',
          error_description: 'do yourself a favor and only use https',
        };
        ctx.status = 400;
      }
    });
  }

  router.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof SessionNotFound) {                                       //Provider's session error
        ctx.status = err.status; 
        const { message: error, error_description } = err;
        // renderError(ctx, { error, error_description }, err);
      } else {                                                                    //Framework error
        throw err;
      }
    }
  });

  router.get('/', async (ctx, next) => {                        //interaction to login request
    ctx.res('dsadsa')
    await next();
  });

  router.get('/interaction/:grant', async (ctx, next) => {                        //interaction to login request
    const details = await provider.interactionDetails(ctx.req);
    const client = await provider.Client.find(details.params.client_id);
    if (details.interaction.error === 'login_required') {                         //require login
      await ctx.render('login', {
        client,
        details,
        title: 'Sign-in',
      });
    } else {                                                                      //logged-in
      await ctx.render('interaction', {                                             
        client,
        details,
        title: 'Authorize',
      });
    }

    await next();
  });

  router.get('/register', async (ctx, next) => {                                    //request register page
    let client = {},
        details= 
    await ctx.render('register', {        
      client  : {},
      details : {uuid : crypto.randomBytes(16).toString('hex'),},
      // info  : false,
      title: 'Register',
    });
    await next();
  });

  router.post('/register/*', body, async (ctx, next) => {                           //user's register
    const register = await Account.register(ctx.request.body);
    await ctx.render('register', {        
      client  : {},
      details : {},
      register,
      title: 'Register',
    });
    await next();
  });

  router.post('/interaction/:grant/confirm', body, async (ctx, next) => {           //authorize
    const result = { consent: {} };
    await provider.interactionFinished(ctx.req, ctx.res, result);
    await next();
  });

  router.post('/interaction/:grant/login', body, async (ctx, next) => {             //post login
    const account = await Account.findByLogin(ctx.request.body.login);              //find by login params
    if (account){
      const result = {                                                                //create result from return of finding function
        login: {
          account: account.accountId,
          acr: 'urn:mace:incommon:iap:bronze',
          amr: ['pwd'],
          remember: !!ctx.request.body.remember,
          ts: Math.floor(Date.now() / 1000),
        },
        consent: {},
      };
      await provider.interactionFinished(ctx.req, ctx.res, result);                   //
    } else {
      ctx.redirect('/interaction/'+ ctx.url.split('/')[2])
    }
    await next();
  });
  
  provider.use(router.routes());
})
.then(() => provider.listen(port))
.catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

/* Example GET:
http://localhost:3000/auth?client_id=hieuhien3012&client_secret=692103&scope=openid%20profile%20email%20address%20phone%20offline_access&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fcb&
*/