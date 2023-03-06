'use strict';
module.exports = {PRIV_getAppSvsUtil, context_values_get};
require("dotenv").config();


//
// Get the main object for accessing App Services utility functions.
//
function PRIV_getAppSvsUtil() {
  //
  // Main App Services utilities class.
  //
  class AppSvsUtil {
    //
    // Log the start timestamp.
    //
    // Typically only used when running this code in standalone Node.js (not in Atlas App Services)
    //
    logStartTimestamp() {
      console.log(`START: ${new Date()}`);
    }


    //
    // Log the result JSON to the console and also a log file cos it may be really larger, also
    // logging end timestamp.
    //
    // Typically only used when running this code in standalone Node.js (not in Atlas App Services)
    //
    logEndTimestampWithJSONResult(result) {
      result = result || "<empty-result>";
      const fs = require("fs");
      console.log(JSON.stringify(result, null, 2));
      const TESTING_OUPUT_FILE = "tmp/results.json";
      fs.writeFileSync(TESTING_OUPUT_FILE, JSON.stringify(result, null, 2));
      console.log(`Test output file is at: ${TESTING_OUPUT_FILE}`);
      console.log(`END: ${new Date()}`);
    }


    
    //
    // Indicate whether the current code is running inside the Atlas App Services runtime, rather
    // than standalone Node.js.
    //
    isRunningInAppSvcs() {
      return (typeof context !== "undefined");
    }


    //
    // Ensures there are request and response objects already present, and if not, creates placeholder
    // versions.
    //
    // Required in Atlas App Services when hitting "Run" in the Funcitons console for functions really
    // intended to be invoked by HTTPS Endpoints directly.
    //
    // Required in Standaloine Node.js to enable the same code to work outside of the App Services
    // server-side runtime - in this case usually the 'dummayParameters' is also provided with fake
    // GET/POST parameters for testing standalone.
    //
    ensureRequestResponseExist(request, response, defaultParameters = {}) {
      if (typeof request === 'string') {
        request = {param1: request};
      } else if (!request) {
        request = {};
      }

      request.body = request.body || {};

      if (!request.body.text) {
        request.body.text = () => JSON.stringify(defaultParameters, null, 2);
      }

      request.query = request.query || defaultParameters;

      if (!response) {
        response = {};
        response.setHeader = () => {};
        response.setBody = () => {};
        response.setStatusCode = () => {};
      }

      return {request, response};
    }


    //
    // Get handle on a DB collection (mechanism varies if running in App Servicies vs standalone)
    //
    getDBCollection(collname) {
      let client;

      if (this.isRunningInAppSvcs()) {
        client = context.services.get("mongodb-atlas"); 
      } else {
        const {MongoClient} = require("mongodb");
        client = new MongoClient(context_values_get("MONGODB_URL"));  
      }

      const dbName = context_values_get("DB_NAME");  
      const db = client.db(dbName);
      return db.collection(collname);
    }


    //
    // Log error, then if in dev mode throw error again so full root cause can be seen, otherwise
    // return generic error message
    //
    logErrorAndReturnGenericError(error, response=null) {
      console.error("Problem executing function");
      console.error(error);

      if (response) {
        response.setStatusCode(500);
      } else {
        throw error;
      }

      return ({msg: "Internal error"});
    }


    //
    // Using Atlas App Services API connect to the remote project capturing some key context variables
    //
    async bootsrapToAtlasAppServicesAppRuntime() {
      try {
        const baseAppSrvsUrl = "https://realm.mongodb.com/api/admin/v3.0";    
        const projPubKey = context_values_get("ATLAS_ADMIN_API_PROJECT_PUBLIC_KEY");
        const projPrvKey = context_values_get("ATLAS_ADMIN_API_PROJECT_PRIVATE_KEY");
        const loginResponse = await this.invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/auth/providers/mongodb-cloud/login`, "POST", null, {username: projPubKey, apiKey: projPrvKey});
        const accessToken = loginResponse.access_token;
        let projectId;
        let appId;

        if (this.isRunningInAppSvcs()) {
          // If running in App Services then can get required data from runtime 'context' object
          projectId = context.app.projectId;
          appId = context.app.id;
        } else {
          // If running in local Node.js use local env vars and get app id from association with app name
          projectId = context_values_get("PROJECT_ID");
          const appName = context_values_get("APP_NAME");
          const appsListResponse = await this.invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/groups/${projectId}/apps`, "GET", accessToken, null);
          appId = this.getValueFieldForFirstKeyOccurenceInArrayOfObjects(appsListResponse, "name", appName, "_id");
        }

        return {baseAppSrvsUrl, projectId, appId, accessToken};
      } catch (error) {
        return this.logErrorAndReturnGenericError(error);
      }
    }


    //
    // Get app id and client id if deployed otherwise use empty strings
    //
    async getDeployedAppMetadata() {
        let appId = "<none>";
        let id = "<none>";

        if (this.isRunningInAppSvcs()) {
          appId = context.app.clientAppId;
          id = context.app.id;
        }

        return {appId, id};
    }


    //
    // Find a matching object from an array of objects (where the given key and its value matches) then
    // return the value of a specifed property of the matching object
    //
    getValueFieldForFirstKeyOccurenceInArrayOfObjects(arrayOfObjects, matchKeyName, matchKeyValue, returnFieldName) {
      const foundObject = arrayOfObjects.find(obj => obj[matchKeyName] === matchKeyValue);
      return foundObject ? foundObject[returnFieldName] : null;
    }


    //
    // Call an App Services Admin REST HTTP API resource
    //
    async invokeAppSvcsAdminAPIResource(url, method, accessToken, jsonDataToSend) {
      const axios = require("axios").default;  
      let request = {
        url: url,
      }

      request.method = method;
      request.headers = {};
      request.headers["Accept"] = "application/json";

      if (accessToken) {
        request.headers["Authorization"] = `Bearer ${accessToken}`;
      }

      if (jsonDataToSend) {
        request.headers["Content-Type"] = "application/octet-stream";
        request.data = jsonDataToSend;
      } 
      
      let resourceObject = {};

      try {
        const response = await axios(request);
        resourceObject = response.data;
      } catch (error) {
        console.error(`Error invoking App Services Admin API resource: ${url}`);
        console.error(error);
        throw error;
      }

      return resourceObject;
    }


    //
    // Using the App Services Admin API invokve "enable virtual hosting" on this app services application
    // because can't do make this happen just in app json config
    //
    async enableAppVirtualHosting() {
      let {baseAppSrvsUrl, projectId, appId, accessToken} = await this.bootsrapToAtlasAppServicesAppRuntime();
      await this.invokeAppSvcsAdminAPIResource(`${baseAppSrvsUrl}/groups/${projectId}/apps/${appId}/hosting/config`, "PATCH", accessToken, {enabled: true});
      return ` Enabled virtual hosting for app `;
    }


    //
    // Using the App Services Admin API invokve "enable virtual hosting" on this app services
    // application because can't define this just in normal app services app json config
    //
    async getAppVirtualHostingURL() {
      try {
        let hostingUri = "";

        // If running in App Services then  get URL from runtime 'context' object, else can't do anything
        if (this.isRunningInAppSvcs()) {
          let numTries = 0;

          // Loop wait 2 secs each time between each try for CDN hosting and DNS to update (max total
          // time to spend trying is 1 minute)
          while (numTries < 30) {
            hostingUri = context.app.hostingUri;

            if (hostingUri) {
              break;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            numTries++;
          } 
        }

        return hostingUri ? ` App virtual hosting URL:  https://${hostingUri}/ ` : " <unknown> ";
      } catch (error) {
        return this.logErrorAndReturnGenericError(error);
      }
    }  
  }


  return new AppSvsUtil();
}


//
// Stand-in replacement for Atlas App Services "context.values.get()" (in the app services project
// the app services secret associated with a value will be used instead).
// Only used when running this code in standaline Node.js - redacted out when converted to Atlas
// App Services.
// 
function context_values_get(key) {
  const value = process.env[key];

  if ((!value) || (value.trim().length <= 0)) {
    throw `Unable to locate the key-value pair for '${key}' in the '.env' file in this project's root folder - ensure this file exists and contains the key-value pair`;
  }

  return value;
}
