# open-ID-provider-sample
This is an example for a openid-connect provider. It support many type of flow. Its setting is dynamic config for client. Follow my direction to test it
## Run the provider
### Clone reposity
```
git clone http://18.179.147.115:3000/genki-system-all/open-ID-Provider-example.git
```
### Install modules
```
npm install
```
### Excute the Provider
```
node index.js
```
## Test how it work
This  [here](http://18.179.147.115:3000/genki-system-all/OpenID-Client-Example)
## What I've learnt
You can see my comments in the code. I will say more details here.
### What is Provider
In a simple way, who provide the OpenID service is called Provider (ex: Facebook, Twitter, Google,...). ***oidc-provider*** library provide us a simple way to create a Provider by ourself.