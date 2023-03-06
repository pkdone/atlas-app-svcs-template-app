'use strict';
require("dotenv").config();
const {PRIV_getAppSvsUtil} = require("./app-svcs-util");


// TEST WRAPPER  (similar to App Services' function test console, but for standalone Node.js)
(async() => {
  const appSvsUtil = PRIV_getAppSvsUtil();
  appSvsUtil.logStartTimestamp();
  const result = await PUB_getDeployedAppMetadata();
  //const result = await PUB_enableAppVirtualHosting();
  //const result = await PUB_getAppVirtualHostingURL();
  appSvsUtil.logEndTimestampWithJSONResult(result);
})();


//
// Get app id and client id if deployed otherwise use empty strings
//
async function PUB_getDeployedAppMetadata() {
  const appSvsUtil = PRIV_getAppSvsUtil();
  return appSvsUtil.getDeployedAppMetadata();
}


//
// Using the App Services Admin API invokve "enable virtual hosting" on this app services application
// because can't do make this happen just in app json config
//
async function PUB_enableAppVirtualHosting() {
  const appSvsUtil = PRIV_getAppSvsUtil();
  return appSvsUtil.enableAppVirtualHosting();
}


//
// Using the App Services Admin API invokve "enable virtual hosting" on this app services
// application because can't do make this happen just in app json config
//
async function PUB_getAppVirtualHostingURL() {
  const appSvsUtil = PRIV_getAppSvsUtil();
  return appSvsUtil.getAppVirtualHostingURL();
}
